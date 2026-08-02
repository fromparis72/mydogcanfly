// Country Entry Guide display types + data accessor.
//
// SOURCE OF TRUTH: content/countries/<slug>.yml (one bilingual guide per country).
// Do NOT edit countries.generated.json or hand-edit below — edit the YAML and run
// `node packages/knowledge/scripts/ingest-countries.mjs` (also in the deploy chain),
// which validates every guide against a Zod schema before regenerating.
import raw from "./countries.generated.json";

export type LT = { en: string; fr: string; es?: string };
export type Cls = "ok" | "no" | "warn" | "neutral";

export interface SummaryRow { requirement: LT; status: LT; cls: Cls }
export interface Factor { stars: number; label: LT; text: LT }
export interface ReqRow { item: LT; required: LT; when: LT; exceptions: LT; ref: LT }
export interface OriginBlock { title: LT; body: LT; cls?: Cls; /** Libellé de colonne propre à la fiche, quand le gabarit UE/listé/non listé ne s'applique pas. */ tag?: LT }
export interface SourceLink { label: LT; url: string }
/** Round-trip layer: the country's pet-movement regime + the sourced formalities to LEAVE it. */
export type Regime = "eu" | "listed" | "non_listed" | "island_controlled" | "island_strict";
export interface ExitStep { text: LT; timing: "before" | "window" | "longlead" }
export interface ExitBlock { authority: string; authorityUrl: string; intro: LT; steps: ExitStep[]; onSiteNote?: LT }
/** Domestic travel (same country both ends): no border → no import rules. What applies instead, + special territories. */
export interface DomesticTerritory { name: LT; note: LT; url?: string }
export interface DomesticBlock { intro: LT; points: LT[]; territories?: DomesticTerritory[] }

export interface CountryGuide {
  id: string;
  iso2: string;
  name: LT;
  region: LT;
  hero: { h1: LT; intro: LT };
  /** Difficulty verdict shown as a coloured gauge. */
  difficulty: { level: "easy" | "moderate" | "difficult"; label: LT };
  /** Estimated preparation time by traveller origin (rendered as a bar chart). */
  prepTime: { eu: LT; listed: LT; nonListed: LT };
  /** Quick at-a-glance requirement/status table. */
  summary: SummaryRow[];
  /** Highlighted "Important notice" box — bullet points + closing line. */
  notice: LT[];
  noticeClose: LT;
  /** "Before travelling" — the three factors that decide the requirements. */
  factors: { title: LT; intro: LT; items: Factor[]; note: LT };
  /** Detailed entry-requirements table. */
  requirements: ReqRow[];
  /** Rules according to the dog's origin — three blocks. */
  origin: { eu: OriginBlock; listed: OriginBlock; nonListed: OriginBlock };
  /** Arrival section. */
  arrival: { intro: LT; points: LT[] };
  /** Round-trip: country classification + how to LEAVE the country with a dog (optional). */
  regime?: Regime;
  exit?: ExitBlock;
  /** Domestic travel within this country (no border): what applies instead of import rules. */
  domestic?: DomesticBlock;
  /** Real traveller experience — null when no reliable documented feedback exists. */
  travellerExperience: LT | null;
  /** Restricted / categorised dogs. */
  restrictedDogs: { intro: LT; cat1: LT; cat2: LT; note: LT };
  /** Practical preparation checklist. */
  checklist: LT[];
  /** Official sources only. */
  sources: SourceLink[];
  seo: { title: LT; metaTitle: LT; metaDesc: LT; slug: string; shortDesc: LT };
  /** ISO date (YYYY-MM-DD) the official sources were last checked. */
  verified_date: string;
  reviewer: string;
  /** Reviewer confidence 1–5. */
  confidence: number;
}

/** All country guides, keyed by country id (e.g. "country_fr"). */
export const countryData = raw as unknown as Record<string, CountryGuide>;
