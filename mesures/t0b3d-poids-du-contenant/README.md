# T0-B3-d — le poids du contenant : le périmètre réel

**Ce dossier ne corrige rien et ne tranche rien.** Aucune règle retirée, aucun seuil déplacé, aucun
fichier de `packages/` écrit — l'empreinte des fichiers bruts est relue à la fin. Les retraits sont
simulés en mémoire.

```
npm run mesure:t0b3d
```

Base de mesure figée : **`eb3562c27cafb5a41ee19d2519580753a9a040f8`** — SHA complet, jamais abrégé.
Le sceau porte l'empreinte du **moteur** et celle de la **page d'entité**, et la date de voyage est
**dérivée du commit de base, jamais de l'horloge** : T0-B3-c calculait « année courante + 1 », si
bien qu'au 1er janvier ses chiffres auraient changé sans qu'une donnée bouge.

## Pourquoi ce dossier existe

T0-B3-c a mesuré 34 seuils de soute auto-cités et conclu 34 sur 34 sur un écart réel : **la règle
annonce une limite qui couvre le chien ET son contenant, sa condition ne pèse que le chien.**

Le chiffre 34 était juste. Il décrivait le périmètre que T0-B3-c s'était donné — pas celui du
défaut. Ce périmètre avait été tracé par **une phrase**, `combined dog + crate`. Les règles de
cabine disent `including the carrier` : la même faute, un autre mot, invisible à la recherche.

**Un dossier qui cherche une phrase trouve une phrase.**

## Ce dossier ne cherche plus une phrase

Il part de **tous les seuils de poids publiés** — toute règle portant un `params.max_weight_kg`,
quelle que soit sa catégorie, quelle que soit sa source — et exige que **chacun** soit classé :
soit il annonce une limite incluant le contenant, soit il figure **nommément** au résidu versionné.
Aucun troisième état n'est toléré.

Une formulation nouvelle ou modifiée tombe donc dans le résidu, hors de la liste, et **fait échouer
la mesure** au lieu de disparaître en silence. Ce n'est pas une promesse : c'est ce mécanisme, et
non ma vigilance, qui a rattrapé `rule_km_malta_hold_weight` (« the dog plus crate ») que mon
propre lexique manquait encore une heure plus tôt.

## Le périmètre réel

| | mesuré |
|---|---|
| seuils de poids publiés | **96** |
| annonçant une limite **contenant compris** | **95** |
| résidu | **1** — `rule_global_cabin_weight_cap`, nommé et motivé |
| catégories | **53 en cabine · 42 en soute** |
| citation | **74 auto-citées · 21 citant un tiers** |
| compagnies concernées | **63** |
| ce que la phrase de T0-B3-c attrapait | **41 sur 95** |
| ce que le périmètre de T0-B3-c couvrait | **34 sur 95** |

**34 sur 95.** T0-B3-c décrivait un tiers de son sujet, et le tiers le moins exposé. Et **21 des 95
citent un tiers** : aucun lot « retirer les règles auto-citées » ne les atteindrait.

Les 95 conditions testent `dog.weight_kg`, en `gt`, sur la valeur même du seuil annoncé — vérifié
une par une. Aucun poids de contenant, aucun poids total nulle part dans le référentiel.

## L'écart est plus grave en cabine

| | n | min | médiane | max |
|---|---|---|---|---|
| cabine | 53 | 6 kg | **8 kg** | 10 kg |
| soute | 42 | 14 kg | **45 kg** | 100 kg |

La fenêtre permissive vaut exactement le poids du contenant. Sur un seuil de soute à 45 kg, une
caisse de 8 kg en ouvre 18 % ; sur un seuil de cabine à 8 kg, un sac de 2 kg en ouvre **25 %** — et
c'est le canal que le voyageur regarde en premier. *Ces pourcentages illustrent : le référentiel ne
détient aucun poids de contenant, et ce dossier n'en invente pas.*

## Les langues

| | traduites | repli sur l'anglais |
|---|---|---|
| français | **96 / 96** | 0 |
| espagnol | **1 / 96** | 95 |
| portugais | **1 / 96** | 95 |

Là où le français existe, il annonce le contenant comme l'anglais — **aucune divergence**. Mais
l'espagnol et le portugais ne traduisent qu'un seuil sur 96. C'est une dette distincte de celle-ci,
mesurée ici parce qu'elle porte sur les mêmes phrases.

## La fiche ne corrige rien : elle republie

| | mesuré |
|---|---|
| fiches muettes sur le seuil | **75** |
| fiches republiant **le même nombre** que la règle | **20** |
| fiches divergentes | **0** |

Là où la fiche parle, c'est le nombre de la règle **au kilo près**. Aucun garde-fou : elle
republie l'annonce, contenant compris.

## L'effet, lu dans le moteur

Un témoin par règle. **Le témoin se cherche, il ne se devine pas** : ma première version prenait le
premier trajet direct par ordre alphabétique, et `rule_egyptair_hold_weight` ne mordait pas — non
parce qu'elle est morte, mais parce qu'elle porte une troisième condition (destination Tunisie ou
Tanzanie). On essaie donc les trajets l'un après l'autre et on s'arrête au premier où **le moteur
dit** que la règle a tiré.

| mesure | valeur |
|---|---|
| mordent sur leur témoin | **95 / 95** |
| sous le seuil, la règle ne tire plus | **95 / 95** |
| dominantes (leur retrait déplace le statut) | **84** — 42 en cabine, 42 en soute |
| masquées par un autre refus **nommé** | **11** |

