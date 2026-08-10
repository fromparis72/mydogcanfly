# §15.10 — Premier lot de tests de référence (v2, corrigé après contre-revue Codex du 10/08/2026)

**SHA de référence pour le code : `e2b27799de335558afc165ee1763ad4613ca4ed9` (origin/main).**
**Version v1 de ce document marquait plusieurs scénarios "à exécuter" ou "confirmé" sans distinguer l'état du code de l'état réellement servi aux visiteurs. Codex a testé directement l'API et l'UI publiques et a trouvé des échecs en production que la v1 ne couvrait pas. Ce document ajoute une colonne PRODUCTION vérifiée par des tests réels (WebFetch + navigateur avec exécution JS), remplaçant les suppositions.**

## Distinction utilisée à partir de maintenant

- **LOCAL_GIT** : comportement du code au SHA `e2b2779` (origin/main), vérifié par exécution directe du moteur dans un worktree propre.
- **PREVIEW** : déploiement Cloudflare Pages/Workers de preview. **Aucune URL de preview connue à ce jour** — non testable tant que Philippe n'en communique pas une. Marqué NON VÉRIFIABLE partout.
- **PRODUCTION** : `mydogcanfly.com` / `api.mydogcanfly.com`, testé en direct le 10/08/2026 (requêtes HTTP réelles + un test navigateur avec exécution JS pour le scénario #2, qui est rendu côté client).

**Constat transversal, confirmé par test réel** : le Worker de production ne sert pas le code de `origin/main`. Test décisif — la règle Melbourne (`rule_au_mel_cargo_only`, Phase 1, mergée à 09:48 le 10/08) devrait interdire cabine ET soute pour toute compagnie volant vers MEL. En production, `CDG→MEL` renvoie Qantas `hold:true`, Air India et Vietnam Airlines `cabin:true,hold:true` — la règle n'existe pas côté serveur. **Le Worker public sert donc un code antérieur au 10/08 09:48**, très probablement le dernier déploiement du 09/08 (commit `heat`, 18:32) ou plus ancien. Aucun correctif du 10/08 (Phase 1, Phase 2, ni a fortiori le patch non appliqué) n'est en production.

## #1 — La Compagnie, EWR→ORY, 32 kg

| Environnement | Statut | Preuve |
|---|---|---|
| LOCAL_GIT | **FIXED** | Testé dans deux worktrees indépendants : `bc879cc` (avant) → hold:true, cargo:true ; `e2b2779` (origin/main) → hold:false, cargo:false |
| PREVIEW | NON VÉRIFIABLE — URL de preview inconnue | — |
| PRODUCTION | **FAIL — confirmé le 10/08/2026** | `GET https://mydogcanfly.com/v1/finder?origin=EWR&destination=ORY&weight_kg=32` → `{"airline_id":"airline_la_compagnie","cabin":false,"hold":true,"cargo":true,"label":"Hold only"}`. Le visiteur reçoit encore le résultat faux aujourd'hui. |

## #2 — Modalités détaillées falsifiables par URL

| Environnement | Statut | Preuve |
|---|---|---|
| LOCAL_GIT | **FAIL — confirmé par lecture du code** | `packages/ui/src/pages/[...loc]/tools/fiche.astro` : le nom de compagnie (`an`), les 3 placements (`cab`/`hold`/`cargo`, testés `=== "1"`), le statut direct, le tarif (`fee`), le score (`sc`) et les deux liens sortants (`as`/`af`) sont tous lus directement depuis la query string côté client, sans jamais rappeler le moteur. `safeUrl()` (l.282) filtre uniquement les schémas dangereux (`javascript:`, `data:`...) mais autorise **n'importe quel domaine https://**. |
| PREVIEW | NON VÉRIFIABLE — URL de preview inconnue | — |
| PRODUCTION | **FAIL — reproduit en direct le 10/08/2026, avec exécution JS réelle (navigateur, pas simple fetch)** | URL forgée `https://mydogcanfly.com/tools/fiche?from=fr&to=jp&an=FAUSSE+COMPAGNIE&cab=1&hold=1&cargo=1&fee=1e&sc=100&as=https://evil.example.com&af=https://evil.example.com` → la page rend réellement « Chosen airline: **FAUSSE COMPAGNIE** », « **100 %** », une ligne « The flight & the airline — FAUSSE COMPAGNIE » avec Hold ✓ / Cargo ✓ / tarif « 1e », et un lien « ✈ Airline sheet : FAUSSE COMPAGNIE → » pointant vers le domaine forgé. Capture texte intégrale conservée dans les notes de session. |

**Ce scénario est un P0 au même titre que #1 — il n'a pas de rapport avec les patches du 10/08, c'est une faille de conception préexistante de la page `fiche.astro` elle-même.** Voir document 11 (plan P0).

## #3 — Écart fiche↔moteur (Air Serbia, Aircalin, Bangkok Airways, Batik Air Indonesia/Malaysia, ITA Airways, La Compagnie, Pegasus)

| Environnement | Statut | Preuve |
|---|---|---|
| LOCAL_GIT | **FIXED (mécanisme général)** | `policy?.[p]?.allowed !== true` inconditionnel, sur `origin/main` (`01e7f98`). Seul La Compagnie re-testé individuellement (#1) ; les 6 autres compagnies non re-testées une par une. |
| PREVIEW | NON VÉRIFIABLE | — |
| PRODUCTION | **FAIL** | Le Worker de production étant antérieur même à la Phase 1 (voir constat transversal ci-dessus), il est nécessairement antérieur à la Phase 2 qui corrige ce mécanisme — donc le bug générique existe aussi en production pour ces 7 compagnies, pas seulement La Compagnie. Non testé compagnie par compagnie, mais la cause commune est confirmée absente du Worker déployé. |

## #4 — Qantas, CDG→SYD, revendication « direct » exacte

| Environnement | Statut | Preuve |
|---|---|---|
| LOCAL_GIT | **FAIL — confirmé par lecture du code** | `packages/engine/src/evaluate.ts` l.295-389 : en l'absence d'arête directe documentée, le moteur retombe sur une heuristique de hub (« a hub at either endpoint implies a likely nonstop ») qui peut marquer `direct:true, itinerary_confidence:"direct_assumed"` pour une route jamais opérée en direct. Ce code n'a pas été modifié aujourd'hui — le bug est présent sur `origin/main` autant qu'en production. |
| PREVIEW | NON VÉRIFIABLE | — |
| PRODUCTION | **FAIL — confirmé le 10/08/2026** | `GET https://mydogcanfly.com/v1/finder?origin=CDG&destination=SYD&weight_kg=8` → `airline_qantas`: `direct:true, itinerary_confidence:"direct_assumed"`. |

## #5 — Pegasus, hold domestique vs cargo

| Environnement | Statut | Preuve |
|---|---|---|
| LOCAL_GIT | **FAIL — patch non appliqué** | `rule_pegasus_hold_domestic_only` existe uniquement dans `weight-brachy-conditions-10-08.patch`, non appliqué sur `origin/main` (0 occurrence). |
| PREVIEW | NON VÉRIFIABLE | — |
| PRODUCTION | **FAIL** | A fortiori absent, le Worker prod étant antérieur même aux correctifs déjà sur `origin/main`. |

## #6 — South African Airways, cargo international

| Environnement | Statut | Preuve |
|---|---|---|
| LOCAL_GIT | **FAIL — patch non appliqué** | Même situation que #5 (`rule_south_african_airways_hold_domestic_only`). |
| PREVIEW | NON VÉRIFIABLE | — |
| PRODUCTION | **FAIL** | Idem #5. |

## #7 — Exceptions cargo spécialisé brachycéphale séparées de l'interdiction générale

| Environnement | Statut | Preuve |
|---|---|---|
| LOCAL_GIT | **FAIL — patch non appliqué, ET défaut de conception identifié par Codex même s'il était appliqué** | L'exception Qantas n'existe pas sur `origin/main`. Codex a testé le patch dans un worktree temporaire : même appliqué, il exclut Qantas de l'interdiction globale (`rule_global_brachy_hold`) sans ajouter de règle `require` séparée qui se déclenche et remonte au rapport — la condition BOAS/spécialiste n'apparaît nulle part dans le rapport final pour un Carlin sur Qantas, seulement `cargo:true` sans avertissement ni source. Le rationale mis à jour se trouve sur la règle qui, précisément, ne se déclenche plus pour ce cas. |
| PREVIEW | NON VÉRIFIABLE | — |
| PRODUCTION | **FAIL** | Absent, comme #5/#6. |

## #8 — Dogo Argentino → Australie non sur-généralisé + Melbourne airport-scoped

| Environnement | Statut | Preuve |
|---|---|---|
| LOCAL_GIT | **Melbourne : FIXED — Dogo Argentino : NON TESTÉ** | `rule_au_mel_cargo_only` (scope aéroport) présent sur `origin/main`. La partie race non sur-généralisée n'a pas été re-testée dans le cadre de cet inventaire ni de la contre-revue. |
| PREVIEW | NON VÉRIFIABLE | — |
| PRODUCTION | **Melbourne : FAIL — confirmé le 10/08/2026** | `GET .../v1/finder?origin=CDG&destination=MEL&weight_kg=5` → Qantas `hold:true`, Air India et Vietnam Airlines `cabin:true,hold:true` — aucune restriction Melbourne appliquée. Dogo Argentino non testé en production. |

## #9 — Staffordshire Bull Terrier → Allemagne

| Environnement | Statut | Preuve |
|---|---|---|
| LOCAL_GIT | À EXÉCUTER | Non touché par les correctifs du jour, non re-testé. |
| PREVIEW | NON VÉRIFIABLE | — |
| PRODUCTION | À EXÉCUTER | Non testé. |

## #10 — Hawaï, régime distinct

| Environnement | Statut | Preuve |
|---|---|---|
| LOCAL_GIT | **PARTIEL, pas « confirmé » sans nuance (correction demandée par Codex, acceptée)** | `rule_us_hnl_animal_quarantine` couvre le cas international (Paris→Honolulu, le cas d'origine) mais le scope `country_us` fait que le cas domestique (LAX→HNL) reste masqué par la logique `isDomestic` — limitation déjà documentée dans l'historique de la règle elle-même. |
| PREVIEW | NON VÉRIFIABLE | — |
| PRODUCTION | **FAIL — confirmé le 10/08/2026, absence totale** | `GET .../v1/finder?origin=CDG&destination=HNL&weight_kg=8` → aucune mention d'Hawaï, quarantaine ou Honolulu ; seules les règles CDC génériques US s'appliquent. Cohérent avec le constat transversal : le Worker prod est antérieur à la Phase 1 qui a introduit cette règle. |

## #11 à #14 — À EXÉCUTER dans les trois environnements
Aucun changement depuis la v1 : ces scénarios (retour passeport UE, panne API, condition de course, mesure de cage) n'ont été testés dans aucun environnement, ni par cet inventaire ni par la contre-revue Codex.

## #15 — Séparation des trois notions de chaleur

| Environnement | Statut | Preuve |
|---|---|---|
| LOCAL_GIT | **FAIL — confirmé** | Document 04 : 4 modèles de seuils de chaleur indépendants dans le code, déjà divergents (Athènes juillet : 28 °C vs 31 °C). Ce n'est pas un problème de déploiement, c'est un problème de code source lui-même. |
| PREVIEW | NON VÉRIFIABLE | — |
| PRODUCTION | **Présumé FAIL, non re-testé spécifiquement** | Le code sous-jacent étant la cause, et n'ayant fait l'objet d'aucun correctif aujourd'hui, il n'y a pas de raison que la production diffère de `origin/main` sur ce point. |

## Synthèse

| Statut | Scénarios |
|---|---|
| FIXED sur origin/main, FAIL en production | #1, #3 (mécanisme), #8 (Melbourne) |
| FAIL sur origin/main ET en production (bug non traité aujourd'hui) | #2, #4, #15 |
| FAIL — patch livré mais non appliqué, sur origin/main ET en production | #5, #6, #7 |
| PARTIEL sur origin/main, FAIL (absence totale) en production | #10 |
| À EXÉCUTER dans tous les environnements | #9, #11, #12, #13, #14 (+ Dogo Argentino du #8) |

**Deux P0 actifs en production aujourd'hui, affectant des visiteurs réels : #1 (La Compagnie) et #2 (falsification de rapport). Voir document 11 pour le plan de traitement, sans déploiement engagé de ma part.**
