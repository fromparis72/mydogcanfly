# Architecture Decision Record — MyDogCanFly V2

> ADR log. Each structural decision is recorded once, with rationale, so we don't re-litigate it in six months.
> Format per entry: **Context · Decision · Rationale · Consequences · Status**. Status ∈ {accepted, superseded, proposed}.

---

## ADR-0001 — Monorepo layout `packages/{knowledge, engine, ui, workers}`
- **Context:** V2 is a platform (web + app + API + AI), not a website. Code must be shared across interfaces.
- **Decision:** One repository, four packages:
  - `knowledge/` — the single source of truth: data (JSON), schemas, types, validation.
  - `engine/` — the Decision Engine (pure, framework-agnostic logic + contracts).
  - `ui/` — component library & design system (front-end framework TBD — see ADR-0011).
  - `workers/` — Cloudflare Workers exposing the engine as a versioned API.
- **Rationale:** logic lives once, low in the stack; interfaces are thin consumers. Enforces "no page-specific logic."
- **Consequences:** npm workspaces; every interface imports `@mydogcanfly/knowledge` / `@mydogcanfly/engine`. The existing Hugo site remains at repo root during migration and is progressively replaced.
- **Status:** accepted.

## ADR-0002 — Knowledge Base storage: JSON in Git now, D1 only if justified
- **Decision:** KB is **JSON versioned in Git** in Phase 1. Migrate to **Cloudflare D1** only when *measured* constraints (dataset size, relational queries, write concurrency) require it.
- **Rationale:** diff-able, reviewable, PR-based data governance, zero infra. "Database before pages" is about *structure*, not about a server. D1 migration is mechanical once the schema is stable.
- **Consequences:** the schema (ADR-0004) is designed to map cleanly to SQL later. No feature may assume a live DB before Phase 3.
- **Status:** accepted.

## ADR-0003 — "Static by default, dynamic by necessity" (hybrid rendering)
- **Decision:** Two tiers.
  - **Level 1 — static, generated from the KB:** entity pages (Airlines, Countries, Airports) + **major corridors** (high-demand routes).
  - **Level 2 — dynamic Decision Engine (Workers):** *all* origin×destination×dog combinations, on demand.
- **Rationale:** SEO + speed + Cloudflare-first for the finite, high-value set; the engine handles the combinatorial long tail without generating millions of doorway pages (protects Trust).
- **Consequences:** we never statically generate the full route matrix. Route long-tail = engine only.
- **Status:** accepted.

## ADR-0004 — Contracts with Zod (schema + validation + types = one artifact)
- **Decision:** Define all data contracts in **Zod**; derive TypeScript types via `z.infer`. No hand-written interfaces duplicating schemas.
- **Rationale:** golden rule "never duplicate data" applies to *contracts* too. One definition → runtime validation (KB integrity, API input) **and** static types (web/app/engine). Resolves the "schemas Phase 1 vs validation Phase 2" tension: it's the same artifact, validation is just switched on in CI.
- **Consequences:** Zod is a shared dependency of `knowledge` and `engine`.
- **Status:** accepted.

## ADR-0005 — Multilingual strategy (phased) + language-neutral data
- **Decision:** Launch **EN + FR** (Phase 1) → **ES** (Phase 2) → **DE** (Phase 3) → **IT/NL/PT** (Phase 4) → **JA** only if traffic justifies it. Entity data is **language-neutral** (IDs, ISO codes, numbers, dates, booleans); human strings live in a **localized strings layer** keyed by `object_id · field · locale`.
- **Rationale:** "two excellent languages beat ten mediocre ones." ES chosen for large market, low competition, strong SEO ROI. Never fork the data per language.
- **Consequences:** `LocalizedText` type (EN required, others optional). Translation is additive, never a data copy.
- **Status:** accepted.

## ADR-0006 — Sourcing is a product feature (provenance on every fact)
- **Decision:** Every fact carries a `Source`: `url`, `source_type`, `verified_date`, `review_due`, `confidence` (★1–5), `reviewer`, `history[]`.
- **Rationale:** Trust is the positioning. A rule with no source is not shippable. Provenance is displayed to users and feeds the engine's confidence score.
- **Consequences:** authoring cost per rule; enforced by schema (Source required on every `Rule`).
- **Status:** accepted.

## ADR-0007 — Review cadence + "Fast Update"
- **Decision:** Tiered re-verification: **Airlines every 90 days**, **Countries every 180 days** (override immediately on any regulatory alert), **Equipment yearly**. `review_due` is **derived** from `verified_date` + cadence (single source, not hand-typed). **Fast Update:** a user-reported error auto-creates a verification task immediately — no waiting for the cycle.
- **Rationale:** volatility differs by domain; freshness is a trust signal; crowdsourced error-reporting shortens the correction loop.
- **Consequences:** a scheduled job flags overdue sources; the Fast Update pipeline is built in Phase 5 (notifications) reusing existing scheduled-task infra.
- **Status:** accepted.

## ADR-0008 — Data criticality tiers
- **Decision:** Every rule has a `criticality`: **critical** (vaccination, import rules, breed ban) · **high** (cabin weight, crate size) · **medium** (fees) · **low** (tips/advice).
- **Rationale:** criticality drives (a) how prominently the engine surfaces it (blocker vs info), (b) review urgency, (c) confidence weighting. A wrong "critical" fact can strand a dog; a wrong "fee" is minor.
- **Consequences:** `Criticality` enum on `Rule`; Alerts inherit severity from criticality.
- **Status:** accepted.

