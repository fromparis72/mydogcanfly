import { z } from "zod";

/* ---- Localization (ADR-0005) — data stays language-neutral; strings localized ---- */
export const LOCALES = ["en", "fr", "es", "de", "it", "nl", "pt", "ja"] as const;
export const Locale = z.enum(LOCALES);
export type Locale = z.infer<typeof Locale>;

/** English required; other locales optional. */
export const LocalizedText = z.object({ en: z.string().min(1) }).catchall(z.string());

/**
 * Date de voyage — contrat PARTAGÉ (lot P0-A, 12/08/2026).
 *
 * `FinderRequest` et `DestinationsRequest` validaient la date chacun de leur côté, par expression
 * régulière et comparaison lexicographique. Résultat mesuré : `"garbage"`, `"2026-00-15"`,
 * `"2026-13-01"` et `"2027-02-30"` étaient tous acceptés — et le moteur en dérivait un mois
 * `NaN`, `0`, `13` ou `2`, c'est-à-dire une valeur qui viole son propre registre de faits.
 *
 * `z.string().date()` fait une vraie validation CALENDAIRE (le 30 février est refusé). La plage
 * reste la même : de ce jour à 18 mois — au-delà, ni le réseau de routes ni les règles ne sont
 * garantis stables, et rien dans le référentiel ne modélise leur évolution.
 */
/* ---- Température : provenance et statut de placement (P0 climat, 13/08/2026) ----
 *
 * Mesuré avant d'écrire : les deux modèles de température du site (région et latitude) divergent
 * sur 72 catégories visibles et 126 décisions de canal pour 231 cas, et 491 refus fermes reposent
 * sur une température que personne n'a mesurée. Principe du lot, validé en revue : AUCUNE
 * estimation ne produit seule un refus dur — elle produit `confirmation_required`.
 *
 * La provenance est posée PAR LE SERVEUR, jamais par le client : `FinderRequest.weather` est un
 * objet `strict()` qui ne transporte qu'un nombre. Une valeur entrante est `visitor_input` ;
 * l'absence de valeur fait estimer le moteur, qui étiquette lui-même `estimated_region` (Finder)
 * ou `estimated_latitude` (Destinations, via l'option interne d'`evaluate()`). `sourced` est
 * réservé à une future source climatique par aéroport : AUCUNE branche du code ne le produit
 * aujourd'hui — il est donc inconstructible depuis une requête, par construction.
 */
export const TemperatureProvenance = z.enum([
  "visitor_input", "estimated_region", "estimated_latitude", "sourced",
]);
export type TemperatureProvenance = z.infer<typeof TemperatureProvenance>;
export const isEstimatedTemperature = (p: TemperatureProvenance): boolean => p.startsWith("estimated_");

export const TemperatureReading = z.object({
  value_c: z.number().min(-60).max(60),
  provenance: TemperatureProvenance,
}).strict();
export type TemperatureReading = z.infer<typeof TemperatureReading>;

/**
 * Statut d'un couple (compagnie, canal). `denied` DOMINE `confirmation_required`, qui domine
 * `allowed` : un canal fermé par une règle de race ne devient jamais « à confirmer » parce qu'un
 * embargo estimé s'y ajoute. Les booléens historiques (`allowed`, `cabin_ok`…) ne valent `true`
 * QUE pour `allowed` — un statut « à confirmer » n'est jamais rendu comme disponible.
 */
export const PlacementStatus = z.enum(["allowed", "denied", "confirmation_required"]);
export type PlacementStatus = z.infer<typeof PlacementStatus>;

export const TRAVEL_DATE_HORIZON_MONTHS = 18;

/**
 * Bornes de la date de voyage. L'horloge est INJECTABLE pour que les tests puissent viser la
 * frontière au jour près plutôt qu'une date lointaine choisie au hasard.
 *
 * Fin de mois : `Date.UTC(y, m + 18, 31)` déborderait sur le mois suivant — « 31 août + 18 mois »
 * deviendrait le 3 mars au lieu du 28 ou 29 février. Le jour est donc ramené au dernier jour du
 * mois cible, ce qui rend l'horizon exactement de 18 mois et jamais « 18 mois et quelques jours ».
 */
export const travelDateBounds = (now: Date = new Date()): { min: string; max: string } => {
  const y = now.getUTCFullYear(), m = now.getUTCMonth(), d = now.getUTCDate();
  const min = new Date(Date.UTC(y, m, d));
  const lastDayOfTarget = new Date(Date.UTC(y, m + TRAVEL_DATE_HORIZON_MONTHS + 1, 0)).getUTCDate();
  const max = new Date(Date.UTC(y, m + TRAVEL_DATE_HORIZON_MONTHS, Math.min(d, lastDayOfTarget)));
  return { min: min.toISOString().slice(0, 10), max: max.toISOString().slice(0, 10) };
};

