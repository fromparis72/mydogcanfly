import objects from "../raw/objects.json";
import rules from "../raw/rules.json";
import guidesRaw from "../raw/guides.json";
import { normalize, type NormalizedKB, type RawKB } from "./normalize";
import { Guide, type Guide as TGuide } from "./guides";

/**
 * The authored knowledge base, bundled from `raw/`. Data lives in this package (never in the Worker).
 * Callers normalize once (Worker cold start, or at build time) and reuse.
 */
export const rawKB = { ...(objects as Record<string, unknown>), rules } as unknown as RawKB;

/** Normalized, engine-ready knowledge base. */
export function loadKB(): NormalizedKB {
  return normalize(rawKB);
}

/** Hub guides (presentation-only). Loaded at build time by the UI, never by the engine. */
const GUIDES: TGuide[] = (guidesRaw as unknown[]).map((g) => Guide.parse(g));

/** The guide attached to an entity in a given locale, or null. */
export function guideFor(entityId: string, locale: string): TGuide | null {
  return GUIDES.find((g) => g.entity_id === entityId && g.locale === locale) ?? null;
}

/** A standalone (advice) or entity guide by type + slug + locale, or null. */
export function guideBySlug(type: string, slug: string, locale: string): TGuide | null {
  return GUIDES.find((g) => g.type === type && g.slug === slug && g.locale === locale) ?? null;
}

/** All guides (e.g. to generate advice routes or sitemaps). */
export function allGuides(): TGuide[] {
  return GUIDES;
}
