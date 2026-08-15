import { z } from "zod";
import { Placement, TravelType, Locale, TravelDate, PlacementStatus, TemperatureProvenance } from "@mydogcanfly/knowledge";
export type { PlacementStatus, TemperatureProvenance };

/* ---- T0-A : le statut porte sa cause (contre-revues des 13–14/08/2026) ----------------------
 *
 * Jusqu'à ce lot, `confirmation_required` n'avait qu'une seule source possible (l'embargo
 * climatique sur température estimée) et cinq points du code déduisaient la CHALEUR du seul
 * STATUT. T0-B introduira des confirmations de politique : chaque confirmation doit donc porter
 * sa cause, structurée et traçable jusqu'au fait source — pas une étiquette d'interface.
 *
 * Le contrat est une UNION DISCRIMINÉE par statut (pas une table optionnelle parallèle) : un
 * `confirmation_required` sans cause, un `allowed` porteur d'une cause, ou un booléen `allowed`
 * en désaccord avec son statut sont INCONSTRUCTIBLES — refusés par Zod à la construction même
 * (`makePlacementDecision` retourne le résultat de `.parse()`), pas seulement à la sérialisation. */

/** Référence d'une politique de canal : `airline_xxx#cabin|hold|cargo` — jamais un id de règle
 *  (une règle se référence par `rule_id`). */
const POLICY_REF_RE = /^airline_[a-z0-9_]+#(cabin|hold|cargo)$/;

export const ConfirmationCause = z.discriminatedUnion("code", [
  /** Embargo `summer_embargo` déclenché sur une température ESTIMÉE — la seule cause active en T0-A. */
  z.object({ code: z.literal("estimated_climate"), rule_id: z.string().min(1) }).strict(),
  /** Politique non publiée (Thai Cargo…) — émise par les politiques canoniques `undocumented` (T0-B). */
  z.object({ code: z.literal("policy_unpublished"), policy_ref: z.string().regex(POLICY_REF_RE) }).strict(),
  /** Acceptation au cas par cas / on request — politiques canoniques `case_by_case` (T0-B). */
  z.object({ code: z.literal("airline_approval"), policy_ref: z.string().regex(POLICY_REF_RE) }).strict(),
  /** Donnée HÉRITÉE non revérifiée (T0-B) — la condition figure dans notre fiche mais n'a pas
   *  encore été confrontée à une source officielle à jour. L'incertitude est LA NÔTRE : la
   *  ranger avec `policy_unpublished` l'attribuerait à la compagnie, ce qui serait exactement
   *  la perte d'interprétation que T0-B répare. `policy_ref` est obligatoire — une donnée non
   *  revérifiée sans le couple (compagnie, canal) qu'elle concerne serait inauditables. */
  z.object({ code: z.literal("legacy_unreviewed"), policy_ref: z.string().regex(POLICY_REF_RE) }).strict(),
  /** Fait requis absent (poids total T2, âge T3). `fact` restera à resserrer en registre fermé
   *  avant la première migration T2/T3 — aucune donnée réelle ne l'émet en T0-A. */
  z.object({ code: z.literal("missing_fact"), fact: z.string().min(1), requirement_ref: z.string().min(1) }).strict(),
]);
export type ConfirmationCause = z.infer<typeof ConfirmationCause>;

/** Clé canonique d'une cause — tri stable et déduplication des snapshots. */
export const causeKey = (c: ConfirmationCause): string =>
  c.code === "estimated_climate" ? `${c.code}|${c.rule_id}`
  : c.code === "missing_fact" ? `${c.code}|${c.fact}|${c.requirement_ref}`
  : `${c.code}|${c.policy_ref}`;

const sortDedupCauses = (causes: ConfirmationCause[]): ConfirmationCause[] => {
  const m = new Map<string, ConfirmationCause>();
  for (const c of causes) m.set(causeKey(c), c);
  return [...m.values()].sort((a, b) => causeKey(a).localeCompare(causeKey(b)));
};

