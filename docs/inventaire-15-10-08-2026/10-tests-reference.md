# §15.10 — Premier lot de tests de référence

**SHA de référence : `e2b27799de335558afc165ee1763ad4613ca4ed9` (origin/main).**
Reprend les 15 scénarios du protocole (§10.4). Statut réel vérifié sur ce SHA — pas sur le working tree du sandbox, qui contient des correctifs non encore poussés.

## #1 — La Compagnie, EWR→ORY, 32 kg — CONFIRMÉ PAR TEST (avant/après)

Reproduit dans deux worktrees git propres et indépendants du sandbox :

| SHA | cabin | hold | cargo |
|---|---|---|---|
| `bc879cc` (avant le correctif du 10/08, ce que Philippe a signalé) | false | **true** | **true** |
| `e2b2779` = origin/main actuel | false | **false** | **false** |

Le bug original (soute/fret déclarés disponibles pour une compagnie qui ne transporte qu'en cabine) est corrigé sur `origin/main`. C'est le seul scénario testé en exécutant réellement le moteur dans le cadre de cet inventaire ; les autres restent à exécuter formellement (voir statuts ci-dessous).

## #2 — La Compagnie, résistance à la falsification d'URL du rapport détaillé
**Statut : À EXÉCUTER.** Non testé dans le cadre de cet inventaire — nécessite un test d'intégration UI, hors périmètre d'un audit moteur seul.

## #3 — Écart fiche↔moteur : Air Serbia, Aircalin, Bangkok Airways, Batik Air Indonesia/Malaysia, ITA Airways, La Compagnie, Pegasus
**Statut : CONFIRMÉ PAR LE CODE (mécanisme), PARTIELLEMENT CONFIRMÉ PAR TEST.** Le correctif générique (`policy?.[p]?.allowed !== true` inconditionnel) qui corrige ce mécanisme pour l'ensemble des compagnies est bien sur `origin/main` (commit `01e7f98`). Seul La Compagnie a été individuellement re-testé en direct (#1) ; les 6 autres compagnies bénéficient du même mécanisme mais n'ont pas été re-testées une par une dans le cadre de cet inventaire — à faire dans un lot de non-régression dédié.

## #4 — Qantas, CDG→SYD, revendication « direct » exacte de la route
**Statut : À EXÉCUTER.** Non testé.

## #5 — Pegasus, distinction hold domestique vs cargo
**Statut : PAS ENCORE CORRIGÉ SUR ORIGIN/MAIN.** La règle `rule_pegasus_hold_domestic_only` existe dans le patch `weight-brachy-conditions-10-08.patch` livré le même jour, mais ce patch n'est pas encore appliqué sur `origin/main` (0 occurrence confirmée par grep) — voir DECISION_REQUIRED-06 (document 09).

## #6 — South African Airways, cargo international
**Statut : PAS ENCORE CORRIGÉ SUR ORIGIN/MAIN.** Même situation que #5 — règle `rule_south_african_airways_hold_domestic_only` présente uniquement dans le patch non appliqué.

## #7 — Exceptions cargo spécialisé brachycéphale gardées séparées de l'interdiction générale de hold
**Statut : PAS ENCORE CORRIGÉ SUR ORIGIN/MAIN.** L'exception Qantas (`breed_affenpinscher` et les 15 autres races) n'existe pas encore sur `origin/main` (0 occurrence confirmée par grep) — même patch non appliqué que #5/#6.

## #8 — Dogo Argentino → Australie non sur-généralisé + Melbourne airport-scoped
**Statut : MELBOURNE CONFIRMÉ PAR LE CODE.** `rule_au_mel_cargo_only` (scope aéroport, pas pays entier) est bien sur `origin/main` (Phase 1, commit `bc879cc`). La partie « Dogo Argentino non sur-généralisé » concerne une règle de restriction de race préexistante, non modifiée aujourd'hui — à confirmer par un test dédié, non exécuté dans le cadre de cet inventaire.

## #9 — Staffordshire Bull Terrier → Allemagne, distinction de race correcte
**Statut : HORS PÉRIMÈTRE DES CORRECTIFS DU 10/08 — À TESTER SÉPARÉMENT.** Cette règle n'a pas été touchée par les patches livrés aujourd'hui ; son statut sur `origin/main` n'a pas été vérifié dans le cadre de cet inventaire.

## #10 — Hawaï, régime distinct
**Statut : CONFIRMÉ PAR LE CODE.** `rule_us_hnl_animal_quarantine` présente sur `origin/main` (Phase 1, commit `bc879cc`). Limite connue et déjà documentée dans la règle elle-même : le scope `country_us` fait que le cas purement domestique (ex. LAX→HNL) reste masqué par la logique `isDomestic` du moteur — seul le cas international (ex. Paris→Honolulu, le cas d'origine signalé) est couvert.

## #11 — Logique du chemin de retour avec passeport UE
**Statut : À EXÉCUTER.** Le fait `docs.eu_passport` existe et est utilisé par 81 règles dans `rules.json`, mécanisme préexistant non modifié aujourd'hui — comportement non re-testé dans le cadre de cet inventaire.

## #12 — API en panne : toujours une erreur explicite, jamais un repli de démo/Tokyo
**Statut : À EXÉCUTER.** Non testé formellement ; le principe (pas de `DEFAULT_FINDER_INPUT`) est mentionné comme corrigé dans `docs/ROADMAP.md` et confirmé par le code (document 03, §5) pour `GET /v1/finder`, mais aucun test de panne réelle n'a été exécuté ici.

## #13 — Condition de course lors d'une re-recherche rapide
**Statut : À EXÉCUTER.** Non testé — nécessite un test d'intégration UI (déclenchements successifs rapprochés), hors périmètre d'un audit moteur seul.

## #14 — Priorité à la mesure réelle de la cage
**Statut : À EXÉCUTER.** Non testé.

## #15 — Séparation des trois notions de chaleur (risque physiologique / réglementation / embargo compagnie)
**Statut : PROBLÈME CONFIRMÉ, PAS ENCORE CORRIGÉ.** Document 04 : quatre modèles de seuils de chaleur coexistent (moteur région, moteur latitude, `HeatCalculator.astro` avec ajustement brachycéphale, page Hugo legacy), avec des résultats déjà divergents sur des cas réels (Athènes juillet : 28 °C vs 31 °C). C'est le scénario le plus clairement en échec de toute la liste — voir Lot 5 (document 07) et DECISION_REQUIRED-03/04 (document 09).

## Synthèse

| Statut | Scénarios |
|---|---|
| Confirmé par test réel (avant/après) | #1 |
| Confirmé par le code, mécanisme général vérifié | #3 (partiel), #8 (partiel), #10 |
| Pas encore corrigé sur origin/main (patch livré, non appliqué) | #5, #6, #7 |
| Problème confirmé, aucun correctif encore proposé | #15 |
| À exécuter (aucun test formel dans le cadre de cet inventaire) | #2, #4, #9, #11, #12, #13, #14 |

**Recommandation** : avant tout nouveau lot de code, transformer ces 15 scénarios en un script de non-régression exécutable (`packages/engine/scripts/reference-tests.ts` ou équivalent), qui tourne dans la CI du Lot 1 (document 07) et donne un statut PASS/FAIL vérifiable à chaque PR plutôt qu'une vérification manuelle ponctuelle comme celle-ci.
