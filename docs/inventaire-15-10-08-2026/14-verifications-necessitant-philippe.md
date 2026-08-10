# §15 — Liste exacte des vérifications nécessitant Philippe ou un accès Cloudflare en lecture

**Aucun secret ne doit être collé dans cette conversation ni dans aucun document versionné. Ce qui suit demande soit un accès au dashboard Cloudflare, soit une réponse factuelle de Philippe (existence/volumétrie), jamais une valeur de credential.**

## Confirmées nécessaires par la contre-revue Codex du 10/08/2026

1. **Base D1 legacy** (`worker/wrangler.toml`, binding `DB`, base `mydogcanfly`, id `4a0e2131-ed9e-4049-bbe4-6a0eccd58aad`) — existe-t-elle encore côté Cloudflare ? Contient-elle des lignes (abonnés confirmés) ? Une simple réponse « oui, N abonnés » / « non, vide » / « n'existe plus » suffit, aucune donnée personnelle n'a besoin de sortir de ce diagnostic.
2. **Cron triggers** — le déclencheur horaire (`crons = ["0 * * * *"]` dans `worker/wrangler.toml`) est-il actif sur Cloudflare aujourd'hui, et sur quel Worker (legacy ou V2) ?
3. **Historique des déploiements Worker** — quel Worker (`worker/src/worker.js` ou `packages/workers/src/index.ts`) a été déployé en dernier sous le nom `mydogcanfly-api`, et à quelle date ? Ceci confirmerait/affinerait l'estimation faite par test indirect (document 10 : antérieur au 10/08 09:48, probablement le commit `heat` du 09/08 18:32).
4. **Bindings KV/D1 réellement associés au Worker actif** — le Worker qui répond aujourd'hui sous `mydogcanfly-api` a-t-il accès au KV `WX_CACHE` et au D1 `DB`, ou tourne-t-il sans eux (cohérent avec le fait que `packages/workers/wrangler.toml` n'en déclare aucun) ?
5. **Routes et custom domains actuels** — état réel des routes de zone (`mydogcanfly.com/v1/*`, `www.mydogcanfly.com/v1/*`, `api.mydogcanfly.com`) et de tout attachement de domaine personnalisé au projet Pages `mydogcanfly-v2-preview`.
6. **Projet Cloudflare Pages du site Hugo principal** — quel est son nom, existe-t-il encore séparément du V2, ou a-t-il été remplacé ?
7. **Preview Pages vs preview Worker — deux pipelines distincts, à ne pas confondre (ajouté suite à la contre-revue Codex, tour 3)** :
   - **Preview Worker** : `packages/workers/wrangler.toml` a un `[env.preview]` distinct et fonctionnel — `npx wrangler deploy --env preview` et son URL `workers.dev` sont utilisables dès aujourd'hui, indépendamment de tout le reste. Aucune ambiguïté connue sur ce pipeline.
   - **Preview Pages** : le seul script de déploiement du dépôt (`npm run release`) cible le projet Cloudflare Pages `mydogcanfly-v2-preview`, mais avec `--branch=main` — pas une branche `preview` distincte. Le nom du projet ne prouve pas qu'il est sans effet sur la production, et `--branch=main` peut représenter la branche de production réelle de ce projet Pages. **Question à Philippe, à répondre avant tout `npm run release`** : ce projet Pages est-il bien un environnement de preview isolé, ou sert-il (ou pourrait-il servir) du trafic réel ? Si la réponse n'est pas claire depuis le dashboard, la lecture de la configuration Cloudflare (domaines attachés à ce projet, branche de production déclarée) tranchera.
   - Cette clarification est nécessaire avant le déploiement en attente du changement New York (`new-york-grouping-10-08.patch`, déjà commité) et avant tout déploiement futur du site (Pages), mais ne bloque en rien le pipeline preview du Worker, qui peut être utilisé dès maintenant pour les prochains changements du moteur/API.

## Déjà tranchées sans accès Cloudflare (pour référence, ne pas re-demander)

- État du V2 en production (page d'accueil) — confirmé par test HTTP/navigateur public, document 10 DR-01.
- Collision de nom entre les deux Workers avec effet réel (404 sur les routes legacy) — confirmé par test HTTP public, document 02 §3bis.
- Staleness du Worker de production par rapport à `origin/main` — confirmé par test HTTP public (règle Melbourne absente), document 10.
- Vulnérabilité de falsification de `fiche.astro` — confirmée par lecture de code + test navigateur réel, document 10 #2 et document 11.

## Ce que Claude ne demande jamais

Aucun token, aucune clé API, aucun mot de passe. Si une de ces vérifications nécessite que Philippe partage une capture d'écran du dashboard ou colle un résultat de commande `wrangler` déjà authentifiée sur son poste, c'est suffisant — Claude n'a besoin que du résultat, jamais du moyen d'y accéder.
