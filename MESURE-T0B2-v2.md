# MESURE T0-B2 — v3 : chiffres v2 validés, dispositif de reproduction durci

> **v3 (15/08/2026)** — les chiffres métier de la v2 sont validés en contre-revue et **inchangés**.
> Cette révision ne corrige que l'outillage, sur six faux verts relevés par Codex : runner non
> portable, `registre.mjs` qui nommait un écart sans échouer, idempotence contournable, dettes
> scellées par cardinal au lieu d'identité, chemins absolus dans une annexe, propreté du dépôt
> affichée mais non gardée. Détail au §11.


Date : 15/08/2026 · Base : `origin/main` @ `8fe97c0d7a1695ca97fff19b0421aecc90f7b1c6` · Node 22.22.2
Annexes et outils : `mesures/t0b2/` · Reproduction intégrale : `bash mesures/t0b2/outils/reproduire.sh`

**Statut : MESURE SEULE.** Aucun patch métier. Le dépôt n'est pas modifié par les sondes : la
migration est appliquée dans une copie jetable issue de `git archive HEAD`. Les baselines figées
ne sont ni écrasées ni assouplies.

Cette v2 remplace `MESURE-T0B2.md` (v1). Les deux décisions P0 sont appliquées, les deux
corrections intégrées, et **les cinq valeurs prévisionnelles de Codex ont été reproduites
indépendamment** — le candidat a été calculé, puis seulement ensuite comparé aux valeurs annoncées.

---

## 1. Reproduction indépendante du contre-calcul Codex

| Valeur annoncée | Reproduite | Verdict |
|---|---|---|
| Baseline candidate `5dad5396527c94bcb1a0fc2bb2c79b94052c26ca32d92fb47cfecd43a205d2e7` | `5dad5396…a205d2e7` | ✅ identique |
| 44 scénarios touchés | 44 / 72 | ✅ |
| 46 compagnies | 46 | ✅ |
| 452 cartes modifiées | 452 (`statuts`/`decisions`/`booleens`/`confirm`) | ✅ |
| 464 bascules sur 48 couples | 464 sur 48 | ✅ |

Idempotence : deux exécutions complètes du harnais donnent le même fichier **bit à bit**.

## 2. P0 — Les dix `POLICY_STALE` passent en `legacy_unreviewed`

Décision appliquée. Le raisonnement est vérifié dans les données : sur `airline_french_bee.cargo`,
le YAML vivant porte `cls: warn` / « Via freight » tandis que l'artefact survivant porte
`allowed: false` — les deux sources se contredisent, et c'est l'artefact qui est périmé. Les 10
sont donc traités comme donnée non revérifiée, pas comme vérité canonique.

**Répartition finale : 218 + 83 + 1 = 302.**

| Lot | Couples | Cible |
|---|---|---|
| Mécanique | **218** | `offered` **143** · `not_offered` **75** |
| Non revus | **83** | `review_state: legacy_unreviewed` — **73** du manifeste + **10** `POLICY_STALE` |
| Thai cargo | **1** | `availability: undocumented` → `confirmation_required` / `policy_unpublished` |

Contrôles internes du générateur (échec bloquant sinon) : 302 politiques, 74 `conditional`
consommés, 10 `POLICY_STALE` vus, **0 `conditional` résiduel**, aucune forme d'auteur `{allowed:…}`.

## 3. Traçabilité intégrale des 464 bascules

| Invariant | Résultat |
|---|---|
| Bascules hors registre approuvé | **0** |
| Transitions autres que `allowed → confirmation_required` | **0** (464/464 conformes) |
| Cause ou `policy_ref` divergente | **0** |
| Compagnie apparue ou disparue | **0** |
| `pets` / `deny` / `heat` | **0 écart** — aucun refus inventé, aucun effet climatique |

Effets transitifs : `label` 72, `fee` 56 (tarif emprunté qui disparaît quand le dernier canal
`allowed` passe à confirmer), `score` 22 scénarios, `compatible` 24, `classement` 28.

**Couverture, sans plafond silencieux** : les 72 scénarios HTTP n'exercent que **48 des 84**
couples migrés. Les **36 restants** sont nommés dans `verification-bascules.json` — et couverts
directement au point 5.

