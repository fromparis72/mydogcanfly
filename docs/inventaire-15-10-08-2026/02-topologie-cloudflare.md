# §15.2 — Topologie Cloudflare connue via le dépôt

**SHA de référence : `e2b27799de335558afc165ee1763ad4613ca4ed9` (origin/main).**
Aucun accès à l'API/dashboard Cloudflare n'a été utilisé pour ce document — tout est déduit du code versionné. Tout ce qui concerne l'état réellement déployé est marqué **NON VÉRIFIABLE SANS ACCÈS CLOUDFLARE**.

## 1. Deux fichiers `wrangler.toml`, deux Workers indépendants

### A. `worker/wrangler.toml` (Worker legacy, à la racine du dépôt)
```
name = "mydogcanfly-api"
main = "src/worker.js"
compatibility_date = "2024-11-01"
```
- KV : binding `WX_CACHE` (cache météo), id `000166c4cf944aecac2ab079c2385a6b`.
- D1 : binding `DB`, base `mydogcanfly`, id `4a0e2131-ed9e-4049-bbe4-6a0eccd58aad`.
- Route custom domain : `api.mydogcanfly.com`.
- Cron horaire : `crons = ["0 * * * *"]` (alertes/rappels).
- `[vars]` : `SITE_URL`, `API_URL=https://api.mydogcanfly.com`, `FROM_EMAIL`, `HEAT_MIN_LEVEL=3`.
- Pas d'`env.preview`/`env.production` — configuration à plat, un seul environnement implicite.
- Code source : `worker/src/worker.js` (344 lignes) + `worker/schema.sql`.

### B. `packages/workers/wrangler.toml` (Worker V2)
```
name = "mydogcanfly-api"
main = "src/index.ts"
compatibility_date = "2024-09-01"
```
- `[env.preview]` : `name = "mydogcanfly-api-preview"`, `workers_dev = true` → `https://mydogcanfly-api-preview.<subdomain>.workers.dev`.
- `[env.production]` : `name = "mydogcanfly-api"`, `workers_dev = false`, routes :
  - `mydogcanfly.com/v1/*`
  - `www.mydogcanfly.com/v1/*` (ajoutée après un incident documenté en commentaire dans le fichier lui-même : le 30/07/2026, un visiteur arrivé par `www` recevait un 405 sur `POST /v1/finder`, et l'ancien Finder retombait sur un snapshot de démo au lieu d'une erreur explicite).
- Pas de KV/D1 déclarés. Code : `packages/workers/src/index.ts` — commentaire explicite : *« No business logic, no data — those live in @mydogcanfly/engine »* (routing HTTP seul, ADR-0010).

## 2. Incohérence structurelle confirmée par le code : collision de nom

**Les deux Workers déclarent le même nom Cloudflare `"mydogcanfly-api"` pour ce qui est présenté comme un déploiement de production dans les deux cas** :
- `worker/wrangler.toml:1` → `name = "mydogcanfly-api"` (déploiement à plat, `wrangler deploy` simple).
- `packages/workers/wrangler.toml:18` (`[env.production]`) → `name = "mydogcanfly-api"`.

Sur Cloudflare, un nom de Worker est unique par compte. Deux codes sources et bindings totalement différents (legacy : `src/worker.js` + KV/D1/cron horaire ; V2 : `src/index.ts` + routes `/v1/*`) se disputent le même nom : **un déploiement de l'un écrase potentiellement l'autre**, selon lequel a été déployé en dernier. C'est un risque de configuration réel, visible dans le code, indépendamment de l'état actuellement déployé.

Le commentaire interne à `packages/workers/wrangler.toml` documentant l'incident du 30/07/2026 sur `mydogcanfly.com/v1/health` suggère qu'au moins le Worker V2 a été déployé en production à un moment donné.

## 3. Projets Cloudflare Pages mentionnés dans le dépôt

