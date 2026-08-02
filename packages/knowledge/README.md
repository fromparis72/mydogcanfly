# @mydogcanfly/knowledge

The **single source of truth** for MyDogCanFly. Airlines, countries, airports, breeds, rules, partners — as structured, versioned, sourced data. The Decision Engine and every interface read from here.

## Layout
```
knowledge/
  raw/           # human-authored source data (editable)
  normalized/    # build output — engine-ready (never hand-edited)   [generated]
  generated/     # build output — Level-1 static page artifacts       [generated]
  translations/  # localized strings, keyed by object_id.field (en, fr, es…)
  quality/       # validators: schema-check, rule-check, link-check, coverage
  src/           # Zod schemas + types + normalization + graph (the contracts)
```

## Pipeline (ADR-0012)
`raw/  →  normalize()  →  NormalizedKB (indexed + graph)  →  Decision Engine`

## Principles
- **Zod = one artifact** for schema + validation + TS types (ADR-0004). No hand-written interfaces.
- **Never hardcode airline rules** — all policy lives in `Rule` objects (ADR-0009).
- **Sourcing is a feature** — every rule carries `source` (url, type, verified/review dates, confidence, reviewer, history) (ADR-0006).
- **Language-neutral data** — human strings live in `translations/` (ADR-0005).

## Commands
```bash
npm run check       # schema-check + rule-check + coverage
```
