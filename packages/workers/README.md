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
GET  /v1/health   → { ok: true, service, version, sha, worker_version_id }
                    en-tête : Cache-Control: no-store
```

Deux identifiants, de natures différentes — c'est leur **couple** qui fait la traçabilité :

| Champ | Origine | Ce que ça prouve |
|---|---|---|
| `sha` | **déclaré** par la commande de déploiement (variable `BUILD_SHA`) | le commit que l'opérateur affirme avoir déployé |
| `worker_version_id` | **attribué par Cloudflare** (binding Version Metadata) | la version de code que Cloudflare a réellement reçue et sert |

`sha` seul ne prouve rien : c'est une chaîne que la commande a bien voulu annoncer, et rien
n'empêche de la faire mentir. `worker_version_id` seul ne dit rien du code source. Ensemble,
consignés dans le manifeste de déploiement, ils relient un commit Git à une version Cloudflare
vérifiable.

```bash
npx wrangler deploy --env preview --var BUILD_SHA:$(git rev-parse HEAD)
```

Sans ce drapeau, `sha` vaut `"unknown"` : le Worker reste fonctionnel mais se déclare
non traçable. Ne jamais conclure qu'un déploiement correspond à `origin/main` sans avoir lu
ce champ — c'est précisément la déduction indirecte que l'inventaire (document 10) a dû retirer,
faute de SHA exposé.

`Cache-Control: no-store` est explicite : l'absence d'en-tête de cache dans les relevés n'est
pas une interdiction contractuelle de mise en cache. Comme cet endpoint sert à vérifier les
déploiements, une réponse servie depuis un cache y ferait conclure à tort qu'un déploiement
n'est pas passé.

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
