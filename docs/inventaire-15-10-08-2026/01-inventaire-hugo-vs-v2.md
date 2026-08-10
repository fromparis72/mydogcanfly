# §15.1 — Inventaire Hugo vs V2

**SHA de référence : `e2b27799de335558afc165ee1763ad4613ca4ed9` (origin/main, 2026-08-10 10:16:24 +0200).**
Audité sur un worktree git propre, checkouté exactement sur ce SHA, sans aucune modification locale.

> Légende utilisée dans tout ce document : **CONFIRMÉ PAR LE CODE** (vérifiable dans le dépôt) · **CONFIRMÉ PAR TEST** (reproduit en exécutant le moteur) · **AFFIRMÉ PAR LA DOC SEULEMENT** (aucune vérification code possible) · **NON VÉRIFIABLE SANS ACCÈS CLOUDFLARE** (état de production réel) · **CONTRADICTION** (deux sources du dépôt se contredisent).

## 1. Hugo (racine du dépôt) — CONFIRMÉ PAR LE CODE

- `hugo.toml` : `baseURL = "https://mydogcanfly.com/"`, thème `PaperMod`.
- `layouts/` : 22 fichiers (1 `baseof.html`, `index.html`, `term.html`, `sitemap.xml`, 8 partials, 9 shortcodes — dont `outils.html` qui référence en dur 3 outils et « 62 compagnies »).
- `content/` : **353 fichiers `.md`** — `airlines/` (103), `countries/` (221, dont un sous-dossier `_pt`), `hub/drafts/` (152), `dog-heat-safety/` (40), `posts/` (149), `categories/` (5), `objects-i18n/` (5), 7 pages institutionnelles à la racine.
- `static/`, `themes/PaperMod/` (thème tiers vendorisé), `data/produits.yaml`, `tools/routes-refresh/`.
- Aucun fichier de type "breeds"/"airports" côté Hugo — ces objets n'existent que côté V2.

## 2. V2 — `packages/ui` + `packages/engine` + `packages/knowledge` + `packages/workers` — CONFIRMÉ PAR LE CODE

- `packages/ui/src/pages/` : **37 fichiers** Astro/TS. Routes objets (`airlines`, `airports`, `breeds`, `countries`, `travel-hub`), outils (`best-carriers`, `best-crates`, `crate`, `destinations`, `fiche`, `heat`, `pet-relief`, `timeline`), pages institutionnelles, technique (`robots.txt.ts`, `sitemap.xml.ts`, `v1/finder.ts`).
- `packages/ui/src/components/` : **28 fichiers** (pages d'entités, 6 outils interactifs, navigation/layout).
- `packages/engine/` : 10 fichiers `.ts` — moteur de décision (`evaluate.ts`, `explain.ts`, `destinations.ts`, `contracts.ts`, `partners.ts`…).
- `packages/knowledge/` : base de connaissance (`raw/objects.json`, `raw/rules.json`), schémas Zod (`src/`), traductions (`translations/{en,es,fr,pt}`), scripts de curation (`scripts/`).
- `packages/workers/` : `src/index.ts` (routing HTTP uniquement, ADR-0010), `wrangler.toml`.

## 3. Build & déploiement réellement câblés dans le dépôt — CONFIRMÉ PAR LE CODE

`package.json` (racine) :
```
"build": "npm -w @mydogcanfly/ui run build",
"build:prod": "npm -w @mydogcanfly/ui run build:prod",
"release": "npm run build:prod && npm run verify:index && npx wrangler pages deploy packages/ui/dist --project-name=mydogcanfly-v2-preview --branch=main --commit-dirty=true",
```
→ Le seul script `release` du dépôt déploie **exclusivement le V2** vers le projet Cloudflare Pages **`mydogcanfly-v2-preview`**, branche **`main`** (pas "preview", malgré le nom du projet — divergence de nommage à noter, cf. document 03).

**Aucun script npm racine n'appelle `hugo`.** Aucun workflow CI propre au site n'existe dans le dépôt (les seuls `.github/workflows/` trouvés appartiennent au thème tiers vendorisé `themes/PaperMod/`, pas au site). Le pipeline de build/déploiement du site Hugo n'est documentable que par déduction — **NON VÉRIFIABLE SANS ACCÈS CLOUDFLARE**.

`worker/package.json` : `"deploy": "wrangler deploy"` — déploie `worker/wrangler.toml` (le Worker legacy), indépendamment de tout le reste.

## 4. Mécanisme d'unification Hugo/V2 — recherché, non trouvé dans le code

Aucun proxy, rewrite ou fichier `_redirects` à la racine du dépôt ne relie Hugo et V2. `packages/ui/public/_routes.json` exclut certains chemins du Worker Cloudflare Pages du V2 lui-même, mais ne fait aucune référence à Hugo. Le seul `_redirects` du dépôt (`deploy/_redirects`, 334 règles) concerne un **troisième site distinct**, `lechienvoyageur.com` (ancien Hugo francophone), en cours de redirection 301 vers `mydogcanfly.com` — sans rapport avec la coexistence Hugo/V2 du dépôt principal.

**Constat : le dépôt ne contient aucun mécanisme technique explicite unifiant Hugo et V2 sous mydogcanfly.com.** Si une unification existe réellement (domaine personnalisé attaché manuellement au projet Pages V2, bascule DNS, etc.), elle n'est pas visible dans le code — **NON VÉRIFIABLE SANS ACCÈS CLOUDFLARE**.

## 5. Ce que dit la documentation — AFFIRMÉ PAR LA DOC SEULEMENT, et en tension interne

- `docs/V2-DEPLOYMENT.md` (l.4, 9, 59, 120-134) est explicite et cohérent : *« The current Hugo site at repo root is not modified... Production stays 100% Hugo [until a deliberate later step]. »* Le document présente le V2 comme **pas encore en production**, uniquement en preview.
- `docs/V2-PLATFORM-BLUEPRINT.md` (l.68) présente Hugo comme le générateur **actuel** du site vivant, le V2 comme la cible.
- **En tension avec ce qui précède** : `ANALYSE-MAILLAGE.md` (daté 30/07/2026, l.85-90) affirme que *« l'API Worker est bien déployée (`https://mydogcanfly.com/v1/health` répond) et elle sert les routes fusionnées »*, et décrit des tests sur `www.mydogcanfly.com/fr/countries/de/` avec un vocabulaire (`_routes.json`, locales `/fr/`) qui correspond à la structure V2, pas à celle de Hugo. `docs/ROADMAP.md` documente aussi une correction de routing Worker en production le 30/07/2026.

**CONTRADICTION non tranchée par le code seul** : soit le V2 (au moins son Worker `/v1/*`) est déjà partiellement actif sur le domaine de production `mydogcanfly.com` en parallèle de Hugo (ce que suggère `ANALYSE-MAILLAGE.md`), soit `docs/V2-DEPLOYMENT.md` reflète encore l'état réel et rien du V2 n'est en production. **Ce point ne peut être tranché que par Philippe ou par un accès Cloudflare direct — voir document 09 (DECISION_REQUIRED).**

## 6. Chiffre à noter pour la suite

Le shortcode Hugo `outils.html` annonce « 62 compagnies » en dur dans le texte ; le V2 (`objects.json`) en contient aujourd'hui **102**. Ce chiffre, comme d'autres écarts de volumétrie documentaire, est détaillé dans le document 03.
