# @mydogcanfly/ui

Astro + TypeScript front-end: **component library + Homepage V2 shell** (ADR-0011). Static-first, interactive islands only where necessary, Cloudflare Pages compatible.

## What's here (Phase 1)
- `src/styles/tokens.css` — design tokens (structural only; brand/design deferred, ADR-0016).
- `src/layouts/Base.astro` — page shell (Header + Footer).
- `src/components/Header.astro` — product-logic nav (Logo · Flight Finder · Airlines · Countries · Tools · Travel Hub · About · Language · Account; no "Home").
- `src/components/FlightFinder.astro` — the flagship UI: static shell + **one island** that calls `/v1/finder` and renders a `DecisionReport`. Types come from `@mydogcanfly/engine` (contract-first).
- `src/pages/v1/finder.ts` — **mock** `/v1/finder` (prerendered static JSON; final response shape). Phase 2 swaps in the real Cloudflare Worker.
- `src/pages/index.astro` — Homepage V2 shell in the prescribed order: Hero → Flight Finder → Recommendation example → Trust → Tools → Travel Hub → Partners → Footer.

## Principles
Static by default · islands only where needed · shared types from `knowledge`/`engine` · no design work beyond clean structure · SEO-safe generated pages.

## Commands
```bash
npm run dev      # local preview
npm run build    # static build (Cloudflare Pages)
npm run check    # astro + TypeScript check
```

## Next
Homepage stays a shell until Phase 2 wires the real Worker `/v1/finder`, then entity pages (Airlines/Countries/Airports/Breeds) are generated from `@mydogcanfly/knowledge`.
