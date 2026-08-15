# LIVRAISON T0-B2 — patch métier complet (v2)

> **v2 (15/08/2026)** — trois P0, un P1 et un P2 relevés en contre-revue sont corrigés, et chacun
> a sa contre-épreuve permanente. **La baseline publique est inchangée** (`5dad5396…`) : aucun
> verdict ne bouge. Le seul changement de données est la provenance Thai Cargo (§14). Détail au §14.


Date : 15/08/2026 · Base : `origin/main` @ `8fe97c0d…` · Node 22.22.2 · Branche `claude/passation-t0-b2-xgrvye`
Mesure approuvée : `MESURE-T0B2-v2.md` (v3-bis) · Feu vert de contre-revue du 15/08/2026, 14:05

**Le diff réellement obtenu est identique à la mesure approuvée**, produit cette fois par
l'implémentation et non par une simulation : baseline `5dad5396527c94bcb1a0fc2bb2c79b94052c26ca32d92fb47cfecd43a205d2e7`,
44 scénarios, 46 compagnies, 452 cartes, 464 bascules sur 48 couples, 302 politiques projetées
en 143 / 75 / 84.

---

## 1. La source de vérité décisionnelle est dans les fiches

Chacune des **102 fiches** porte un bloc `policies:` unique et non éditorial ; chacun des
**296 canaux visibles** porte un `placement` qui le relie à sa politique sans jamais la décider.

```yaml
policies:                      # les 302 décisions — LA source
  cabin:  { availability: not_offered }
  hold:   { availability: offered }
  cargo:  { availability: undocumented }
channels:                      # le contenu VISIBLE, qui ne décide plus rien
  - placement: cabin           # simple lien vers la politique
    icon: 🐾
    name: { en: Cabin, … }
    cls: no
```

L'écriture des fiches a été faite par insertion **textuelle** (`mesures/t0b2/outils/ecrire-policies-yaml.mjs`) :
le round-trip du paquet `yaml` ne restitue aucune des fiches à l'identique, et régénérer les
fichiers aurait noyé la migration dans un reformatage. L'outil prouve son innocuité **octet à
octet** avant d'écrire — il retire ses insertions, défait la réindentation, et exige l'égalité
stricte avec la source. 102/102 fiches, 0 anomalie.

## 2. `catOf` et la traduction `cls` → `allowed` ont quitté le chemin décisionnel

| Avant | Après |
|---|---|
| `catOf(name.en)` devinait le canal depuis son libellé anglais | la clé `cabin`/`hold`/`cargo` **est** le placement |
| `cls: warn` → `allowed:true` + `conditional:true`, puis `conditional` effacé par Zod | la fiche écrit `availability` ou `review_state`, et rien n'est effacé |
| 4 canaux non reconnus → politiques orphelines survivantes | les 296 canaux sont rattachés ; 0 orphelin |

`LegacyPlacementPolicyAuthored` est **supprimée**. Ce n'est pas cosmétique : tant que la branche
existait, un objet `{allowed: …}` restait acceptable par l'union d'auteur — un artefact régénéré
par un outil ancien aurait été validé sans bruit puis projeté en ignorant `conditional`. Le
booléen `allowed` du modèle **runtime** reste, comme prévu par le cadrage.

## 3. Migration : 218 + 83 + 1 = 302

| Lot | Couples | Cible |
|---|---|---|
| Mécanique | **218** | `offered` 143 · `not_offered` 75 |
| Non revus | **83** | `review_state: legacy_unreviewed` (73 manifeste + 10 anciens `POLICY_STALE`) |
| Thai cargo | **1** | `availability: undocumented` → `confirmation_required` / `policy_unpublished` |

`objects.json` régénéré par l'ingestion est **identique octet à octet** au candidat approuvé de la
mesure. Deux exécutions consécutives sont **idempotentes bit à bit**. `ingest:check` sort en 0 et
n'écrit rien (vérifié par comparaison du fichier avant/après).

