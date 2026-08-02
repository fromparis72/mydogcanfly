# Portugais (Brésil) — langue en préparation

*État au 31 juillet 2026.*

## Ce que « en préparation » veut dire ici

Les pages `/pt/` existent, se visitent et sont entièrement navigables, mais elles sont
invisibles des moteurs de recherche :

| Mécanisme | Effet |
|---|---|
| `<meta name="robots" content="noindex">` | Google ne les indexe pas (662 pages) |
| Absence du `sitemap.xml` | 1 980 URL déclarées, aucune en `/pt/` |
| Absence des `hreflang` | on ne recommande pas une page qu'on interdit par ailleurs |
| Absence du sélecteur de langue | le « PT » n'apparaît que si on est déjà sur `/pt/` |
| Absence de la détection de langue | le Worker d'accueil ne connaît que `en`, `fr`, `es` |

Un visiteur brésilien qui arrive sur le site reçoit donc l'anglais, comme avant. On atteint
le portugais uniquement en tapant l'URL. C'est volontaire : tant que la traduction est
partielle, la mettre en avant serait une promesse non tenue.

Tout tient à une seule liste, dans `packages/ui/src/lib/routes.ts` :

```ts
export const PREVIEW_LOCALES: readonly string[] = ["pt"];
```

Vider cette liste publie le portugais partout à la fois. C'est le seul geste à faire — il ne
doit être fait qu'une fois la traduction jugée présentable.

## Ce qui est traduit

Deux tables, deux mécanismes :

| Table | Contenu | Volume |
|---|---|---|
| `translations/pt/strings.json` | chaînes d'interface appelées par `t(locale, clé)` | 277 clés |
| `translations/pt/inline.json` | phrases écrites dans les gabarits, indexées par leur version anglaise | 745 clés |

Concrètement : navigation, formulaire du Finder, verdicts, pied de page, fils d'Ariane,
bandeau cookies, **tous les titres de pages sauf ceux des fiches pays**, les cinq outils, les
pages légales, la page presse, la page « quem somos », le formulaire de signalement d'erreur.

Vocabulaire retenu, brésilien et non européen : *cachorro* (et non *cão*), *porão* (soute),
*caixa de transporte* (caisse), *área de alívio* (zone de détente), *área restrita*
(côté piste), *focinho achatado* (museau court).

### Le mécanisme de la seconde table

Les gabarits écrivent leurs phrases en dur, les trois langues côte à côte :

```astro
T("Why trust us", "Pourquoi nous faire confiance", "Por qué confiar")
```

C'est lisible, mais toute langue absente de la signature retombe sur l'anglais — et il y a
708 sites d'appel. Plutôt que de les réécrire un par un, la version anglaise sert de clé et
une table se superpose pour les langues suivantes (`packages/knowledge/src/inline.ts`). Une
chaîne absente de la table retombe sur l'anglais : la page reste juste, elle n'est simplement
pas encore traduite. `inlineF` gère les phrases qui incorporent une donnée, avec des trous
numérotés (`{0}`, `{1}`) plutôt qu'une interpolation en dur.

Deux scripts entretiennent l'ensemble :

```bash
node packages/knowledge/scripts/extract-inline-strings.mjs --json /tmp/skel.json
node packages/knowledge/scripts/wire-inline-t.mjs        # à ne relancer qu'après un ajout de gabarit
```

Le premier relève toutes les chaînes des gabarits et refuse de deviner : un appel qu'il ne
sait pas analyser est signalé, jamais ignoré en silence. Comparer sa sortie à `inline.json`
donne la liste exacte de ce qui reste à traduire.

## Les fiches pays : la troisième table

Le fond éditorial ne vit ni dans les gabarits ni dans un fichier de chaînes, mais dans les
données : `content/countries/<code>.yml`, où chaque valeur porte ses langues côte à côte
(`{ en, fr, es }`). Trois points ont dû être ouverts pour qu'une quatrième langue y entre :

1. **Le schéma Zod des scripts d'ingestion.** En mode « strip », Zod efface en silence toute
   clé non déclarée. Un `pt:` ajouté au YAML mais absent du schéma aurait disparu à
   l'ingestion sans qu'aucune erreur ne le signale — c'est exactement ce qui était arrivé à
   `brachy_allowed`. Le champ est donc déclaré explicitement.
