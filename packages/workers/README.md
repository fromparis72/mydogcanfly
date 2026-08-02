# @mydogcanfly/workers

Cloudflare Worker — the **API layer** (ADR-0010). It does routing + HTTP + CORS only. All business logic lives in `@mydogcanfly/engine`, all data in `@mydogcanfly/knowledge`.

```
Knowledge → Normalization → Decision Engine → Explanation Engine → Decision Report
 loadKB()                    runFinder = evaluate → explain
```

## Endpoints (v1)
```
POST /v1/finder   → DecisionReport   (real input; the live engine)
GET  /v1/finder   → DecisionReport   (default Golden Retriever → Japan; keeps the current UI working)
GET  /v1/health   → { ok: true }
```

- The knowledge base is normalized **once at cold start** and reused (low-cost).
- Output is the exact same typed `DecisionReport` the Astro UI already consumes — contract unchanged.

## Production routing
Route the Worker so the UI's same-origin path is served by it, unchanged:
```
mydogcanfly.com/v1/*      # (recommended — same origin, no CORS)
# or
api.mydogcanfly.com/*     # (dedicated subdomain; CORS already enabled)
```

## Commands
```bash
npm run smoke      # verify the live pipeline locally (no deploy needed)
npm run dev        # wrangler dev
npm run deploy     # wrangler deploy
```
