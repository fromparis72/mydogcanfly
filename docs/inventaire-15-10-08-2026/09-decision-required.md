# §15.9 — Points DECISION_REQUIRED

**SHA de référence : `e2b27799de335558afc165ee1763ad4613ca4ed9` (origin/main).**
Chaque point ci-dessous nécessite un arbitrage de Philippe — soit parce que l'information n'est vérifiable que côté Cloudflare/dashboard (hors de portée du code), soit parce qu'il s'agit d'un choix produit/priorité qui n'appartient pas à Claude.

## DECISION_REQUIRED-01 — État réel de la coexistence Hugo/V2 en production
**Constat (document 01)** : le dépôt ne contient aucun mécanisme technique unifiant Hugo et V2 sous `mydogcanfly.com`, mais `ANALYSE-MAILLAGE.md` et `docs/ROADMAP.md` affirment que le Worker `/v1/*` du V2 répond déjà sur le domaine de production, en apparente contradiction avec `docs/V2-DEPLOYMENT.md` qui présente le V2 comme non encore en production.
**Décision nécessaire** : Philippe confirme l'état réel (dashboard Cloudflare ou test direct) — le Worker V2 est-il aujourd'hui actif sur `mydogcanfly.com`, et si oui depuis quand et avec quel périmètre ?
**Impact** : conditionne le niveau de prudence de tout le reste du chantier — si le V2 sert déjà une partie du trafic réel, les lots 3/4/5 (document 07) ont un impact production immédiat, pas seulement preview.

## DECISION_REQUIRED-02 — Collision de nom entre les deux Workers Cloudflare
**Constat (document 02)** : `worker/wrangler.toml` (legacy, KV+D1+cron) et `packages/workers/wrangler.toml` (V2, routes `/v1/*`) déclarent tous les deux le nom de production `mydogcanfly-api`.
**Décision nécessaire** : lequel des deux est réellement déployé aujourd'hui sous ce nom ? Le Worker legacy (cache météo, abonnés D1, alertes par cron) est-il encore utilisé, ou peut-il être retiré/archivé ?
**Impact** : bloque le Lot 6 (document 07) tant que non tranché ; un déploiement accidentel de l'un pourrait écraser l'autre en production.

## DECISION_REQUIRED-03 — La page Hugo legacy « is-it-too-hot-for-my-dog » est-elle encore servie ?
**Constat (document 04)** : `static/tools/is-it-too-hot-for-my-dog/index.html` contient un quatrième modèle de seuil de chaleur (29,4 °C), indépendant des 3 autres.
**Décision nécessaire** : cette page est-elle encore accessible en production ? Si oui, doit-elle être retirée, redirigée vers l'outil V2 équivalent (`HeatCalculator`), ou volontairement maintenue le temps de la transition ?
**Impact** : conditionne le périmètre du Lot 5 (unification chaleur).

## DECISION_REQUIRED-04 — Modèle de température canonique
**Constat (document 04)** : modèle « région » (moteur) vs modèle « latitude » (destinations/heat) donnent des résultats différents pour la même route.
**Décision nécessaire** : lequel des deux devient la source de vérité unique, ou un troisième modèle doit-il être développé ? Ce choix a un impact produit direct (quelles routes déclenchent un embargo chaleur) — ce n'est pas un choix purement technique.
**Impact** : bloque le Lot 5.

## DECISION_REQUIRED-05 — Valeur d'un plafond de poids générique pour hold/cargo
**Constat (document 05)** : 31 compagnies acceptent le hold sans aucune règle de poids spécifique ni filet générique (contrairement à la cabine, plafonnée à 10 kg par défaut).
**Décision nécessaire** : Philippe valide-t-il l'ajout d'un plafond générique hold/cargo (et sa valeur), ou préfère-t-il une autre approche (ex. exiger une donnée qualifiée compagnie par compagnie avant d'autoriser le hold, ce qui réduirait le nombre de compagnies affichées comme éligibles tant que la donnée n'est pas recueillie) ?
**Impact** : bloque le Lot 3. Contrairement à la cabine (dimension standardisée par IATA), la capacité de soute dépend de l'appareil — un plafond générique serait une approximation, pas une règle officielle sourcée, ce qui est en tension avec la règle maison « aucune affirmation sans source officielle ».

## DECISION_REQUIRED-06 — Sort du patch `weight-brachy-conditions-10-08.patch`, non encore appliqué sur origin/main
**Constat** : ce patch (18 règles de poids cabine, exception brachycéphale Qantas, règles route-scopées SAA/Pegasus), livré le 10/08/2026, n'a pas encore été appliqué/poussé par Philippe au moment de cet inventaire — `origin/main` ne le contient pas.
**Décision nécessaire** : l'appliquer maintenant en `main` (comme déjà approuvé le jour même, avant le pivot stratégique), ou l'intégrer plus tard dans le flux de PR `rebuild/v2` du nouveau protocole ?
**Impact** : si non appliqué, les mesures du document 05 (auditées sans ce patch) restent l'état réel de `main` jusqu'à décision contraire — aucune action de ma part sans confirmation.

## DECISION_REQUIRED-07 — Réécriture de `docs/airline-fiche-contract.md`
**Constat (document 03)** : la doc décrit un pipeline d'ingestion jamais implémenté, en contradiction avec le script réel `ingest-airlines.mjs`.
**Décision nécessaire** : Philippe valide-t-il que la réécriture (Lot 2) documente le pipeline **réel** (schéma `Fiche` actuel), ou souhaite-t-il au contraire faire évoluer le code vers le schéma initialement documenté (`iata`, `country_id`, `alliance`…) ? Ce sont deux directions opposées, pas un simple nettoyage.
**Impact** : bloque le Lot 2 tant que la direction n'est pas choisie.

## DECISION_REQUIRED-08 — Provisionnement des accès GitHub/Cloudflare (document 08)
**Constat** : aucun accès d'écriture n'est configuré ; le mode transitoire (document 06) reste actif tant que ce n'est pas fait.
**Décision nécessaire** : Philippe choisit le type de credential GitHub (PAT fine-grained vs GitHub App), met en place le ruleset sur `main`, et décide de l'approche Cloudflare (preview auto-déployé depuis GitHub vs token scoped).
**Impact** : bloque le passage au mode cible pour tous les lots suivants.

## Points explicitement NON bloquants (peuvent avancer en mode transitoire dès validation de cet inventaire)
- Lot 0 (cet inventaire) : déjà en cours de clôture par ce document.
- Lot 1 (CI minimale) et Lot 2 (réécriture doc fiche) : ne dépendent d'aucune des décisions ci-dessus pour être *préparés* (patch/document livrable dès maintenant), seulement pour être *fusionnés* dans `rebuild/v2`.