## 4. Une perte de provenance détectée et empêchée

En redevenant dérivables, les 10 anciens `POLICY_STALE` allaient voir leur provenance
**écrasée** : `https://asianacargo.com/contents/lifeAnimalsAviGuide.do` remplacée par
`https://flyasiana.com`, confiance abaissée de 4 à 3. Le cadrage interdit la perte de provenance
au même titre que celle d'un poids ou d'une condition.

L'ingestion préserve donc une provenance stockée plus précise que la dérivée, et **nomme**
l'écart : `PROVENANCE_CURATED`, ensemble scellé par identité (10 clés), échec si l'ensemble
change dans un sens ou dans l'autre. Le mécanisme est inerte sur les 259 politiques réellement
dérivées — la provenance y suit bien la fiche. Rien n'est figé en silence.

`POLICY_STALE` a disparu, et sa **cause** avec : une politique non reproductible depuis sa fiche
est devenue inconstructible. Ce qui subsiste est d'une autre nature — 6 placements décidés
qu'aucun canal visible ne raconte au lecteur — scellé par identité sous
`POLITIQUES_SANS_CANAL_VISIBLE`. Dette éditoriale, plus décisionnelle.

## 5. Contre-épreuves du cadrage (`test-ingest-check.mjs` §3)

| Contre-épreuve | Résultat |
|---|---|
| (a) canal renommé + `cls` changé → **aucun** effet sur la décision | ✅ |
| (b) décision absente pour un placement revendiqué | ✅ refus |
| (c) décision hybride (`availability` + `review_state`) | ✅ refus |
| (d) valeur de disponibilité inventée | ✅ refus |
| (e) placement dupliqué dans une fiche | ✅ refus |
| (f) placement inconnu | ✅ refus |
| (g) `allowed`/`conditional` réintroduits dans l'artefact | ✅ refus |
| (h) fiche modifiée sans régénération | ✅ dérive nommée |

S'y ajoutent, dans les autres harnais : la forme héritée est **inconstructible** (union
d'auteur), l'artefact ne porte **zéro** `allowed`/`conditional`, et le vérificateur figé exige que
chaque ligne de manifeste ait été **consommée à sa valeur** (couple supplémentaire → échec).

## 6. Les preuves rendues permanentes

Le défaut de conception signalé en contre-revue est corrigé : une preuve qui compare l'état
**vivant** à une baseline figée devient rouge au premier lot métier, donc assouplie ou supprimée.
Les deux preuves comparent désormais **deux fichiers figés**, et restent intégralement exécutées à
chaque CI.

| Preuve | Bornes | Contrat |
|---|---|---|
| Historique **T0-A** | `t0a-finder-baseline-avant.json` → `t0b-finder-baseline-avant.json` | 24 cartes approuvées, valeurs exactes, bijection |
| **T0-B2** | `t0b-finder-baseline-avant.json` → `t0b2-finder-baseline-apres.json` | 452 cartes + 46 champs de tête, valeurs exactes, bijection, **chaque carte cite le couple migré qui l'explique** |

Ce que la preuve T0-A a perdu, et il faut le dire : le témoin legacy **vivant** (`verifyFlip`)
recalculait chaque bascule sur la base du jour. Sur données figées il interrogerait une base qui a
changé depuis. Sa démonstration a eu lieu ; son résultat **est** le fichier approuvé, dont la
bijection reste exigée dans les deux sens, et l'appartenance aux 11 compagnies du diff exhaustif
reste vérifiée. Le témoin vivant continue de servir, sur les données du jour, dans
`test-t0a-carries-diff.mjs`.

**Même traitement pour la sonde `carries_pets`** : elle recalculait 42 360 couples et les
comparait à la mesure T0-A ; T0-B2 élargit mécaniquement l'écart (178 → **2 017** bascules).
Le relevé T0-A reste figé comme document historique (et borne toujours les 11 compagnies) ;
la sonde vivante compare désormais à `t0b2-carries-pets-diff.json`, recalculé à chaque CI. La
barrière garde sa force, et l'invariant de sûreté — **toutes les bascules vont de false à true,
aucune compagnie ne perd son transport d'animaux** — est vérifié sur le recalcul.