2. **Les sept lecteurs `{en, fr, es}`** recopiés dans autant de gabarits, chacun avec son
   propre ternaire. Ils sont remplacés par un seul helper, `localized(locale, valeur)` :
   la langue devient une clé, plus une branche de code.
3. **Les fiches elles-mêmes**, dont quatre-vingts sur 140 sont désormais quadrilingues.

### Quatre-vingts fiches traduites, en huit lots

Choix guidé par les destinations réellement fréquentées depuis le Brésil, et par les hubs de
correspondance — qui comptent autant, puisque les règles d'escale s'appliquent au chien.

| Lot | Pays |
|---|---|
| 1 | **Brésil** (le trajet retour, que tout voyageur brésilien doit préparer), États-Unis, Argentine, Portugal, Chili, Uruguay, Espagne, France, Italie, Mexique |
| 2 | Colombie, Pérou, Paraguay, Panama, Canada · puis cinq pays de correspondance : Allemagne, Royaume-Uni, Pays-Bas, Turquie, Émirats arabes unis |
| 3 | Les régimes les plus stricts et les plus cherchés : Japon, Australie, Corée du Sud, Afrique du Sud, Chine · le hub de Doha : Qatar · Suisse, Irlande · et deux destinations caraïbes : République dominicaine, Costa Rica |
| 4 | **Les trois pays lusophones du site — Angola, Mozambique, Cap-Vert** · Nouvelle-Zélande, Singapour (régimes stricts) · Belgique, Grèce, Thaïlande, Israël, Maroc |
| 5 | Ukraine (forte audience) · Norvège et Finlande (les deux régimes européens qui exigent le traitement contre la tênia) · Autriche, Pologne, Croatie, Cuba, Inde, Hong Kong, Égypte |
| 6 | Équateur, Bolivie, Venezuela (le reste de l'Amérique du Sud hispanophone) · Malte, Suède, Danemark, Tchéquie, Hongrie (Europe) · Maurice et Sénégal (deux régimes africains, dont un très strict) |
| 7 | **L'Amérique centrale au complet** — Guatemala, Honduras, Nicaragua, Salvador · **les Caraïbes** — Jamaïque, Bahamas, Trinité-et-Tobago · Russie, Roumanie, Islande |
| 8 | **Les huit derniers États membres de l'UE** — Bulgarie, Chypre, Estonie, Lituanie, Luxembourg, Lettonie, Slovénie, Slovaquie · Liechtenstein · Serbie |

**Depuis le lot 8, les 27 États membres de l'Union européenne sont traduits**, et avec la
Norvège, l'Islande, le Liechtenstein et la Suisse, tout l'Espace économique européen l'est
aussi. C'est le bloc qui compte le plus pour un lecteur brésilien : la double nationalité
italienne, portugaise ou espagnole est courante, et l'Europe est la première destination
long-courrier depuis le Brésil.

Soit 10 194 valeurs et environ 1 048 000 caractères.

**Une nuance de registre pour les trois pays lusophones.** Angola, le Mozambique et le
Cap-Vert ne lisent pas une traduction : ils lisent leur langue. Ces trois fiches sont donc
écrites dans un portugais neutre et soutenu — tournures impersonnelles ou infinitives plutôt
que le tutoiement par « você », lexique commun aux deux normes, institutions dans leur forme
officielle locale. Le reste du site garde le portugais du Brésil, qui est son public premier.

Deux scripts encadrent l'opération :

```bash
node packages/knowledge/scripts/country-pt.mjs dump br > /tmp/br.json
node packages/knowledge/scripts/country-pt.mjs inject br content/countries/_pt/br.json
node packages/knowledge/scripts/check-country-pt.mjs br
```

L'injection travaille sur le **texte** du YAML, pas sur l'arbre analysé : un aller-retour par
la bibliothèque conserverait les commentaires mais mangerait les lignes vides, et ces fiches
sont écrites et relues à la main. Le contrôle vérifie trois choses, dans cet ordre : que
l'anglais, le français et l'espagnol n'ont pas bougé d'un caractère ; que chaque nœud porte
une traduction ; et que **tous les chiffres de la version anglaise se retrouvent dans la
version portugaise**. Ce dernier point n'est pas cosmétique : sur une fiche qui énonce
« 21 jours après la primovaccination » ou « ≥ 0,5 UI/ml », un délai perdu en traduction est
une information fausse, pas une maladresse. Le contrôle sait que 0.5 IU/ml et 0,5 UI/ml sont
la même quantité, et que « art. 5, 15 » fait deux nombres et non « 5,15 ».

Les traductions elles-mêmes sont conservées dans `content/countries/_pt/<code>.json` : elles
servent de trace et permettent de rejouer l'injection si la fiche anglaise est corrigée.

## Ce qui reste en anglais

- **60 fiches pays sur 140.**
- Le contenu éditorial des fiches compagnies (« Allowed. Dogs & cats only ≤ 8 kg… ») et les
  descriptions de races portées par les données.

Sur les 662 pages portugaises, **602 ont un titre en portugais** ; les 60 restantes sont les
fiches pays non traduites.

## Le vrai coût, si on veut aller au bout

Ajouter une langue n'est pas d'abord un travail de traduction, c'est un travail de câblage.
Ce câblage est fait. Ce qui reste est du volume, pas de la difficulté : 60 fiches pays à
environ 13 000 caractères chacune, soit à peu près 780 000 caractères, à traiter avec
la même chaîne outillée que les quatre-vingts premières — dix par lot, traduites en parallèle
par des agents à qui l'on passe le glossaire, le script de contrôle servant de condition de
sortie.

### Le défaut que la traduction en parallèle fabrique toute seule

Dix agents traduisent dix fiches en même temps, sans se voir. Chacun retraduit de son côté
le texte qui revient d'une fiche à l'autre : en-têtes de tableau, noms de sources, mentions
légales. Au bout de soixante fiches, **la mention légale du site existait en neuf
formulations**, alors que le français et l'espagnol n'en ont qu'une. Ce n'est pas une nuance
de style : c'est la même phrase, au même endroit de la page, qui change de mots selon le
pays consulté.

Mesuré sur les mêmes soixante fiches, en ne comptant que les phrases anglaises qui
reviennent au moins deux fois :

| Langue | Chaînes répétées traduites de plusieurs façons |
|---|---|
| français | 47 sur 360 |
| espagnol | 66 sur 360 |
| **portugais** | **103 sur 360** |

Le portugais dérivait deux fois plus que le français, pour une raison mécanique : il a été
écrit en lots parallèles, les deux autres non.

`harmonize-pt.mjs` fige une forme par phrase et réécrit le reste — 507 valeurs corrigées sur
les soixante fiches. Il distingue **deux registres**, parce que les fondre détruirait un
choix éditorial : le portugais du Brésil d'un côté, le portugais neutre des trois fiches
lusophones (Angola, Mozambique, Cap-Vert) de l'autre. Là où la majorité ne tranche pas, ou
tranche mal, un tableau d'arbitrages explicite décide — le corpus dit « dono » 137 fois
contre 26 « tutor », donc « dono ».

Les formes retenues sont exportées dans `content/countries/_pt/_glossaire.json`, que chaque
agent des lots suivants reçoit comme consigne impérative. Résultat au lot 7 : **5 valeurs à
harmoniser sur dix fiches neuves**, contre 507 sur les soixante précédentes. Au lot 8, **3**.

### Ne jamais abîmer une phrase pour faire taire un contrôle

Le contrôle exige que tout chiffre de l'anglais se retrouve dans la traduction. Sur la fiche
Jamaïque, l'anglais dit `8:30 a.m.–5:00 p.m.` ; le portugais dit naturellement « das 8h30 às
17h ». Le contrôle a réclamé un `5` et un `4` — et l'agent a fini par écrire *« das 8h30 às
5h00 da tarde »*, du mauvais portugais produit uniquement pour satisfaire un test.

C'est le contrôle qui avait tort. Les deux scripts normalisent maintenant les horaires sur
une horloge de 24 heures avant de compter, et la consigne donnée aux agents dit désormais
explicitement qu'une phrase lisible prime sur un chiffre littéral.

**Une limite du contrôle, découverte au lot 6.** La sauvegarde `/tmp/<code>.yml.avant` est
la référence de non-régression pour l'anglais, le français et l'espagnol. Quand ces trois
langues sont corrigées *après* la traduction — ce qui est arrivé aux 111 meta-descriptions
tronquées — la sauvegarde devient périmée et le contrôle signale un écart qui n'en est pas
un. Dix-neuf fiches se sont ainsi mises au rouge. La vérification a montré que **les 23
écarts étaient tous dans `seo.metaDesc`, et zéro ailleurs** : exactement les corrections
voulues. Les sauvegardes ont été régénérées depuis l'état vérifié ; les soixante fiches
repassent au vert. À retenir : une correction dans une langue déjà publiée doit s'accompagner
d'une régénération des sauvegardes, sinon le contrôle crie au loup.

C'est là qu'une traduction non relue serait dangereuse : ces pages énoncent des règles
douanières et sanitaires. Tant que ce chantier n'est pas fini, `/pt/` reste utile comme
démonstration mais ne doit pas être indexé.

## Effets de bord corrigés au passage

**Les préfixes d'URL.** Huit composants construisaient leur préfixe de langue en énumérant
les langues (`locale === "fr" ? "/fr" : locale === "es" ? "/es" : ""`). Toute langue non
listée retombait sur la racine : les pages portugaises renvoyaient vers les pages anglaises,
11 353 liens au total. Le préfixe est maintenant dérivé du code de langue. Les deux scripts
d'audit avaient le même angle mort et ont été corrigés de la même façon.

**Les identifiants YouTube.** Le film de lancement existe en trois langues et son identifiant
était choisi par un ternaire de langue. Passé par la table de traduction il serait devenu une
« chaîne à traduire », ce qu'il n'est pas : il vit maintenant dans une table dédiée, et toute
langue supplémentaire reçoit la version anglaise.

## Garanties de non-régression

Le refactoring touche 45 fichiers de gabarit et ne devait rien changer à l'anglais, au
français ni à l'espagnol. C'est vérifié, pas supposé : le texte visible et le `<title>` des
**1 992 pages** EN/FR/ES du build ont été comparés caractère à caractère avec le site en
ligne. **Zéro différence.** Les deux audits (`audit-site`, `audit-coherence`) rendent le même
verdict qu'avant le portugais.

Cette comparaison est rejouée à chaque lot. Au lot 8 (2 654 pages construites) :

```
Pages publiques comparées : 1992 · Différences : 0 · Apparues/disparues : 0
audit-site      → ✅ Aucune anomalie.
audit-coherence → 0 lien mort, 0 ancre absente, 0 page orpheline, 0 titre dupliqué
audit-country-langs pt → 0 signalement
```

## Les 173 pages de races (31/07)

`packages/ui/src/lib/breedTravel.ts` calcule tout ce qui s'affiche sur une fiche de race :
verdict cabine / porão / carga, risque chaleur, tolérance au froid, respiration,
adaptabilité, saison conseillée, classement des compagnies et les cinq questions de la FAQ.
Son interface ne connaissait que trois langues :

```ts
export interface Bi { en: string; fr: string; es: string }
```

Conséquence : **52 libellés restaient en anglais sur les 173 pages portugaises**, au milieu
d'un texte par ailleurs traduit. Rien ne le signalait — une clé absente n'est pas une erreur.
`pt` est donc devenue **obligatoire** dans l'interface : désormais, un oubli ne compile plus.

### Le piège de l'accord

Les libellés ne se traduisent pas depuis l'anglais seul. « High » est tantôt
`Élevé / Alto` (le *risque*, masculin), tantôt `Élevée / Alta` (l'*adaptabilité*, féminin) ;
« Moderate », « Low » et « Limited » ont le même double emploi. Le portugais accorde comme le
français et l'espagnol. La table de traduction est donc indexée sur le **triplet
(en, fr, es)**, jamais sur l'anglais : c'est le français et l'espagnol déjà écrits qui
révèlent le genre attendu. Traduire sur l'anglais aurait produit « adaptabilidade alto ».

### Glossaire respecté

`cabine`, `porão`, `carga`, `companhia aérea`, `cachorro`, `caixa de transporte`,
`focinho achatado` — les mêmes termes que dans les 80 fiches pays et les 750 chaînes
d'interface déjà traduites. Aucun synonyme nouveau n'a été introduit.

### Ce qui reste volontairement en anglais

Les **172 noms de races** n'ont pas de version portugaise dans `raw/objects.json`
(`name_i18n` ne porte que `fr` et `es`). `namePt` retombe donc sur l'anglais. C'est le bon
repli : « French Bulldog » est compréhensible, un nom de race inventé ne le serait pas.
C'est le prochain lot naturel — 113 des 172 noms diffèrent déjà de l'anglais en espagnol,
donc l'écart est réel.

`Travel DNA` reste en anglais dans **les quatre langues** : c'est un intitulé de marque, au
même titre que `Decision Engine™`, pas une chaîne d'interface.

### Vérification

```
344 pages EN/FR comparées avant/après  → 0 différence
172 pages portugaises analysées        → aucun des 52 libellés anglais résiduel
tsc --noEmit (packages/ui)             → 0 erreur
audit-site (2 654 pages)               → ✅ Aucune anomalie
```

## Les 172 noms de races (31/07)

`name_i18n` ne portait que `fr` et `es`. Les noms de races s'affichaient donc en anglais sur
les pages portugaises — titre, `<h1>`, fil d'Ariane, index, blocs « comparer avec ».

**104 noms sont traduits, 68 restent en anglais, et c'est délibéré.** La règle suivie est
l'usage brésilien réel, pas la traduction systématique : au Brésil on dit *Golden Retriever*,
*Border Collie*, *Shih Tzu*, *Rottweiler* — les traduire aurait produit des noms que personne
ne tape dans un moteur de recherche. À l'inverse *German Shepherd* est toujours
*Pastor Alemão*, et *Bulldog* s'écrit *Buldogue* (orthographe CBKC) : Buldogue Francês,
Buldogue Inglês, Buldogue Americano.

Quelques choix qui méritent d'être notés :

| Anglais | Portugais | Pourquoi |
|---|---|---|
| Mixed breed | Sem raça definida | Terme neutre ; « vira-lata » est familier |
| Great Dane | Dogue Alemão | Le nom brésilien ne mentionne pas le Danemark |
| Pomeranian | Lulu da Pomerânia | Nom d'usage, plus reconnu que « Spitz Alemão » |
| Newfoundland | Terra-nova | Traduit, avec le trait d'union brésilien |
| Podenco | Podenco *(inchangé)* | Le *Podengo* portugais est une AUTRE race — traduire aurait renommé le chien |

### Deux ternaires qui n'énuméraient que deux langues

Le nom de la race passait par `loc === "fr" ? … : loc === "es" ? … : anglais`, dans le
gabarit **et** dans la liste des races voisines. Ajouter la traduction ne suffisait donc pas :
le code ne serait jamais allé la chercher. Les deux endroits interrogent maintenant
`name_i18n[loc]`, où la langue est une clé et non une branche.

### Vérification

```
516 pages EN/FR/ES comparées avant/après → 0 différence
172 titres portugais                     → 172 portent le nom portugais, 0 dépasse 65 caractères
audit-site (2 654 pages)                 → ✅ Aucune anomalie
```

## Nuit du 31/07 au 01/08 — accueil, outils, presse, et les 60 dernières fiches pays

### Ce qui a été traduit

| Bloc | Volume |
|---|---|
| FAQ de l'accueil | 8 questions, ~770 mots |
| Quatre pages d'outils (caisse, chaleur, aires de détente, calendrier) | 20 questions + le bloc éditorial des aires de détente |
| Page presse | 46 chaînes `T()` sans entrée portugaise |
| **60 fiches pays** | **6 782 valeurs**, dont 1 663 reprises telles quelles d'une fiche déjà validée |

Les 140 fiches pays portent désormais toutes leur bloc `pt`, sans un seul trou.

### La mémoire de traduction

Les 140 fiches partagent énormément de formulations. Les retraduire à chaque lot fabrique de
l'incohérence — on l'a payé une fois, avec 507 corrections d'harmonisation sur les 60
premières. `packages/knowledge/scripts/country-pt-prefill.mjs` reconstruit à chaque appel une
mémoire (anglais → portugais) depuis les fiches déjà traduites, et pré-remplit le gabarit :
**25 % des valeurs sont revenues à l'identique**, et le traducteur n'a vu que le neuf. Quand
deux portugais existent pour un même anglais, la valeur est laissée vide plutôt qu'arbitrée au
hasard — un arbitrage silencieux est exactement ce qui crée les divergences.

### Le même défaut, trois fois

Trois endroits choisissaient la langue par un ternaire à deux branches
(`locale === "fr" ? … : locale === "es" ? … : anglais`) : la FAQ de l'accueil, les FAQ des
quatre outils, et le nom de race dans son gabarit. Écrire la traduction ne suffisait pas —
le code ne serait jamais allé la chercher. Les trois lisent maintenant une table indexée par
la langue. **La langue est une clé, pas une branche** ; c'est la règle qui a été appliquée
partout dans ce chantier.

### Budgets d'affichage

35 `metaTitle` et 34 `metaDesc` portugais dépassaient les budgets de 65 et 165 caractères.
Le portugais est structurellement plus long que l'anglais : « Traveling to Albania With Your
Dog » fait 34 caractères, « Viajar para a Albânia com seu cachorro » en fait 38. Deux gabarits
sont donc appliqués, comme l'espagnol le fait déjà : la forme longue quand elle tient, la forme
compacte (« Cachorro: exigências de entrada Costa do Marfim (2026) ») sinon. Au passage, les
titres en Title Case — calque de l'anglais — sont repassés en casse de phrase.

### Vérification

```
2 654 pages reconstruites (toutes familles, toutes langues)
1 992 pages EN/FR/ES comparées avant/après → 0 différence
6 782 valeurs pt contrôlées nombre à nombre  → 0 écart
audit-site        → ✅ Aucune anomalie
audit-coherence   → 0 lien mort, 0 ancre absente, 0 page orpheline, 0 titre dupliqué
audit-country-langs → 0 signalement portugais (les 24 restants sont fr/es, préexistants)
```

### Ce qui reste

**Les 78 fiches compagnies** — 3 976 valeurs, en/fr/es présents, `pt` absent. C'est le dernier
gros bloc : 54 % du texte des 79 pages portugaises de compagnies est encore anglais. Le
gabarit lit déjà par `localizer(locale)`, donc aucun travail de code — seulement une clé `pt`
à ouvrir dans le schéma Zod de `ingest-airlines.mjs`, où `es` est déjà facultatif.

## 01/08 — les compagnies, et le portugais est complet

### Les 78 fiches compagnies

3 976 valeurs traduites, en huit lots parallèles. Deux outils écrits pour l'occasion, jumeaux
de ceux des pays : `airline-pt.mjs` (dump / inject sans réécrire le YAML) et
`airline-pt-prefill.mjs`, dont la mémoire agrège **trois** sources déjà validées — les fiches
compagnies, les 140 fiches pays et la table d'interface.

Aucun travail de code : le gabarit lisait déjà par `localizer(locale)` et `pt` était déjà
déclaré dans le schéma Zod d'ingestion. C'était de la pure traduction.

### 204 valeurs harmonisées après coup

Huit lots en parallèle ont rencontré les mêmes chaînes sans savoir ce que les autres en
faisaient : « Quote » est devenu *Orçamento* 56 fois et *Cotação* 26 fois, « Free » *Gratuito*
52 fois et *Grátis* 17 fois, « Service dog » avait **trois** portugais. Trente-neuf chaînes
divergeaient. `harmonize-airlines-pt.mjs` tranche une fois, en clair, avec le motif écrit :

- **Quote → Cotação** : le mot du transport au Brésil ; *Orçamento* évoque le budget d'un chantier.
- **Free → Grátis** : ce qu'on lit sur une étiquette de prix ; *Gratuito* est l'adjectif.
- **Service dog → Cão de serviço** : terme réglementaire figé, l'une des rares exceptions à la
  règle « cachorro » du glossaire, au même titre que *cão-guia*.

Trois passages ont été nécessaires : corriger les 39 premières divergences en révélait
14 autres, puis 2. Vérification finale : **2 232 chaînes anglaises distinctes, 0 gardant
plusieurs portugais.**

### Deux défauts trouvés en chemin

**« Travel DNA »** était écrit en dur dans le gabarit des races, donc en anglais dans les
**quatre** langues. Il avait été rangé — par moi — avec « Decision Engine™ », au motif que
c'était un intitulé de marque. Vérification faite : pas de ™, aucune autre occurrence sur le
site ni dans le dossier de presse. C'était une chaîne oubliée, pas un choix. Traduite :
*ADN de voyage*, *ADN de viaje*, *DNA de viagem* (au Brésil on écrit DNA).

**Les aires de détente des aéroports** : sur 1 100 valeurs, il manquait 290 espagnol et
481 portugais — les emplacements (« Terminal B, Level 3 Departures, near Gate B40 ») et les
libellés de contact. L'espagnol est **public** : ce défaut était en ligne. Comblé dans les
deux langues.

### État final du portugais

```
famille        pages   segments   encore en anglais
countries        141     12 396      17   0,14 %   (noms de lois et titres de sources)
airlines          79      3 125       3   0,10 %
breeds           173      4 238       0
airports         251      2 125       0
accueil, outils, presse, pages légales                0
TOTAL            662     22 176      21   0,09 %
```

Les 21 segments restants sont des noms de textes réglementaires et des titres de sources
officielles — « Loi L/2018/026/AN — Code de l'élevage », « CDC — Bringing a Dog into the
U.S. ». Ils ne se traduisent pas : un journaliste ou un vétérinaire doit pouvoir les
retrouver sous leur nom.

### Le dossier de presse portugais

`press-kit-pt.html` (12 pages) et son PDF de 2,9 Mo, produits depuis la version anglaise avec
le français et l'espagnol comme modèles de longueur. Il est proposé sur la page presse au même
titre que les trois autres : le portugais est une langue en préparation, mais son dossier est
complet, et un journaliste brésilien n'a aucune raison de recevoir la version anglaise.

Le schéma de mesure de la caisse existe désormais en quatre langues (`iata-measure-pt.jpg`).

### Vérification

```
2 655 pages reconstruites, toutes familles, toutes langues
différences sur les langues publiques → 346 pages, toutes expliquées :
   · 172 fr + 172 es  : « Travel DNA » enfin traduit
   ·  31 es           : aires de détente qui repartaient en anglais
   ·   3              : la quatrième plaquette ajoutée à la page presse
audit-site (2 655 pages) → ✅ Aucune anomalie
npm run check            → toutes les vérifications passent
```

## 01/08 — le portugais devient public

`PREVIEW_LOCALES` est passée de `["pt"]` à `[]`. Toute la couche de routage suit d'elle-même :
indexation, sitemap, hreflang et sélecteur de langue se déduisent de cette liste. La constante
reste en place, vide, pour la prochaine langue.

### Ce que la bascule change

| | avant | après |
|---|---|---|
| pages portugaises indexables | 0 | 660 |
| URL dans le sitemap | 1 980 | 2 640 |
| hreflang | 3 langues + x-default | 4 langues + x-default |
| sélecteur d'en-tête | EN / FR / ES | EN / FR / ES / PT |

### Les mentions de langues

Deux familles à ne pas confondre :

- **Les langues du SITE** passent à quatre : page « à propos », bloc « en bref » de la page
  presse, phrase de méthode (« gratuit, sans compte, en quatre langues »), et le compteur
  « 3 Langues » de la page 07 des quatre dossiers de presse.
- **Les langues du FILM** restent trois. Le film de lancement n'existe qu'en anglais, français
  et espagnol ; un lecteur portugais voit la version anglaise. La phrase « en trois langues »
  qui le décrit est donc juste, et n'a pas été touchée. **Le jour où un film portugais existe,
  c'est cette phrase-là qu'il faudra corriger.**

### Les pastilles de langue de la page presse

Retirées. Elles doublonnaient avec le sélecteur de l'en-tête, qui porte désormais les quatre
langues. Le décalage horizontal de la photo d'interview, qui partait du bord du bouton
« Español », a été retiré avec elles.

### Ce que l'audit a vu une fois le portugais indexable

Le contrôle SEO ignorait les pages en noindex. En les rendant publiques, il a signalé
d'un coup **2 titres et 17 descriptions hors budget, et un titre dupliqué** — tous portugais,
et tous invisibles jusque-là.

La cause est structurelle : le portugais est plus long que l'anglais.
« Air Caraïbes pet policy: » fait 24 caractères, « Política de animais de estimação da
Air Caraïbes: » en fait 52. L'ouverture a donc été raccourcie sur **les 78 fiches**, pas
seulement sur les 16 qui débordaient — pour que la famille se lise de la même façon.

Le titre dupliqué opposait `/pt/cookies/` et `/es/cookies/` : « Política de cookies » s'écrit
pareil dans les deux langues. Le portugais précise maintenant « do MyDogCanFly ».

### Vérification

```
2 655 pages reconstruites
sitemap                     → 2 640 URL, 660 par langue
hreflang                    → en, fr, es, pt et x-default sur chaque page
pages pt en noindex         → 2, et ce sont les deux outils noindex dans TOUTES les langues
titres > 65 / desc > 165    → 0 / 0
titres dupliqués            → 0
audit-site (2 655 pages)    → ✅ Aucune anomalie
différences sur en/fr/es    → le seul ajout est « PT » dans le sélecteur de langue
```
