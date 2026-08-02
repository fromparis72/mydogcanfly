import { defineConfig } from "astro/config";

// Static by default (ADR-0003). The Cloudflare adapter is added only when SSR/API
// endpoints go live (Phase 2). For now the Finder targets a prerendered mock /v1/finder.
export default defineConfig({
  site: "https://mydogcanfly.com",
  output: "static",
  // outDir overridable for sharded builds (see src/lib/buildShard.ts). Default "dist".
  outDir: process.env.OUTDIR || "dist",
});