| Projet | Où | Détail |
|---|---|---|
| `mydogcanfly-v2-preview` | `package.json:15` (script `release`), `docs/ROADMAP.md:199`, `docs/V2-DEPLOYMENT.md:43,61` | Seul projet Pages nommé pour le site principal. Le script réel déploie sur la branche `main` ; `docs/V2-DEPLOYMENT.md` mentionne la branche `preview` — divergence de nommage entre doc et script réel. |
| *(site Hugo principal)* | — | **Aucun nom de projet Pages trouvé nulle part dans le dépôt** pour le site Hugo en production. |
| `lechienvoyageur.com` | `deploy/BRIEF-lechienvoyageur.md` | Projet Pages tiers, distinct, connecté à GitHub (build Hugo automatique à chaque push), en cours de redirection 301 vers `mydogcanfly.com`. |

## 3bis. Confirmation en direct (10/08/2026, suite à la contre-revue Codex)

Ce qui était classé « non vérifiable sans accès Cloudflare » en §4 (version précédente) a en partie été tranché par des requêtes HTTP publiques, sans aucun accès Cloudflare :

- `mydogcanfly.com/v1/health` → `200 {"ok":true,"service":"mydogcanfly-api","version":"v1"}`
- `api.mydogcanfly.com/v1/health` → **le même JSON, exactement**
- `api.mydogcanfly.com/api/weather`, `/api/confirm`, `/api/unsubscribe` (les 3 routes propres au Worker legacy, `worker/src/worker.js`) → **404 sur les trois**

`worker/src/worker.js` n'a jamais eu de route `/v1/*`. La seule explication cohérente : **le Worker V2 répond aujourd'hui sous le nom `mydogcanfly-api`, sur les deux domaines** — le Worker legacy a perdu son propre domaine `api.mydogcanfly.com`, ou son code n'est simplement plus celui qui tourne sous ce nom. Ce n'est plus une hypothèse de collision *possible* (§2 ci-dessus), c'est une collision confirmée avec effet réel.

**Conséquence potentiellement grave, non quantifiée** : si la base D1 legacy (binding `DB`, base `mydogcanfly`) contient des abonnés réels aux alertes (chaleur, rappels), leurs liens de confirmation/désinscription envoyés par email pointent vers des routes qui répondent 404 aujourd'hui. Voir document 09 (DR-11) et document 14 pour la vérification exacte à demander à Philippe (lecture D1, hors de portée de Claude).

## 4. Ce qui reste NON VÉRIFIABLE SANS ACCÈS CLOUDFLARE

- Lequel des deux Workers (legacy ou V2, ou lequel en dernier déploiement) est réellement actif aujourd'hui sous le nom `mydogcanfly-api`.
- L'état réel des routes de zone Cloudflare (`mydogcanfly.com/v1/*`, `www.mydogcanfly.com/v1/*`, redirection `www` → apex mentionnée dans `docs/ROADMAP.md`).
- L'existence et la configuration du projet Pages du site Hugo principal (nom, domaine attaché, build settings).
- Si/comment le projet Pages `mydogcanfly-v2-preview` est ou non attaché à un domaine personnalisé.
- L'état du projet Pages `lechienvoyageur.com` et l'application effective des 334 règles de `deploy/_redirects`.
- Tout DNS, certificat, Page Rule, KV/D1 réellement provisionné (les ID vus dans `worker/wrangler.toml` prouvent une intention de configuration, pas un état actif).

## 5. Conséquence pour la suite du chantier

Ce document motive directement deux points du §15.9 (DECISION_REQUIRED) : (a) la collision de nom entre les deux Workers doit être résolue — laquelle des deux configurations `wrangler.toml` reflète l'état réel, et laquelle doit être retirée ou renommée ; (b) Philippe est la seule personne qui puisse confirmer l'état réel du dashboard Cloudflare (Workers actifs, projets Pages, routes de zone), information qu'aucune lecture du dépôt ne peut fournir.
