# §15.4 — Logique métier dupliquée

**SHA de référence : `e2b27799de335558afc165ee1763ad4613ca4ed9` (origin/main).**
8 duplications distinctes identifiées, dont 4 critiques touchant directement une logique de sécurité (risque de chaleur), avec des valeurs déjà divergentes sur 3 d'entre elles au moment de l'audit.

## Duplications critiques

### 1. Deux modèles climatiques indépendants, *à l'intérieur même* du moteur « officiel »
- `packages/engine/src/evaluate.ts` (l.40-58) : table `CLIMATE` **par région** (Middle East, Africa, Asia, Europe…), utilisée par défaut quand aucune température n'est fournie.
- `packages/engine/src/destinations.ts` (l.20-45) : modèle **par latitude d'aéroport**, courbes linéaires par morceaux.

`FlightFinder.astro` (l'outil principal, page d'accueil) n'envoie jamais `weather.temperature_c` → retombe systématiquement sur le modèle région. `DestinationFinder.astro` calcule sa propre température par latitude et l'injecte, écrasant le modèle région.

**Désynchronisation déjà mesurée** : Athènes en juillet → 28 °C (région, pas d'embargo) vs 31 °C (latitude, embargo déclenché, seuil 30 °C franchi). Bangkok en mai → 28 °C vs 32 °C. **Conséquence concrète : pour le même trajet et le même mois, le Flight Finder peut ne montrer aucun bandeau chaleur alors que le Destination Finder ou le Heat Calculator affichent un embargo pour la même route.**

### 2. `carries_pets` / « n'accepte aucun animal » réimplémenté dans `CrateCalculator.astro`
- Moteur (`evaluate.ts` l.266-289) : réévalue toutes les règles de la compagnie avec un chien neutre ET exige `allowed === true` sur au moins un placement (`unknown` = refus, corrigé le 10/08/2026).
- UI (`CrateCalculator.astro` l.33-43) : calcule `noPets` uniquement depuis `premium.policy`, avec un `hold` tri-state où seul `"no"` compte comme refus — `"unknown"` n'est pas traité comme un refus.

**Déjà désynchronisé** : une compagnie avec soute non documentée (`unknown`) est vue par le moteur comme « ne transporte pas d'animaux » depuis le correctif du 10/08, mais pas par `CrateCalculator`, qui continuerait d'afficher un message générique au lieu du message dédié « aucun animal accepté ».

### 3. Seuils de risque chaleur brachycéphale absents du moteur
- `HeatCalculator.astro` (l.120) : `bands(brachy) = brachy ? {emb:27, risk:24} : {emb:30, risk:27}` — seuils plus stricts pour les races brachycéphales.
- Moteur (`explain.ts`, `destinations.ts`) : `HEAT_EMBARGO_THRESHOLD_C = 30`, fixe, **aucun ajustement brachycéphale**.

**Risque de sécurité** : un chien brachycéphale sur une route à 28 °C est signalé « risque élevé/embargo » par le Heat Calculator autonome, mais aucun embargo n'est déclenché par le Flight Finder avant 30 °C, quelle que soit la race.

### 8. Un quatrième seuil, sur une page Hugo legacy
`static/tools/is-it-too-hot-for-my-dog/index.html` (l.228) : `flightLevel(airC)` — danger à **29,4 °C**, sans ajustement brachycéphale, indépendant des trois modèles précédents. Cette page Hugo legacy est toujours présente et servie.

## Duplications modérées

| # | Duplication | Emplacements | Valeurs divergentes ? |
|---|---|---|---|
| 4 | Recopie manuelle du modèle latitude | `HeatCalculator.astro` (l.113-117, commentaire « mirrors the engine's destinations tool ») vs `destinations.ts` | Non, synchronisé pour l'instant — mais aucun partage de code, dérive manuelle à chaque évolution |
| 5 | Constante `HEAT_EMBARGO_THRESHOLD_C` déclarée deux fois | `explain.ts` (l.6) vs `destinations.ts` (l.7) | Non (30 = 30), mais fragile — commentaire du code lui-même signale le risque |
| 6 | Délai rage/UE (rétro-planning) | `worker/src/worker.js` (DEST_RULES, offset 30 j) vs `TravelTimeline.astro` (offset 21 j réglementaire, 120 j si titrage) | **Oui — 30 j vs 21 j**, pas encore dangereux (marge de sécurité côté Worker) mais vraie divergence de valeur sur la même règle |
| 7 | `walkRisk()` (risque promenade) | `worker/src/worker.js` (commentaire « server copy ») vs `static/tools/is-it-too-hot-for-my-dog/index.html` | Non, copie identique assumée — duplication volontaire pour l'envoi d'alertes par cron |

## Zones cherchées, sans duplication significative trouvée

- `FlightFinder.astro` et `DestinationFinder.astro` : aucun calcul métier en dur, uniquement des appels API et de l'affichage.
- `packages/workers/src/index.ts` : confirmé sans logique métier propre (ADR-0010 respecté).
- `packages/knowledge/scripts/*.mjs` : scripts de curation de données en amont, pas de recalcul métier parallèle.
- Formule de dimensionnement de cage IATA : n'existe que dans `CrateCalculator.astro` — pas une duplication au sens strict (pas de seconde implémentation), mais de la logique métier sensible codée en dur uniquement côté UI, jamais dans `packages/engine`.

## Tableau récapitulatif

| # | Duplication | Sévérité | Valeurs déjà divergentes ? |
|---|---|---|---|
| 1 | Modèle climatique région vs latitude (intra-moteur) | Critique | Oui |
| 2 | `carries_pets`/`noPets` | Critique | Oui |
| 3 | Seuils chaleur brachycéphale | Critique | Oui |
| 8 | `flightLevel()` legacy (page Hugo) | Critique | Oui |
| 4 | Recopie modèle latitude | Modéré | Non |
| 5 | `HEAT_EMBARGO_THRESHOLD_C` x2 | Modéré | Non |
| 6 | Délai rage/UE | Modéré | Oui |
| 7 | `walkRisk()` | Modéré | Non |
| — | Formule cage IATA (UI seule, pas de 2e implémentation) | Structurel | N/A |

**Priorité recommandée pour la refonte** : les duplications 1, 2, 3 et 8 touchent toutes, directement ou indirectement, le calcul de risque lié à la chaleur — un sujet de sécurité pour l'animal, pas seulement de cohérence produit. Elles justifient à elles seules qu'un des premiers lots de la refonte (document 07) consolide la logique de risque chaleur en un point unique, source de vérité pour les 4 outils.