## 7. Couverture directe des 302, hors des 72 scénarios

Les 72 scénarios n'exercent que **48 des 84** couples migrés (9 routes). La sonde promue dans
`test-t0a-baseline.mjs` prend les **302** politiques au niveau normalisation/projection :

```
302 politiques d'auteur, toutes projetées · 302 conformes à la table de projection
ZÉRO forme d'auteur héritée subsistante
runtime : 143 allowed · 75 denied · 84 à confirmer
causes  : 83 legacy_unreviewed · 1 policy_unpublished
```

## 8. Diff exhaustif réellement obtenu

`test-baselines/t0b2-approved-diff.json` — 44 scénarios touchés / 72.

| Nature | Occurrences |
|---|---|
| `statuts` / `decisions` / `booleens` / `confirm` | **452** chacune |
| `label` | 72 |
| `fee` | 56 (tarif emprunté qui disparaît quand le dernier canal `allowed` passe à confirmer) |
| `score` · `compatible` (tête) | 22 · 24 |
| `pets` · `deny` · `heat` | **0** |

**464 bascules sur 48 couples**, toutes `allowed → confirmation_required`, toutes rattachées à un
couple du registre approuvé. Zéro compagnie apparue ou disparue.

## 9. Résultats des tests

| Contrôle CI | Résultat |
|---|---|
| `npm run check` (schéma · règles · couverture) | ✅ |
| `npm run ingest:check` | ✅ code 0, **rien écrit** |
| `npm run typecheck` (knowledge · engine · workers) | ✅ |
| `npm run smoke` | ✅ |
| `npm run test:unit` — 12 suites | ✅ **0 FAIL**, code 0 |
| `npm run build:ci` (97 pages) | ✅ |
| `npm run test:built-ui` (fiche + Finder, 4 langues) | ✅ |
| `check-bundle.mjs` (Worker épinglé) | ✅ |
| `check-astro-debt.mjs` | ✅ dette stable à 175, aucune hausse |

Détail `test:unit` : 50 · 31 · 170 · 18 · 42 · 13 · 36 · 70 · 9 · 58 · 23 · 6 · 94 · 55 assertions,
plus « 74 lignes vérifiées, 0 écart(s) ».

## 10. Le dispositif de mesure, après le patch

`mesures/t0b2/outils/reproduire.sh` mesure l'état **pré-migration** : sur un dépôt migré il
refuse désormais explicitement (code 3) et indique le SHA où le rejouer (`bccd6b7`), au lieu
d'échouer obscurément outil par outil. Ses garanties ne sont pas perdues — elles sont passées
dans les harnais, qui tournent à chaque CI sur l'état courant.

## 11. Deux points de transparence

**Le libellé « 103 fiches » de la mesure était imprécis** : `content/airlines/` contient 103
fichiers `.yml`, dont `_template.yml` — squelette vide, `id: null`, **zéro canal**, exclu par
l'ingestion. Les fiches réelles sont **102**. Aucune mesure n'est affectée (296 canaux et 302
politiques inchangés) ; seul le libellé l'était.

**Deux tests portaient des attentes T0-A que ce lot change légitimement**, et ont été mis à jour
en les **renforçant**, jamais en les affaiblissant :
- `test-tristate-climat.mjs` — Abou Dabi : `etihad.cargo` est l'un des 73 couples du manifeste, le
  fret passe donc à « à confirmer ». Le contrôle vérifie désormais **en plus** que la cause est
  nommée avec son `policy_ref` exact, et qu'aucun drapeau chaleur ne s'allume ;
