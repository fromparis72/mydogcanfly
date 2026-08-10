# §15.6 — Plan de branches et de CI

**SHA de référence : `e2b27799de335558afc165ee1763ad4613ca4ed9` (origin/main).**

## 1. Constat de départ : aucun accès d'écriture GitHub configuré aujourd'hui

Vérifié dans cette session (lecture seule) : `gh` CLI non authentifiée, `origin` en HTTPS sans `credential.helper`, `git ls-remote origin HEAD` fonctionne (lecture publique) mais aucun credential d'écriture n'est présent. Le protocole (§5.1) suppose que Claude reçoive lecture complète + écriture sur les branches `v2/*` + création de PR — ce n'est pas le cas à l'instant où ce document est écrit.

Conséquence directe, reprenant la recommandation de Philippe : le chantier fonctionne selon **deux modes**, l'un actif dès maintenant, l'autre visé une fois l'accès sécurisé mis en place.

## 2. Mode transitoire (actif dès aujourd'hui)

- Claude produit des documents Markdown et, pour du code, des fichiers `.patch` (format actuel, déjà utilisé pour les 3 correctifs livrés le 10/08/2026).
- Philippe (ou un opérateur Git de confiance qu'il désigne) applique mécaniquement le patch sur une branche dédiée et ouvre la Pull Request vers `rebuild/v2`.
- Codex audite la PR une fois ouverte, selon le format de rapport d'anomalie du protocole (§ sévérité P0-P3).
- Aucun commit, push ou déploiement n'est jamais exécuté depuis le sandbox cloud de Claude — règle déjà en vigueur, reconduite explicitement pour ce chantier.
- Ce document lui-même (l'inventaire §15) est livré selon ce mode : Markdown + patch, à faire déposer par Philippe dans le dépôt puis, une fois l'accès en place, à transformer en la première vraie PR du chantier.

## 3. Mode cible (une fois l'accès sécurisé provisionné — voir document 08)

- Claude dispose d'un accès GitHub scoped (PAT fine-grained limité au seul dépôt, ou compte technique dédié) lui permettant de créer des branches `v2/*`, y pousser des commits, et ouvrir/mettre à jour des Pull Requests vers `rebuild/v2`.
- Claude ne peut ni pousser sur `main`, ni fusionner une PR, ni administrer le dépôt — ces limites doivent être appliquées par un **ruleset GitHub** sur `main` (et recommandé aussi sur `rebuild/v2`), pas seulement par la portée du token, conformément à la remarque technique de Philippe : un token limité au dépôt ne garantit pas à lui seul l'interdiction d'écrire sur `main`.

## 4. Modèle de branches (repris du protocole, précisé)

| Branche | Rôle | Qui peut y pousser | Qui peut fusionner |
|---|---|---|---|
| `main` | Production actuelle (Hugo + V2 tel que déployé aujourd'hui) | Personne directement (PR obligatoire) | Philippe uniquement |
| `rebuild/v2` | Intégration de la refonte, jamais déployée en production tant que non validée | PR obligatoire depuis les branches `v2/*` | Philippe (après revue Codex) |
| `v2/<sujet>` | Branches de travail courtes, un sujet = une branche | Claude (mode cible) ou l'opérateur désigné (mode transitoire) | — (mergées dans `rebuild/v2` par PR) |

Branches `v2/*` déjà identifiées par le périmètre des documents 04/05/07 : `v2/contracts-policy-status` (réconciliation fiche/moteur), `v2/heat-risk-unification` (fusion des 4 modèles de chaleur du document 04), `v2/worker-consolidation` (collision de nom du document 02), `v2/fiche-contract-doc` (réécriture de `airline-fiche-contract.md`), `v2/hold-cargo-weight-safety-net` (extension du filet de sécurité poids du document 05).

## 5. Ruleset GitHub recommandé sur `main`

Conformément à la recommandation de Philippe et à la documentation GitHub sur les rulesets :
- Pull request obligatoire avant toute fusion (pas de push direct, y compris pour les administrateurs si l'option est disponible sur le plan GitHub utilisé).
- Statuts CI requis avant fusion (au minimum `npm run check` + `npm run typecheck`, idéalement aussi `npm run smoke`).
- Conversations de revue résolues avant fusion.
- Force-push interdit sur `main` et `rebuild/v2`.
- Fusion réservée à Philippe (ou à un rôle qu'il délègue explicitement) — jamais automatique.

## 6. CI — état actuel et proposition minimale

**Aujourd'hui, aucun workflow CI propre au site n'existe dans le dépôt** (confirmé document 01 — seuls des workflows du thème tiers vendorisé existent). Les 4 commandes de `docs/V2-DEPLOYMENT.md` (§4, « Pre-deploy checklist ») existent comme scripts npm mais ne sont exécutées manuellement qu'au moment du déploiement, jamais en CI sur PR.

Proposition minimale pour la première itération du chantier (pas de décision technique lourde, juste faire tourner ce qui existe déjà à chaque PR) :
1. `npm run check` (qualité des données de connaissance : schéma, règles, couverture).
2. `npm run typecheck` (knowledge + engine + workers).
3. `npm run smoke` (Worker en conditions réelles).
4. `npm run build` (build Astro complet — détecte toute régression de build avant la revue humaine).

Ce socle correspond exactement à ce que `docs/V2-DEPLOYMENT.md` décrit déjà comme checklist manuelle — le rendre obligatoire en CI sur chaque PR vers `rebuild/v2` est un changement d'infrastructure, pas de logique métier, donc à faible risque et proposable dès le premier lot (document 07).

## 7. Ce que ce document ne tranche pas

Le choix de l'outil CI (GitHub Actions, ou autre) et le niveau d'accès nécessaire pour le configurer relèvent du document 08 (accès nécessaires) et d'un point `DECISION_REQUIRED` du document 09, puisque la mise en place d'un workflow CI nécessite un accès d'écriture sur `.github/workflows/` — un accès plus sensible qu'une simple branche de contenu.
