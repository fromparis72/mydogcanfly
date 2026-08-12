// Airline fiche display types + data accessor.
//
// SOURCE OF TRUTH: content/airlines/<slug>.yml (one bilingual fiche per airline).
// Do NOT edit airlines.generated.json or the data below by hand — edit the YAML, then run
// `npm run ingest`, which validates every fiche against a Zod schema before regenerating.
//
// L'ingestion ne tourne PAS toute seule : ni le build, ni `release`, ni la CI ne l'exécutent.
// Cette ligne affirmait le contraire (« also runs in the deploy chain ») depuis l'origine, et
// c'était faux — rien ne garantissait que ce fichier corresponde encore aux fiches. Ce qui la
// remplace n'est plus une promesse mais un contrôle : `npm run ingest:check` régénère en
// mémoire, compare aux artefacts versionnés et échoue sur tout écart, à chaque CI. Oublier
// l'ingestion après avoir édité une fiche est donc désormais visible, sans être automatique.
// Voir docs/pipeline-compagnies.md.
import raw from "./airlines.generated.json";

export type LT = { en: string; fr: string };
export type PillCls = "ok" | "no" | "warn" | "neutral";
export interface Pill { cls: PillCls; label: LT }
export interface Chip { icon: string; label: LT; cls?: PillCls }
export interface Channel { icon: string; name: LT; cls: PillCls; statusLabel: LT; detail: LT; fee: LT }
export interface LadderSeg { flex: number; color: string; label: LT; sub: string | LT }
export interface FareRow { zone: LT; cabin: string; hold: string }
export interface FareItem { label: LT; value: LT }
export interface RestrictionCard { icon: string; title: LT; pills: Pill[]; note: LT }
export interface InfoRow { icon: string; label: LT; value: LT }
export interface AirlineData {
  id?: string;
  mono: string;
  name: string;
  titleH1: LT;
  metaDesc: LT;
  chips: Chip[];
  verdict: Pill;
  verdictNote: LT;
  ladder: LadderSeg[];
  channels: Channel[];
  fareGrid?: { headCabin: LT; headHold: LT; rows: FareRow[]; note: LT };
  fareList?: { rows: FareItem[]; note: LT };
  restrictions: RestrictionCard[];
  /** Codes ISO 3166-1 alpha-2 des pays où la compagnie ne transporte aucun animal. */
  noPetCountries?: string[];
  crate?: LT[];
  temperature: { pills: Pill[]; note: LT };
  assistance: InfoRow[];
  goodToKnow: InfoRow[];
  book: { host: string; url: string };
  sources: LT;
  /** ISO date (YYYY-MM-DD) the official sources were last checked. */
  verified_date?: string;
}

/** All airline fiches, keyed by airline id (e.g. "airline_air_france"). */
export const airlineData = raw as unknown as Record<string, AirlineData>;
