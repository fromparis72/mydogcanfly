# §15 — Inventaire de premières actions (Protocole Claude–Codex, 10/08/2026)

**SHA de référence pour l'ensemble de ce dossier : `e2b27799de335558afc165ee1763ad4613ca4ed9` (origin/main, 2026-08-10 10:16:24 +0200).**

Ce dossier répond au §15 du protocole : « Claude ne doit pas lancer une migration massive avant validation de cet inventaire par Philippe et contre-revue de Codex. » C'est le Lot 0 du plan de lots (document 07) — aucun changement de code n'est inclus dans cette livraison, uniquement de la lecture et de la mesure.

**Méthode** : chaque document est basé sur un worktree git propre checkouté exactement sur le SHA ci-dessus, distinct du working tree du sandbox de développement (qui contient des correctifs non encore appliqués/poussés par Philippe — voir DECISION_REQUIRED-06). Chaque affirmation factuelle est classée : confirmée par le code, confirmée par un test réel exécuté, affirmée par la documentation seulement, non vérifiable sans accès Cloudflare, ou contradiction entre deux sources du dépôt.

## Sommaire des 10 documents

| # | Document | Contenu essentiel |
|---|---|---|
| 01 | `01-inventaire-hugo-vs-v2.md` | Hugo (353 pages content, racine du dépôt) vs V2 (37 pages Astro, `packages/`) ; aucun mécanisme d'unification trouvé dans le code ; contradiction non tranchée sur l'état réel de production |
| 02 | `02-topologie-cloudflare.md` | Deux `wrangler.toml` indépendants, **collision de nom `mydogcanfly-api`** entre le Worker legacy et le Worker V2 |
| 03 | `03-divergences-doc-code-prod.md` | `docs/airline-fiche-contract.md` décrit un pipeline jamais implémenté ; chiffres de volumétrie obsolètes (76→102 compagnies, 249→268 aéroports) |
| 04 | `04-logique-metier-dupliquee.md` | 8 duplications, dont 4 critiques touchant le calcul de risque chaleur, avec des valeurs déjà divergentes (Athènes juillet : 28 °C vs 31 °C selon le modèle) |
| 05 | `05-donnees-sous-qualifiees.md` | 74 cas `conditional` jamais lus ; 31 compagnies sans filet de poids hold/cargo ; 34+8 champs de fiche jamais lus par le moteur ; 4 cases entièrement non qualifiées |
| 06 | `06-plan-branches-ci.md` | Mode transitoire (actif dès aujourd'hui, patch/document) vs mode cible (PR directes, une fois l'accès sécurisé) ; modèle de branches `v2/*` → `rebuild/v2` → `main` |
| 07 | `07-lots-proposes.md` | 7 lots séquencés (CI, doc fiche, filet de poids, `conditional`, unification chaleur, collision Worker, migration Hugo→V2) avec critères d'acceptation |
| 08 | `08-acces-necessaires.md` | PAT fine-grained scoped au dépôt + ruleset GitHub sur `main` ; aucun token de production Cloudflare pour Claude |
| 09 | `09-decision-required.md` | 8 décisions nécessitant l'arbitrage de Philippe |
| 10 | `10-tests-reference.md` | Les 15 scénarios du protocole §10.4, statut réel vérifié — 1 confirmé par test, 3 non encore corrigés, 1 problème confirmé sans correctif, 7 à exécuter |

## Trois constats qui ressortent de l'ensemble

1. **Le correctif du 10/08/2026 (fiche = socle systématique) est bien sur `origin/main` et fonctionne** — vérifié en reproduisant le cas La Compagnie 32 kg dans deux worktrees indépendants (document 10, #1). C'est la seule affirmation de ce dossier confirmée par un test d'exécution réelle plutôt que par lecture de code.
2. **Le risque architectural le plus sérieux et le moins visible n'est pas dans le moteur de décision lui-même, mais dans la duplication de la logique de risque chaleur** (document 04) : quatre implémentations indépendantes, déjà divergentes sur des cas réels, touchant un sujet de sécurité pour l'animal plutôt qu'un simple confort produit.
3. **Plusieurs affirmations de gouvernance (doc, ROADMAP, protocole lui-même) ne peuvent pas être vérifiées depuis le code seul** — l'état réel de Cloudflare (quel Worker actif, quels projets Pages, quelles routes de zone) reste entièrement entre les mains de Philippe. Ce dossier ne prétend jamais trancher ces points ; il les liste explicitement (document 09) pour que la décision soit prise en connaissance de cause plutôt que supposée.

## Prochaine étape

Selon le document 06 (mode transitoire), ce dossier est livré en Markdown pour que Philippe le dépose dans le dépôt (par exemple sous `docs/inventaire-15-10-08-2026/`) et, une fois l'accès GitHub provisionné (document 08), qu'il devienne la première Pull Request réelle du chantier vers `rebuild/v2` — conformément à l'exigence du protocole que rien ne soit une décision du projet tant que ce n'est pas inscrit dans une PR, une issue, un ADR ou un rapport versionné.

Aucune action de code n'est engagée avant validation de ce dossier par Philippe et contre-revue de Codex.