export const PlacementDecision = z.discriminatedUnion("status", [
  z.object({ placement: Placement, status: z.literal("allowed"), allowed: z.literal(true) }).strict(),
  z.object({ placement: Placement, status: z.literal("denied"), allowed: z.literal(false) }).strict(),
  z.object({
    placement: Placement,
    status: z.literal("confirmation_required"),
    allowed: z.literal(false),
    confirmation_causes: z.array(ConfirmationCause).min(1),
  }).strict(),
]);
export type PlacementDecision = z.infer<typeof PlacementDecision>;

/** Le triplet complet d'une compagnie : exactement cabine, soute et fret — ni absence, ni doublon.
 *  Le schéma d'une décision isolée ne peut pas garantir cet invariant ; celui-ci le valide. */
export const PlacementDecisionSet = z.array(PlacementDecision).length(3).superRefine((ds, ctx) => {
  const seen = ds.map((d) => d.placement).sort().join(",");
  if (seen !== "cabin,cargo,hold") {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: `PlacementDecisionSet: placements {${seen}} ≠ {cabin,cargo,hold}` });
  }
});

/** L'UNIQUE constructeur d'une décision — valide À LA CONSTRUCTION, jamais un littéral libre.
 *  `allowed` est imposé par la branche du statut ; les causes sont triées et dédupliquées ici,
 *  une fois pour toutes, pour des snapshots reproductibles. */
export function makePlacementDecision(
  placement: z.infer<typeof Placement>,
  status: PlacementStatus,
  causes?: ConfirmationCause[],
): PlacementDecision {
  return PlacementDecision.parse(
    status === "confirmation_required"
      ? { placement, status, allowed: false, confirmation_causes: sortDedupCauses(causes ?? []) }
      : { placement, status, allowed: status === "allowed" },
  );
}

/** Valide le triplet complet d'une compagnie (défense en profondeur : chaque décision a déjà
 *  été validée individuellement à sa construction). */
export function makePlacementDecisionSet(ds: PlacementDecision[]): PlacementDecision[] {
  return PlacementDecisionSet.parse(ds);
}

/** La chaleur dérive d'une CAUSE CLIMATIQUE ACTIVE — jamais du seul statut (T0-A). */
export const hasActiveClimateCause = (d: PlacementDecision): boolean =>
  d.status === "confirmation_required" && d.confirmation_causes.some((c) => c.code === "estimated_climate");

/** Signal de confirmation d'une destination : la cause SANS perdre la compagnie ni le canal
 *  (contre-revue v2 : deux signaux identiques chez deux compagnies ou sur deux canaux sont deux
 *  informations distinctes). L'agrégat de statut d'une destination suit sa propre dominance
 *  (`allowed > confirmation_required > denied`) ; ces signaux survivent même quand le statut
 *  agrégé vaut `allowed` grâce à une autre compagnie. */
export interface DestinationConfirmationSignal {
  airline_id: string;
  placement: z.infer<typeof Placement>;
  cause: ConfirmationCause;
}
export const signalKey = (s: DestinationConfirmationSignal): string =>
  `${s.airline_id}|${s.placement}|${causeKey(s.cause)}`;