Une règle masquée n'est pas inoffensive : elle est fausse au même titre que les autres, mais son
retrait ne déplacerait rien tant que le refus qui la couvre tient. Chacune des 11 porte le nom de
la règle qui la couvre, lu dans `fired` — « non dominante » n'est pas un fourre-tout où l'on range
ce qu'on n'explique pas.

**Statut après retrait** : cabine `denied → allowed` 42 · cabine `denied → denied` 11 · soute
`denied → allowed` 41 · soute `denied → confirmation_required` 1.

**Volet public** — 72 scénarios (9 routes × 4 poids × 2 canaux) : **155 placements déplacés, 111 en
cabine et 44 en soute, tous de `denied` vers `allowed`.**

## Ce que le voyageur lit — et ce qu'il ne lit pas

J'ai d'abord cru que la phrase contradictoire était sous ses yeux : `EntityPage.astro` contient un
bloc qui affiche `rule.rationale`, et `pagedata.ts` y injecte la traduction. **Les 2 957 pages
construites disent le contraire.**

| | mesuré sur le site construit |
|---|---|
| pages lues | **2 957** |
| pages portant la classe `ep__rationale` | **0** |
| pages publiant l'une des 95 rationales, toutes langues | **0** |

Le bloc existe et ne sort jamais. **Lire le code ne remplace pas lire le site.** Ce qui atteint le
voyageur, ce n'est donc pas la phrase — c'est sa **conséquence** : un verdict calculé sur le chien
seul, sans le texte qui permettrait de le contester.

**Ce que ce dossier refuse de chiffrer.** La fiche, elle, publie ses propres notes, et certaines
annoncent bien une limite « contenant compris » dans la langue du visiteur — « up to 75 kg
including the carrier » chez Qatar Airways, « Jusqu'à 45 kg caisse comprise » chez Asiana, lues
dans les octets. J'ai voulu en donner le compte : **44 avec un lexique large, 2 avec celui de ce
dossier.** Les deux sont faux. Le lexique d'ici est fermé par résidu *contre le corpus des règles*
et ne prouve rien contre celui des fiches. Publier l'un des deux referait, à la lettre, la faute
que ce dossier corrige. **Aucun compte de fiches n'est publié.** Le fermer est un dossier à part.

## Ce que cela change pour l'arbitrage

T0-B3-c posait trois options pour 34 règles de soute. Elles valent toujours, mais **pour 95 règles
sur deux canaux**, et deux faits nouveaux les déplacent :

1. **La cabine est concernée, et davantage.** 53 des 95, seuil médian 8 kg. Retirer ces règles
   publierait `allowed` là où 42 refus tombent — sur le canal le plus consulté, sans qu'aucune
   fiche ne prenne le relais dans 75 cas sur 95.
2. **21 règles citent un tiers.** Un lot « auto-citées » ne les toucherait pas : le défaut
   survivrait à sa propre correction, ce qui est le pire des états — corrigé en apparence.

Et une option nouvelle apparaît, que T0-B3-c ne pouvait pas voir : **corriger l'annonce plutôt que
la condition.** Puisque la rationale n'est publiée nulle part, réécrire les 95 textes pour qu'ils
décrivent ce que la condition mesure ne changerait **aucun octet publié** — et rendrait le
référentiel honnête vis-à-vis de lui-même. Cela ne corrige pas l'écart avec la compagnie ; cela
cesse de le cacher. Aucune des options n'est proposée ici : elles appellent un arbitrage, et
l'arbitrage appelle des sources — **ce dossier n'ouvre aucune page web.**

## Les contre-épreuves

Une mesure incapable d'échouer ne mesure rien. Quatre invariants distincts, chacune devant sortir
en **code 1 avec son diagnostic propre** :

| contre-épreuve | invariant cassé |
|---|---|
| `lexique` | une entrée morte est ajoutée au lexique → « aucune formulation morte » tombe |
| `formulation` | les textes n'annoncent plus le contenant → l'exhaustivité tombe |
| `temoin` | le témoin passe **sous** le seuil → « les 95 mordent » tombe |
| `langue` | un texte français cesse d'annoncer le contenant → « aucune divergence » tombe |

La première est celle qui garde le défaut de T0-B3-c fermé : elle vérifie qu'un lexique qui cesse
d'attraper quelque chose **fait rougir la mesure**, au lieu de rétrécir le périmètre en silence.

**Pourquoi ces quatre-là ne sont pas dans `npm run contre-epreuves`.** Le runner de mutations
tourne en intégration continue, en dernier, avec `--dom` : il reconstruit `packages/ui/dist` en
version **réduite**. Or cette mesure exige un site **complet** pour prouver la publication. L'y
inscrire la ferait échouer en CI pour une raison qui n'a rien à voir avec l'invariant testé — le
faux rouge est aussi trompeur que le faux vert. Ses contre-épreuves sont donc portées par son
propre reproducteur, qui est son point d'entrée scellé.

## Ce que ce dossier NE fait pas

- il ne retire rien, ne corrige aucun seuil, ne touche à aucun fichier de `packages/` ;
- il ne juge pas la véracité des seuils : il mesure ce que le site **annonce**, ce que sa condition
  **teste**, et ce que le site **publie** ;
- il ne chiffre pas les notes de fiche (voir plus haut : le lexique n'y est pas fermé) ;
- il ne traite ni les 12 `placement`, ni les 44 `import_rules` — le reste de la dette nommée par
  T0-B3.

## L'artefact

`poids-du-contenant.json` — le périmètre et sa méthode (lexique, résidu versionné), la
sous-estimation de T0-B3-c chiffrée, l'ampleur relative, les langues, la fiche, l'effet mesuré
règle par règle, la publication et le volet public.
