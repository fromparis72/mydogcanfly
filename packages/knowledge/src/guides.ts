import { z } from "zod";

/** A hand-authored Hub guide, ingested from Markdown into raw/guides.json.
 *  Presentation content only — never read by the Decision Engine or the Worker. */
export const GuideSource = z.object({
  id: z.string(),
  url: z.string(),
  publisher: z.string().optional(),
  accessed: z.string().optional(),
});
export type GuideSource = z.infer<typeof GuideSource>;

export const Guide = z.object({
  type: z.enum(["country_guide", "airline_guide", "breed_detail", "advice"]),
  entity_id: z.string().nullable(),
  slug: z.string(),
  locale: z.string(),
  title: z.string(),
  description: z.string().default(""),
  last_reviewed: z.string().nullable().optional(),
  html: z.string(),
  sources: z.array(GuideSource).default([]),
  policy_source: z.string().nullable().optional(),
});
export type Guide = z.infer<typeof Guide>;