/* ---- Public input contract (frozen in Phase 1, contract-first) ---- */
export const FinderRequest = z.object({
  origin: z.string(),      // airport id (representative origin — the primary of the origin set)
  destination: z.string(), // airport id (representative destination)
  // Optional airport sets — used for city-level search (e.g. Paris = CDG + ORY). Fall back to [origin]/[destination].
  origins: z.array(z.string()).optional(),
  destinations: z.array(z.string()).optional(),
  dog: z.object({
    breed_id: z.string().optional(),
    // Plafond ajouté (audit du 09/08/2026) : `positive()` seul laissait passer n'importe quel poids
    // absurde (999 999 kg reproduit en direct via l'API) et obtenait un verdict "conditional" avec
    // de vraies compagnies listées en soute/fret. 120 kg couvre largement le plus gros chien réel
    // (mâtin/dogue ~100 kg) tout en bloquant une confusion d'unité (grammes au lieu de kilos) ou
    // une saisie fantaisiste.
    weight_kg: z.number().positive().max(120).optional(),
    brachycephalic: z.boolean().optional(),
  }),
  travel_type: TravelType.default("pet"),
  placement: z.union([Placement, z.literal("any")]).default("any"),
  date: TravelDate.optional(),
  /* PLAGE OPÉRATIONNELLE PRODUIT sur la température — pas une limite physique terrestre
     (reformulé au L-bis sur remarque de Codex : l'OMM recense des températures continentales
     sous −60 °C, Vostok est descendu à −89,2 °C ; « physique » était donc faux). Ce que borne
     cette plage, c'est le domaine où un embargo de chaleur pour un chien sur un vol commercial
     a un sens : −60 °C à +60 °C est la plage opérationnelle produit retenue pour le voyage
     commercial, et le record officiel OMM de chaleur à l'ombre (56,7 °C, table des records de
     l'OMM) tient largement dedans. Hors plage, la saisie
     est bien plus probablement une erreur d'unité (Fahrenheit, dixièmes) qu'une expédition
     antarctique avec chien en soute : le contrat répond 400, et si ce cas d'usage émergeait un
     jour, élargir la borne est une décision produit d'une ligne. Ce champ pilote les embargos
     de chaleur — une valeur absurde ne fausse pas un affichage, elle décide. */
  /* `.strict()` et non le mode strip par défaut : le mini-contrat climat promet qu'un client ne
     peut pas DÉCLARER la provenance de sa température. En strip, un champ `provenance` envoyé par
     un client aurait été ignoré en silence — c'est-à-dire accepté ; en strict, il est refusé en
     400. La provenance est posée par le serveur, exclusivement. */
  weather: z.object({ temperature_c: z.number().min(-60).max(60) }).strict().optional(),
  /* Retour vers l'UE — le seul fait que le moteur ne peut pas déduire du vol.
     On interroge la SITUATION du chien ("vit-il habituellement dans l'Union européenne ?"), au
     présent et sans rien faire vérifier : "yes" = il rentre chez lui, "no" = il découvre l'UE.
     La question portait autrefois sur le document et au passé, ce qui n'avait pas de sens pour qui
     n'a jamais quitté l'UE ; « vit habituellement » dit en plus ce que la Commission pose et que
     l'ancienne formulation ratait — la dispense vaut pour un séjour, pas pour un propriétaire qui
     réside désormais hors UE.
     ABSENT = on ne devine pas : les DEUX parcours (passeport et certificat) sont affichés. Ne
     jamais traiter l'absence de réponse comme un "no".
     Le "unknown" d'avant n'est plus ni produit ni attendu ; s'il arrive encore d'une page en cache,
     il est ramené à l'absence de réponse plutôt que rejeté — un 400 priverait le visiteur de tout
     son rapport pour une valeur dont on connaît déjà le sens prudent. */
  eu_passport: z.preprocess(
    (v) => (v === "unknown" || v === "" ? undefined : v),
    z.enum(["yes", "no"]).optional(),
  ),
  locale: Locale.default("en"),
});
export type FinderRequest = z.infer<typeof FinderRequest>;

/* ---- Destination-finder input contract: "where can I fly my dog on this date?" ----
   Same dog + date model as the finder, but no fixed destination — the engine scans every
   country reachable from the origin and returns a compact per-destination match. */
/* Retest 09/08/2026, point 4 : une date passée (ex. 2020-01-15) était acceptée telle quelle — le
 * moteur mélangeait alors le réseau aérien ACTUEL avec le climat moyen d'un mois révolu, produisant
 * un résultat sans signification. Validée ici (moteur), en plus du `min`/`max` posés côté client
 * sur le champ — la validation client seule est contournable (saisie directe, DevTools, appel API
 * direct). Horizon plafonné à 18 mois : au-delà, ni le réseau de routes ni les règles ne sont
 * garantis stables, et rien dans le référentiel ne modélise leur évolution future.
 */