export const TravelDate = z.string().date().refine((d) => {
  const { min, max } = travelDateBounds();
  return d >= min && d <= max;
}, { message: `la date de voyage doit être comprise entre aujourd'hui et ${TRAVEL_DATE_HORIZON_MONTHS} mois` });
export type TravelDate = z.infer<typeof TravelDate>;
export type LocalizedText = z.infer<typeof LocalizedText>;

/* ---- Enumerations ---- */
export const Placement = z.enum(["cabin", "hold", "cargo"]);
export type Placement = z.infer<typeof Placement>;

export const TravelType = z.enum(["pet", "service_dog", "emotional_support", "military"]);
export type TravelType = z.infer<typeof TravelType>;

export const DogSize = z.enum(["toy", "small", "medium", "large", "giant"]);
export type DogSize = z.infer<typeof DogSize>;

export const RuleCategory = z.enum([
  "vaccination", "import_rules", "breed_ban", "cabin_weight", "hold_weight", "crate_size",
  "fees", "summer_embargo", "placement", "tips",
]);
export type RuleCategory = z.infer<typeof RuleCategory>;

/** Drives surfacing + review urgency (ADR-0008). */
export const Criticality = z.enum(["critical", "high", "medium", "low"]);
export type Criticality = z.infer<typeof Criticality>;

export const Money = z.object({ amount: z.number().nonnegative(), currency: z.string().length(3) });
export type Money = z.infer<typeof Money>;

/** Branded id helper: enforces "<prefix>_<slug>". */
export const id = (prefix: string) =>
  z.string().regex(new RegExp(`^${prefix}_[a-z0-9_]+$`), `expected "${prefix}_…" id`);

/* ---- Sourcing is a product feature (ADR-0006). Provenance on every fact. ---- */
export const SourceType = z.enum([
  "official_website", "regulation", "government", "airline_contact", "press", "other",
]);
/**
 * Types de source pouvant fonder un FAIT MÉTIER. Un article de presse ou un « other » documentent
 * un contexte ; ils ne ferment pas un canal à un chien.
 *
 * DÉFINI ICI, ET PLUS DANS `breed-restrictions.ts`. Trois fichiers avaient besoin de cette liste —
 * la preuve d'une restriction de race, la projection d'une politique de canal, la qualification
 * d'un lien officiel. La recopier trois fois, c'est la garantie qu'elles divergeront : c'est
 * exactement la faute que ce dépôt documente partout ailleurs. `common.ts` n'importe que `zod`,
 * donc tout le monde peut la lire sans cycle.
 */
export const FACTUAL_SOURCE_TYPES = [
  "official_website", "regulation", "government", "airline_contact",
] as const;

/** Domaines qui ne peuvent JAMAIS fonder un fait métier — nous compris, sous-domaines inclus. */
export const FORBIDDEN_SOURCE_DOMAINS = ["mydogcanfly.com"] as const;

/** Hostname normalisé : minuscules, point final retiré, préfixe `www.` conservé tel quel. */
export const normalizeHost = (url: string): string =>
  new URL(url).hostname.toLowerCase().replace(/\.+$/, "");

/** `true` si l'URL est une de nos pages. Une URL illisible n'est pas une auto-citation. */
export const isForbiddenSource = (url: string | undefined | null): boolean => {
  if (!url) return false;
  let host: string;
  try { host = normalizeHost(String(url)); } catch { return false; }
  return FORBIDDEN_SOURCE_DOMAINS.some((d) => host === d || host.endsWith("." + d));
};

export const ReviewEvent = z.object({
  date: z.string().date(),
  reviewer: z.string(),
  note: z.string().optional(),
});
export const Source = z.object({
  url: z.string().url(),
  source_type: SourceType,
  verified_date: z.string().date(),
  review_due: z.string().date(),
  confidence: z.number().int().min(1).max(5), // ★ 1–5
  reviewer: z.string(),
  history: z.array(ReviewEvent).default([]),
});
export type Source = z.infer<typeof Source>;

/* ---- Review cadence policy (ADR-0007). review_due is derived, never hand-typed. ---- */
export const REVIEW_CADENCE_DAYS = {
  airline: 90, country: 180, equipment: 365, breed: 365, route: 90, global: 180,
} as const;
export type ReviewDomain = keyof typeof REVIEW_CADENCE_DAYS;

export function reviewDueFrom(verifiedDate: string, domain: ReviewDomain): string {
  const d = new Date(verifiedDate + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + REVIEW_CADENCE_DAYS[domain]);
  return d.toISOString().slice(0, 10);
}
