# §15.3 — Divergences documentation / code / production

**SHA de référence : `e2b27799de335558afc165ee1763ad4613ca4ed9` (origin/main).**
Documents audités intégralement : `docs/V2-DEPLOYMENT.md`, `docs/V2-PLATFORM-BLUEPRINT.md`, `docs/airline-fiche-contract.md`, `docs/ROADMAP.md`, `ARCHITECTURE_DECISIONS.md`.

## 1. ADR (`ARCHITECTURE_DECISIONS.md`) — CONFIRMÉ PAR LE CODE, aucune divergence

Tous les ADR référencés dans le code (ADR-0002, 0005, 0006, 0008, 0009, 0010, 0012 à 0015) décrivent fidèlement le mécanisme implémenté : source obligatoire par donnée, `review_due` dérivé, graphe de relations typées, séparation Decision/Explanation Engine, Worker sans logique métier, JSON en Git plutôt que D1 en Phase 1 (confirmé : aucun `d1_databases`/`kv_namespaces` dans `packages/workers/wrangler.toml`).

## 2. `docs/V2-DEPLOYMENT.md` — CONFIRMÉ PAR LE CODE, fiable et à jour

Les scripts (`check`, `typecheck`, `smoke`, `build`), le mécanisme `robots.txt` piloté par `PUBLIC_SITE_ENV`, la séparation `PUBLIC_API_BASE`/`PUBLIC_SITE_ENV`, l'absence de route au niveau racine de `wrangler.toml` (route uniquement sous `[env.production]`) sont tous confirmés tels quels dans le code. Seules les affirmations sur l'état réellement déployé (« preview URL fonctionnelle ») restent **NON VÉRIFIABLES SANS ACCÈS CLOUDFLARE**.

## 3. `docs/V2-PLATFORM-BLUEPRINT.md` — globalement prospectif, peu vérifiable

Document de cible (« draft v0.1 »). Le seul chiffre vérifiable (169 races dans `data/races.json`) est confirmé. Le reste décrit des phases futures, non datées précisément — statut d'avancement réel **NON VÉRIFIABLE SANS ACCÈS PRODUCTION**.

## 4. `docs/airline-fiche-contract.md` — la divergence la plus sérieuse du dépôt

### 4.1 Un pipeline « à créer » qui existe déjà, avec un schéma incompatible

La doc affirme (§1, §11.4) que `packages/knowledge/scripts/ingest-airlines.mjs` est **« NOUVEAU (à créer) »**, censé lire `content/airlines/<slug>.yml` selon un schéma détaillé au §3 (`iata`, `country_id`, `alliance`, `policy.cabin.status` en enum, `restrictions.brachycephalic`, `environment{...}`, `evidence.type`…) et écrire à la fois dans `objects.json` **et** `rules.json`.

**CONTREDIT PAR LE CODE** : ce script existe déjà (présent depuis le premier commit du dépôt, modifié pour la dernière fois le 08/08/2026). Son schéma Zod réel n'a quasiment aucun champ en commun avec celui décrit par la doc (`mono`, `titleH1`, `metaDesc`, `chips`, `verdict`, `ladder`, `channels`, `fareGrid`, `restrictions[]`, `crate`, `temperature`, `assistance`, `sources`, `verified_date`…). Il écrit vers `packages/ui/src/data/airlines.generated.json` et **ne touche jamais `rules.json`** — contrairement à ce qu'affirme le §11.4. Un fichier `content/airlines/_template.yml`, conforme au schéma *proposé* par la doc, a été créé le même jour que la doc mais est incompatible avec le schéma réellement attendu par le script — un squelette qui ne validerait jamais s'il était rempli et ingéré tel quel. Les 102 fichiers de données réels utilisent en plus un nommage (snake_case) différent de celui prescrit (kebab-case).

**Conclusion : deux définitions concurrentes et incompatibles du contrat de données « fiche compagnie » coexistent dans le dépôt sans réconciliation** — la doc décrit une spécification cible jamais implémentée, en la présentant comme l'état actuel.

### 4.2 Champs présentés comme « lus par le moteur » — CONTREDIT PAR LE CODE

La doc affirme (tableau §0, §10) que `policy.*.max_weight_kg`, `policy.*.status` et `restrictions.brachycephalic` sont lus par le Decision Engine pour générer les règles `cabin_weight`/`hold_weight`/`breed_ban`. **Faux à ce SHA** : `packages/engine/src/evaluate.ts` ne lit que le champ booléen `allowed` de `premium.policy`. `max_weight_kg`, `carrier_dims_cm` et `brachy_allowed` n'apparaissent dans aucun fichier de `packages/engine/src/*.ts` ni `packages/workers/src/*.ts` (grep vide) — ils ne servent qu'à l'affichage côté UI (`pagedata.ts`, `breedTravel.ts`, `cluster.ts`, `CrateCalculator.astro`). Ce point recoupe exactement l'audit chiffré du document 05.

### 4.3 Chiffres de volumétrie obsolètes

| Dimension | Doc §13.2 | Code réel | Statut |
|---|---|---|---|
| Compagnies | « 76 » | **102** | CONTREDIT PAR LE CODE |
| Pays | « 140 » | **140** | CONFIRMÉ |
| Aéroports | « 249 » | **268** | CONTREDIT PAR LE CODE |

## 5. `docs/ROADMAP.md` (daté 30/07/2026) — majoritairement fiable mais figé

Toutes les affirmations de correctifs *techniques* vérifiées (ajout de `brachy_allowed`, absence de dimensions structurées dans `airlines.ts`, `GET /v1/finder` lisant la query string, `partner_petassure` repassé en placeholder, route `www` ajoutée au Worker) sont **CONFIRMÉES PAR LE CODE**, telles quelles.

Deux problèmes distincts :
- **Chiffres obsolètes** : « 142/249 » puis « 250/250 » aéroports (le ROADMAP se contredit déjà lui-même), « 78/78 » compagnies — contre 268 aéroports et 102 compagnies réels aujourd'hui. Le document est explicitement daté et s'auto-qualifie de « vérifié au 30/07 » ; le SHA audité est du 10/08, dix jours plus tard. Ce n'est pas une doc mensongère, mais une doc non resynchronisée avec la croissance de la base de connaissance.
- **Affirmations de production** (« `www` → apex fait en Page Rule », « `/v1/health` répond, 19/19 concordent ») : décrivent un état observé en dehors du dépôt — **NON VÉRIFIABLES SANS ACCÈS CLOUDFLARE/PRODUCTION**, à faire confirmer par Philippe ou par le premier lot de tests de référence (document 10).

## 6. Synthèse des 4 divergences prioritaires pour la suite

1. `docs/airline-fiche-contract.md` doit être réécrit pour décrire le pipeline `ingest-airlines.mjs` **réel**, pas une spécification jamais implémentée — sinon Codex auditera contre une doc fausse.
2. Les champs de fiche non lus par le moteur (`max_weight_kg`, `carrier_dims_cm`, `brachy_allowed`) doivent être requalifiés dans la doc comme « affichage uniquement », pas « lus par le moteur ».
3. Les chiffres de volumétrie doivent être resynchronisés dans tous les documents à chaque mise à jour de gouvernance (ou remplacés par une commande de comptage automatique plutôt qu'un chiffre en dur).
4. Toute affirmation sur l'état de production (Worker actif, routes, redirections) doit être vérifiée par un test réel (document 10) avant d'être considérée comme acquise pour le chantier de refonte.
