# Le pipeline des compagnies aériennes — état réel au 12/08/2026

> Document de référence du lot M1. Il décrit ce que le code **fait**, pas ce qu'on voudrait
> qu'il fasse. Les limites y sont nommées avec leur chiffre : c'est ce qui rend M3 possible.
>
> Écrit après une erreur d'analyse à consigner : la mesure du 11/08 décrivait fiches et moteur
> comme **deux autorités indépendantes**. C'est faux. Ce sont deux sorties d'un même pipeline,
> relié mais fragile. Toute la suite en découle.

## 1. Le chemin, en entier

```
content/airlines/<slug>.yml          102 fiches, une par compagnie — LA SOURCE
        │
        │   npm run ingest   (= npx tsx …/ingest-airlines.mjs — tsx requis)
        │   ├─ valide chaque fiche contre un schéma Zod `.strict()`
        │   ├─ écrit  packages/ui/src/data/airlines.generated.json   (102 entrées)
        │   └─ dérive une politique structurée et l'injecte dans
        │          packages/knowledge/raw/objects.json → airlines[].premium.policy
        ▼
┌───────────────────────────────┐        ┌──────────────────────────────────────┐
│ airlines.generated.json       │        │ objects.json                          │
│  → fiches compagnies (UI)     │        │  → identité, routes, premium.policy   │
└───────────────────────────────┘        └──────────────────┬───────────────────┘
                                                            │
                                          packages/knowledge/src/normalize.ts
                                              Airline.parse(x)  ← Zod, mode STRIP
                                                            │
                                            ┌───────────────┴───────────────┐
                                            ▼                               ▼
                              packages/engine/evaluate.ts      packages/ui/lib/breedTravel.ts
                                + rules.json (449 règles)         + cluster.ts
                              Finder · /v1/finder · verdicts    pages de RACES (carlin…)
                                            │                               │
                                lit : policy[canal].allowed      lit AUSSI : brachy_allowed
                                      max_weight_kg                    ▲
                                                                       │
                                    ┌──────────────────────────────────┘
                                    └─ `brachy_allowed` n'est PAS lu par evaluate.ts.
                                       Le Finder applique, lui, des règles brachycéphales
                                       distinctes venues de rules.json.
```

**La fiche n'alimente donc pas seulement l'affichage : elle alimente aussi le moteur.** Une
correction de fiche change un verdict — à condition que l'ingestion soit relancée.

## 2. Les chiffres

