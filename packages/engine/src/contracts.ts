import { z } from "zod";
import { Placement, TravelType, Locale } from "@mydogcanfly/knowledge";

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
  date: z.string().optional(),
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
  weather: z.object({ temperature_c: z.number().min(-60).max(60) }).optional(),
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
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
function isDateInRange(d: string): boolean {
  if (!DATE_RE.test(d)) return false;
  const today = new Date();
  const todayIso = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate())).toISOString().slice(0, 10);
  if (d < todayIso) return false;
  const max = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 18, today.getUTCDate()));
  const maxIso = max.toISOString().slice(0, 10);
  return d <= maxIso;
}

export const DestinationsRequest = z.object({
  origin: z.string(),                       // representative origin airport id
  origins: z.array(z.string()).optional(),  // origin airport set (city search, e.g. Paris = CDG + ORY)
  dog: z.object({
    breed_id: z.string().optional(),
    weight_kg: z.number().positive().max(120).optional(), // même plafond que FinderRequest — cf. commentaire là-bas
    brachycephalic: z.boolean().optional(),
  }),
  placement: z.union([Placement, z.literal("any")]).default("any"),
  date: z.string().optional().refine((d) => !d || isDateInRange(d), {
    message: "date must be between today and 18 months from now",
  }),
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
  heat_embargo: boolean;     // estimate above the hold/cargo embargo threshold
  heat_risk: boolean;        // warm-but-not-embargo band
  airlines_total: number;    // direct, dog-accepting airlines on this route
  cabin_ok: boolean;
  hold_ok: boolean;
  placement_ok: boolean;     // the requested/deduced placement is feasible on ≥1 direct airline
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
  placements: { placement: string; allowed: boolean }[];
  fired: FiredRule[];
}
/** Seasonal climate context used for the heat-embargo filter (temperature-driven hold/cargo denials). */
export interface Climate {
  temperature_c: number; // temperature applied to the evaluation (explicit, or model-estimated from the date)
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
  cabin: boolean;
  hold: boolean;
  cargo: boolean;
  /* Vrai si la compagnie transporte des animaux en général (réévaluation avec un chien neutre).
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
  heat_embargo?: boolean; // true when a seasonal heat embargo suspends this airline's hold/cargo on the given date
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
  climate?: { temperature_c: number; estimated: boolean; embargo: boolean; risk: boolean; threshold_c: number };
  /** Affirmative "why it works" statements, in plain language (narrative-first report). */
  positives: ReportItem[];
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
