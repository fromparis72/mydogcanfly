import { z } from "zod";

/* ---- Localization (ADR-0005) — data stays language-neutral; strings localized ---- */
export const LOCALES = ["en", "fr", "es", "de", "it", "nl", "pt", "ja"] as const;
export const Locale = z.enum(LOCALES);
export type Locale = z.infer<typeof Locale>;

/** English required; other locales optional. */
export const LocalizedText = z.object({ en: z.string().min(1) }).catchall(z.string());
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
