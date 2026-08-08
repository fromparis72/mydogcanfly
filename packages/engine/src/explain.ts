import { t } from "@mydogcanfly/knowledge";
import type { Decision, DecisionReport, ReportItem, AirlineResult } from "./contracts";

const CRIT_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
/** Temperature above which seasonal heat embargoes suspend hold/cargo (matches the summer_embargo rules). */
const HEAT_EMBARGO_THRESHOLD_C = 30;

/** Join a list with a localized final conjunction: "a, b and c" / "a, b et c".
    L'espagnol et le portugais écrivaient « and » : la liste des modes de transport, puis celle des
    motifs de refus, sortaient en anglais au milieu d'une phrase traduite. */
const AND: Record<string, string> = { fr: "et", es: "y", pt: "e" };
function joinList(arr: string[], locale: string): string {
  if (arr.length <= 1) return arr[0] ?? "";
  return `${arr.slice(0, -1).join(", ")} ${AND[locale] ?? "and"} ${arr[arr.length - 1]}`;
}

/** Published fees are stored as-is (English). French display strings for the ones that contain words. */
const FEE_FR: Record<string, string> = {
  "€70 (within France) to €200 (US/Canada–Europe)": "€70 (en France) à €200 (États-Unis/Canada–Europe)",
  "€100 to €600": "€100 à €600",
  "€70 to €500 per one-way flight": "€70 à €500 par vol aller simple",
  "€70 to €500": "€70 à €500",
  "via IAG Cargo (quote)": "via IAG Cargo (sur devis)",
  "$150 (US/Canada/PR/USVI) or $200 international, for tickets issued on/after 8 Apr 2025": "$150 (États-Unis/Canada/Porto Rico) ou $200 à l'international, pour les billets émis à partir du 8 avril 2025",
  "via Delta Cargo (quote)": "via Delta Cargo (sur devis)",
  "$150 each way": "$150 par trajet",
  "via PetSafe cargo (quote)": "via le fret PetSafe (sur devis)",
  "$150 per carrier": "$150 par contenant",
  "via cargo (quote)": "via fret (sur devis)",
  "CA/US $50–$60 one-way (higher international)": "CA/US $50–$60 aller simple (plus élevé à l'international)",
  "CA/US $105–$126 (Canada/US); $270–$324 international": "CA/US $105–$126 (Canada/États-Unis) ; $270–$324 à l'international",
  "from €40/$50 (Spain) to €180/$215 (America/Asia) per segment": "de €40/$50 (Espagne) à €180/$215 (Amérique/Asie) par segment",
  "via Etihad Cargo (quote)": "via Etihad Cargo (sur devis)",
  "from €60": "à partir de €60",
  "excess-baggage rate": "tarif d'excédent de bagages",
  "via Copa Pets cargo (quote)": "via le fret Copa Pets (sur devis)",
  "via Virgin Atlantic Cargo (quote)": "via Virgin Atlantic Cargo (sur devis)",
  "via Qantas Freight (quote on request)": "via Qantas Freight (devis sur demande)",
  "via American PetEmbark (quote)": "via American PetEmbark (sur devis)",
  "via Cathay Cargo (quote)": "via Cathay Cargo (sur devis)",
};
/** Localize a published fee string for display (FR only; falls back to a safe "to"→"à" for plain ranges). */
function localizeFee(fee: string, locale: string): string {
  if (locale !== "fr") return fee;
  return FEE_FR[fee] ?? fee.replace(/ to /g, " à ");
}

/**
 * Explanation Engine (ADR-0013): turns a raw Decision into the Decision Report.
 * Structure: headline verdict + score, country requirements ("before departure"),
 * and an airline-by-airline comparison (direct flights first).
 */