| | |
|---|---|
| Fiches YAML | **102** |
| Entrées dans `airlines.generated.json` | **102** (0 orphelin dans un sens comme dans l'autre) |
| Compagnies dans `objects.json` | **102** |
| Règles dans `rules.json` | **449** — 255 de portée compagnie, 189 pays, 5 globales |
| Canaux **stockés** comme dérivés (`derived_from_fiche`) | **269** |
| Canaux **réellement reproductibles** par la dérivation d'aujourd'hui | **259** |
| Canaux dérivés **périmés** (`POLICY_STALE`, §4.8) | **10** |
| Canaux de politique **écrits à la main**, préservés | **33** (sur 11 compagnies) |
| Canaux portant `conditional: true` | **74** — et aucun n'atteint le moteur (§4.3) |

Les 11 compagnies à politique écrite à la main : `air_canada`, `air_france`, `american`,
`british_airways`, `delta`, `iberia`, `klm`, `lufthansa`, `turkish`, `united`, `westjet`.

## 3. Ce que l'ingestion sait dériver — et comment

`derivePolicy()` lit **trois** endroits de la fiche, et rien d'autre :

| Fait produit | Lu depuis | Règle appliquée |
|---|---|---|
| `allowed` | `channels[].cls` | `no` → `false` ; `ok` ou `warn` → `true` |
| `conditional` | `channels[].cls` | `warn` → `true` |
| `max_weight_kg` (cabine seule) | `fareList.rows[].label/value` | première expression `… N kg` trouvée |
| `brachy_allowed: false` | `restrictions[].pills[]` | pastille `no` dont le libellé mentionne soute ou fret |

Le **canal** est identifié par expression régulière sur le libellé **anglais** :

```js
/cargo|fret/ → cargo     /hold|soute|checked/ → hold     /cabin|cabine/ → cabin
```

Tout le reste de la fiche — le texte éditorial, les exclusions géographiques, les conditions —
n'est **pas** dérivé. Il s'affiche, il ne décide pas.

## 4. Les limites connues, avec leur chiffre

### 4.1 Le canal est deviné depuis de l'anglais

Quatre libellés réels du dépôt ne sont reconnus par aucun motif : `Freight`, `Qantas Freight`,
`Specialized-LIVE`, `MASkargo Animal Hotel`. Quatre compagnies ont donc, aujourd'hui, un canal
fret que le moteur ignore. Renommer un canal dans une fiche peut le faire disparaître du moteur
**sans aucune erreur**.

### 4.2 L'autorisation est déduite d'une classe visuelle

`cls` est un attribut de **présentation** (`ok` / `no` / `warn` / `neutral`). Changer la couleur
d'une pastille pour des raisons éditoriales change une décision moteur.

### 4.3 Deux champs écrits puis effacés en silence

L'ingestion écrit `conditional` et `derived_from_fiche` dans `objects.json` — **74** et **269**
occurrences stockées. Le schéma `PlacementPolicy` (`packages/knowledge/src/objects.ts`) ne les déclare
pas, et `normalize.ts` fait `Airline.parse(x)` : Zod, en mode `strip`, les supprime. Ils
n'atteignent jamais le moteur.

C'est la **deuxième** occurrence de ce défaut. La première, en juillet, portait sur
`brachy_allowed` : absent du schéma, effacé à l'ingestion, **25 compagnies** affichaient
« ✅ Accepté en soute » pour un carlin alors qu'elles le refusent explicitement. Le champ a été
ajouté au schéma le 30/07/2026 ; le récit est conservé dans le commentaire de `objects.ts`.

### 4.4 Une absence devient un refus

`ingest-airlines.mjs` écrit, en toutes lettres : *« A missing signal stays "unknown" (omitted),
never a fabricated refusal »*. Mais `evaluate.ts` répond :

```ts
if (!denied && policy?.[p]?.allowed !== true) { denied = true; … }
```

Un canal absent et un canal explicitement refusé sont donc traités **de la même façon**. Le
quatrième état `unknown` n'existe pas ; l'introduire est un sujet de M3, et il devra l'être
**avant** toute migration de données, sinon les canaux non documentés deviendront des refus
silencieux au moment même où on prétend les documenter.

### 4.5 Un mode supprimé emporte ses faits

`derivePolicy()` supprime tout mode dont `allowed` est resté inconnu. Les faits attachés à ce
mode disparaissent avec lui. Une fiche qui déclare le refus des brachycéphales en soute **sans
porter de canal « soute »** perd donc son refus. Un cas réel : `air_tahiti_nui`.

### 4.6 La préservation des politiques écrites à la main crée un angle mort

L'ingestion ne réécrit jamais un canal écrit à la main (`cur.source && !cur.derived_from_fiche`).
C'est voulu : ces politiques sont plus riches. Mais le jour où la fiche est corrigée, la
politique reste à sa valeur d'origine, **en silence**. C'est ce que `ingest --check` détecte
désormais (§5).

### 4.7 Le refus brachycéphale en fret n'est jamais dérivé

`derivePolicy()` écrit `p.hold.brachy_allowed = false` — **en dur sur la soute**, quel que soit le
canal nommé par la pastille. Une pastille « Hold/cargo forbidden » ne produit donc rien pour le
fret.

Mesuré : **11 fiches** déclarent un refus brachycéphale en fret, **0** politique porte
`cargo.brachy_allowed`, et **10** de ces onze ont `cargo.allowed = true`. Le fret est donc
annoncé ouvert à un carlin sur dix compagnies qui l'excluent par écrit — `air_canada` en est
l'exemple relevé par Codex.

**`ingest:check` ne voit pas ces onze cas, et c'est une limite du contrôle lui-même :** il
compare la dérivation à l'artefact, pas la fiche à la dérivation. Une perte qui survient
*à l'intérieur* de `derivePolicy()` lui est invisible. Étendre le contrôle à ce troisième axe
appartient au P0 « propagation des restrictions brachycéphales ».

### 4.8 Un canal dérivé qui n'est plus produit survit à sa fiche

L'ingestion repart de `objects.json`, **écrase** ce qu'elle sait encore dériver, mais ne **retire
ni ne signale** un canal marqué `derived_from_fiche` que la fiche ne produit plus. La politique
d'alors survit indéfiniment.

Mesuré : **269** canaux stockés comme dérivés, **259** reproductibles aujourd'hui, donc **10
périmés** :

```
airline_asiana.cargo        airline_korean_air.cargo         airline_qantas.cargo
airline_condor.cargo        airline_malaysia_airlines.cargo  airline_qantas.hold
airline_eva_air.cargo       airline_norwegian.cargo          airline_virgin_australia.hold
airline_french_bee.cargo
```

Huit portent sur le fret, deux sur la soute. Leur canal a disparu de la fiche, ou son libellé
n'est plus reconnu par `catOf()` (§4.1) — les
quatre libellés non reconnus s'y retrouvent : `Freight`, `Qantas Freight`, `Specialized-LIVE`,
`MASkargo Animal Hotel`.

Ce défaut touchait `--check` lui-même, qui comparait l'artefact à lui-même et sortait `0`. Il est
détecté depuis le 12/08/2026 (`POLICY_STALE`, §5). Les dix ne sont **pas supprimés** : retirer un
canal d'une politique change un verdict — c'est de la donnée métier, pas de l'outillage.

## 5. `npm run ingest:check` — le contrôle qui rend la promesse vraie

Jusqu'au 12/08/2026, l'ingestion n'était appelée **ni par le build, ni par `release`, ni par la
CI** — alors que `airlines.ts` affirmait qu'elle tournait « in the deploy chain ». Rien ne
garantissait donc que les artefacts versionnés correspondent encore aux fiches.

`npm run ingest:check` régénère les deux artefacts **en mémoire** et les compare à ceux du
dépôt. Il **n'écrit jamais** : le script n'a qu'un seul point d'écriture, et ce point bascule en
comparaison. Il tourne à chaque CI, juste après `npm run check`.

**Ce contrôle est lui-même testé.** `test-ingest-check.mjs` (dans `npm run test:unit`, **21
contrôles**) rejoue les cinq situations dans un bac à sable `.ingest-sandbox/` — jamais dans
l'arbre de travail — et vérifie en dernier lieu que le dépôt réel n'a pas bougé d'un octet :
dépôt intact, contenu d'un `POLICY_STALE` modifié, nouveau `POLICY_STALE`, identifiants
désalignés, argument invalide. Les trois angles morts trouvés successivement dans ce script —
`--chek` qui basculait en écriture, les canaux périmés invisibles, leur contenu modifiable sous
une clé figée — n'auraient survécu à aucun d'eux.

**Le mode d'exécution est verrouillé.** Deux formes seulement : aucun argument → écriture,
exactement `--check` → comparaison. Toute autre forme sort en **2** *avant toute lecture comme
toute écriture*. Sans ce verrou, `--chek` basculait en mode écriture et réécrivait les deux
artefacts en silence : une faute de frappe dans un job de CI aurait modifié le dépôt au lieu de
le vérifier.

**Six** verdicts distincts, volontairement séparés :

| | Signification | Bloquant |
|---|---|---|
| **artefacts désynchronisés** | une fiche a été modifiée sans relancer l'ingestion | **oui** — nomme les compagnies |
| **identifiants désalignés** | une fiche sans compagnie dans `objects.json`, ou l'inverse | **oui** — l'ingestion ne crée ni ne supprime de compagnie |
| **`POLICY_DRIFT`** | les deux côtés portent une valeur et elles s'opposent | **oui** |
| **`POLICY_GAP`** | la fiche affirme, la politique enrichie est muette | **ensemble figé** (10) |
| **`POLICY_STALE`** | canal marqué « dérivé » que la fiche ne produit plus (§4.8) | **ensemble + empreinte figés** (10) |
| **`POLICY_STALE_DRIFT`** | le *contenu* d'une politique périmée a changé sous une clé connue | **oui** |

Format d'un `POLICY_DRIFT`, tel qu'arbitré avec Codex le 12/08/2026 :

```
POLICY_DRIFT airline_air_france.cabin.allowed
    fiche=true
    curated=false
```

Champs comparés : `allowed`, `max_weight_kg`, `brachy_allowed`. `conditional` est
**délibérément exclu** — Zod l'efface (§4.3), le comparer ferait rougir la CI sur un champ sans
effet et masquerait les trois qui décident. Les champs propres à la politique enrichie que la
fiche ne modélise pas (dimensions, tarifs, conditions) sont ignorés : les signaler reviendrait
à reprocher à la fiche d'être moins riche, ce qui est précisément sa raison d'être.

### Les 10 `POLICY_GAP` connus

Relevés dès la première exécution du contrôle. **44 fiches** déclarent le refus des races à face
plate en soute ; **34** atteignent le moteur.

| Compagnie | Cause |
|---|---|
| `air_canada`, `air_france`, `american`, `delta`, `iberia`, `klm`, `lufthansa`, `turkish`, `westjet` | politique écrite à la main, préservée, jamais complétée (§4.6) |
| `air_tahiti_nui` | canal « soute » absent de la fiche, le fait est supprimé avec le mode (§4.5) |

Conséquence mesurée : la page de race du carlin annonce « **34 compagnies** interdisent
explicitement les chiens à face plate en soute » là où **44 fiches** le déclarent. L'effet des dix
pertes n'est pas uniforme — le tableau ci-dessous le détaille.

Impact mesuré **canal par canal**, parce que « dix restrictions perdues » ne veut pas dire
« dix faux positifs » :

| Effet | Compagnies |
|---|---|
| **Faux « soute disponible »** — `hold.allowed = true`, aucun garde-fou | **7** : `air_canada`, `air_france`, `iberia`, `klm`, `lufthansa`, `turkish`, `westjet` |
| Restriction perdue **sans conséquence d'affichage** — `hold.allowed = false` de toute façon | **2** : `american`, `delta` |
| État **« soute inconnue »**, pas « disponible » — aucun canal soute | **1** : `air_tahiti_nui` |

Traitement retenu, repris du mécanisme `xfail` / `XPASS` adopté pour M2 : **l'ensemble exact des
dix clés** est figé dans `KNOWN_POLICY_GAPS` — pas leur nombre. Un compteur ne suffirait pas : à
total constant, une compagnie corrigée et une autre cassée s'annuleraient, et la CI resterait
verte sur un défaut tout neuf. Le contrôle compare donc les ensembles, clé par clé.

Tant que l'ensemble est celui attendu, la CI reste verte — `main` ne peut pas naître rouge.
**Toute différence échoue** :

- une **clé en plus** : un fait déclaré cesse d'atteindre le moteur ;
- une **clé en moins** : un trou s'est refermé, ce qui est une bonne nouvelle, mais elle doit
  devenir une garantie dans la même PR au lieu de disparaître sans témoin. C'est le `XPASS` ;
- une clé **remplacée par une autre**, à total identique : les deux messages s'affichent.

### Les 10 `POLICY_STALE` connus

Même mécanique, même exigence : l'ensemble exact des dix clés est figé (§4.8). Une clé en plus
signifie qu'un canal vient de cesser d'être produit par sa fiche — le cas typique est un libellé
renommé que `catOf()` ne reconnaît plus. Une clé en moins signifie qu'un canal périmé a été
résolu : la clé doit sortir de la liste dans la même PR.

Contre-épreuve : renommer « Aegean Cargo » en un libellé non reconnu, relancer l'ingestion
normale, puis `ingest:check` → `+ airline_aegean.cargo`, sortie **1**. Avant le 12/08/2026, la
même séquence sortait **0**.

**La clé seule ne suffit pas.** `KNOWN_POLICY_STALE` associe à chaque clé l'**empreinte canonique**
du contenu complet de `premium.policy[canal]` — clés triées récursivement, puis SHA-256 tronqué,
pour rester insensible à l'ordre de sérialisation. Passer `airline_french_bee.cargo.allowed` de
`false` à `true` conserve les dix mêmes clés : sans empreinte, un verdict bascule sans alerte.
Avec, le contrôle produit :

```
POLICY_STALE_DRIFT airline_french_bee.cargo
    empreinte attendue = 3f98ea1a87e8511c
    empreinte trouvée  = c23ff5fd0808c5d5
```

Une politique périmée n'est plus reproductible depuis sa fiche : personne ne la régénère, donc
rien ne la corrigerait. La modifier reste possible — la table rend le geste explicite au lieu de
l'interdire.

### Deux dettes, deux lots — à ne pas confondre

Les vingt clés figées ne relèvent pas du même problème et ne partiront pas ensemble :

| Dette | Nature | Lot |
|---|---|---|
| **10 `POLICY_GAP`** | un fait de la fiche n'atteint pas la politique structurée — tous sur `hold.brachy_allowed` | P0 « propagation des restrictions brachycéphales » |
| **10 `POLICY_STALE`** | un canal a cessé d'exister dans la fiche, sa politique d'alors survit — 8 `cargo`, 2 `hold`, aucun lien avec les brachycéphales | lot « cohérence des politiques compagnies » |

Le correctif des `POLICY_GAP` est un **lot métier / de données distinct** : c'est de la donnée métier, pas de
l'outillage.

## 6. Ce qui reste à la main

`npm run ingest` n'est toujours pas automatique — ni au build, ni au déploiement. C'est un choix :
une régénération silencieuse pendant un build ferait entrer dans un artefact déployé des données
que personne n'a relues. Le contrôle remplace l'automatisme par une obligation visible.

Après toute édition d'une fiche :

```bash
npm run ingest        # régénère les deux artefacts
npm run ingest:check  # doit sortir 0
```

et les artefacts régénérés partent dans la **même** pull request que la fiche.
