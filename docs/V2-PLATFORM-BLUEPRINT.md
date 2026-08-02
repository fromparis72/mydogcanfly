# MyDogCanFly — V2 Platform Blueprint

> **Working document — architecture & logic only. No design work in this phase.**
> Status: draft v0.1 · Owner: Philippe · Lead Engineer: Claude
> This document is the single source of truth for the V2 reboot. Every feature, page and line of code is judged against it.

---

## 0. The one-sentence test

> **"MyDogCanFly — the world's reference for flying with your dog."**

Every decision passes through a single gate:

> **Does this strengthen MyDogCanFly as the global reference for flying with a dog?**
> If it adds complexity without adding **trust, simplicity, or brand value** → don't build it.

We are building **"Google Flights for dogs"**, not a content website. We build a **brand before a business**; the website is only the first product. Future products (mobile app, API, AI assistant, airline integrations, premium services) all consume the *same* knowledge base and the *same* engine.

---

## 1. What we are / are not

| We ARE | We are NOT |
|---|---|
| Air Travel **Intelligence** Platform | Blog |
| **Decision** Platform | Forum |
| **Knowledge Graph** for dog air travel | Travel agency |
| Global **reference** | Pet shop |

The **Decision Engine is the product.** The website, app, API and AI assistant are **interfaces** over one knowledge base and one engine.

---

## 2. Global architecture (layered)

```
        ┌─────────────────────────────────────────────┐
        │                 KNOWLEDGE                    │  ← single source of truth (data)
        │  Airlines · Countries · Airports · Routes    │
        │  Breeds · Rules · Equipment · Partners       │
        └───────────────────────┬─────────────────────┘
                                │  (typed contracts / IDs)
        ┌───────────────────────▼─────────────────────┐
        │            DECISION ENGINE                   │  ← the product
        │  evaluate(Route × Dog) → Recommendations     │
        │  + Alerts, each one self-explaining          │
        └───────────────────────┬─────────────────────┘
                                │  (one API, versioned)
   ┌──────────┬─────────────────┼─────────────────┬──────────┐
   ▼          ▼                 ▼                 ▼          ▼
 WEBSITE     APP              API              AI ASSISTANT  PARTNERS
(static +   (mobile)      (public/B2B)       (RAG over KB)  (contextual)
 finder)
```

**Rule of the diagram:** interfaces never own logic or data. They call the engine or read generated artifacts. Move logic **down** the stack, never sideways into a page.

---

## 3. Technical foundation (decision + rationale)

**Decision:** evolve on the current Cloudflare stack, **contract-first** and **data-driven**. No big-bang rewrite.

| Layer | Technology | Why |
|---|---|---|
| Knowledge (source of truth) | Structured data files in Git (JSON/YAML), validated by schema; promoted to **D1** (SQL) when relational queries/scale demand it | Versionable, reviewable, diff-able, Cloudflare-first, migrates cleanly to D1 later. "Database before pages." |
| Generation | Static site generator (Hugo now, abstracted behind a data pipeline) renders **one page per entity** from the KB at build time | Static-whenever-possible, SEO is a build output, Cloudflare Pages CDN. |
| Decision Engine | **Cloudflare Worker** reading the KB (KV/D1 cache) | Dynamic where needed (the Finder), edge-fast, already deployed for the weather proxy. |
| API | The Worker **is** the API (versioned `/v1/...`), JSON contracts | Web, app, AI all consume the same endpoints. "API-ready" for free. |
| Cache/state | KV (read cache), D1 (relational + user data later) | Cloudflare-first. |

**Why not a full app-framework rewrite now?** It would trade months of migration for zero new user value and put the existing SEO at risk. We get 90% of the "product platform" benefit by (a) making data the source of truth and (b) exposing the engine as an API — both doable incrementally. We revisit the front-end framework **only** if the finder UX outgrows progressive enhancement.