// La validation vit désormais dans `TravelDate` (knowledge/common.ts), partagée par les deux
// requêtes. L'ancienne version, par expression régulière et comparaison lexicographique, acceptait
// « 2027-02-30 » et « 2026-13-01 » — et le moteur en dérivait un mois hors domaine.

export const DestinationsRequest = z.object({
  origin: z.string(),                       // representative origin airport id
  origins: z.array(z.string()).optional(),  // origin airport set (city search, e.g. Paris = CDG + ORY)
  dog: z.object({
    breed_id: z.string().optional(),
    weight_kg: z.number().positive().max(120).optional(), // même plafond que FinderRequest — cf. commentaire là-bas
    brachycephalic: z.boolean().optional(),
  }),
  placement: z.union([Placement, z.literal("any")]).default("any"),
  date: TravelDate.optional(),
  locale: Locale.default("en"),
});
export type DestinationsRequest = z.infer<typeof DestinationsRequest>;

/** One reachable destination CITY (airport), reachable by a DIRECT flight, summarised for the ranking.
    Climate is estimated per airport from its latitude + travel month (not the country) — honest about
    intra-country variation, though altitude is not captured. Formalities are added by the UI (country
    guide difficulty × the documents the traveller holds). */
export interface DestinationMatch {
  airport_id: string;
  iata: string;
  city: string;              // localized city name
  country_id: string;
  iso2: string;
  country_name: string;      // localized country name
  region: string;
  temperature_c: number;     // per-airport seasonal estimate (latitude + month)
  climate_estimated: boolean; // true when a travel month was supplied
  /** TOUJOURS false dans cet outil : sa température est toujours estimée (latitude), et une
   *  estimation ne peut plus produire un embargo (P0 climat). Conservé pour la transition. */
  heat_embargo: boolean;
  /** ≥1 compagnie directe porte RÉELLEMENT un canal `confirmation_required` — dérivé de la
   *  décision, jamais du seul seuil de température (contre-revue v2 : un carlin dont tous les
   *  canaux sont refusés par les règles de race ne doit rien avoir « à confirmer »). */
  heat_confirmation_required: boolean;
  /** Indicateur BRUT : température estimée au-dessus du seuil. Aucune prétention sur les règles
   *  compagnie — c'est un signal météo modélisé, à afficher comme tel. */
  estimated_heat_signal: boolean;
  heat_risk: boolean;        // warm-but-not-embargo band
  airlines_total: number;          // compagnies directes avec ≥1 canal réellement `allowed`
  airlines_to_confirm_total: number; // compagnies directes SANS canal allowed mais avec ≥1 « à confirmer »
  /* Booléens de transition, vrais UNIQUEMENT pour `allowed` ; les statuts sont la vérité.
     Le fret entre officiellement dans l'outil (arbitrage du 13/08/2026, option 1) : `cargo_ok`
     était calculé, utilisé dans `placement_ok`, et jamais émis — 3 à 5 destinations étaient
     « compatibles » par un canal que le visiteur ne pouvait pas voir. */
  cabin_ok: boolean;
  hold_ok: boolean;
  cargo_ok: boolean;
  cabin_status: PlacementStatus;
  hold_status: PlacementStatus;
  cargo_status: PlacementStatus;
  /** T0-A — les causes de confirmation AVEC leur compagnie et leur canal (jamais aplaties : deux
   *  causes identiques chez deux compagnies sont deux signaux). Survivent à l'agrégation même
   *  quand le statut agrégé vaut `allowed` grâce à une autre compagnie. Triées, dédupliquées
   *  sur le triplet complet. */
  confirmation_signals: DestinationConfirmationSignal[];
  placement_ok: boolean;         // le placement demandé est réellement `allowed` sur ≥1 compagnie directe
  /** Aucun canal demandé `allowed`, mais ≥1 « à confirmer » : à afficher en ALTERNATIVE, jamais en compatible. */
  placement_to_confirm: boolean;
  entry_allowed: boolean;    // no blocking country-level denial (e.g. hard import ban)
  flight_hours: number;      // estimated direct flight time (great-circle distance ÷ cruise speed)
}

