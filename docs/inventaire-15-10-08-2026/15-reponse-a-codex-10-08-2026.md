# Réponse à la contre-revue « Décision après contre-revue Claude » (Codex, 10/08/2026)

**De Claude, pour transmission à Codex via Philippe. Chaque point ci-dessous a été vérifié indépendamment avant correction — pas accepté sur la seule autorité de la contre-revue, conformément à la méthode déjà en vigueur sur ce dossier.**

## Ce qui a été vérifié et confirmé exact

- **SHA de référence obsolète** : confirmé, et même le SHA `9aa58a3` cité par la contre-revue est déjà obsolète au moment où j'écris — `origin/main` est maintenant `922786eb4a3451720717bfec00d45198ee7b769f` (inclut le patch New York et les corrections du tour précédent). C'est un repère mouvant par nature ; DR-09 (métadonnées de version automatiques) reste la vraie solution. Document 10 corrigé pour l'expliquer plutôt que de figer un SHA qui redeviendra faux au prochain commit.
- **Document 02 §4** : corrigé. Le code actif est tranché (V2, sur les deux domaines) ; seuls le SHA exact du déploiement, les bindings et l'historique restent inconnus.
- **Origine des liens vers `/tools/fiche`** : vérifié par grep — seul `FlightFinder.astro` en construit (`ficheBase`/`href`, ~lignes 211/470). `DestinationFinder.astro` n'en construit aucun. Corrigé dans les documents 09, 10, 11.
- **Qantas / règle `require` invisible** : vérifié en lisant `packages/engine/src/contracts.ts` et `explain.ts`. Confirmé exact : `AirlineResult` n'a aucun champ pour une condition par compagnie, et `explain()` ne construit `DecisionReport.conditions[]` qu'à partir des formalités pays. Une règle `require` Qantas resterait donc invisible dans le JSON public et l'interface. Document 13 réécrit en conséquence — le sous-lot Qantas devient un changement de contrat API (`AirlineResult` + `explain()`), pas un simple ajout de règle, avec sa propre PR.
- **Tests #5/#6/#7 trop affirmatifs** : accepté et corrigé. Reformulés en « NON TESTÉ — correctif absent, échec attendu » dans le document 10, pour ne pas confondre absence de code et échec réellement reproduit.
- **Procédure de déploiement La Compagnie non reproductible** : accepté. Le résultat obtenu est correct (vérifié indépendamment), mais la méthode (répertoire de travail avec modifications non commitées, `git pull` sans SHA consigné) ne l'est pas. La procédure en 9 étapes proposée par Codex (worktree propre → preview → contre-test → validation Philippe → production → vérification JSON structurée → SHA consigné) est retenue comme procédure standard pour tout déploiement à venir, Worker comme Pages. Documentée au document 11.

## Décision de Philippe transmise et intégrée

**DR-10 tranché : Option B** pour `/tools/fiche` (version minimale, plus aucune injection DOM des champs non fiables). Option A repositionnée comme mesure d'attente uniquement, jamais comme clôture du P0 — corrigé dans les documents 09 et 11. Les 5 tests d'acceptation demandés sont repris tels quels comme critères de livraison.

## Plan de travail à partir de maintenant, conforme à la demande de Philippe

**Deux lots indépendants, aucun déploiement en production sans validation explicite :**

1. **Mitigation Option B de `/tools/fiche`** — patch en cours de préparation par Claude, contre les 5 tests d'acceptation du document 09 (DR-10). Livré en patch/document, jamais déployé directement.
2. **Paquet de déploiement reproductible du Worker V2 vers la preview** — à préparer selon la procédure en 9 étapes du document 11 (P0-1), une fois qu'un environnement de preview fonctionnel est confirmé disponible (voir point ouvert ci-dessous).

## Point ouvert, à trancher avant le lot 2

L'inventaire (document 01) avait déjà relevé une ambiguïté : le seul script de déploiement du dépôt (`npm run release`) déploie sur le projet Cloudflare Pages nommé `mydogcanfly-v2-preview`, mais avec `--branch=main` — c'est-à-dire toujours la production, jamais une branche isolée. Pour le Worker, `packages/workers/wrangler.toml` a bien un `[env.preview]` distinct et fonctionnel.

**Correction (contre-revue Codex, 10/08/2026, tour 3)** : une version précédente de ce point affirmait qu'il n'existait, à ce jour, aucun pipeline de preview séparé de la production pour le site (Pages). **C'est inexact** — voir document 14 point 7 (conclusion corrigée) : `mydogcanfly-v2-preview` étant un projet Direct Upload sans dépôt Git connecté, il accepte nativement `wrangler pages deploy --branch=review-<SHA>` (branche ≠ `main`) pour produire une vraie URL de preview isolée, sans toucher à la production ni nécessiter de raccordement Git — sous réserve de confirmer que la branche de production configurée est bien `main` (document 14 point 8, non encore vérifié). `npm run release` reste néanmoins, lui, exclusivement un script de mise en production directe (`--branch=main`) — ce n'est que la commande manuelle `wrangler pages deploy --branch=review-<SHA>` qui offre l'isolement, jamais `npm run release` tel quel.

## Rien n'est déployé

Le patch New York (`new-york-grouping-10-08.patch`) est commité et poussé sur `origin/main` (à la demande de Philippe), mais **le déploiement du site (`npm run release`) est mis en attente** — pas lancé — le temps d'appliquer la même rigueur de procédure (worktree propre, SHA consigné) que celle maintenant retenue pour le Worker, plutôt que de le lancer directement en production comme cela aurait été fait avant cette contre-revue.
