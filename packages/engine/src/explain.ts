import { t, isEstimatedTemperature } from "@mydogcanfly/knowledge";
import type { Decision, DecisionReport, ReportItem, AirlineResult, PlacementStatus } from "./contracts";
import { hasActiveClimateCause, makePlacementDecision } from "./contracts";

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

  /* BUG corrigé (audit du 09/08/2026) : `confidences[]` n'était alimenté QUE par les règles pays
   * (countryRequirements) ci-dessus. Sur un vol domestique (isDomestic → countryRequirements = []
   * dans evaluate.ts) ou une destination sans règle pays applicable, `confidences` restait vide et
   * `avgConfidence` plus bas retombait sur un 4 codé en dur — un ★★★★ affiché quelle que soit la
   * confiance RÉELLE des règles compagnies utilisées, y compris quand la seule règle en jeu est le
   * repli `policyFallbackDenyRule` (confidence 1 par défaut, evaluate.ts). On ajoute donc aussi la
   * confiance de chaque règle compagnie qui s'est déclenchée, pour que le ★ affiché — et la part
   * qu'il pèse dans le score (`confidenceRatio`, computeScore) — reflète vraiment les sources
   * utilisées pour CE rapport, pas seulement celles du volet pays. */
  for (const a of decision.airlines) {
    for (const f of a.fired) confidences.push(f.confidence);
  }

  /* BUG CRITIQUE corrigé (audit du 09/08/2026, signalement utilisateur du même jour — Dogo Argentino
   * Paris→Londres, Air France « Dogue argentin » vers Le Caire) : `entry_allowed` ne pesait QUE sur
   * le verdict/score globaux (voir plus bas) — chaque compagnie continuait d'afficher cabine/soute/
   * fret cochés d'après ses propres règles, sans jamais consulter l'interdiction pays. Un chien dont
   * le TYPE est interdit d'entrée en Grande-Bretagne (Dangerous Dogs Act) recevait quand même « Air
   * France : soute ✓ » — la fiche « modalités détaillées » reprenait ces coches telles quelles,
   * contredisant son propre avertissement légal affiché juste au-dessus. Une interdiction d'entrée
   * pays est désormais terminale : aucune compagnie ne peut « compenser » un pays qui refuse le
   * chien à la frontière, qu'elle accepte de l'embarquer ou non. Calculé ici, AVANT la boucle
   * compagnies (plus bas dans le fichier), pour que ce blocage s'applique à chaque carte. */
  const entryAllowed = decision.destination.entry_allowed;

  // Airline-by-airline comparison for this dog + route.
  const has = (a: Decision["airlines"][number], pl: string) => a.placements.find((p) => p.placement === pl)?.allowed ?? false;
  /* Statut d'un canal, entryAllowed compris : un pays qui refuse l'entrée rend chaque canal
     `denied` — y compris ceux qui n'étaient « qu'à confirmer », car aucune confirmation de
     compagnie ne lève une interdiction d'entrée. */
  const statusOf = (a: Decision["airlines"][number], pl: string): PlacementStatus => {
    if (!entryAllowed) return "denied";
    return a.placements.find((p) => p.placement === pl)?.status ?? "denied";
  };
  const airlines: AirlineResult[] = decision.airlines.map((a) => {
    // entryAllowed prime sur les trois — voir le commentaire au-dessus de sa déclaration.
    const cabin = entryAllowed && has(a, "cabin"), hold = entryAllowed && has(a, "hold"), cargo = entryAllowed && has(a, "cargo");
    const cabin_status = statusOf(a, "cabin"), hold_status = statusOf(a, "hold"), cargo_status = statusOf(a, "cargo");
    const to_confirm = (["cabin", "hold", "cargo"] as const)
      .filter((pl) => statusOf(a, pl) === "confirmation_required");
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
    const label = cabin ? L("air.cabin_ok") : hold ? L("air.hold_only") : cargo ? L("air.cargo_only")
      : to_confirm.length ? L("air.to_confirm") : notAccepted;
    /* Fret : un montant n'est affiché que s'il est publié POUR LE FRET. Sinon « sur devis » — un
       envoi fret se chiffre chez le transitaire, et laisser croire à un tarif serait une invention. */
    const cargoOnly = !cabin && !hold && cargo;
    const feeShown = a.fee ? localizeFee(a.fee, locale) : undefined;
    const fee_quote_only = cargoOnly && !feeShown;
    /* Heat embargo : une règle saisonnière (température) suspend la soute/le fret pour cette date —
     * MAIS SEULEMENT si c'est la SEULE raison du refus. BUG corrigé (audit du 09/08/2026) : avant,
     * `heat_embargo` passait à `true` dès qu'une règle `summer_embargo` s'était déclenchée N'IMPORTE
     * OÙ dans `a.fired`, même quand la vraie raison du refus était permanente (interdiction de race,
     * poids...). Une compagnie interdite à l'année pour une race ET, accessoirement, concernée par
     * un embargo canicule ce mois-ci, se retrouvait classée « juste bloquée par la saison » — devant
     * dans le tri (ligne ~159), avec un badge suggérant qu'un autre mois suffirait, alors que la
     * vraie cause ne bougera jamais avec le calendrier. `reasons` (denyReasonsOf, evaluate.ts) exclut
     * déjà la catégorie summer_embargo : s'il reste un motif dedans, l'embargo canicule n'est pas la
     * seule cause, donc pas de badge "juste saisonnier".
     * entryAllowed s'applique aussi ici (09/08/2026) : un pays qui refuse l'entrée ne doit pas
     * laisser une carte affichée en style "bloqué par la saison seulement" (tireté ambre, tâche 19)
     * quand la vraie cause est une interdiction définitive et non calendaire.
     */
    /* v5 (contre-revue v4) : la garde « seule raison du refus » (reasons.length === 0) est RETIRÉE
       du marquage — le bandeau promet « les compagnies concernées sont marquées », il ne tient sa
       promesse que si le marquage suit sa définition. Une carte dont la cabine est fermée au poids
       et la soute par l'embargo est bien CONCERNÉE par l'embargo. La nuance « juste saisonnier »
       reste disponible côté UI via `deny_reasons` (vide ⇔ aucune cause non saisonnière). */
    const heatFired = entryAllowed && a.fired.some((f) => f.category === "summer_embargo");
    /* P0 climat : le drapeau dépend de la PROVENANCE de la température. Fournie par le visiteur →
       embargo confirmé, avec sa garde historique (« seule raison du refus », voir ci-dessus).
       Estimée → signal de confirmation, porté par les STATUTS eux-mêmes : dès qu'un canal est
       `confirmation_required`, la carte le dit — même si un AUTRE canal est refusé pour une autre
       raison (ex. cabine fermée au poids). La garde « seule raison » ne s'applique pas ici : elle
       protégeait contre l'étiquette « juste saisonnier » sur un blocage permanent, alors que ce
       drapeau-ci n'affirme aucune disponibilité, seulement une question à poser à la compagnie. */
    /* `isEstimatedTemperature`, pas `!== "visitor_input"` : une future température `sourced`
       n'est pas une estimation, et doit produire un embargo confirmé, pas une confirmation. */
    const tempEstimated = isEstimatedTemperature(decision.climate.provenance);
    const heat_embargo = heatFired && !tempEstimated;
    /* T0-A : la chaleur dérive d'une CAUSE CLIMATIQUE ACTIVE, plus jamais du seul statut.
       `to_confirm.length > 0` était vrai uniquement parce que le climat estimé était l'unique
       source de confirmation — dès T0-B, une politique « à confirmer » sur une route chaude
       aurait allumé un message climatique sans rapport (contre-revue du 13/08, P0 n° 2). Le
       statut FINAL (entryAllowed compris) reste la garde : une entrée refusée éteint tout. */
    const heat_confirmation_required = (["cabin", "hold", "cargo"] as const).some((pl) =>
      statusOf(a, pl) === "confirmation_required" &&
      a.placements.some((d) => d.placement === pl && hasActiveClimateCause(d)));
    /* Le triplet PUBLIC reste cohérent avec les statuts publics : quand `entryAllowed` dégrade
       une confirmation en refus, les causes s'éteignent avec elle (dominance intra-compagnie). */
    const placement_decisions = a.placements.map((d) => {
      const st = statusOf(a, d.placement);
      return st === d.status ? d : makePlacementDecision(d.placement, st,
        st === "confirmation_required" && d.status === "confirmation_required" ? d.confirmation_causes : []);
    });
    // National-carrier ranking (no price/distance data): flag carrier of the departure country, then destination.
    /* ATTENTION AU NOM : ces deux champs signifient « compagnie IMMATRICULÉE dans le pays de
     * départ / d'arrivée », rien de plus. Ce n'est PAS un statut de compagnie nationale ni de
     * porte-drapeau, et le contrat le laissait entendre à tort jusqu'au 11/08/2026.
     *
     * Relevé par Codex : sur un départ de France, cette simple égalité de `country_id` étoilait
     * les HUIT compagnies rattachées à `country_fr` — Air France, mais aussi Air Austral,
     * Air Caraïbes, Air Tahiti Nui, Aircalin, Corsair, French Bee et La Compagnie. L'UI affichait
     * « Compagnie nationale · départ » sur chacune. Air Tahiti Nui et Aircalin desservent en outre
     * la Polynésie française et la Nouvelle-Calédonie : leur rattachement à `country_fr` est un
     * raccourci de modélisation, pas une équivalence.
     *
     * Correction immédiate : les libellés affichés disent désormais « Compagnie du pays de
     * départ/destination », ce que le calcul établit réellement. Le tri qui suit reste inchangé —
     * privilégier une compagnie du pays reste pertinent, c'est l'étiquette qui mentait.
     *
     * Reste à faire, hors de ce lot : une donnée explicite `flag_carrier`, et une modélisation
     * correcte des territoires. Tant qu'elle n'existe pas, ne PAS réintroduire le mot « nationale ». */
    const carrier_of_origin = !!a.country_id && a.country_id === decision.origin_country_id;
    const carrier_of_destination = !!a.country_id && a.country_id === decision.destination.country_id;
    if (a.source_url) sources.set(a.source_url, { url: a.source_url });
    return { airline_id: a.airline_id, name: a.airline_name, direct: a.direct, itinerary_confidence: a.itinerary_confidence, deny_reasons: (cabin || hold || cargo || to_confirm.length > 0) ? undefined : reasons, connect_airport_id: a.connect_airport_id, detour_km: a.detour_km, cabin, hold, cargo, cabin_status, hold_status, cargo_status, to_confirm: to_confirm.length ? to_confirm : undefined, placement_decisions, offers_pet_transport: a.offers_pet_transport, carries_pets: a.carries_pets, label, fee: fee_quote_only ? L("air.fee_cargo_quote") : feeShown, fee_quote_only, source_url: a.source_url, heat_embargo, heat_confirmation_required, carrier_of_origin, carrier_of_destination, origin_airport_id: a.origin_airport_id, destination_airport_id: a.destination_airport_id };
  });
  /* Le placement demandé, AVANT le tri (contre-revue v4 : le classement l'ignorait — quatre
     « soute à confirmer » précédaient des soutes réellement autorisées sur une recherche soute). */
  const reqP = decision.request.placement;
  const okFor = (a: AirlineResult) => reqP === "any" ? (a.cabin || a.hold || a.cargo)
    : reqP === "cabin" ? a.cabin : reqP === "hold" ? a.hold : a.cargo;
  /* Même filtre, côté « à confirmer » : ne regarde que le placement demandé. */
  const confirmFor = (a: AirlineResult) => reqP === "any"
    ? (a.cabin_status === "confirmation_required" || a.hold_status === "confirmation_required" || a.cargo_status === "confirmation_required")
    : (reqP === "cabin" ? a.cabin_status : reqP === "hold" ? a.hold_status : a.cargo_status) === "confirmation_required";
  /* Rang par rapport au PLACEMENT DEMANDÉ — l'accepté réel toujours devant l'« à confirmer » :
       0  placement demandé réellement accepté ;
       1  placement demandé à confirmer ;
       2  un AUTRE canal réellement accepté ;
       3  autre canal à confirmer, ou embargo saisonnier seule cause (blocage temporaire) ;
       4  refusé.
     Avec "any", 0≡2 et 1≡3 : l'ordre v4 est conservé. */
  const seasonalOnly = (a: AirlineResult) => !!a.heat_embargo && !(a.deny_reasons && a.deny_reasons.length);
  const rangPlacement = (a: AirlineResult): number =>
    okFor(a) ? 0
    : confirmFor(a) ? 1
    : (a.cabin || a.hold || a.cargo) ? 2
    : ((a.to_confirm?.length ?? 0) > 0 || a.heat_confirmation_required || seasonalOnly(a)) ? 3
    : 4;
  airlines.sort((x, y) =>
    // 0) airlines that carry pets first, "no pets" always last — EXCEPT when the only blocker is a
    //    seasonal heat embargo (temporary), which stays in the top group.
    // 1) direct flights before connections, 2) acceptance quality — cabin, then accompanied hold (soute), so a
    //    direct flight offering soute outranks a direct fret/cargo-only one, 3) shortest detour, then name.
    //    (Le départage « compagnie du pays » qui figurait ici en 3) est retiré — J-bis, 11/08/2026.)
    /* v4 (contre-revue v3) : un canal RÉELLEMENT accepté passe TOUJOURS avant un « à confirmer »
       — un direct dont la soute n'est qu'à confirmer ne doit pas dominer une correspondance qui
       accepte vraiment le chien. Trois groupes : accepté > à confirmer/saisonnier > refusé. */
    (rangPlacement(x) - rangPlacement(y)) ||
    Number(y.direct) - Number(x.direct) ||
    // 1 bis) une correspondance dont les deux segments sont attestés passe devant une correspondance
    //        seulement déduite d'une géométrie de hub : l'établi avant le plausible.
    Number(x.itinerary_confidence === "connection_unverified") - Number(y.itinerary_confidence === "connection_unverified") ||
    Number(y.cabin) - Number(x.cabin) ||
    Number(y.hold) - Number(x.hold) ||
    /* Départage par `carrier_of_*` RETIRÉ provisoirement (J-bis, décision Codex du 11/08/2026) :
     * tant que ces champs ne reflètent qu'une égalité de `country_id`, faire remonter une compagnie
     * sur cette base revient à classer sur une donnée qui ne prouve rien — Air Tahiti Nui passait
     * devant des correspondances mieux établies au titre de « compagnie nationale » française.
     * Les champs restent calculés et exposés (le contrat ne change pas) ; seul le classement ne s'en
     * sert plus. À réintroduire avec `flag_carrier`. */
    // Among otherwise-equal connections, the shortest detour first (via a nearer hub).
    (x.detour_km ?? 0) - (y.detour_km ?? 0) ||
    x.name.localeCompare(y.name),
  );

  // Verdict is driven by the requested placement; "any" = any placement works.
  // (`reqP`, `okFor`, `confirmFor` sont déclarés au-dessus du tri, qu'ils servent aussi.)
  const acceptedAirlines = airlines.filter(okFor);
  const acceptCount = acceptedAirlines.length;
  const anyCompatible = acceptCount > 0;
  const anyConfirm = airlines.some(confirmFor);
  /* `compatible[]` ne porte que du réellement `allowed` — jamais une confirmation. */
  const compatible = acceptedAirlines.map((a) => ({ airline_id: a.airline_id, placement: reqP === "any" ? (a.cabin ? "cabin" : a.hold ? "hold" : "cargo") : reqP }));

  /* BUG CRITIQUE corrigé (audit du 09/08/2026) : le verdict ne consultait jamais
   * `decision.destination.entry_allowed` — calculé dans evaluate.ts à partir des règles pays
   * `deny` (interdictions de race, embargos sanitaires…) — et se basait UNIQUEMENT sur le fait
   * qu'une compagnie accepte le chien à bord. Vérifié en direct : un Pit Bull vers la France
   * recevait "conditional", score 25%, 3 compagnies "compatibles", alors que la France interdit
   * purement et simplement l'entrée de la race sur son sol (loi n° 99-5, six mois de prison et
   * 15 000 € d'amende — rule_fr_breed_ban_restricted_types, action "deny"). L'interdiction
   * atterrissait dans `conditions[]` comme une simple formalité parmi d'autres, jamais comme un
   * verdict bloquant : une compagnie qui accepte d'EMBARQUER le chien ne change rien au fait que
   * le PAYS refuse de le laisser entrer. `entry_allowed` prime désormais sur l'acceptation
   * compagnie — un embarquement possible ne rend jamais un trajet légalement impossible "conditional".
   * (`entryAllowed` est déclaré plus haut, avant la boucle compagnies — voir son commentaire.) */
  /* Règle EXACTE (revue du 13/08/2026) :
       1. entry_allowed=false → incompatible, quoi qu'en disent les compagnies ;
       2. les statuts sont filtrés par le placement demandé (tous les canaux pour "any") ;
       3. ≥1 allowed correspondant → verdict actuel (compatible/conditional selon les formalités) ;
       4. sinon ≥1 confirmation_required correspondant → conditional ;
       5. sinon → incompatible. */
  const verdict: DecisionReport["verdict"] =
    !entryAllowed ? "incompatible"
    : anyCompatible ? (conditions.length > 0 ? "conditional" : "compatible")
    : anyConfirm ? "conditional"
    : "incompatible";

  // Same source-confidence average the ★ rating below is built from (see `confidence`) — reused
  // here rather than recomputed, so the score and the stars never silently disagree.
  const avgConfidence = confidences.length ? confidences.reduce((a, b) => a + b, 0) / confidences.length : 4;
  // Même logique que le "0 compagnie candidate" de computeScore : un pays qui refuse l'entrée
  // rend le trajet impossible quel que soit le nombre de compagnies prêtes à embarquer le chien —
  // ce n'est pas un score bas, c'est 0, pour ne jamais laisser un pourcentage à deux chiffres
  // suggérer que "ça reste jouable".
  const score = entryAllowed ? computeScore(airlines, acceptedAirlines, avgConfidence, conditions) : 0;

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
  const estimatedAboveThreshold = isEstimatedTemperature(decision.climate.provenance)
    && decision.climate.temperature_c > HEAT_EMBARGO_THRESHOLD_C;
  const climate = decision.climate.provided
    ? {
        temperature_c: decision.climate.temperature_c,
        estimated: decision.climate.estimated,
        provenance: decision.climate.provenance,
        /* `embargo` comme `confirmation_required` DÉRIVENT DES RÈGLES RÉELLEMENT DÉCLENCHÉES
           (contre-revues v2 et v3) : le seuil seul ne produit que l'indicateur brut. Sur une
           route où AUCUNE compagnie ne porte de règle d'embargo, une température fournie de 35°
           n'affiche plus de bandeau « embargo » — rien n'a été suspendu. */
        /* v6 (contre-revue v5) : le bandeau DÉRIVE DES CARTES — une seule définition, la
           cohérence par construction. La v5 lisait les règles déclenchées directement dans la
           décision : sur une entrée INTERDITE (pit-bull vers la France), `entryAllowed` démarquait
           toutes les cartes pendant que le bandeau affirmait un embargo — troisième asymétrie de
           la même famille. Un trajet incompatible à la frontière n'a pas de bandeau embargo :
           la chaleur n'est pas ce qui l'empêche. */
        embargo: !isEstimatedTemperature(decision.climate.provenance) && airlines.some((a) => a.heat_embargo === true),
        /* T0-A : le bandeau dérive des cartes, FILTRÉ PAR CAUSE — une confirmation de politique
           sur une route chaude n'allume plus le bandeau climatique (contre-test 2). */
        confirmation_required: estimatedAboveThreshold && airlines.some((a) => a.heat_confirmation_required === true),
        estimated_heat_signal: estimatedAboveThreshold,
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