## 4. P0 — Arbitrage structurel : l'option C est faisable en l'état

Structure retenue (arbitrage Codex), mesurée avant d'être écrite :

```yaml
policies:                      # bloc UNIQUE, non éditorial : les 302 décisions
  cabin: { availability: offered }
  hold:  { review_state: legacy_unreviewed }
  cargo: { availability: undocumented }
channels:                      # contenu VISIBLE, qui ne décide plus rien
  - placement: cabin           # simple lien vers la politique
    name: { en: Cabin, … }     # éditorial
    cls: ok                    # éditorial
```

| Invariant de l'option C | Mesure |
|---|---|
| 302 politiques déclarées dans le bloc | ✅ 302 |
| 296 canaux visibles portent un `placement` | ✅ 296 (292 relus de `catOf` + **4 rattachements explicites**) |
| Chaque canal visible référence une politique | ✅ 0 orphelin |
| Aucun placement dupliqué dans une fiche | ✅ 0 |
| Exactement 6 politiques sans canal visible | ✅ 6 |

Les 4 rattachements explicites (`french_bee` « Freight », `korean_air` « Specialized-LIVE »,
`malaysia_airlines` « MASkargo Animal Hotel », `qantas` « Qantas Freight ») sont justifiés par
leur libellé de statut, et n'entrent en collision avec aucun canal existant. Les 6 politiques sans
canal visible — `asiana.cargo`, `condor.cargo`, `eva_air.cargo`, `norwegian.cargo`, `qantas.hold`,
`virgin_australia.hold` — sont la dette éditoriale exacte, désormais **scellée et nommée**, mais
dont la décision devient reproductible.

**Conclusion : aucun changement éditorial requis.** `catOf(name.en)` quitte le chemin décisionnel
sans qu'une seule ligne visible bouge.

## 5. Couverture directe des 302 à la projection (hors scénarios HTTP)

Sonde `couverture-projection.mjs` : chaque politique traverse `normalize()` — donc la validation
stricte de `PlacementPolicyAuthored` puis `projectPlacementPolicy` — et son statut runtime est
comparé au registre.

| Mesure | Résultat |
|---|---|
| Politiques projetées | **302 / 302** |
| Conformes au registre | **302** — 0 échec |
| Répartition par statut | `allowed` 143 · `denied` 75 · `confirmation_required` **84** |
| Répartition par cause | `legacy_unreviewed` **83** · `policy_unpublished` **1** |
| Couples migrés couverts | **84 / 84**, y compris les 36 hors scénarios |
| `conditional` survivant à la projection | **0** |

## 6. Preuve de non-perte et bijections

| Preuve | Résultat |
|---|---|
| Candidat identique à l'actuel **hors** `premium.policy` | ✅ strict |
| Champs perdus ou modifiés dans les 302 (hors `allowed`/`conditional`) | **0** |
| Champs apparus hors discriminants | **0** |
| Inventaire conservé | `source` 302 · `brachy_allowed` 34 · `max_weight_kg` 23 · `carrier_dims_cm` 10 · `fee` 10 · `conditions` 33 |
| 74 lignes de manifeste ↔ 74 `conditional:true` | ✅ 0 orphelin dans chaque sens |
| Empreintes SHA-256 recalculées sur les fiches vivantes | ✅ 74/74 |
| Dérive `cls` → `allowed` (292 canaux) | ✅ 0 |
| Politique sans canal YAML | 10, **nommées** (les `POLICY_STALE`) |

## 7. Correction acceptée : 86 `warn`, pas 82

Confirmé et intégré au générateur : **86 canaux `warn`** = 82 reconnus par `catOf` + 4 non
reconnus (eux aussi `warn`). La v1 ne comptait que les reconnus. Les 74 `conditional:true`
d'`objects.json` s'expliquent : 86 `warn` − 4 non reconnus (jamais dérivés) − 8 cargo dont la
politique écrite à la main est préservée = 74.

## 8. Section historique T0-A : 1530 écarts mesurés, et le plan pour ne rien affaiblir

**Écart avec le contre-calcul Codex** : je mesure **1530**, pas 1398. Mon compte est intégralement
décomposable, et c'est exactement ce que la section compte :

