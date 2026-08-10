# §15.7 — Lots proposés et critères d'acceptation

**SHA de référence : `e2b27799de335558afc165ee1763ad4613ca4ed9` (origin/main).**
Découpage volontairement petit et vérifiable lot par lot — cohérent avec le constat du protocole que le chantier ne doit pas repartir en migration massive non revue. Chaque lot correspond à une branche `v2/*` (document 06) et se ferme par une PR contenant les 12 items requis par le protocole.

## Lot 0 — Cet inventaire lui-même
**Contenu** : les 10 documents §15.1 à §15.10, plus ce document.
**Critère d'acceptation** : validé par Philippe et contre-revu par Codex avant tout autre lot. Aucun changement de code dans ce lot.

## Lot 1 — CI minimale sur PR
**Contenu** : ajout d'un workflow qui exécute `check` + `typecheck` + `smoke` + `build` sur chaque PR vers `rebuild/v2`, sans changement de logique métier.
**Critère d'acceptation** : une PR de test délibérément cassée (ex. une règle JSON invalide) doit faire échouer la CI et bloquer la fusion.
**Dépendance** : accès `.github/workflows/` (document 08).

## Lot 2 — Réconciliation `airline-fiche-contract.md` ↔ `ingest-airlines.mjs`
**Contenu** : réécriture de la doc pour décrire fidèlement le pipeline réel (document 03, §4.1), sans toucher au code. Correction des chiffres de volumétrie obsolètes (76→102 compagnies, 249→268 aéroports) partout où ils apparaissent en dur.
**Critère d'acceptation** : plus aucune section de la doc ne décrit un champ ou un script comme existant ou lu par le moteur sans que ce soit vérifiable par grep dans le code livré à ce moment-là.
**Risque** : nul pour la production — c'est un lot documentaire pur.

## Lot 3 — Filet de sécurité poids hold/cargo
**Contenu** : ajouter l'équivalent de `rule_global_cabin_weight_cap` pour le hold et/ou le cargo, ou à défaut documenter explicitement pourquoi aucun plafond générique n'est souhaitable pour ces placements (le poids maximal d'une soute dépend de l'appareil, contrairement à la cabine).
**Critère d'acceptation** : sur les 31 compagnies listées au document 05 (chiffre 3), au moins un test de non-régression démontre qu'un poids extrême (ex. 90 kg) est désormais refusé par défaut en hold, sans casser les cas déjà corrects.
**Dépendance** : nécessite une décision préalable sur la valeur du plafond générique — point du document 09.

## Lot 4 — Lecture du champ `conditional` par le moteur
**Contenu** : décider comment traiter les 74 cas `conditional: true` (document 05, chiffre 2) — soit le moteur les lit et les traduit en `warn`/`require` plutôt qu'un `allow` silencieux, soit chaque cas est promu en règle explicite dans `rules.json` comme cela a déjà été fait pour les poids et les cas route-scoped lors des correctifs du 10/08.
**Critère d'acceptation** : zéro cas `conditional: true` traité en pratique comme un `allow` plein sans avertissement à l'utilisateur.

## Lot 5 — Unification de la logique de risque chaleur
**Contenu** : le plus gros lot technique, motivé par le document 04 (4 modèles de seuils divergents). Un seul modèle de température (région ou latitude, à trancher), un seul seuil d'embargo avec ajustement brachycéphale, consommé par `evaluate.ts`, `destinations.ts`, `HeatCalculator.astro` et la page Hugo legacy (ou retrait de cette dernière si elle est confirmée hors production).
**Critère d'acceptation** : un jeu de scénarios (mêmes route/mois/race) donne un résultat identique sur les 4 points d'entrée testés.
**Dépendance** : nécessite de trancher d'abord si la page Hugo legacy `static/tools/is-it-too-hot-for-my-dog/` est encore en production (document 09).

## Lot 6 — Résolution de la collision de nom Worker
**Contenu** : décider quel `wrangler.toml` (legacy `worker/` ou V2 `packages/workers/`) reste actif sous le nom `mydogcanfly-api`, renommer ou retirer l'autre.
**Critère d'acceptation** : un seul `wrangler.toml` du dépôt référence ce nom de production ; l'autre est soit renommé soit explicitement marqué comme retiré/archivé avec sa fonctionnalité (KV cache météo, D1 abonnés, cron alertes) migrée ou sciemment abandonnée.
**Dépendance** : Philippe doit d'abord confirmer lequel est réellement actif sur Cloudflare (document 09).

## Lot 7+ — Migration Hugo → V2, page-type par page-type
**Contenu** : hors périmètre détaillé de cet inventaire — le protocole est explicite sur le fait qu'aucune migration massive ne doit démarrer avant validation des lots 0 à 6. Ce lot sera découpé plus finement (par type de page : airlines, countries, breeds, hub, posts) une fois les fondations (lots 1 à 6) stabilisées.

## Principe général de découpage retenu

Chaque lot ci-dessus est : (a) réversible indépendamment des autres, (b) testable par un critère d'acceptation binaire, (c) sans risque pour `main`/production tant qu'il n'est pas fusionné. Aucun lot ne mélange changement de données et changement de logique moteur dans la même PR, pour que Codex puisse auditer chaque type de risque séparément.
