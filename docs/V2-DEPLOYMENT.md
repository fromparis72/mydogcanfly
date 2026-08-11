# MyDogCanFly V2 — Déploiement, previews et sécurité de migration

> **Ce document décrivait jusqu'au 11/08/2026 un état qui n'existe plus.** Il présentait V2 comme
> une expérimentation à valider sur une URL de preview pendant que Hugo tenait la production, avec
> une mise en production « plus tard ». **V2 est en production depuis.** Toutes les sections
> ci-dessous ont été réécrites d'après la topologie Cloudflare réelle, relevée sur le dashboard et
> recoupée par requêtes directes.

L'application V2 vit dans `packages/ui` (Astro) et `packages/workers` (l'API). Le site Hugo à la
racine du dépôt n'est plus servi sur le domaine.

---

## 0. Topologie réelle — à lire avant tout

Le point le plus déroutant, et la source de la plupart des erreurs passées :

> **Le projet Cloudflare Pages `mydogcanfly-v2-preview` est le projet de PRODUCTION**, malgré son
> nom. Ce nom est un vestige de la phase d'expérimentation ; le renommer n'est pas possible sans
> recréer le projet, donc il reste.

| | |
|---|---|
| Projet Pages de production | **`mydogcanfly-v2-preview`** |
| Branche de production | **`main`** |
| Domaines personnalisés | **déjà attachés** à ce projet (`mydogcanfly.com`, `www` en redirection 301 vers l'apex) |
| Previews isolées | déploiements **`review-<sha>`** sur **ce même projet** — donc en `*.pages.dev` uniquement, jamais sur le domaine |
| Projet Pages `mydogcanfly` (Hugo) | **aucun domaine personnalisé**, subsiste en `mydogcanfly.pages.dev`, orphelin |
| `npm run release` | **déploie DIRECTEMENT EN PRODUCTION** (`--branch=main` sur le projet ci-dessus) |

**Conséquences pratiques :**

- Previews et production **partagent un projet Pages**. Le `noindex` par défaut n'est donc pas une
  précaution théorique : c'est ce qui empêche des milliers de pages de preview d'être indexées
  depuis le même projet que le site live.
- `npm run release` n'a pas de filet. Il n'y a pas d'étape de validation intermédiaire : ce qu'on
  lance part en production.
- Une preview ne peut pas « fuiter » sur le domaine, parce que Cloudflare ne route les domaines
  personnalisés que vers la branche de production.

## Règles de sécurité

- **Tout ce qui n'est pas production est `noindex` par défaut** : sauf `PUBLIC_SITE_ENV=production`,
  chaque page émet `<meta name="robots" content="noindex, nofollow">` et `robots.txt` renvoie
  `Disallow: /`. Sécurité par défaut : c'est l'absence de la variable qui protège, pas sa présence.
- **Le Worker API porte un nom et une route distincts par environnement.** Preview = sous-domaine
  `workers.dev`, sans route personnalisée. Production = routes sur `mydogcanfly.com/v1/*`.
- **Une preview soumise à contre-test est épinglée sur une version Worker précise** (voir §2).

---

## 1. Environnements

| Env | UI (`packages/ui`) | API (`packages/workers`) | Indexable |
|---|---|---|---|
| **local** | `npm run dev -w @mydogcanfly/ui` (`localhost:4321`) | `npx wrangler dev` (`localhost:8787`) | non (`noindex`) |
| **preview** | `npm run deploy:preview` → déploiement `review-<sha>` en `*.pages.dev` | version Worker épinglée `<version>-mydogcanfly-api-preview.*.workers.dev` | **non** (`noindex` + `robots Disallow`) |
| **production** | `npm run release` → branche `main`, domaine attaché | `wrangler deploy --env production` (routes `mydogcanfly.com/v1/*`) | oui |

Le seul commutateur d'indexation est **`PUBLIC_SITE_ENV`** : non défini / `preview` / `local` →
`noindex` ; `production` → indexable, `robots Allow`, sitemap référencé.

### `PUBLIC_API_BASE` — quel moteur le Finder interroge

Variable **de build** (`PUBLIC_`, inlinée par Vite dans l'îlot du Finder ; `src/lib/env.ts` →
`API_BASE`). Elle est lue **au build, jamais au déploiement** : déployer un `dist/` construit sans
elle expédie un Finder cassé sans que le déploiement échoue. Cette régression s'est produite deux
fois (10 et 11/08/2026), d'où les garde-fous du §2. Elle est orthogonale à `PUBLIC_SITE_ENV` :
la définir n'affecte pas l'indexation.

| Env | `PUBLIC_API_BASE` | Le Finder appelle | Notes |
|---|---|---|---|
| **local** | non défini, ou `http://localhost:8787` | rien, ou le Worker `wrangler dev` | Laisser vide ne donne aucun repli : le Finder affiche une erreur. |
| **preview** | **URL Worker versionnée**, ex. `https://9c3ae533-mydogcanfly-api-preview.fromparis.workers.dev` | cette version précise (cross-origin, CORS) | Injectée par `npm run deploy:preview`. **Jamais l'alias partagé** (§2). |
| **production** | non défini (same-origin) | `/v1/*` via la route Cloudflare `mydogcanfly.com/v1/*` | Pas de cross-origin, pas de CORS : la route Worker est sur le domaine live. |

### Il n'y a aucun repli

Le Finder émet **uniquement des `POST`** sur `${API_BASE}/v1/finder`, avec **une seule relance** en
cas d'échec transitoire (`for (let attempt = 0; attempt < 2; attempt++)`, et une réponse 4xx
interrompt la boucle : réessayer n'aiderait pas). Il n'y a **ni repli en `GET`, ni réponse statique
de secours**. Un corps sans `verdict` est rejeté quel que soit le code HTTP.

Ce document décrivait auparavant un repli `GET` plus un instantané statique calculé au build. Les
deux ont été supprimés le 30/07/2026 : l'instantané était un rapport « CDG → Tokyo » écrit en dur,
servi à toute requête `GET`. En développement, `POST` sur une route prérendue n'existant pas, le
Finder retombait systématiquement dessus — tout semblait fonctionner alors que rien n'était calculé.
En production, le moindre `POST` en échec affichait ce voyage au Japon à la place de la recherche du
visiteur, ce qu'un utilisateur a fini par signaler.

`packages/ui/src/pages/v1/finder.ts` subsiste, **délibérément inerte**, et n'exporte qu'un `GET`.
En same-origin sur le site statique, un `POST` sur ce chemin **échoue** (aucun gestionnaire `POST`
sur un fichier prérendu) ; **seule une requête `GET`** y renvoie le corps inerte
`{"error":"not_available_here"}`, dépourvu du champ `verdict` que le Finder exige pour afficher un
rapport. Aucune couche du site ne peut donc plus présenter un exemple comme une réponse.

---

## 2. Déployer une preview

### Pourquoi l'alias Worker partagé est proscrit

`https://mydogcanfly-api-preview.fromparis.workers.dev` (sans préfixe) est **mutable** : il désigne
le déploiement Worker actif du moment. Une preview Pages construite contre lui n'est immuable qu'en
apparence — ses fichiers statiques sont figés, mais le moteur qu'ils interrogent change à chaque
promotion. Un contre-test validé la veille peut ainsi porter, le lendemain, sur un backend qui
n'existe plus.

Cloudflare attribue à chaque **version** Worker une URL propre
(`<8 caractères de l'id>-<worker>.<sous-domaine>`). `build-preview.mjs` refuse tout `--api-base` qui
ne serait pas une URL versionnée conforme.

L'alias ne bouge que sur commande explicite après contre-test : il signifie « dernière preview
**approuvée** », pas « dernier code téléversé ».

### La commande

```bash
npm run deploy:preview
```

Sept étapes vérifiées, chacune bloquante : arbre Git propre **et** `HEAD == origin/main` (sans
dérogation) → `versions upload` taguée `git-<sha>` → sélection de la version par ce tag,
correspondance unique exigée → `/v1/health` relu sur l'URL versionnée jusqu'à double concordance
(SHA **et** identifiant de version) → build épinglé → `pages deploy --branch=review-<sha>` → smoke
HTTP de la preview publiée (200, `noindex`, bundle épinglé). Un manifeste est écrit dans
`.artifacts/previews/<sha>/manifest.json` (dossier non versionné).

Pour exploiter le manifeste en sortie, `--silent` est **obligatoire** : sans lui, npm mêle son
préambule au JSON sur stdout.

```bash
npm run --silent deploy:preview -- --json | jq .worker_version_id
```

Puis, **seulement après un contre-test navigateur concluant** :

```bash
npm run promote:preview-alias -- .artifacts/previews/<sha>/manifest.json
```

Cette commande revérifie le manifeste, le tag auprès de Cloudflare, la santé de la version, promeut
l'alias, puis **relit l'alias** jusqu'à concordance avant d'annoncer quoi que ce soit.

`npm run build:preview` seul reste possible pour du dépannage, mais construit contre l'alias mutable
et l'annonce bruyamment : son résultat n'est pas soumettable à contre-test.

---

## 3. Worker API — plan de routage

| Env | Commande | Surface |
|---|---|---|
| local | `npx wrangler dev` (dans `packages/workers`) | `http://localhost:8787/v1/finder` |
| **preview** | `npm run deploy:preview` (qui appelle `versions upload`) | `https://<version>-mydogcanfly-api-preview.<sub>.workers.dev/v1/*` — **aucune route personnalisée** |
| **production** | `npx wrangler deploy --env production --var BUILD_SHA:$(git rev-parse HEAD)` | routes `mydogcanfly.com/v1/*` et `www.mydogcanfly.com/v1/*` |

Endpoints : `POST /v1/finder` (corps JSON), `GET /v1/finder` (**lit la query string**, et répond 400
avec le mode d'emploi s'il n'y a rien à lire — ce n'est plus une démo par défaut), `GET /v1/health`.

`/v1/health` renvoie `{ ok, service, version, sha, worker_version_id }` avec `Cache-Control:
no-store`. Les deux identifiants sont de natures différentes et c'est leur **couple** qui fait la
traçabilité : `sha` est *déclaré* par la commande de déploiement (donc falsifiable),
`worker_version_id` est *attribué par Cloudflare* au code réellement reçu. Ne jamais conclure qu'un
déploiement correspond à `origin/main` sans avoir lu les deux.

> **État au 11/08/2026** : le Worker de **production** répond encore
> `{"ok":true,"service":"mydogcanfly-api","version":"v1"}`, **sans `sha` ni `worker_version_id`**.
> Il est donc antérieur au correctif de traçabilité et n'est, à ce jour, pas traçable. Le Worker de
> preview, lui, expose les deux champs.

CORS est activé, donc l'UI de preview peut appeler le Worker de preview en cross-origin.

---

## 4. Contrôles avant déploiement

Depuis la racine — tout doit passer :

```bash
npm run check                  # portes qualité de la base de connaissances (schéma · règles · couverture)
npm run typecheck              # knowledge · engine · workers
npm run smoke                  # moteur en direct via le Worker (EN + FR + partenaires + garde-fou affiliation)
node test-preview-select.mjs   # sélection de version Worker + double concordance (hors ligne)
```

Les deux harnais suivants lisent le HTML **construit** : ils exigent un `packages/ui/dist` à jour et
doivent donc être lancés **après** un build.

```bash
node test-fiche-harness.cjs
node test-flightfinder-harness.cjs
```

Pour une **preview**, ne pas construire à la main : `npm run deploy:preview` enchaîne le build,
vérifie lui-même `noindex` sur la totalité des pages ainsi que l'épinglage du bundle, puis interroge
la preview publiée.

Pour un build de **production** (`npm run build:prod`), que ces automatismes ne couvrent pas :

- [ ] `packages/ui/dist/robots.txt` → `Allow: /` + `Sitemap:`
- [ ] `packages/ui/dist/sitemap.xml` existe et liste les URL des 4 langues avec alternates hreflang
- [ ] les pages **ne** portent **pas** `<meta name="robots" content="noindex, nofollow">`
- [ ] `hreflang` + canonical auto-référent présents sur les pages d'entité
- [ ] aucun lien sortant affilié/sponsorisé pour un partenaire non `active`
- [ ] contrôle des liens internes : 0 cassé

---

## 5. Vérification du sitemap

- Généré au build par `src/pages/sitemap.xml.ts` depuis la base de connaissances (4 langues, hreflang).
- Vérifier : `test -s packages/ui/dist/sitemap.xml && grep -c "<loc>" packages/ui/dist/sitemap.xml`
- En production, `robots.txt` le référence ; en preview il existe mais l'exploration est bloquée par `Disallow: /`.

---

## 6. Robots / noindex

- **`robots.txt`** dépend de l'environnement (`src/pages/robots.txt.ts`) : `Disallow: /` sauf `PUBLIC_SITE_ENV=production`.
- **Meta par page** : `<meta name="robots" content="noindex, nofollow">` sur chaque page sauf en production (`src/lib/env.ts` → `Base.astro`).
- Double protection : un déploiement de preview ne peut pas être indexé même si un robot ignore `robots.txt`.
- Ce point est d'autant plus critique que previews et production **partagent le même projet Pages** (§0).

---

## 7. Revenir en arrière

- **UI (Pages)** : dashboard Cloudflare → projet `mydogcanfly-v2-preview` → *Deployments* →
  **Rollback** vers un déploiement antérieur de la branche `main`. C'est un retour arrière **de
  production** : le domaine suit immédiatement.
- **Worker de preview** : `npx wrangler rollback --env preview`, ou `npx wrangler deployments list`
  puis `wrangler rollback [id] --env preview`. On peut aussi repointer l'alias sur une version
  antérieure avec `npm run promote:preview-alias` à partir d'un manifeste plus ancien.
- **Worker de production** : `npx wrangler rollback --env production`.
- **Git** : la pile V2 vit sous `packages/`, `docs/`, `ARCHITECTURE_DECISIONS.md`, et les
  `package.json`/`tsconfig.base.json` racine.

Le site Hugo à la racine du dépôt **n'est plus un filet de secours** : son projet Pages
(`mydogcanfly`) n'a aucun domaine personnalisé attaché. Revenir à Hugo supposerait de réattacher le
domaine à ce projet — une opération manuelle sur le dashboard, pas un `git revert`.

---

## 8. Déployer en production

```bash
npm run release
```

**Cette commande part directement en production.** Elle enchaîne `build:prod` (avec
`PUBLIC_SITE_ENV=production`), `verify:index`, puis `pages deploy --branch=main` sur le projet
auquel le domaine est attaché. Il n'y a **aucune étape de validation intermédiaire** : pas de
preview implicite, pas de confirmation.

Faire précéder d'un `npm run deploy:preview` et d'un contre-test navigateur sur la preview
correspondante — c'est le seul filet existant, et il est volontaire, pas automatique.

Le Worker de production se déploie **séparément** ; déployer le site ne le met pas à jour :

```bash
npx wrangler deploy --config packages/workers/wrangler.toml --env production --var BUILD_SHA:$(git rev-parse HEAD)
curl -s https://mydogcanfly.com/v1/health
```

Le `curl` doit renvoyer le SHA qui vient d'être déployé. S'il renvoie `unknown`, ou un corps sans
champ `sha`, le déploiement n'est pas traçable — ne pas conclure qu'il correspond à `origin/main`.
