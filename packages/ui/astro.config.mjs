import { defineConfig } from "astro/config";

// Static by default (ADR-0003). The Cloudflare adapter is added only when SSR/API
// endpoints go live (Phase 2). Le Finder interroge le Worker via PUBLIC_API_BASE (inlinée au
// build) — et non, comme l'affirmait ce commentaire jusqu'au 11/08/2026, « a prerendered mock
// /v1/finder » : ce mock a été supprimé le 30/07/2026, la route prérendue n'expose plus qu'un
// GET renvoyant un refus explicite (voir src/pages/v1/finder.ts).
export default defineConfig({
  site: "https://mydogcanfly.com",
  output: "static",
  // outDir overridable for sharded builds (see src/lib/buildShard.ts). Default "dist".
  outDir: process.env.OUTDIR || "dist",
});
