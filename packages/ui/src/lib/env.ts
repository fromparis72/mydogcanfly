/**
 * Environment gate. SAFE BY DEFAULT: anything that is not explicitly "production"
 * is treated as non-indexable (local + preview), so a preview deploy can never leak into search.
 * Set PUBLIC_SITE_ENV=production only on the real production build.
 */
export const SITE_ENV: string = (import.meta.env.PUBLIC_SITE_ENV as string | undefined) ?? "preview";
export const IS_PRODUCTION: boolean = SITE_ENV === "production";

/**
 * Base URL of the Decision Engine API (the Cloudflare Worker).
 * Empty string = same-origin (uses the static build-time snapshot as a fallback).
 * Set PUBLIC_API_BASE to the Worker URL so the Finder POSTs real inputs to the live engine.
 */
export const API_BASE: string = (import.meta.env.PUBLIC_API_BASE as string | undefined) ?? "";