| Poste | Occurrences |
|---|---|
| Segments comparés `[1,2,3,5,6,8,10,11]` : `statuts` 452 + `booleens` 452 + `confirm` 452 + `fee` 56 | **1412** |
| Libellé changé sans bascule `pets` | **72** |
| Champs de tête : `score` 22 + `compatible` 24 | **46** |
| **Total** | **1530** |

Non comptés par cette section, et c'est conforme à son code : `decisions` (seg#4, champ nouveau,
exclu de la boucle) et `classement` (l'ordre n'est pas comparé). L'écart de 132 avec 1398 mérite
une vérification croisée de Codex — il ne bloque rien, aucune de ces deux valeurs n'étant approuvée.

**Plan retenu pour le patch** (aucune preuve supprimée ni assouplie) :
1. La preuve historique T0-A cesse de comparer l'état VIVANT : elle compare deux baselines
   **figées** (`t0a-finder-baseline-avant.json` → la baseline T0-A scellée). Elle devient
   insensible à T0-B2 et à tout lot ultérieur, sans perdre un seul de ses contrôles — c'est ce
   qui la rend permanente au lieu de fragile.
2. Une baseline **après T0-B2** est versionnée (empreinte prévisionnelle `5dad5396…`, à
   régénérer et approuver avec le patch).
3. Un **diff T0-B2 approuvé** est versionné sur le modèle de `t0a-approved-diff.json` : valeurs
   exactes des cartes, bijection stricte dans les deux sens (aucune bascule non approuvée, aucune
   entrée approuvée non observée).
4. Les **84 couples** sont couverts directement au niveau normalisation/projection — le
   mécanisme du point 5, promu en test du harnais, indépendant des routes.

## 9. Reproductibilité des générateurs (et non seulement leur intégrité)

Les six outils sont versionnés dans `mesures/t0b2/outils/`, paramétrés par arguments (aucun
chemin en dur), et orchestrés par un script unique :

```
bash mesures/t0b2/outils/reproduire.sh
```

Il crée la copie jetable, **valide l'instrument** (le témoin doit reproduire `bc10c594…` bit à
bit avant toute mesure), applique le candidat, prouve l'idempotence, produit le diff, trace les
bascules, exécute la couverture directe, teste l'option C, **compare les artefacts régénérés aux
annexes publiées**, puis **exige** que le dépôt soit dans son état initial. Toute rupture
d'invariant sort en échec — aucune n'est seulement affichée.

| Outil | Rôle |
|---|---|
| `registre.mjs` | état AVANT, bijections, re-calcul des 74 empreintes |
| `candidat.mjs` | migration 218/83/1, contrôles bloquants |
| `diff-baselines.mjs` | diff segment par segment de deux baselines |
| `verifier-bascules.mjs` | traçabilité des bascules au registre |
| `couverture-projection.mjs` | couverture directe des 302 |
| `faisabilite-option-c.mjs` | carte et invariants de la structure cible |

Empreintes : `mesures/t0b2/SHA256SUMS` (`sha256sum -c SHA256SUMS`).

## 10. Ce que le patch fera, une fois autorisé

1. Écrire le bloc `policies:` dans les 103 fiches (302 décisions) et le `placement` sur les 296
   canaux visibles.
2. Supprimer `catOf` et la traduction `cls` → `allowed`/`conditional` du chemin décisionnel.
3. Supprimer `LegacyPlacementPolicyAuthored`. Le booléen `allowed` du modèle runtime reste — sa
   suppression n'appartient pas à T0-B2.
4. Régénérer `objects.json` par l'ingestion (idempotence bit à bit, `ingest:check` sans écriture).
5. Poser les contre-épreuves du point 6 du cadrage (décision absente/doublée/hybride, placement
   absent/inconnu/dupliqué, réintroduction d'`allowed`/`conditional`, entrée de manifeste non
   consommée, `cls`/texte modifié sans effet, `availability` modifié sans régénération).
6. Poser les quatre éléments du point 8 ci-dessus.

**Aucun patch avant ton feu vert.** Ensuite seulement : contre-revue → PR → CI verte → preview
immuable → contre-test navigateur. Aucun alias ni production sans validation complète de Philippe.

## 11. v3 — les six faux verts, corrigés et contre-testés