/* Retest 09/08/2026, point 2 : le seul champ `matches` ne permettait pas de distinguer "aucune
 * compagnie ne dessert de destination directe depuis cette ville" (candidates_total = 0) de "des
 * destinations sont desservies, mais aucune n'accepte ce chien nulle part" (candidates_total > 0,
 * matches vide) — les deux retombaient sur le même "matches: []" et donc le même message générique
 * côté UI. */
export interface DestinationsResult {
  matches: DestinationMatch[];
  candidates_total: number; // aéroports directement desservis depuis l'origine, avant tout filtrage race/placement
}

/* ---- Internal (Decision Engine output) ---- */
export interface FiredRule {
  rule_id: string;
  action: string;
  category: string;
  criticality: string;
  rationale: string;
  source_url: string;
  confidence: number;
  params: Record<string, unknown>;
}
export interface AirlineDecision {
  airline_id: string;
  airline_name: string;
  country_id?: string;        // pays d'immatriculation déclaré dans les données — PAS un statut de porte-drapeau
  direct: boolean;            // likely a direct flight on this route (hub at origin or destination)
  carries_pets: boolean;      // true if the airline carries pets at all (a neutral dog) — false = structural "no pets"
  /* Ce que vaut réellement l'itinéraire proposé. On ne présente plus un nonstop attesté et une
     correspondance fabriquée par géométrie de hub sous la même étiquette :
       direct_documented       — la paire origine|destination figure dans `direct_routes` ;
       direct_assumed          — pas de graphe de routes : « direct » vient de l'heuristique du hub ;
       connection_documented   — les DEUX segments origine→hub et hub→destination sont dans `direct_routes` ;
       connection_unverified   — hub géométriquement plausible, mais aucun segment attesté.
     `connection_unverified` ne dit pas que l'itinéraire n'existe pas : il dit que rien ne l'établit. */
  itinerary_confidence?: "direct_documented" | "direct_assumed" | "connection_documented" | "connection_unverified";
  /* Motifs du refus, LUS sur les règles qui ont réellement refusé chaque placement (leur catégorie
     et les placements qu'elles visent), jamais déduits d'une absence de mode accepté.
     Codes : breed_restricted · weight_limit · cabin_unavailable · hold_unavailable · cargo_unavailable. */
  deny_reasons?: string[];
  connect_airport_id?: string;     // for a connection, the airline hub the itinerary plausibly routes through
  detour_km?: number;              // extra distance vs the direct great-circle (0 for a direct) — ranks/trims connections
  source_url?: string;
  fee?: string;               // published fee for the accepted placement, as-is (e.g. "€100 to €600")
  origin_airport_id?: string;      // the origin airport this airline actually uses, when it differs from the representative origin (city search)
  destination_airport_id?: string; // idem for the destination
  /* `status` est la vérité ; `allowed` est le booléen de transition, vrai UNIQUEMENT pour
     `allowed`. Un embargo chaleur déclenché sur une température ESTIMÉE produit
     `confirmation_required` — jamais un refus dur, jamais une disponibilité.
     T0-A : le triplet est validé (`PlacementDecisionSet`) et chaque confirmation porte ses
     causes structurées. */
  placements: PlacementDecision[];
  /** Vérité STRUCTURELLE (T0-A) : ≥1 canal dont la POLITIQUE (après projection) est `allowed`
   *  ou `confirmation_required` — sans appliquer les règles du trajet ni le climat. */
  offers_pet_transport: boolean;
  /** TÉMOIN DE TRANSITION, jamais public (retiré par explain) : l'ancien calcul verbatim, pour
   *  que la CI recalcule l'écart exhaustif versionné (t0a-carries-pets-diff.json). À retirer
   *  avec le fichier une fois la migration digérée. */
  _legacy_carries_pets?: boolean;
  fired: FiredRule[];
}
/** Seasonal climate context used for the heat-embargo filter (temperature-driven hold/cargo denials). */
export interface Climate {
  temperature_c: number; // temperature applied to the evaluation (explicit, or model-estimated from the date)
  provenance: TemperatureProvenance; // posée par le serveur — visitor_input | estimated_region | estimated_latitude
  estimated: boolean;    // true when derived from the travel month + destination region (not user-supplied)
  provided: boolean;     // true when the user gave a travel date or explicit temperature (else it's the mild default)
  month?: number;        // 1..12, when a date was supplied
  risk: boolean;         // possible-but-unconfirmed heat: temperate region in peak-summer months (heat-wave season)
}
export interface Decision {
  request: FinderRequest;
  airlines: AirlineDecision[];
  countryRequirements: FiredRule[];
  destination: { country_id: string; country_name: string; entry_allowed: boolean };
  origin_country_id: string; // pays de l'aéroport de départ (le départage carrier_of_* est retiré — J-bis 11/08/2026)
  domestic: boolean;       // same country at both ends: no border crossing, so no import requirements apply
  brachycephalic: boolean; // effective snub-nosed flag (from request or breed) — drives welfare wording
  climate: Climate;        // seasonal temperature context (drives the automatic heat embargo)
}

