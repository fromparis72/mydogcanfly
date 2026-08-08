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
    weight_kg: z.number().positive().optional(),
    brachycephalic: z.boolean().optional(),
  }),
  travel_type: TravelType.default("pet"),
  placement: z.union([Placement, z.literal("any")]).default("any"),
  date: z.string().optional(),
  weather: z.object({ temperature_c: z.number() }).optional(),
  /* Retour vers l'UE — le seul fait que le moteur ne peut pas déduire du vol.
     On interroge le DOCUMENT détenu ("mon chien a-t-il un passeport européen dont la vaccination
     antirabique était déjà valide avant de quitter l'UE ?"), jamais l'origine ni le statut juridique
     de l'animal : c'est vérifiable par le visiteur en ouvrant le carnet, et c'est exactement la
     condition posée par la Commission pour se dispenser du certificat sanitaire.
     ABSENT ou "unknown" = on ne devine pas : les DEUX parcours (passeport et certificat) sont
     affichés. Ne jamais traiter l'absence de réponse comme un "no". */
  eu_passport: z.enum(["yes", "no", "unknown"]).optional(),
  locale: Locale.default("en"),
});
export type FinderRequest = z.infer<typeof FinderRequest>;

/* ---- Destination-finder input contract: "where can I fly my dog on this date?" ----
   Same dog + date model as the finder, but no fixed destination — the engine scans every
   country reachable from the origin and returns a compact per-destination match. */
export const DestinationsRequest = z.object({
  origin: z.string(),                       // representative origin airport id
  origins: z.array(z.string()).optional(),  // origin airport set (city search, e.g. Paris = CDG + ORY)
  dog: z.object({
    breed_id: z.string().optional(),
    weight_kg: z.number().positive().optional(),
    brachycephalic: z.boolean().optional(),
  }),
  placement: z.union([Placement, z.literal("any")]).default("any"),
  date: z.string().optional(),
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
  country_id?: string;        // the airline's home country (its flag/national carrier country)
  direct: boolean;            // likely a direct flight on this route (hub at origin or destination)
  carries_pets: boolean;      // true if the airline carries pets at all (a neutral dog) — distinguishes a low-cost "no pets" from "breed not accepted"
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
  origin_country_id: string; // home country of the origin airport — drives the "national carrier" ranking
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
  carries_pets?: boolean; // airline carries pets in general — false = structural "no pets" (low-cost); true but no mode = breed not accepted
  label: string;        // localized one-line verdict (e.g. "Cabin OK", "Hold only", "Not accepted")
  fee?: string;         // published fee for the accepted placement, when known
  source_url?: string;
  heat_embargo?: boolean; // true when a seasonal heat embargo suspends this airline's hold/cargo on the given date
  carrier_of_origin?: boolean;      // national/flag carrier of the departure country (ranked right after direct flights)
  carrier_of_destination?: boolean; // national/flag carrier of the destination country (ranked next)
  origin_airport_id?: string;       // the specific origin airport used, when it differs from the one searched (city search)
  destination_airport_id?: string;  // idem for the destination
}
export interface DecisionReport {
  verdict: "compatible" | "conditional" | "incompatible";
  /** 0..100 compatibility score — a transparent, rule-derived headline number (see explain.ts). */
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
