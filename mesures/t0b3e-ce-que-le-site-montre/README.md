# T0-B3-e — ce que le site montre, et dans quelle langue

**Ce dossier ne corrige rien et ne tranche rien.** Aucune règle retirée, aucun texte réécrit, aucun
fichier de `packages/` écrit — l'empreinte des fichiers bruts est relue à la fin.

```
npm run mesure:t0b3e
```

Base de mesure figée : **`34b04cd8fe9ec9c60d41a34e28f48908699127c5`** — SHA complet, jamais abrégé.
Le sceau porte l'empreinte du **moteur** et celle du **chemin de publication** (le composant de
repli, celui qui l'appelle, et les deux pages qui décident de le prendre ou non). La date de voyage
est dérivée du commit de base, jamais de l'horloge.

## D'où il vient

T0-B3-d a établi, en lisant les 2 957 pages construites, que les 95 phrases contradictoires sur le
poids ne sont publiées nulle part. Il l'a **constaté sans l'expliquer** — et un constat inexpliqué
est une hypothèse déguisée. Ce dossier répond à la question qui restait : **quelles phrases du
référentiel atteignent réellement un lecteur, par quel chemin, et dans quelle langue ?**

## La partition n'est pas déduite : elle est récoltée

Il serait facile d'écrire « seules les `import_rules` sont publiées » en lisant `explain.ts`. Ce
dossier ne le lit pas. Il fait tourner le moteur sur **la grille exhaustive des couples de pays que
le référentiel sait relier** — 108 origines × 108 destinations, **11 556 passes**, aucun échantillon,
aucun plafond — et récolte tout identifiant de règle qui atteint `report.conditions`.

**Et la déduction aurait menti, dans les deux sens :**

- `rule_jp_import` **atteint** le lecteur en étant classée `vaccination`. C'est une règle d'entrée
  du Japon ; son identifiant le dit, sa catégorie le contredit.
- **35 `import_rules` n'atteignent jamais personne** — 32 pays sans aéroport dans le référentiel,
  et des variantes dont les conditions d'origine ne sont satisfaites par aucun couple de la grille.

## Ce qu'un lecteur peut voir

| | mesuré |
|---|---|
| règles du référentiel | **407** |
| atteignant un lecteur | **148** |
| n'atteignant **jamais** un lecteur | **259** |
| dont poids, placement, race, embargo de chaleur | **224** |
| dont règles d'entrée non atteintes | **35**, motif lisible pour chacune |

**224 règles décident de ce que le site affirme sans jamais montrer sur quoi elles se fondent.** Les
54 seuils de cabine, les 42 de soute, les 105 de placement, les 17 interdictions de race, les 6
embargos de chaleur : tous sourcés, tous datés, tous notés en confiance — et jamais lus.

C'est le complément exact de T0-B3-d : les 95 phrases qui annoncent une limite « contenant compris »
sont fausses **et** invisibles. Le voyageur reçoit leur conséquence — un verdict — sans le texte qui
lui permettrait de la contester.

## La langue de ce qui est montré

Mesuré **dans le rapport**, pas dans la donnée : pour chaque règle atteinte, son couple témoin est
rejoué dans les quatre langues et le texte renvoyé est comparé à celui renvoyé en anglais.

| langue | servies | **servies en anglais** |
|---|---|---|
| anglais | 148 | — |
| français | 148 | **0** |
| espagnol | 148 | **118** |
| portugais | 148 | **148** |

**Un visiteur lusophone reçoit 100 % de l'anglais. Un hispanophone, 80 %.** Sur la seule prose que
le site leur montre — et qui porte sur les conditions légales d'entrée d'un animal dans un pays.

Le site publie en quatre langues ; sa seule prose factuelle en publie deux.

## Le repli : mort, mais armé

`EntityPage.astro` contient le seul bloc du site capable de publier la rationale d'une règle. Il
n'est importé que par `EntityDetail.astro`, lui-même appelé **en repli** : une compagnie sans fiche,
un pays sans guide.

| | mesuré |
|---|---|
| importeurs de `EntityPage` | **1** — `EntityDetail.astro`, et rien d'autre |
| compagnies sans fiche | **0 / 102** |
| pays sans guide | **0 / 140** |
| pages rendues par le repli | **0 / 2 957** |

Ce n'est donc pas du code mort : **c'est du code armé.** Rien ne le rend, aucun harnais ne
l'exerce, et **une seule entité ajoutée sans sa fiche le mettrait en production** — publiant d'un
coup des textes que personne n'a relus pour l'affichage, dans un composant que personne ne
maintient.

**Le marqueur a dû être une conjonction.** `ep__title` seul comptait une page : le prototype caché
`/lab/roundtrip/`, qui ne rend pas ce composant mais embarque une feuille de style où ce nom de
classe figure. Le dossier exige donc les deux marqueurs ensemble — et vérifie, en exigence
bloquante, que le marqueur **pris séparément donnerait bien ce faux positif**. Une précaution dont
on ne prouve pas l'utilité finit par sauter.

## Les sources

| | total | auto-citées |
|---|---|---|
| ce que le site **montre** | 148 | **13** |
| ce que le site **tait** | 259 | **117** |

La dette de sourcing n'est pas cantonnée à l'invisible, mais elle y est concentrée : 45 % des
règles jamais montrées se citent elles-mêmes, contre 9 % de celles qui sont montrées.

## Ce que cela ouvre — sans rien trancher

1. **La traduction des conditions d'entrée.** 148 textes, 0 en portugais, 30 en espagnol. C'est la
   seule dette de ce dossier qui touche directement ce qu'un visiteur lit, et elle ne demande aucune
   source nouvelle : les textes anglais existent et sont sourcés.
2. **Le repli armé.** Trois issues possibles — retirer le composant, le couvrir d'un harnais, ou
   rendre impossible l'entité sans fiche. Aucune n'est proposée ici.
3. **`rule_jp_import` mal classée.** Un identifiant qui dit `import`, une catégorie qui dit
   `vaccination`. Fait isolé : les 181 autres règles d'entrée sont classées `import_rules`.
4. **Les 224 justifications invisibles.** Les publier serait un choix de produit, pas une
   correction ; ne pas les publier en est un aussi, et il n'a jamais été écrit.

## Les contre-épreuves

| contre-épreuve | invariant cassé |
|---|---|
| `chemin` | les règles d'entrée sont retirées du moteur → « 148 règles atteignent un lecteur » tombe |
| `traduction` | un texte portugais est injecté partout → « le portugais est servi en anglais » tombe |
| `repli` | une compagnie perd sa fiche → « aucune compagnie ne prend le repli » tombe |

Chacune doit sortir en **code 1 avec son diagnostic propre** ; un échec pour une autre raison ne
prouverait rien.

## Ce que ce dossier NE fait pas

- il ne publie rien, ne traduit rien, ne retire aucun composant ;
- il ne juge pas la véracité des textes montrés : il mesure **lesquels** sont montrés, **à qui**, et
  **dans quelle langue** ;
- il ne mesure pas les notes de la fiche, qui sont une autre surface publiée avec son propre lexique
  (voir T0-B3-d, qui refuse de la chiffrer sans lexique fermé).

## L'artefact

`ce-que-le-site-montre.json` — la méthode et la grille, la partition règle par règle, les motifs des
non atteintes, la langue servie pour chacune, l'état du repli et la répartition des sources.