- `test-t0b-manifeste.mjs` — le vérificateur figé « ne voyait rien » d'un échange de décisions ;
  il le voit maintenant, par sa seconde cible (consommation du manifeste). La contre-épreuve
  démontre toujours que l'empreinte seule n'approuve pas une décision.

**Le vérificateur figé a changé d'empreinte** : `1d6f14c3…71871d` → `07d628e8ca2fda2676335f792e0801abdc26d12aed9254483f51d943c33f8b9f`.
Son cœur cryptographique est **inchangé** — et il le prouve : les 74 empreintes de blocs YAML se
revérifient à l'identique sur les fiches migrées, puisque `placement` n'entre pas dans les champs
d'empreinte. Seule sa cible de bijection a changé, de « les 74 `conditional:true` » (état
d'avant, disparu par construction) vers « chaque ligne consommée à sa valeur, aucun couple
supplémentaire ».

## 12. Empreintes

| Artefact | SHA-256 | État |
|---|---|---|
| `test-baselines/t0b-migration-matrice.json` | `de1b9783…c52893` | **inchangé** — le manifeste approuvé n'a pas bougé |
| `test-baselines/t0b-finder-baseline-avant.json` | `bc10c594…45b7bb` | **inchangé** — la borne AVANT reste scellée |
| `test-baselines/t0b2-finder-baseline-apres.json` | `5dad5396…a205d2e7` | nouveau — identique à la prévision approuvée |
| `test-baselines/t0b2-approved-diff.json` | `405bd05c…74282c` | nouveau — 452 cartes + 46 champs de tête |
| `test-baselines/t0b2-carries-pets-diff.json` | `917b8b51…8680fc` | nouveau — sonde vivante, 2 017 bascules |
| `test-baselines/t0a-carries-pets-diff.json` | `8651d280…4594dd` | **inchangé** — relevé historique T0-A |
| `test-t0b-matrice.mjs` | `07d628e8…f8b9f` | modifié (§11) — cœur cryptographique inchangé |
| `packages/knowledge/raw/objects.json` | `8d51bac4…90dfcd` | migré — identique octet à octet au candidat approuvé |

## 13. Ce qui reste, et dans quel ordre

Contre-revue Codex de ce patch → PR protégée → CI verte → preview immuable → contre-test
navigateur indépendant. **Aucun déploiement, aucun alias, aucune production** avant cette
validation complète et le feu vert de Philippe.

## 14. v2 — les cinq constats de contre-revue, fermés

### P0-1 · Une suppression dans le YAML laissait une politique fantôme

`continue` sur un placement que la fiche ne décide plus **préservait** la politique d'alors, et
`--check` sortait 0 puisqu'il comparait l'artefact à une régénération qui la préservait aussi.
Retirer un canal laissait donc un fantôme — la classe de défaut que T0-B2 devait fermer, et la
cause même des dix anciens `POLICY_STALE`.

**Correction** : la fiche est autoritaire **y compris par le retrait**. Une politique absente du
YAML est supprimée d'`objects.json`. Comme un retrait change un verdict, il est **relevé et
scellé par identité** (`POLICY_REMOVED`, ensemble attendu vide) : une suppression non prévue fait
échouer `--check`.

Contre-épreuve rejouée (§3-i des tests permanents), sur le scénario exact de la contre-revue :
- retrait de `policies.cargo` + du canal cargo → ingestion en 0, politique **supprimée**, les deux
  autres placements intacts ;
- même retrait **sans** régénération → `--check` en **1**, `POLICY_REMOVED airline_aegean.cargo`
  nommé.

**La dette des 6 politiques sans canal visible est désormais contrôlée dans les deux sens** : une
dette qui apparaît fait échouer l'ingestion, une dette résorbée doit être retirée de la liste
scellée dans la même PR (§3-j).

### P0-2 · La provenance dérivée ne pouvait plus être actualisée