/* ---- Public output contract: the Decision Report (Explanation Engine output) ---- */
export interface ReportItem {
  text: string;
  criticality: string;
  tone?: "positive" | "negative"; // UI marker: green check (default) vs red cross
  rule_id?: string;
  source_url?: string;
}
/** A contextual partner suggestion — only ever present when it adds value to this report. */
export interface PartnerRef {
  partner_id: string;
  vertical: string;
  name: string;
  url: string;        // monetizable outbound link — non-empty ONLY when sponsored (status = active)
  sponsored: boolean; // true only for an active affiliate; safeguard against sending free qualified traffic
  reason: string;     // the contextual value (why it is shown here)
}
/** One airline's outcome for this dog + route — the unit of the comparison list. */
export interface AirlineResult {
  airline_id: string;
  name: string;
  direct: boolean;
  connect_airport_id?: string;  // for a connection, the airline hub it routes through (e.g. Madrid) — shown as "via MAD"
  detour_km?: number;           // extra distance vs the direct route (0 for direct) — used to rank connections
  /* Booléens de transition : vrais UNIQUEMENT pour `allowed`. Les statuts sont la vérité. */
  cabin: boolean;
  hold: boolean;
  cargo: boolean;
  cabin_status: PlacementStatus;
  hold_status: PlacementStatus;
  cargo_status: PlacementStatus;
  /** Canaux au statut `confirmation_required` — à rendre « politique à confirmer », JAMAIS comme ouverts. */
  to_confirm?: string[];
  /** T0-A — le triplet canonique validé : trois décisions (cabine/soute/fret), chaque
   *  confirmation portant ses causes structurées. Les booléens et `*_status` ci-dessus en
   *  DÉRIVENT ; c'est la source d'affichage des libellés par famille de cause. */
  placement_decisions: PlacementDecision[];
  /** Vérité structurelle canonique (T0-A) : la compagnie PROPOSE un transport d'animaux —
   *  ≥1 canal dont la politique est `allowed` ou `confirmation_required`, indépendamment du
   *  trajet et du climat. `carries_pets` en est la projection legacy pendant la transition. */
  offers_pet_transport?: boolean;
  /* Projection legacy de `offers_pet_transport` (T0-A — correction contrôlée, diff versionné :
     l'ancien calcul appliquait les règles du trajet au « chien neutre » et affichait « Animaux
     refusés » sur des compagnies dont la politique propose un canal).
     NE JAMAIS EN DÉDUIRE UN MOTIF : « true, mais aucun mode accepté » ne veut pas dire « race
     refusée » — c'est le plus souvent le poids, ou l'absence de soute/fret. Le motif réel est
     dans `deny_reasons`, lu sur les règles qui ont refusé. */
  carries_pets?: boolean;
  /** Motifs du refus (codes stables), présents seulement quand aucun mode n'est accepté. */
  deny_reasons?: string[];
  /** Nature de l'itinéraire — voir AirlineDecision.itinerary_confidence. */
  itinerary_confidence?: "direct_documented" | "direct_assumed" | "connection_documented" | "connection_unverified";
  label: string;        // localized one-line verdict (e.g. "Cabin OK", "Hold only", "Not accepted")
  fee?: string;         // published fee for the accepted placement, when known
  /** Fret sans tarif publié POUR LE FRET : `fee` porte alors « sur devis », pas un montant repris d'ailleurs. */
  fee_quote_only?: boolean;
  source_url?: string;
  /** Embargo chaleur CONFIRMÉ — température fournie par le visiteur au-dessus du seuil. Une
   *  estimation ne produit JAMAIS ce drapeau (P0 climat) : elle produit le suivant. */
  heat_embargo?: boolean;
  /** Signal de chaleur sur température ESTIMÉE : la soute/le fret sont « à confirmer auprès de la
   *  compagnie », pas suspendus. Distinct d'`heat_embargo` par la provenance, pas par le seuil. */
  heat_confirmation_required?: boolean;
  /* « Compagnie immatriculée dans ce pays », et RIEN DE PLUS : simple égalité de `country_id`.
   * Ces deux champs annonçaient « national/flag carrier » — c'était faux (voir explain.ts).
   * Ne pas réintroduire ce vocabulaire sans une donnée `flag_carrier` explicite. */
  carrier_of_origin?: boolean;      // compagnie immatriculée dans le pays de départ (triée juste après les vols directs)
  carrier_of_destination?: boolean; // compagnie immatriculée dans le pays d'arrivée (triée ensuite)
  origin_airport_id?: string;       // the specific origin airport used, when it differs from the one searched (city search)
  destination_airport_id?: string;  // idem for the destination
}
export interface DecisionReport {
  verdict: "compatible" | "conditional" | "incompatible";
  /** 0..100 TRIP-level score (see computeScore() in explain.ts) — every candidate airline on this
   *  route combined, never a single carrier's number. Weighted from real choice (accepted ÷
   *  candidate airlines), route-attestation quality (direct_documented > direct_assumed >
   *  connection_documented > connection_unverified), and average source confidence, minus a
   *  penalty for entry-formality friction. Not a probability of successful travel. */
  score: number;
  /** Airline-by-airline comparison for this dog + route, direct flights first. */
  airlines: AirlineResult[];
  /** Destination country, for the flag + link to its entry-requirements page. */
  destination_country?: { iso2: string; name: string };
  /** True when origin and destination are the same country: no border, so no import formalities apply. */
  domestic?: boolean;
  /** Seasonal temperature context — present only when the user supplied a travel date or temperature.
   *  embargo = confirmed (estimate above threshold); risk = possible-but-unconfirmed heat-wave season. */
  climate?: {
    temperature_c: number; estimated: boolean; provenance: TemperatureProvenance;
    /** Vrai UNIQUEMENT sur température fournie (`visitor_input`) au-dessus du seuil. */
    embargo: boolean;
    /** ≥1 compagnie du rapport porte réellement un canal à confirmer, ET la température estimée
     *  dépasse le seuil — jamais le seuil seul (contre-revue v2). */
    confirmation_required: boolean;
    /** Indicateur brut : température estimée au-dessus du seuil, sans prétention sur les règles. */
    estimated_heat_signal: boolean;
    risk: boolean; threshold_c: number;
  };
  /** Affirmative "why it works" statements, in plain language (narrative-first report). */
  positives: ReportItem[];
  /** Couples réellement `allowed` — jamais un `confirmation_required` (il irait dans `to_confirm`). */
  compatible: { airline_id: string; placement: string }[];
  conditions: ReportItem[];
  warnings: ReportItem[];
  risks: ReportItem[];
  alternatives: ReportItem[];
  confidence: number; // 1..5, derived from cited sources
  sources: { url: string }[];
  partners: PartnerRef[]; // contextual suggestions (recommendation-first) — may be empty
  generated_at: string;
}
