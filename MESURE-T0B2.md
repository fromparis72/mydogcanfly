# MESURE T0-B2 — dossier chiffré AVANT patch

Date : 15/08/2026 · Base : `origin/main` @ `8fe97c0d7a1695ca97fff19b0421aecc90f7b1c6` · Node 22.22.2
Annexes : `mesures/t0b2/` (empreintes SHA-256 en fin de document).

**Statut : MESURE SEULE.** Aucun fichier du référentiel n'est modifié par ce lot. La simulation a
tourné dans une copie jetable hors dépôt ; `objects.json`, les fiches YAML et les baselines figées
sont intacts.

---

## 0. Environnement neuf et gardes T0-B1 (zéro confiance)

| Contrôle | Résultat |
|---|---|
| Conteneur neuf, clone frais, arbre vide | ✅ |
| SHA local = `origin/main` = `8fe97c0d…` | ✅ |
| Node 22.22.2 = `.nvmrc` | ✅ |
| `t0b-migration-matrice.json` | ✅ `de1b9783…c52893` (identique à l'annonce) |
| `test-t0b-matrice.mjs` | ✅ `1d6f14c3…71871d` |
| `t0b-finder-baseline-avant.json` | ✅ `bc10c594…45b7bb` |
| `npm run test:unit` (6 suites) | ✅ 225 OK, 0 FAIL |
| Vérificateur figé (sortie directe) | ✅ « 74 lignes vérifiées, 0 écart(s) », code 0 |
| CI complète de `main` (run 31873404610) | ✅ `success` (terminée 08:13 UTC) |

## 1. Registre exhaustif des 302 couples

Annexe `registre-302.json` : pour chaque couple — fichier YAML + locator (ou son absence,
nommée), `name.en`, `cls`, état avant (`allowed`/`conditional`), cible, lot, ligne de manifeste.

**Répartition exacte : 228 + 73 + 1 = 302.**

| Lot | Couples | Cible |
|---|---|---|
| Mécanique | **228** | `allowed:true → availability: offered` (**149**) ; `allowed:false → not_offered` (**79**) |
| Non revus | **73** | `review_state: legacy_unreviewed` |
| Thai cargo | **1** | `availability: undocumented` → runtime `confirmation_required` / `policy_unpublished` |

Réconciliation source par source (chaque nombre est vérifié, pas déduit) :

```
302 politiques canoniques (objects.json)
 = 259 dérivées et encore reproduites par l'ingestion
 + 33  écrites main préservées (11 compagnies × 3 canaux)
 + 10  POLICY_STALE figés (lot M1-v3 — dette nommée, empreintes verrouillées)

292 canaux YAML reconnus par catOf (sur 296 canaux au total ; 4 non reconnus)
 = 302 − 10 POLICY_STALE
228 mécaniques = 218 côté YAML reconnus + 10 POLICY_STALE (6 true + 4 false)
 74 `conditional:true` = 82 canaux `warn` − 8 cargo préservés (politiques écrites main)
```

## 2. Bijection YAML ↔ manifeste ↔ objects.json

| Preuve | Résultat |
|---|---|
| 74 lignes de manifeste ↔ 74 `conditional:true` d'objects.json | ✅ égalité stricte des deux ensembles, 0 orphelin dans chaque sens |
| Fichier + locator du manifeste = position réelle du canal dans la fiche | ✅ 74/74 |
| **Empreintes SHA-256 des 74 blocs recalculées sur les YAML vivants** | ✅ 74/74 identiques, blocs identiques champ à champ |
| Doublon de placement dans une fiche | ✅ 0 |
| Canal YAML reconnu émis sans politique objects.json | ✅ 0 |
| Dérive `cls` → `allowed` (YAML vs objects.json, 292 canaux) | ✅ 0 divergence — les 228 conversions sont réellement mécaniques |

**Écarts structurels connus et NOMMÉS** (ce sont les 10 POLICY_STALE, pas une découverte) :
- **4 canaux YAML au libellé non reconnu par `catOf`** : `french_bee` « Freight », `korean_air`
  « Specialized-LIVE », `malaysia_airlines` « MASkargo Animal Hotel », `qantas` « Qantas Freight »
  — leurs politiques cargo survivent dans objects.json sans lien vivant avec la fiche.
- **6 couples sans aucun canal YAML** : `asiana.cargo`, `condor.cargo`, `eva_air.cargo`,
  `norwegian.cargo`, `qantas.hold`, `virgin_australia.hold`.

→ Voir « Question structurelle pour la contre-revue », point 6.

## 3. Simulation : instrument validé, puis candidat

Méthode : copie intégrale du dépôt (archive de HEAD) hors dépôt, workspaces rebranchés sur la
copie, puis rejeu des **72 scénarios** du harnais baseline à travers le **contrat HTTP réel du
Worker** (le même que la CI).

| Étape | Résultat |
|---|---|
| **Run témoin** (objects.json d'origine) | ✅ reproduit la baseline figée **bit à bit** (`bc10c594…`) — l'instrument est valide |
| Candidat : migration des 302 selon le registre | ✅ contrôles internes : 302/302, 73/1/149/79, 74 `conditional` consommés, 0 résiduel |
| Le candidat passe la validation Zod complète (normalize) | ✅ implicite : le Worker a servi les 72 scénarios |
| **Idempotence** : deux exécutions complètes | ✅ identiques **bit à bit** |
| Empreinte de la baseline candidate | `fae18e26ee3ff08ded385b3eb6a5a4428d90e516ef6b8e62bcdaef0c109e94d2` |
| `t0b-finder-baseline-avant.json` | **non touché** (vérifié : `bc10c594…` en place) |

## 4. Diff exhaustif du contrat public (avant → candidat)

Annexes `diff-avant-apres.json` (détail intégral) et `verification-bascules.json`.

**Volumétrie** : 44 scénarios touchés / 72 (28 strictement identiques) ; 41 compagnies.

**Contre-épreuve de traçabilité — le cœur du dossier :**

| Invariant | Résultat |
|---|---|
| Bascules de décision observées | **420**, sur **43 couples distincts** |
| Bascules HORS registre approuvé | **0** |
| Transition ≠ `allowed → confirmation_required` | **0** |
| Cause ou `policy_ref` ≠ la ligne du manifeste | **0** (73 × `legacy_unreviewed`, thai × `policy_unpublished`, `policy_ref` exact) |
| Compagnie apparue ou disparue d'un scénario | **0** |

**Modifications transitives, toutes natures** (comptées segment par segment) :

| Nature | Occurrences | Lecture |
|---|---|---|
| `statuts` / `decisions` / `booleens` / `confirm` | 408 chacune | les 4 vues du même verdict par compagnie |
| `label` | 72 | ex. aircalin « Cargo only » → « Policy to confirm with the airline » ; royal_jordanian « Cabin OK » → « Hold only » |
| `fee` | 56 | le tarif emprunté disparaît quand le seul canal `allowed` passe à confirmer (invariant T0-B1 « aucun placement allowed → aucun tarif emprunté ») |
| `score` (tête) | 22 scénarios | baisse mécanique du score compagnie |
| `compatible` (tête) | 24 scénarios | des couples sortent de la liste compatible |
| `classement` | 28 scénarios | permutations induites par les scores |
| `pets`, `deny`, `heat` | **0** | `offers_pet_transport` survit partout, aucun refus inventé, aucun effet climatique |

**Couverture, sans plafond silencieux** : 43 des 74 couples du registre sont exercés par les 72
scénarios ; les **31 couples jamais vus** par ces routes sont listés nominativement dans
`verification-bascules.json` (`registre_non_couvert`). Leur bascule est prouvée au niveau des
politiques (annexe registre + candidat), pas au niveau du contrat HTTP — c'est la limite de la
matrice 9 routes, héritée de T0-A, notée ici pour la contre-revue.

## 5. Preuve de non-perte des champs non décisionnels

| Preuve | Résultat |
|---|---|
| objects.json candidat identique à l'actuel **hors** `premium.policy` | ✅ strict |
| Champs perdus ou modifiés dans les 302 politiques (hors `allowed`/`conditional`) | **0** |
| Champs apparus (hors discriminants `availability`/`review_state`) | **0** |
| Inventaire conservé | `source` 302, `brachy_allowed` 34, `max_weight_kg` 23, `carrier_dims_cm` 10, `fee` 10, `conditions` 33 — identique avant/après |

## 6. Question structurelle pour la contre-revue Codex (à trancher AVANT le patch)

Le cadrage exige que **chacun des 302 canaux** porte dans les YAML un placement explicite et son
discriminant, et que `catOf(name.en)` disparaisse du chemin décisionnel. Or :

- **296 canaux** existent dans les fiches (292 reconnus + 4 au libellé non reconnu). Le placement
  explicite règle nativement le cas des 4 : leur bloc YAML existe, seul le rattachement par nom
  manquait.
- **6 couples** (`asiana.cargo`, `condor.cargo`, `eva_air.cargo`, `norwegian.cargo`,
  `qantas.hold`, `virgin_australia.hold`) n'ont **aucun bloc YAML**. Ajouter un canal `channels[]`
  serait un changement ÉDITORIAL visible (icône, nom, texte) — interdit par le point 7 du cadrage.

Proposition soumise à Codex (aucune décision prise) :
- **Option A (recommandée)** : un bloc **non éditorial** dans la fiche (ex. `policies:` à côté de
  `channels:`) portant `placement` + discriminant pour ces 6 couples — la fiche devient la source
  décisionnelle complète des 302, sans un pixel de changement visible.
- **Option B** : laisser les 6 en dette POLICY_STALE inchangée (aucun discriminant YAML), au prix
  d'une bijection YAML ↔ objects.json incomplète — contraire à la lettre du cadrage (« chacun des
  302 »), mais périmètre minimal.

## 7. Empreintes des annexes (`mesures/t0b2/`)

Voir `mesures/t0b2/SHA256SUMS` — vérifiable par `sha256sum -c SHA256SUMS`.

| Annexe | Contenu |
|---|---|
| `registre-302.json` | registre exhaustif : 302 couples, YAML/locator, avant, cible, lot, manifeste |
| `diff-avant-apres.json` | diff intégral des 72 scénarios, segment par segment |
| `verification-bascules.json` | contre-épreuve : 420 bascules tracées + 31 couples non couverts |
| `bijection-yaml-manifeste-objects.json` | preuves de bijection et réconciliations chiffrées |
| `baseline-candidate-prevision.json` | baseline candidate PRÉVISIONNELLE (`fae18e26…`) — une prévision de mesure, PAS la baseline du patch : celle-ci sera régénérée et approuvée avec le patch |

**Prochaines étapes (inchangées)** : contre-revue Codex de ce dossier (dont le point 6) → patch
sur cette branche → contre-épreuves du cadrage (point 6 du brief) → PR → CI verte → preview
immuable → contre-test navigateur. Aucune fusion, aucun alias, aucune production sans validation
complète de Philippe.