La préservation s'appliquait à **toute** provenance divergente, pas aux seules dix clés
curatoriales. Corriger la `verified_date` d'une fiche ne se propageait donc plus, et `--check`
signalait ensuite de nouveaux `PROVENANCE_CURATED`. Le remède était devenu la maladie : une
provenance figée en silence, exactement ce que ce lot ferme.

**Correction** : l'exception est **nominative**. Partout ailleurs la provenance suit la fiche.

Contre-épreuve rejouée : Aegean `verified_date` 2026-08-08 → 2026-08-15 ; les trois politiques
reprennent la nouvelle date, `review_due` est recalculée (2026-11-13), `--check` sort en **0**.

### P0-3 · L'audit officiel Thai Cargo n'atteignait pas la donnée canonique

La fiche ne portait que `availability: undocumented` : la décision auditée était migrée, **pas sa
preuve**. La politique canonique recevait la page d'accueil, la date du 11/07 et une confiance 3,
alors que le manifeste approuvé porte l'URL exacte, le 13/08, la confiance 4, la citation verbatim
et l'emplacement dans la page.

**Correction** : le schéma d'auteur accueille une `source` **auditée** facultative, et la fiche
Thai porte désormais la provenance approuvée, recopiée verbatim du manifeste. Elle l'emporte sur
la provenance dérivée — seul cas où la fiche dit mieux que la dérivation, et elle le dit
explicitement.

**Incidence sur la baseline publique : aucune.** Mesurée séparément comme exigé — la baseline
reste `5dad5396…` au bit près. Le seul écart dans `objects.json` est cette provenance :

```
url         https://www.thaiairways.com  →  …/travel-with-pets/pets-as-checked-baggage-avih/
verified    2026-07-11                   →  2026-08-13     review_due 2026-10-09 → 2026-11-11
confidence  3                            →  4
reviewer    MyDogCanFly Data Team        →  Claude+Codex (lecture intégrale 13/08/2026)
+ quote, quote_language, locator
```

### P1 · Les 28 changements de classement n'étaient pas figés

Le générateur et le harnais appariaient les cartes par `Map` : ils contrôlaient leur contenu, pas
leur **ordre**. Or le classement est un contenu public — c'est ce que le visiteur lit.

**Correction** : les **28 permutations** sont figées comme séquences avant/après dans
`t0b2-approved-diff.json`, et le harnais exige la bijection exacte dans les deux sens. Un contrôle
supplémentaire vérifie que ces 28 entrées sont de **vraies** permutations — une séquence identique
des deux côtés passerait la bijection sans rien prouver.

### P2 · Le vérificateur YAML ne vérifiait pas l'état livré

`ecrire-policies-yaml.mjs --verifier` produisait 102 anomalies sur le commit livré : il attend la
syntaxe pré-migration. Il est **déclaré outil pré-migration à usage unique, ancré au SHA
`bccd6b7`**, et **refuse désormais explicitement** (code 3) sur un dépôt migré, en indiquant où le
rejouer et ce qui vérifie l'état courant en continu.

### Trou supplémentaire trouvé en écrivant la contre-épreuve (j)

`Channel` n'était pas `.strict()` : une clé surnuméraire sur un canal était **effacée en
silence** — la famille de défauts que ce dépôt documente depuis `brachy_allowed`, `season.month`,
`conditional` et `derived_from_fiche`. Sur un objet devenu décisionnel par son `placement`, ce
silence n'était plus acceptable. `Channel` est désormais strict.

### Empreintes après v2

| Artefact | SHA-256 | Écart vs v1 |
|---|---|---|
| `t0a-finder-baseline.json` · `t0b2-finder-baseline-apres.json` | `5dad5396…a205d2e7` | **inchangée** |
| `t0b-finder-baseline-avant.json` | `bc10c594…45b7bb` | **inchangée** |
| `t0b2-approved-diff.json` | `2e420408…0eff1b` | + section `classements` (28) |
| `packages/knowledge/raw/objects.json` | recalculée | provenance Thai Cargo uniquement |
