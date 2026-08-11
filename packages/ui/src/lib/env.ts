/**
 * Environment gate. SAFE BY DEFAULT: anything that is not explicitly "production"
 * is treated as non-indexable (local + preview), so a preview deploy can never leak into search.
 * Set PUBLIC_SITE_ENV=production only on the real production build.
 */
export const SITE_ENV: string = (import.meta.env.PUBLIC_SITE_ENV as string | undefined) ?? "preview";
export const IS_PRODUCTION: boolean = SITE_ENV === "production";

/**
 * Base URL of the Decision Engine API (the Cloudflare Worker).
 *
 * Chaîne vide = same-origin. Ce n'est PAS un repli : le commentaire précédent parlait d'un
 * « static build-time snapshot as a fallback » supprimé le 30/07/2026 (c'était un rapport
 * « CDG → Tokyo » écrit en dur, servi à la place des vraies recherches — voir
 * src/pages/v1/finder.ts). Le Finder ne fait que des POST, avec une seule relance ; en
 * same-origin statique ce POST échoue, puisque la route prérendue n'expose qu'un GET.
 *
 * En preview, PUBLIC_API_BASE doit porter une URL Worker VERSIONNÉE, jamais l'alias partagé qui
 * est mutable : `npm run deploy:preview` s'en charge (voir docs/V2-DEPLOYMENT.md).
 * Variable lue au BUILD (inlinée par Vite), jamais au déploiement.
 */
export const API_BASE: string = (import.meta.env.PUBLIC_API_BASE as string | undefined) ?? "";