## ADR-0009 — Airline logic is never hardcoded (Rule model)
- **Decision:** All policy is data — `Rule { scope, applies_when (predicate), effect, params, rationale, source, criticality }`. A generic evaluator reads rules; no page or module encodes an airline's policy in code.
- **Rationale:** golden rules "never hardcode airline rules / never create page-specific logic." Adding an airline = adding data, not code.
- **Consequences:** a small predicate grammar (`all/any/not` + `fact/op/value`); deliberately not a Turing-complete DSL (avoid gold-plating).
- **Status:** accepted.

## ADR-0010 — Decision Engine exposed as a Cloudflare Worker API
- **Decision:** The engine is a pure function `evaluate(KB, FinderRequest) → FinderResponse`, deployed behind a versioned Worker API (`/v1/finder`, …). Website, App and AI assistant all consume the **same** API.
- **Rationale:** one brain, many interfaces. "API-ready, mobile-ready" become free. The AI assistant is RAG over KB + this engine, never a parallel truth.
- **Consequences:** the existing weather-proxy Worker is extended into this API.
- **Status:** accepted.

## ADR-0011 — Front-end framework for `packages/ui` (OPEN)
- **Context:** `ui/` must deliver a TypeScript component library + design system + static entity pages + an interactive Finder island, Cloudflare-first, i18n, SEO-as-build-output. Current site is Hugo (Go templates) — cannot provide a TS component library/design system.
- **Proposed:** **Astro** — static-first, native TS, component islands for the Finder, first-class i18n, Cloudflare Pages, incremental migration from Hugo, shares types with `engine`/`knowledge`. Alternatives: Next.js (heavier, more "app"), keep-Hugo-hybrid (no real design system).
- **Decision:** **Astro + TypeScript on Cloudflare Pages.** Confirmed by CTO 2026-07-08. No Next.js comparison needed.
- **Rationale (CTO):** best alignment with static-first; excellent for SEO / generated pages; interactive islands ideal for the Finder; healthier progressive migration from Hugo; minimal infra cost; no needless React/SSR complexity; native Cloudflare Pages; shared types with `knowledge` and `engine`.
- **Consequences:** `packages/ui` is an Astro project (design tokens + components + the Finder island). Interactivity via Astro `<script>` islands, not a React runtime. Cloudflare adapter added only when SSR/API endpoints are needed (Phase 2). Hugo is migrated page-type by page-type; both coexist during transition.
- **Status:** accepted.

## ADR-0012 — Normalization layer (raw → normalized → generated)
- **Context:** authored knowledge is heterogeneous (different airlines document policies differently). The engine needs a uniform shape.
- **Decision:** insert a **Normalization** layer between Knowledge and the Decision Engine. `knowledge/raw/` (human-authored, per-entity) → **normalize()** → `knowledge/normalized/` (validated, indexed by ID, `review_due` derived, graph built) → **generate()** → `knowledge/generated/` (Level-1 static page artifacts). Full layering: `Knowledge → Normalization → Decision Engine → Explanation Engine → API → Interfaces`.
- **Rationale:** the engine must never parse raw heterogeneity or page-specific shapes. Normalization is the single choke point where data is validated, deduplicated, cross-referenced and made engine-ready.
- **Consequences:** the engine only ever reads `normalized/`. `raw/` is the editable source; `normalized/` and `generated/` are build outputs (never hand-edited).
- **Status:** accepted.

## ADR-0013 — Decision Engine vs Explanation Engine; the Decision Report
- **Decision:** two separate components. **Decision Engine** = pure evaluation: `evaluate(normalizedKB, FinderRequest) → Decision` (which rules fired, per-placement verdicts). **Explanation Engine** = `explain(Decision, locale) → DecisionReport` with sections **Compatible · Conditions · Warnings · Risks · Alternatives · Confidence · Sources**.
- **Rationale:** "every recommendation explains itself." Separating computation from narration keeps the engine testable and lets the same Decision power different explanations (web, AI assistant, app), localized.
- **Consequences:** `DecisionReport` is the public output contract consumed by all interfaces. Confidence is computed from the freshness/coverage of the cited sources.
- **Status:** accepted.

## ADR-0014 — Knowledge is a graph (entities + typed relationships)
- **Decision:** model knowledge as a graph: **entities** (Airline, Country, Airport, Breed…) connected by **typed relationships** (`airline SERVES country`, `airline BASED_IN country`, `airport LOCATED_IN country`, `breed RESTRICTED_BY airline`, `route FROM/TO airport`). The graph is built during normalization.
- **Rationale:** the graph *is* both the engine's traversal structure (find airlines serving a route) and the site's internal-linking structure (entity-first SEO). One structure, two payoffs.
- **Consequences:** relationships are derived from entity references, never duplicated. Internal links are generated from graph edges.
- **Status:** accepted.

## ADR-0015 — Quality gates in `knowledge/quality/`
- **Decision:** knowledge ships with automated validators: **schema-check** (Zod), **rule-check** (predicate facts valid, sources present, `review_due` not overdue), **link-check** (source URLs resolve), **coverage** (every airline/country has minimum required rules). CI blocks on failure.
- **Rationale:** Trust is the product. Data quality is enforced, not hoped for.
- **Status:** accepted.

## ADR-0016 — Brand & design system live in `packages/ui/`
- **Decision:** brand assets and rules (voice, tone, identity, colors, logo, icons, illustrations, animations) live in `packages/ui/` as the design system, applied in the design phase — **not now** (per brief: architecture before design).
- **Rationale:** "build a brand before a business"; a single design system keeps every interface on-brand.
- **Status:** accepted (assets deferred to design phase).