export function explain(decision: Decision, locale = "en"): DecisionReport {
  const conditions: ReportItem[] = [];
  const sources = new Map<string, { url: string }>();
  const confidences: number[] = [];
  const L = (key: string) => t(locale, key);

  // Country entry requirements → "before departure" conditions.
  // The rationale prose already lists the required documents, so we do NOT append a redundant "Required: …".
  for (const f of decision.countryRequirements) {
    conditions.push({
      text: f.rationale,
      criticality: f.criticality, rule_id: f.rule_id, source_url: f.source_url,
    });
    sources.set(f.source_url, { url: f.source_url });
    confidences.push(f.confidence);
  }
  conditions.sort((x, y) => CRIT_ORDER[x.criticality] - CRIT_ORDER[y.criticality]);

  // Airline-by-airline comparison for this dog + route.
  const has = (a: Decision["airlines"][number], pl: string) => a.placements.find((p) => p.placement === pl)?.allowed ?? false;
  const airlines: AirlineResult[] = decision.airlines.map((a) => {
    const cabin = has(a, "cabin"), hold = has(a, "hold"), cargo = has(a, "cargo");
    /* Refus : on dit ce que les règles ont dit, pas ce qu'on en devine.
       - la compagnie ne transporte aucun animal (chien neutre refusé partout) → « animaux refusés » ;
       - des motifs ont été lus sur les règles → on les nomme (poids, race, soute non proposée…) ;
       - aucun motif exploitable → libellé neutre. Jamais « race non acceptée » par défaut : c'était
         faux pour Delta, JetBlue et Brussels Airlines, qui refusent un golden de 30 kg sur son poids. */
    const reasons = a.deny_reasons ?? [];
    const notAccepted = !a.carries_pets
      ? L("air.no_pets")
      : reasons.length
        ? L("air.not_accepted_because").replace("{reasons}", joinList(reasons.map((c) => L(`air.reason.${c}`)), locale))
        : L("air.not_accepted");
    const label = cabin ? L("air.cabin_ok") : hold ? L("air.hold_only") : cargo ? L("air.cargo_only") : notAccepted;
    /* Fret : un montant n'est affiché que s'il est publié POUR LE FRET. Sinon « sur devis » — un
       envoi fret se chiffre chez le transitaire, et laisser croire à un tarif serait une invention. */
    const cargoOnly = !cabin && !hold && cargo;
    const feeShown = a.fee ? localizeFee(a.fee, locale) : undefined;
    const fee_quote_only = cargoOnly && !feeShown;
    // Heat embargo: a seasonal (temperature-driven) rule suspended this airline's hold/cargo for the given date.
    const heat_embargo = a.fired.some((f) => f.category === "summer_embargo");
    // National-carrier ranking (no price/distance data): flag carrier of the departure country, then destination.
    const carrier_of_origin = !!a.country_id && a.country_id === decision.origin_country_id;
    const carrier_of_destination = !!a.country_id && a.country_id === decision.destination.country_id;
    if (a.source_url) sources.set(a.source_url, { url: a.source_url });
    return { airline_id: a.airline_id, name: a.airline_name, direct: a.direct, itinerary_confidence: a.itinerary_confidence, deny_reasons: (cabin || hold || cargo) ? undefined : reasons, connect_airport_id: a.connect_airport_id, detour_km: a.detour_km, cabin, hold, cargo, carries_pets: a.carries_pets, label, fee: fee_quote_only ? L("air.fee_cargo_quote") : feeShown, fee_quote_only, source_url: a.source_url, heat_embargo, carrier_of_origin, carrier_of_destination, origin_airport_id: a.origin_airport_id, destination_airport_id: a.destination_airport_id };
  }).sort((x, y) =>
    // 0) airlines that carry pets first, "no pets" always last — EXCEPT when the only blocker is a
    //    seasonal heat embargo (temporary), which stays in the top group.
    // 1) direct flights before connections, 2) acceptance quality — cabin, then accompanied hold (soute), so a
    //    direct flight offering soute outranks a direct fret/cargo-only one, 3) national carrier (departure, then
    //    destination) breaks ties between equal-quality airlines, then shortest detour, then name.
    (Number(y.cabin || y.hold || y.cargo || y.heat_embargo) - Number(x.cabin || x.hold || x.cargo || x.heat_embargo)) ||
    Number(y.direct) - Number(x.direct) ||
    // 1 bis) une correspondance dont les deux segments sont attestés passe devant une correspondance
    //        seulement déduite d'une géométrie de hub : l'établi avant le plausible.
    Number(x.itinerary_confidence === "connection_unverified") - Number(y.itinerary_confidence === "connection_unverified") ||
    Number(y.cabin) - Number(x.cabin) ||
    Number(y.hold) - Number(x.hold) ||
    Number(y.carrier_of_origin) - Number(x.carrier_of_origin) ||
    Number(y.carrier_of_destination) - Number(x.carrier_of_destination) ||
    // Among otherwise-equal connections, the shortest detour first (via a nearer hub).
    (x.detour_km ?? 0) - (y.detour_km ?? 0) ||
    x.name.localeCompare(y.name),
  );

  // Verdict is driven by the requested placement; "any" = any placement works.
  const reqP = decision.request.placement;
  const okFor = (a: AirlineResult) => reqP === "any" ? (a.cabin || a.hold || a.cargo)
    : reqP === "cabin" ? a.cabin : reqP === "hold" ? a.hold : a.cargo;
  const acceptCount = airlines.filter(okFor).length;
  const anyCompatible = acceptCount > 0;
  const compatible = airlines.filter(okFor).map((a) => ({ airline_id: a.airline_id, placement: reqP === "any" ? (a.cabin ? "cabin" : a.hold ? "hold" : "cargo") : reqP }));

  const verdict: DecisionReport["verdict"] =
    !anyCompatible ? "incompatible" : conditions.length > 0 ? "conditional" : "compatible";

  let score: number;
  if (!anyCompatible) {
    score = 20;
  } else {
    const base = verdict === "compatible" ? 96 : 88;
    score = Math.max(55, Math.min(100, base - conditions.length * 3 - (acceptCount < 3 ? 6 : 0)));
  }

  const positives: ReportItem[] = [];
  // Most important for the visitor: HOW the dog can travel on this route, as a tendency.
  // Cabin available → green, positive wording. Cabin NOT available (but hold/cargo are) →
  // red, negative wording: cabin isn't possible, hold/cargo remain.
  // Route-level availability, independent of the requested placement, so the tendency shows
  // even when the requested mode (e.g. cabin) is impossible.
  {
    const anyCabin = airlines.some((a) => a.cabin);
    const anyHold = airlines.some((a) => a.hold);
    const anyCargo = airlines.some((a) => a.cargo);
    if (anyCabin) {
      const modes = [L("mode.cabin"), ...(anyHold ? [L("mode.hold")] : []), ...(anyCargo ? [L("mode.cargo")] : [])];
      positives.push({ text: L("why.transport_modes").replace("{modes}", joinList(modes, locale)), criticality: "low", tone: "positive" });
    } else if (decision.brachycephalic) {
      // Snub-nosed dog with no cabin option: hold/cargo are ruled out for the breed — don't offer them.
      positives.push({ text: L("why.no_cabin_brachy"), criticality: "high", tone: "negative" });
    } else if (anyHold || anyCargo) {
      // Cabin impossible but hold/cargo remain — highlight it in red, then point to the options.
      //
      // NE PAS ÉCRIRE « la cabine n'est pas possible sur ce trajet ». `anyCabin` est calculé POUR
      // CE CHIEN : un 32 kg échoue chez toutes les compagnies parce qu'il dépasse leur limite de
      // poids, pas parce que la liaison refuserait la cabine. Air France prend un chien en cabine
      // jusqu'à 8 kg sur le transatlantique. La formulation précédente attribuait la cause à la
      // route, ce qui faisait renoncer à tort le propriétaire d'un petit chien.
      // La phrase actuelle — « aucune compagnie de ce trajet ne prend TON chien en cabine » — dit
      // le fait constaté sans en inventer la cause. Pour nommer la vraie cause (poids, race,
      // absence d'offre), il faudrait remonter la limite de poids cabine de chaque compagnie
      // jusqu'ici ; `AirlineResult` ne porte aujourd'hui qu'un booléen.
      const rest = [...(anyHold ? [L("mode_n.hold")] : []), ...(anyCargo ? [L("mode_n.cargo")] : [])];
      positives.push({ text: L("why.no_cabin").replace("{modes}", joinList(rest, locale)), criticality: "high", tone: "negative" });
    }
  }
  if (decision.destination.entry_allowed) {
    positives.push({ text: L("why.country_allows").replace("{country}", decision.destination.country_name), criticality: "low" });
  }
  positives.push({ text: decision.countryRequirements.length ? L("why.docs_known") : L("why.no_docs"), criticality: "low" });

  const confidence = confidences.length ? Math.round(confidences.reduce((a, b) => a + b, 0) / confidences.length) : 4;

  // Seasonal temperature context, surfaced only when the user gave a date/temperature (so the filter is visible).
  const climate = decision.climate.provided
    ? {
        temperature_c: decision.climate.temperature_c,
        estimated: decision.climate.estimated,
        embargo: decision.climate.temperature_c > HEAT_EMBARGO_THRESHOLD_C,
        risk: decision.climate.risk,
        threshold_c: HEAT_EMBARGO_THRESHOLD_C,
      }
    : undefined;

  return {
    verdict, score, airlines, domestic: decision.domestic,
    destination_country: { iso2: decision.destination.country_id.replace(/^country_/, ""), name: decision.destination.country_name },
    climate,
    positives, compatible, conditions,
    warnings: [], risks: [], alternatives: [],
    confidence, sources: [...sources.values()], partners: [], generated_at: new Date().toISOString(),
  };
}