**Challenge to the brief — Phase order.** Your Phase 1 (Homepage/Nav/Components) precedes Phase 2 (Engine/Knowledge). A homepage whose hero *is* the Flight Finder cannot exist before the Finder's data contract exists. Resolution without changing your phases: **Phase 1 defines the data contracts + builds components against fixtures; Phase 2 implements the real KB + engine behind the identical contracts.** This is contract-first / interface-first development — it honours both your ordering and the golden rule "database before pages."

---

## 4. Core objects (the data model)

Twelve first-class objects. **Everything references IDs. Nothing is duplicated.** A field that could be derived is derived, never copied.

| Object | Purpose | Key fields (illustrative) | References |
|---|---|---|---|
| **Airline** | A carrier | `id`, `iata`, `name`, `country_id`, `alliance`, `website`, `contact` | → Country |
| **Country** | A jurisdiction | `id`, `iso2`, `name`, `region`, `pet_scheme` | — |
| **Airport** | A node | `id`, `iata`, `name`, `country_id`, `city`, `geo` | → Country |
| **Breed** | A dog breed | `id`, `name`, `size`, `weight_kg`, `brachycephalic`, `coat` | — |
| **Dog** | A user's dog (instance) | `id`, `breed_id`, `weight_kg`, `age`, `microchip`, `flags` | → Breed |
| **Route** | An origin→destination intent | `id`, `origin_airport_id`, `dest_airport_id`, `transit[]` | → Airport |
| **Rule** | **One atomic, sourced policy** | see §5 | → any object |
| **Equipment** | Crates, carriers, gear | `id`, `type`, `iata_compliant`, `dims`, `max_weight`, `partner_id` | → Partner |
| **Partner** | A monetizable relationship | `id`, `vertical`, `name`, `affiliate`, `regions[]` | — |
| **Recommendation** | Engine output (computed) | verdict, options[], explanation[], confidence | derived |
| **Alert** | A blocker/warning (computed or scheduled) | severity, scope, message, source | derived |
| **User** | Account (Phase 5) | `id`, `locale`, `dogs[]`, `saved_routes[]`, `alerts_opt_in` | → Dog, Route |

**i18n rule:** entity data is **language-neutral** (IDs, ISO codes, numbers, booleans, dates). Human strings (names, descriptions, rule rationale) live in a **localized strings layer** keyed by `object_id + field + locale`. We never fork the data per language.

---

## 5. The Rule model (the anti-hardcoding core)

**Never hardcode airline logic. Never write page-specific logic.** All policy lives in **Rule** objects that a generic evaluator reads. A page never "knows" a rule; it renders the engine's output.

A Rule is data:

```jsonc
{
  "id": "rule_af_brachy_hold_ban",
  "scope": { "type": "airline", "id": "airline_air_france" },
  "applies_when": {                       // structured predicate over Dog/Route/Season
    "all": [
      { "fact": "dog.brachycephalic", "op": "eq", "value": true },
      { "fact": "placement", "op": "in", "value": ["hold", "cargo"] }
    ]
  },
  "effect": { "action": "deny", "placement": ["hold", "cargo"] },
  "params": {},                            // e.g. max_weight_kg, max_dims_cm, fee, docs[], lead_time_days
  "rationale": "Air France refuses brachycephalic breeds in hold/cargo for welfare reasons.",
  "source": { "url": "https://…", "last_verified": "2026-07-01", "confidence": "high" }
}
```

Design principles:
- **Expressive but not Turing-complete.** A small predicate grammar (`all/any/not` + `fact/op/value`) covers real airline/country policies without a bespoke DSL. Resist gold-plating.
- **Every rule is sourced and dated.** `source.last_verified` + `confidence` feed the engine's confidence score and our **Trust** positioning. A rule with no source is not shippable.
- **Rules compose.** Country import rules + airline placement rules + breed restrictions + crate/IATA constraints + seasonal heat embargoes are all just Rules with different `scope`. The evaluator treats them uniformly.
- **Every recommendation explains itself** by listing the Rules that fired, in plain language, with sources.

---

## 6. Decision Engine — Flight Finder (Phase 2 contract)

