import { t, type NormalizedKB } from "@mydogcanfly/knowledge";
import type { FinderRequest, DecisionReport, PartnerRef } from "./contracts";

/**
 * Contextual partner selection (recommendation-first, ADR-0009 spirit).
 * A partner is attached ONLY when a real signal in the report justifies it — never a generic ad.
 * Business logic lives here (engine), never in the UI.
 */
const VERTICAL_PRIORITY = ["insurance", "equipment", "hotel", "airport_transfer", "car_rental", "veterinary"];
const MAX_PARTNERS = 4;

export function selectPartners(kb: NormalizedKB, req: FinderRequest, report: DecisionReport, locale: string): PartnerRef[] {
  const destAirport = kb.airports.get(req.destination);
  const destCountry = destAirport ? kb.countries.get(destAirport.country_id) : undefined;
  const iso = destCountry?.iso2;
  const city = destAirport?.city ?? "";
  const airport = destAirport?.iata ?? "";

  const feasible = report.verdict !== "incompatible";
  const hasImportReqs = report.conditions.length > 0;
  /* La recommandation doit suivre le MODE RÉELLEMENT RETENU. Auparavant, soute et fret
     déclenchaient la même phrase (« le voyage en soute exige une caisse IATA ») : sur un trajet
     annoncé « fret uniquement », on envoyait donc le voyageur préparer une soute accompagnée —
     ni le même produit, ni la même procédure, ni le même interlocuteur. La soute prime quand elle
     existe (c'est aussi l'ordre du verdict : cabine > soute > fret) ; à défaut, le texte fret. */
  const holdMode = report.compatible.some((c) => c.placement === "hold") || req.placement === "hold";
  const cargoMode = report.compatible.some((c) => c.placement === "cargo") || req.placement === "cargo";
  const crateReason = holdMode
    ? t(locale, "partner.equipment.reason")
    : cargoMode
      ? t(locale, "partner.equipment.reason_cargo")
      : undefined;

  // A vertical is offered only when its triggering signal is present; the value carries the reason.
  const reasons: Record<string, string | undefined> = {
    insurance: hasImportReqs ? t(locale, "partner.insurance.reason") : undefined,
    equipment: crateReason,
    hotel: feasible && city ? t(locale, "partner.hotel.reason").replace("{city}", city) : undefined,
    airport_transfer: feasible && airport ? t(locale, "partner.transfer.reason").replace("{airport}", airport) : undefined,
    car_rental: feasible && city ? t(locale, "partner.car.reason").replace("{city}", city) : undefined,
    veterinary: hasImportReqs ? t(locale, "partner.vet.reason") : undefined,
  };

  const out: PartnerRef[] = [];
  for (const vertical of VERTICAL_PRIORITY) {
    const reason = reasons[vertical];
    if (!reason) continue;
    // pick a partner in this vertical serving the destination (empty countries = global; skip rejected)
    const p = [...kb.partners.values()].find(
      (x) => x.vertical === vertical && x.status !== "rejected" &&
        (x.countries.length === 0 || (iso ? x.countries.includes(iso) : false)),
    );
    if (!p) continue;
    // SAFEGUARD (business priority): a monetizable/sponsored outbound link is emitted ONLY for an
    // active partner with a tracking URL. Otherwise the suggestion is text-only — we never send
    // qualified traffic to a partner's site for free.
    const monetizable = p.status === "active" && !!p.tracking_url;
    out.push({
      partner_id: p.id, vertical: p.vertical, name: p.name,
      url: monetizable ? p.tracking_url! : "",
      sponsored: monetizable, reason,
    });
    if (out.length >= MAX_PARTNERS) break;
  }
  return out;
}
