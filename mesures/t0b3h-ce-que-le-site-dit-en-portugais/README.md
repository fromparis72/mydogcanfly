# T0-B3-h — Ce que le site dit en portugais (et en espagnol)

**Base de mesure figée : `2948ee9b12acf0af29267349449dc6147e2410e6`.**
Reproduction : `npm run mesure:t0b3h` — une seconde, sans build ni réseau.

**Ce dossier ne corrige rien.** Aucune phrase traduite, aucun fichier de `packages/` écrit. Les
62 fichiers `.astro` du périmètre et les cinq tables de traduction sont comparés au bit près à leur
version du commit de base ; l'arborescence elle-même est relue au commit, si bien qu'un fichier
ajouté depuis le sceau fait échouer la mesure au lieu de s'y glisser.

## Pourquoi ce dossier suit T0-B3-g

T0-B3-g a mesuré les huit outils : 355 sites d'appel, 33 servis en anglais aux lecteurs portugais.
Le site en compte **887**. « 33 dans les outils » appelait immédiatement « et ailleurs ? » — tant
qu'on ne répondait pas, l'arbitrage portait sur une image partielle.

## La méthode, qui n'interprète rien

Trois mécanismes, trois contrats **écrits dans le code** :

```
inlineT(en, fr, es?)   locale es → es ?? en          locale pt → table[en] || en
inlineF(en, fr, es, …) même chose, avec des trous {0} remplis ensuite
t(locale, clé)         TABLES[locale]?.[key] ?? TABLES.en[key]
```

Un appel à moins de trois arguments sert donc l'anglais en espagnol ; une clé anglaise absente de
la table portugaise sert l'anglais en portugais. Ce sont des faits de code, pas des jugements.

**Les alias sont découverts fichier par fichier**, jamais supposés : un fichier qui nommerait `Tr`
sa fonction de traduction échapperait à un lecteur câblé sur `T` et `L`. Trois alias existent au
sceau — `T` (31 fichiers), `L` (13), `F` (7, pour `inlineF`) — et un fichier qui appellerait
`inlineT` sans en déclarer l'alias fait **échouer** la mesure.

**Exhaustivité par résidu, appliquée au lecteur lui-même** : 887 occurrences repérées dans le texte,
887 classées. Un site que l'analyseur ne saurait pas lire fait échouer la mesure au lieu d'en
disparaître.

## Ce que je refuse de confondre

Une **clé construite dynamiquement** n'est pas une clé manquante. Neuf appels `t(locale, …)`
calculent leur clé (`EntityPage.astro` ×2, `Header.astro` ×3, `HomeSections.astro` ×3,
`Footer.astro` ×1). Ce dossier ne peut pas se prononcer sur elles : il les **nomme** au lieu de les
ranger avec les autres. Les compter comme « incomplètes » aurait produit une accusation fausse.

## Les constats

| | |
|---|---|
| sites d'appel analysés | **887** sur 887 repérés |
| servis dans les quatre langues | **838** |
| servant l'anglais en **espagnol** | **0** |
| servant l'anglais en **portugais** | **49** |
| clés `t(locale, …)` | 229 sites, 168 clés littérales, **0 incomplète**, 9 dynamiques |
| traductions identiques à l'anglais | 6 en espagnol, 7 en portugais — comptées à part, sans jugement |

**L'espagnol est complet.** Les 887 appels portent leurs trois arguments, et aucune clé littérale de
`t()` ne manque en espagnol. C'est un résultat, pas une absence de mesure.

### Les 49 chaînes servies en anglais aux lecteurs portugais

| famille | sur l'anglais | sites |
|---|---|---|
| `tools` | 32 | 343 |
| `accueil` | 10 | 43 |
| `page isolée` | 3 | 238 |
| `travel-hub` | 2 | 10 |
| `airports` | 1 | 57 |
| `partagé` | 1 | 26 |
| `airlines`, `breeds`, `countries` | 0 | 49 · 61 · 60 |

*Les composants n'ont pas de famille propre : ils héritent de celles des routes qui les atteignent,
transitivement. Un composant qui ne sert qu'une famille compte pour elle ; sinon il est « partagé ».
Rattacher d'autorité un composant à une famille fausserait le poids relatif des familles, qui est
précisément ce que ce dossier cherche à établir. Les 33 de T0-B3-g se retrouvent ici en 32 (`tools`)
+ 1 (`RelatedTools`, partagé entre plusieurs familles).*

**Trois groupes comptent plus que leur nombre :**

1. **L'accueil, 10 chaînes — et ce sont des avertissements de planification.** Le FlightFinder de la
   page d'accueil sert en anglais : « Country formalities — outbound AND return », « The return
   needs a long procedure (rabies titer) started BEFORE you leave », « Entry requires an import
   permit and quarantine — plan several months ahead. » Un lecteur portugais reçoit le résultat dans
   sa langue et l'avertissement qui le conditionne en anglais.
2. **Le gabarit des guides, 2 chaînes — sur 72 pages.** `[slug].astro` sert « updated » et
   « In short » en anglais : ces deux mots apparaissent sur **chacun** des 72 guides portugais.
3. **Les outils, 32 chaînes** — messages d'erreur, validations et **réserves** de l'outil chaleur.
   Détaillées dans T0-B3-g.

Le reste est de la page isolée (presskit, `tools.astro`) et un modèle de signalement d'aéroport.

## Les contre-épreuves

Quatre, chacune chirurgicale — elle déplace **un seul** site ou une seule clé, de façon à ne faire
tomber que l'exigence visée. Chacune doit sortir en 1 **avec son diagnostic propre**.

| code | ce qu'elle casse | ce qui doit tomber |
|---|---|---|
| `es` | un site bascule sur l'anglais en espagnol | « aucun site du site entier ne sert l'anglais en espagnol » |
| `pt` | une clé manquante est ajoutée à la table | « l'inventaire portugais est celui du sceau » |
| `clef` | une clé est retirée de la table espagnole | « aucune clé littérale de `t()` n'est incomplète » |
| `residu` | un site d'appel est retiré de l'analyse | « classée dans exactement un état » |

`residu` en fait tomber **deux**, et c'est honnête : perdre un site change nécessairement
l'inventaire.

## Ce qui attend un arbitrage

**Traduire les 49 chaînes est un travail de données** — une table, pas du code : ajouter les clés
manquantes à `translations/pt/inline.json`. Mais ce fichier est **scellé par T0-B3-g et par ce
dossier** : le traduire ferait tomber la reproduction des deux. C'est le comportement voulu — pour
mesurer autre chose, il faut déclarer une nouvelle base — et la décision de rebaser deux dossiers
n'est pas la mienne.

**À trancher :** traduire puis rebaser T0-B3-g et T0-B3-h, ou traduire d'abord les trois groupes
prioritaires (accueil, gabarit des guides, réserves de l'outil chaleur) et laisser le reste, ou
attendre. Et, indépendamment : les 9 clés dynamiques méritent-elles d'être rendues littérales pour
devenir mesurables ?