| # | Faux vert | Correctif | Contre-épreuve |
|---|---|---|---|
| 1 | `faisabilite-option-c.mjs` codait `ROOT` en dur → `ENOENT` hors de la machine d'origine | racine passée en argument, comme les cinq autres outils | rejeu complet depuis un **worktree neuf** |
| 2 | `registre.mjs` nommait un écart puis sortait en succès | verdict strict : toute anomalie sort en **1**, seule la dette scellée est tolérée — **par identité, pas par cardinal** | empreinte du manifeste falsifiée → `EXIT_CODE=1` ; dette résorbée + dette neuve à effectif constant (10) → les **deux** relevées |
| 3 | Idempotence contournable : `\|\| true` puis copie d'un fichier déjà présent dans l'archive | `regenerer_baseline()` supprime la sortie, exige sa recréation, puis exige l'empreinte attendue | un `tsx` qui ne produit rien échoue au lieu de « réussir » |
| 4 | Dettes de l'option C vérifiées au nombre | les **6** couples et les **4** rattachements sont scellés par identité ; chaque rattachement doit être consommé exactement une fois | invariants portés de 5 à 6, tous exigés |
| 5 | `diff-avant-apres.json` portait des chemins absolus | entrées identifiées par **libellé logique + SHA-256**, aucun chemin | plus aucun chemin absolu dans les six annexes |
| 6 | Propreté du dépôt seulement affichée | état (HEAD + `status --porcelain`) capturé au début, **re-comparé** à la fin | toute modification du dépôt fait échouer la reproduction |

**Le même faux vert que le n° 3 affectait aussi l'étape 2 (témoin)**, et il était plus grave :
`t0a-finder-baseline.json` est livré par l'archive et **identique bit à bit** à la baseline figée,
donc un `tsx` planté aurait validé l'instrument sans qu'aucune mesure n'ait eu lieu — puis tout le
reste se serait déroulé sur un harnais mort. Les deux étapes passent désormais par la même
fonction de régénération.

**Ajout non demandé mais nécessaire** : l'étape 4 bis exige maintenant exactement **1530** écarts.
Le total historique n'est pas un commentaire — un autre nombre signifierait un impact métier
différent de celui qui a été mesuré et validé.

### Épreuve finale : worktree neuf, un seul rejeu

Journal intégral (chemins locaux neutralisés) : `mesures/t0b2/epreuve-worktree-neuf.log`.

Worktree détaché créé au commit `d509ca2`, arbre strictement propre, Node 22.22.2.
`bash mesures/t0b2/outils/reproduire.sh` → **`EXIT=0`**, dix étapes réussies :

| Étape | Résultat exigé | Obtenu |
|---|---|---|
| 1 · registre et bijections | aucune anomalie, dette scellée à l'identique | ✅ |
| 2 · témoin (instrument) | `bc10c594…` régénéré | ✅ |
| 3 · candidat | 218 / 83 / 1 = 302 | ✅ |
| 4 · idempotence | deux régénérations effectives, `5dad5396…` | ✅ |
| 4 bis · section historique | exactement 1530 écarts | ✅ |
| 5 · diff | 44 scénarios · 46 compagnies · 452 cartes | ✅ |
| 6 · traçabilité | 464 bascules / 48 couples, 0 hors registre | ✅ |
| 7 · couverture directe | 302/302, 143 · 75 · 84 | ✅ |
| 8 · option C | 6 invariants sur 6 | ✅ |
| 9 · identité des annexes | 6 annexes régénérées = empreintes publiées | ✅ |
| 10 · intégrité du dépôt | état final = état initial | ✅ |

*Transparence : le tout premier lancement depuis ce worktree a rendu `EXIT=141` — un SIGPIPE
provoqué par un `head` dans ma commande de capture, extérieur au runner. Le rejeu avec capture
complète, ci-dessus, est le seul résultat qui fasse foi.*

**Trois annexes ont changé d'empreinte** (formats durcis, contenu métier inchangé) :
`registre-avant-bijections.json`, `diff-avant-apres.json`, `faisabilite-option-c.json`. Les trois
autres — dont `baseline-candidate-prevision.json` (`5dad5396…`) et `verification-bascules.json` —
sont **bit à bit identiques** à la v2. `SHA256SUMS` couvre désormais annexes **et** outils.
