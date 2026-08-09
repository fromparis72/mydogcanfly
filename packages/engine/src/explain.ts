import { t } from "@mydogcanfly/knowledge";
import type { Decision, DecisionReport, ReportItem, AirlineResult } from "./contracts";

const CRIT_ORDER: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
/** Temperature above which seasonal heat embargoes suspend hold/cargo (matches the summer_embargo rules). */
const HEAT_EMBARGO_THRESHOLD_C = 30;

/* Score du trajet (ADR à documenter — décision utilisateur, 08/2026). AVANT : un barème à 3 paliers
   fixes — 96 "compatible", 88 "conditionnel", 20 "incompatible" — plus ou moins ajusté de -3 par
   condition et -6 si moins de 3 compagnies acceptent. Le nombre affiché en gros ("XX% compatibilité")
   n'était donc PAS une mesure : c'était le verdict, re-décoré en pourcentage à trois valeurs
   possibles (à quelques points près). Deux trajets radicalement différents — 8 compagnies dont 6
   acceptent en direct attesté, contre 1 seule compagnie qui accepte via une correspondance jamais
   vérifiée — pouvaient afficher le même 88%.

   MAINTENANT : le score dérive de trois faits déjà connus du moteur, jamais d'un jugement inventé :
   - CHOIX RÉEL : acceptées ÷ candidates. Une compagnie "candidate" est une compagnie dont on a
     évalué la desserte de ce trajet, qu'elle accepte ou non ce chien précis — c'est le nombre
     d'options réellement regardées, pas une estimation.
   - QUALITÉ DE L'ITINÉRAIRE : parmi les compagnies acceptées, la moyenne de leur `itinerary_confidence`
     (direct_documented > direct_assumed > connection_documented > connection_unverified — voir
     evaluate.ts). Un trajet où tout est attesté pèse plus qu'un trajet où tout est déduit d'un hub.
   - CONFIANCE DES SOURCES : la même moyenne 1-5 étoiles déjà affichée par ailleurs (`confidence`),
     ramenée à 0-1 — un dossier sourcé à 5★ partout vaut plus qu'un dossier à 2★.
   Puis une pénalité pour les formalités d'entrée (`conditions`), pondérée par leur criticité — plus
   il faut de démarches critiques avant le départ, plus le trajet est concrètement compliqué, même
   si le chien lui-même est accepté partout.

   Ce que ça corrige mécaniquement, sans cas particulier ajouté : un trajet sans AUCUNE compagnie
   candidate (aucune ne dessert cette paire d'aéroports) tombe à 0 — avant, il affichait le même 20%
   qu'un trajet où 10 compagnies desservent la route mais refusent toutes CE chien. Ce sont deux
   réalités différentes ; le score les distingue maintenant sans qu'on ait eu à les nommer. */
const ITINERARY_WEIGHT: Record<string, number> = {
  direct_documented: 1, direct_assumed: 0.8, connection_documented: 0.7, connection_unverified: 0.4,
};
const CONDITION_PENALTY: Record<string, number> = { critical: 10, high: 6, medium: 3, low: 1 };
function computeScore(
  candidateAirlines: AirlineResult[],
  acceptedAirlines: AirlineResult[],
  avgConfidence: number,
  conditions: ReportItem[],
): number {
  if (candidateAirlines.length === 0) return 0; // no airline even reaches this route — a data gap, not "20% compatible"
  const choiceRatio = acceptedAirlines.length / candidateAirlines.length;
  const routeQuality = acceptedAirlines.length
    ? acceptedAirlines.reduce((sum, a) => sum + (ITINERARY_WEIGHT[a.itinerary_confidence ?? ""] ?? 0.5), 0) / acceptedAirlines.length
    : 0;
  const confidenceRatio = Math.max(0, Math.min(1, avgConfidence / 5));
  const penalty = Math.min(40, conditions.reduce((sum, c) => sum + (CONDITION_PENALTY[c.criticality] ?? 2), 0));
  const raw = 45 * choiceRatio + 35 * routeQuality + 20 * confidenceRatio - penalty;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

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
  const acceptedAirlines = airlines.filter(okFor);
  const acceptCount = acceptedAirlines.length;
  const anyCompatible = acceptCount > 0;
  const compatible = acceptedAirlines.map((a) => ({ airline_id: a.airline_id, placement: reqP === "any" ? (a.cabin ? "cabin" : a.hold ? "hold" : "cargo") : reqP }));

  const verdict: DecisionReport["verdict"] =
    !anyCompatible ? "incompatible" : conditions.length > 0 ? "conditional" : "compatible";

  // Same source-confidence average the ★ rating below is built from (see `confidence`) — reused
  // here rather than recomputed, so the score and the stars never silently disagree.
  const avgConfidence = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 4;
  const score = computeScore(airlines, acceptedAirlines, avgConfidence, conditions);

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
    if (airlines.length === 0) {
      /* Zéro compagnie CANDIDATE — pas zéro compagnie qui refuse ce chien, zéro compagnie évaluée
       * du tout pour cette paire d'aéroports. Repéré en direct par l'utilisateur sur Lisbonne→Cap-
       * Vert (avant l'ajout des routes TAP) : le panneau affichait 20% et « Not as requested »,
       * mais la liste « Pourquoi » ne disait RIEN de l'absence de compagnie — elle affichait deux
       * coches vertes (« Cap-Vert autorise l'entrée », « documents connus »), qui restent vraies
       * indépendamment de toute compagnie mais donnent une impression trompeuse d'ensemble « ça a
       * l'air bon » sur un trajet où aucune option n'existe dans nos données.
       * Second défaut, plus discret, corrigé au passage : sans cette branche dédiée, le cas
       * `airlines.length === 0` tombait dans `anyCabin` false puis, pour un chien brachycéphale,
       * dans la branche `why.no_cabin_brachy` — qui attribue l'absence de cabine À LA RACE. Fausse
       * cause : sur ce trajet on n'a évalué AUCUNE compagnie, brachycéphale ou non ; le message ne
       * doit pas accuser une race pour un trou de couverture.
       * C'est un trou de données (aucune compagnie sourcée sur cette paire d'aéroports, direct ou
       * via une correspondance plausible), pas une preuve que la liaison n'existe pas — le texte le
       * dit explicitement pour ne pas décourager à tort un trajet réellement faisable. */
      positives.push({ text: L("why.no_airline_found"), criticality: "high", tone: "negative" });
    } else if (anyCabin) {
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

  const confidence = Math.round(avgConfidence);

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