**Input**
```jsonc
POST /v1/finder
{ "origin": "airport_cdg", "destination": "airport_jfk",
  "dog": { "breed_id": "breed_french_bulldog", "weight_kg": 11 },
  "preferences": { "placement": "any", "date": "2026-08-15" },
  "locale": "en" }
```

**Pipeline**
1. Resolve candidate **Airlines** serving the Route (or Route-pair via transit).
2. Gather applicable **Rules**: destination import + origin export + transit + airline placement + breed + crate/IATA + season/heat.
3. Evaluate each airline option → verdict per placement (`cabin | hold | cargo | forbidden`) with constraints (max weight/dims, fees, required docs, lead time).
4. Rank options (feasibility → welfare → cost → convenience).
5. Attach **explanation[]** (fired rules + sources) and **confidence** (from rule freshness/coverage).
6. Emit **Alerts** for blockers (e.g., "JFK requires titer test 3 months prior") and warnings (heat embargo window).

**Output**
```jsonc
{ "verdict": "conditional",
  "options": [
    { "airline_id": "airline_...", "placement": "cabin",
      "constraints": { "max_weight_kg": 8, "crate": "soft_under_seat" },
      "requirements": ["microchip","rabies_vaccine","usda_endorsement"],
      "estimated_cost": { "amount": 150, "currency": "USD" },
      "confidence": "high",
      "explanation": [ { "rule_id": "...", "text": "...", "source": "..." } ] }
  ],
  "alerts": [ { "severity": "blocker", "text": "...", "source": "..." } ],
  "partners": [ /* only where contextually valuable — see §9 */ ] }
```

The **website, app and AI assistant call this same endpoint.** The AI assistant is RAG over the KB + this engine, never a parallel source of truth.

---

## 7. Tools (the primary asset)

Tools are the platform's moat — **the goal is the world's largest collection of dog-air-travel tools.** Every new article is first tested: *can it be a tool?* If yes, the tool wins. Priority order:

1. **Flight Finder** (the engine's flagship UI)
2. Airline Comparator
3. Country Rules
4. Crate Finder
5. Travel Timeline
6. Airport Guide
7. Cost Calculator
8. Insurance Comparator
9. Heat Risk Calculator *(exists — becomes an engine module + Alert source)*

Each tool is a **thin UI over the engine/KB**, not a silo. They share components and data.

---

## 8. Entity-first SEO & generation

**SEO is a consequence of architecture, not a content farm.**

- **One page per object**: Airline, Country, Airport, Breed, Route, Tool, Guide — all **generated from the KB**. No manual pages when avoidable.
- **Schema.org everywhere**, mapped per type (Airline→Organization/Service, Country/Airport→Place, Breed→custom + FAQ, Route→custom decision + FAQ, Tool→SoftwareApplication/HowTo).
- **Internal linking by entity**: an Airline page links the Countries it serves and Breeds it restricts; a Route page links its Airline + Country + Breed; a Breed page links airlines that restrict it. The graph *is* the link structure.
- **Travel Hub replaces "Blog."** It is platform documentation — guides that support entities, not standalone SEO bait.
- **Challenge — route-page explosion.** Airline × country-pair × breed is combinatorial. Generating all of it = doorway-page risk (kills Trust). **Recommendation:** statically generate only **high-demand corridors** and canonical entity pages; serve the long tail through the **dynamic Finder**. Quality over page count.

---

## 9. Partners & affiliation (recommendation-first)

**Recommendation first, affiliate second. No affiliate link without contextual value.** A Partner appears only when the engine has a genuine reason to surface it at that moment (e.g., insurance on a route that requires vet endorsement; a crate that matches the computed IATA dimensions).

Vertical priority: **Airlines · Insurance · Hotels · Equipment · Airport Parking · Airport Transfer · Veterinary · Car Rental.**

Partners are objects referenced by ID and injected by the engine into `recommendation.partners[]` — never hardcoded into pages.

---

## 10. Homepage & navigation (information architecture — no visual design yet)

**Objective:** understand the product in **≤10s**, launch the Flight Finder in **≤20s**. One objective per page, **one CTA per screen**.

**Header:** `Logo · Flight Finder · Airlines · Countries · Tools · Travel Hub · About · Language · Account` — **no "Home"** (logo returns home).

**Homepage order:**
```
Header → Hero → Flight Finder → Recommendation example → Trust → Tools → Travel Hub → Partners → Footer
```
The **Flight Finder is always visible**; it becomes a **sticky search bar** after scroll (the "Google Flights" pattern).

**Design north star (for the later design phase, not now):** Stripe · Linear · Apple · Google · Vercel — minimal, premium, fast, no visual noise.

---

## 11. Engineering guardrails (non-negotiable)

- Never duplicate data. Never hardcode airline rules. Never create page-specific logic.
- Every component is reusable, scalable, internationalized.
- Every recommendation explains itself (fired rules + sources).
- Every object has one page; every page one objective; every screen one CTA.
- Static whenever possible. Cloudflare-first.
- Everything data-driven. Nothing hardcoded. Everything reusable.
- Trust before SEO. Product before content. Database before pages.
- The Lead Engineer **challenges weak ideas and proposes better alternatives** — decisions are documented here.

---

## 12. Roadmap (your phases, with contract-first refinement)

| Phase | Scope (your brief) | Engineering note |
|---|---|---|
| **1** | Architecture · Homepage · Navigation · Components | + **Define data contracts & schema now**; build components against fixtures. Ship the IA + component library + Finder shell wired to a mock `/v1/finder`. |
| **2** | Flight Engine · Knowledge · Recommendations | Implement KB (Airlines/Countries/Breeds/Airports first) + Rule model + engine behind the Phase-1 contracts. Real `/v1/finder`. |
| **3** | Airlines · Countries · Routes | Migrate existing prose pages → structured records → **generated** entity pages. High-demand routes only. |
| **4** | SEO · Travel Hub · Schema | Entity-first generation, Schema.org, internal-linking graph, Travel Hub restructure. |
| **5** | Affiliation · User Accounts · Notifications | Contextual partners; users (saved dogs/routes); rule-change & heat alerts (leverages existing scheduled tasks). |
| **6** | API · Mobile App · AI | Publicize the versioned API; mobile app on the same engine; AI assistant = RAG over KB + engine. |

---

## 13. Migration map (existing → structured)

| Today (V1) | Becomes (V2) |
|---|---|
| ~40 airline policy `.md` pages | **Airline** records + **Rule** records → generated pages |
| Country entry pages + `dog-entry` tool data | **Country** records + import **Rule**s |
| `races.json` (169 breeds) | **Breed** records |
| Crate calculator logic | **Equipment** (crate) + IATA **Rule**s (data, not code) |
| Heat tool + `/dog-heat-safety/` pages | Heat **Rule**s + **Alert** source; breed pages link to Breed entities |
| Blog posts | **Travel Hub** guides attached to entities |
| Cloudflare Worker (weather proxy) | Extended into the **Decision Engine / API** |

**Inversion to internalize:** today pages are the source of truth; in V2 **data is the source of truth and pages are generated output.** Phase 3 is where that inversion happens for airlines/countries.

---

## 14. Open decisions (need your call)

1. **Data format for the KB v1:** JSON in Git (simplest, review-friendly) → promote to D1 in Phase 2/3? (My reco: **yes, JSON-in-Git first**.)
2. **Route strategy confirmation:** canonical entities + high-demand routes static, long tail dynamic? (My reco: **yes** — protects Trust.)
3. **i18n launch languages** for V2 (EN + FR first, then?).
4. **Airline data sourcing standard:** every Rule needs `source` + `last_verified`. Do we set a re-verification cadence (e.g., quarterly) now?

---

*Next working documents to produce on request: `V2-DATA-SCHEMA.md` (formal entity + Rule JSON schemas), `V2-DECISION-ENGINE.md` (full evaluator spec + API reference), `V2-COMPONENT-LIBRARY.md` (Phase-1 component inventory & contracts).*
