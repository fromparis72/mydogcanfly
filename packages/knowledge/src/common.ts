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
