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
export type Placement = "cabin" | "hold" | "cargo";
/** LE canal, TEL QU'IL S'AFFICHE — et rien de plus depuis T0-B2.
 *
 *  `cls` et `statusLabel` sont ÉDITORIAUX : une couleur de pastille et une étiquette écrites à la
 *  main dans la fiche. Ils ne décident de rien. La décision se lit dans `policies[placement]`,
 *  la seule source canonique. Les faire décider a produit exactement le défaut relevé au
 *  contre-test du 15/08/2026 : 78 canaux affichaient « Autorisé » ou « Non autorisé » là où la
 *  politique dit « à confirmer ». `placement` est le lien entre les deux. */
export interface Channel { placement: Placement; icon: string; name: LT; cls: PillCls; statusLabel: LT; detail: LT; fee: LT }
/** La preuve rattachée à UNE politique de canal — jamais à la fiche entière. */
export interface PolicySource {
  url: string;
  source_type: string;
  verified_date: string;
  review_due?: string;
  confidence: number;
  reviewer?: string;
  quote?: string;
  quote_language?: string;
  locator?: string;
}
/** LA décision, forme d'auteur canonique (T0-B2) : exactement un discriminant.
 *  `availability` dit ce que la COMPAGNIE propose ; `review_state` dit que NOTRE donnée n'a pas
 *  été revérifiée — deux choses différentes, jamais confondues. */
export type PolicyAuthored =
  | { availability: "offered" | "not_offered" | "case_by_case" | "undocumented"; source?: PolicySource; derived_from_fiche?: boolean }
  | { review_state: "legacy_unreviewed"; source?: PolicySource; derived_from_fiche?: boolean };
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
  /** La décision telle que la FICHE l'écrit, reprise dans l'artefact. Déclarée parce qu'elle y
   *  est — un champ présent dans la donnée et absent du type est exactement ce qui a fait
   *  disparaître `brachy_allowed` pendant six semaines.
   *
   *  L'AFFICHAGE, lui, ne la lit PAS : la fiche compagnie rend la politique RUNTIME
   *  (`kb.airlines.get(id).premium.policy[placement]`), le même objet que celui dont le moteur
   *  tire les cartes du Finder. Deux chemins de lecture pour une même décision finissent par
   *  diverger, et c'est cette divergence que le contre-test du 15/08/2026 a trouvée. */
  policies: Partial<Record<Placement, PolicyAuthored>>;
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
