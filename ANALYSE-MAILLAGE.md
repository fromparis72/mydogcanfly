# Analyse du maillage interne — circulation, SEO et GEO

30 juillet 2026. Tout est mesuré sur le build courant (site EN, représentatif des trois
langues) et sur l'export Search Console à 28 jours. Méthode : les liens de navigation
(menu, footer) sont **exclus** — ils existent partout, donc ils ne disent rien de la
circulation réelle. Ne comptent ici que les liens contextuels, ceux qu'un visiteur
rencontre dans le contenu de la page où il se trouve.

Ce document est une base de discussion : rien de ce qui suit n'est implémenté, sauf
mention contraire.

---

## 1. La matrice — qui parle à qui

Liens contextuels moyens par page, de la famille ligne vers la famille colonne :

| de \ vers | pays | compagnie | race | aéroport | outil |
|---|---|---|---|---|---|
| **accueil** | · | 6,0 | · | · | 1,0 |
| **pays** (140) | · | 0,6 → **4,0** | · | 1,6 | 4,0 |
| **compagnie** (78) | 14,7 | · | · → **12,3** | 2,5 | 3,0 |
| **race** (172) | · → **4,6** | 10,0 | 3,0 | · | 1,0 |
| **aéroport** (250) | 1,0 | · → **7,1** | · | 3,3 | 2,0 |
| **outil** (6) | · | · | 2,0 | 1,5 | 2,3 |

Les quatre valeurs en gras sont les propositions A à D, implémentées le 30 juillet — détail
au §5. Le reste du tableau est l'état mesuré avant intervention. **Les quatre cases vides
du diagnostic sont fermées.**

Deux cases restent structurellement vides et le resteront : pays → race (une fiche pays
ne liste que les races *interdites* ; lister les races « adaptées » à un pays supposerait
une donnée que nous n'avons pas) et aéroport → race (aucun rapport éditorial).

Le maillage compagnie → race à 12,3 est une moyenne trompeuse : il vaut **31 liens sur les
93 fiches concernées et 0 sur les 141 autres**, car la restriction n'existe que là où la
compagnie la déclare.

Lecture rapide : ce qui marche, ce qui manque.

**Ce qui marche.** Compagnie → pays (14,7 liens/page, le bloc « où vole X avec les
chiens ») ; race → compagnie (10,0, le classement des compagnies par race) ; pays →
outils (4,0, le pied de page unifié posé hier). L'épine dorsale
race → compagnie → pays existe et elle est solide.

**Les quatre cases vides qui comptent :**

1. **pays → race : zéro.** Une fiche pays liste les races *interdites*, jamais les races
   *adaptées*. Le lecteur qui prépare le Japon ne découvre jamais que la fiche de son
   chien existe.
2. **race → pays : zéro.** C'est la plus étonnante : chaque fiche race affiche des badges
   climatiques « Recommandés / À éviter » avec des **drapeaux de pays**… qui ne sont pas
   des liens. L'information et la cible existent, seul le `<a>` manque.
3. **compagnie → race : zéro.** Une fiche compagnie décrit ses restrictions de races en
   texte (brachycéphales, races catégorisées) sans jamais lier les fiches concernées.
4. **aéroport → compagnie : zéro.** Une fiche aéroport ne dit pas quelles compagnies
   acceptant les chiens y opèrent — la donnée existe (`served_airport_ids`).

**Et une asymétrie** : compagnie → pays est massif (14,7) mais pays → compagnie est
famélique (0,6 — uniquement les compagnies nationales). Le lecteur en préparation de
destination, le plus fréquent d'après la Search Console, est le plus mal servi pour
passer à l'étape « quelle compagnie ».

---

## 2. Le parcours « arrivée Google » — là où le site se joue

D'après la Search Console : **50,7 % des impressions vont vers les fiches pays**, et
l'accueil ne pèse que 0,5 % des impressions (mais 18 % de CTR — les gens qui cherchent le
site le trouvent). Autrement dit : **le visiteur type n'entre pas par la porte, il entre
par une fenêtre.** Le site doit être conçu pour lui.

État des issues de secours sur les 12 vraies pages d'atterrissage du mois :

| Atterrissage | Impressions | Sorties contextuelles |
|---|---|---|
| /dog-heat-safety/american-akita/ | 373 | **0 — page 410** *(corrigé ce matin : 301 → fiche race)* |
| /countries/de/ | 215 | 14 (3 compagnies, 7 aéroports, 4 outils) |
| /countries/it/ | 197 | 13 |
| /countries/tr/ | 189 | 8 |
| /dog-heat-safety/basset-hound/ | 187 | **0 — page 410** *(corrigé)* |
| /countries/ua/ | 178 | 5 |
| /tools/pet-relief/ | 163 | 12 |
| /dog-heat-safety/great-dane/ | 158 | **0 — page 410** *(corrigé)* |
| /tools/iata-dog-crate-calculator/ | 148 | **0 — page 404** *(corrigé ce matin : 301 → outil caisse, via `_redirects`)* |
| /countries/cn/ | 150 | 12 |

Le constat brutal : **16,7 % des impressions du mois menaient à des pages mortes.**
Cinq des douze premières pages d'atterrissage étaient des 410 ou 404. C'est corrigé —
mais c'est la leçon n°1 de cette analyse : le maillage commence par ne pas perdre le
visiteur *avant* la première page.

Sur les pages vivantes, les fiches pays offrent 5 à 14 sorties contextuelles. C'est
correct en volume. Le problème est leur **nature** : aéroports et outils, presque jamais
la suite logique du parcours de préparation (compagnie qui dessert le pays, race).

## 3. Le parcours « arrivée par l'accueil »

Sans les menus, l'accueil ne propose contextuellement que 6 fiches compagnies et un
outil. Tout le reste passe par le Finder (JavaScript) ou par le mega-menu. Pour un humain
c'est acceptable — le Finder est le produit. Pour un moteur, l'accueil est un cul-de-sac
statique : le meilleur point d'entrée du site distribue très peu d'autorité.

Test d'accessibilité complet, menus exclus, depuis l'accueil : 140/140 pays, 78/78
compagnies, 172/172 races et 246/250 aéroports restent atteignables en 2 à 3 clics —
le cœur du site tient sans les menus, c'est une vraie qualité. Les exceptions, connues :
les guides d'achat, le Travel Hub, `/airports/` (l'index), 4 fiches aéroports français
(PGF, PTP, RUN, TLS — desservis par aucun pays documenté ?) et les pages légales.

## 4. Le facteur GEO — le gabarit mange le contenu

Mesure sur 30 fiches pays : **le gabarit (menu + header + footer) représente 67 % de
l'HTML.** La fiche Allemagne contient 442 liens, dont **406 dans le menu (92 %)** —
159 Ko d'HTML dont l'essentiel est la répétition des 406 mêmes liens sur 1 977 pages.

Conséquences concrètes :

- **Pour les moteurs génératifs** (ChatGPT, Perplexity…), qui lisent la page comme un
  texte : les deux tiers de chaque page sont du bruit identique. Le signal — le contenu
  unique — est noyé. C'est le facteur GEO le plus pénalisant du site, loin devant tout
  ce qui concerne le balisage (le JSON-LD est déjà bon : WebPage, FAQPage, Breadcrumb).
- **Pour Google** : 406 liens répétés diluent la valeur des liens contextuels. Un lien
  dans le corps de page vaut plus qu'un lien de menu, mais un ratio 36/406 affaiblit
  l'ensemble.
- **Pour le visiteur mobile** : le menu déroulant de 406 entrées est un choix d'interface
  qui se discute en soi.

*Non corrigé : la proposition E a été essayée puis abandonnée le 30/07 (voir §5). Le
gabarit reste à 67 % de l'HTML. Le constat est mesuré et tient toujours ; c'est le remède
qui a été refusé, au motif que le menu complet est ce qui permet d'atteindre n'importe
quelle fiche depuis n'importe quelle page.*

---

## 5. Propositions, par ordre de rendement

À discuter — aucune n'est engagée.

### A. Relier les badges climatiques des races aux fiches pays — ✅ **fait le 30/07**
Les drapeaux « Recommandés / À éviter » sont devenus des liens vers `/countries/xx/`.

**Mesuré sur le build :** 2 382 liens race → pays, sur **516 fiches races sur 516**
(les trois langues), **aucune cible cassée**. Moyenne 4,6 liens par fiche.

Deux choix méritent d'être connus :

- **L'URL reste propre.** Pas de `?breed=` dans le HTML : c'est `data-carry` qui ajoute
  le contexte à la volée pour le visiteur. Écrire le paramètre en dur aurait créé
  172 variantes paramétrées de chaque fiche pays aux yeux du crawler, pour rien.
- **La fiche race déclare enfin sa propre race comme contexte de session.** Elle ne le
  faisait pas : un visiteur arrivé de Google sur `/breeds/akita/` n'avait aucun « breed »
  en mémoire, si bien que les dix liens compagnies déjà marqués `data-carry` ne
  transportaient rien. Un défaut ancien, révélé par cette passe et corrigé avec elle.

### B. Bloc « compagnies qui desservent ce pays » sur les fiches pays — ✅ **fait le 30/07**
Six compagnies maximum, avec leur canal (cabine + plafond en kg / soute / cargo), le
nombre d'aéroports du pays desservis, et le drapeau pour la compagnie nationale.

**Mesuré sur le build :** 1 668 liens pays → compagnie, sur **282 fiches sur 420**,
**aucune cible cassée**. Moyenne 4,0 sur l'ensemble, 5,9 là où le bloc s'affiche.
**Le rapport pays → compagnie passe de 0,6 à 4,0 lien par fiche.**

Ce qu'il faut savoir avant de valider :

- **Le bloc remplace « Compagnies nationales »**, qui ne listait que les compagnies
  immatriculées dans le pays (51 fiches concernées, 0,6 lien de moyenne). Les nationales
  restent en tête de liste, signalées par leur drapeau : rien n'est perdu, l'information
  n'est plus écrite à deux endroits. Le bloc passe de **51 à 94 fiches**.
- **Deux pays y perdent leur compagnie nationale : la Hongrie (Wizz Air) et l'Islande
  (Icelandair).** Aucune des deux n'accepte le chien — les lister sous un titre qui
  promet le contraire aurait été faux. Les deux fiches affichent désormais six autres
  compagnies qui, elles, l'acceptent.
- **Deux sources concordantes** : les routes AeroDataBox (présence mesurée, aéroport par
  aéroport) et `serves_country_ids` (déclaratif). L'union des deux évite d'oublier une
  compagnie dont le pays n'a aucun aéroport dans la base.
- **Les 46 fiches sans bloc** sont celles dont aucun aéroport n'est documenté (45 pays),
  plus l'Ukraine — dont le seul aéroport, Kyiv, n'est desservi par personne. C'est
  exact, et c'est un manque de données, pas un manque de maillage.
- **La réserve est écrite dans le bloc** : le verdict est la politique générale de la
  compagnie, il ne préjuge ni de la race, ni de la caisse, ni de l'itinéraire. Et les
  compagnies qui refusent ou ne publient rien sont **comptées sans être nommées comme
  refusantes** — on ne leur fait pas dire ce qu'elles ne disent pas.

### C. Lier les restrictions de races des compagnies — ✅ **fait le 30/07**
Bloc « Races concernées par cette politique » sur la fiche compagnie : **2 883 liens sur
93 fiches** (31 compagnies × 3 langues), aucune cible cassée.

**Cette proposition a mis au jour un défaut grave, sans rapport avec le maillage.** Le
champ `brachy_allowed` était renseigné **25 fois** dans les données — 25 compagnies qui
refusent explicitement un carlin ou un bouledogue en soute — mais il **n'existait pas dans
le schéma Zod**. Zod, en mode « strip » par défaut, l'effaçait à chaque ingestion.
`breedTravel.ts` teste bien `h.brachy_allowed === false`, mais la valeur ne lui parvenait
jamais.

Conséquence mesurée, avant/après rétablissement du champ, sur les **31 races
brachycéphales × 3 langues = 93 fiches** :

| | soute déclarée acceptante | refusante | verdict affiché |
|---|---|---|---|
| **avant** | 57 compagnies | 18 | « Restrictions — à confirmer » (orange) |
| **après** | 32 compagnies | 43 (dont 25 refus brachycéphale) | « Souvent refusé » (rouge) |

Soit **25 verdicts faux par fiche, sur 93 fiches — 2 325 lignes « ✅ Accepté en soute »
qui annonçaient l'inverse de la politique publiée par la compagnie.** Le champ est
désormais au schéma, documenté, et la fiche du Bouledogue français affiche « Soute :
souvent refusé » avec les 10 compagnies concernées correctement étiquetées.

Deux partis pris dans le bloc lui-même :

- **La liste des 31 races n'est jamais tronquée.** Sur une restriction, une liste partielle
  laisse croire à celui qui n'y voit pas sa race qu'il n'est pas concerné.
- **Deux libellés distincts** : 25 compagnies portent un refus déclaré (« refuse les races
  brachycéphales en soute ») ; 6 autres — Air France, KLM, American, Air Canada, Iberia,
  Turkish — n'ont pas le drapeau mais évoquent les museaux courts dans leurs conditions.
  Celles-là reçoivent une formulation prudente : « évoquent … sans énoncer de refus
  général ». On ne transforme pas une mention en refus.

### D. Compagnies par aéroport — ✅ **fait le 30/07**
Bloc « Compagnies acceptant le chien à &lt;IATA&gt; » dans le cluster géographique de la
fiche aéroport : **5 352 liens sur 738 fiches sur 750**, aucune cible cassée, **7,1 liens
par fiche**. Les hubs sont marqués, le canal (cabine + plafond / soute / cargo) est affiché.

- **12 fiches sans bloc** = 3 aéroports (Kyiv, Istanbul-Sabiha, Bangkok-Don Mueang) où
  aucune compagnie documentée acceptant le chien n'opère, × 3 langues, plus les index.
- **Le nombre de routes n'est pas affiché**, seulement utilisé pour classer : l'échantillonnage
  des routes n'est pas symétrique d'un aéroport à l'autre, le chiffre donnerait une précision
  qu'il n'a pas.

### E. Dégonfler le mega-menu — ❌ **essayé puis abandonné le 30/07 (décision de Philippe)**

Les listes complètes ont été remplacées par les dix entrées les plus consultées + un lien
vers l'index, puis **le menu d'origine a été rétabli**. Motif : mettre en avant « les plus
consultées » est contre-productif, et le menu perd sa raison d'être — atteindre n'importe
quelle fiche depuis n'importe quelle page. Le code est revenu à `menuList` (listes
complètes, filtre de recherche par panneau).

Ce qui suit est donc la **mesure du gain auquel on renonce**, gardée parce qu'elle chiffre
le coût du menu actuel et pourra servir si le sujet se rouvre autrement (par exemple en
n'agissant que sur le mobile).

**Mesuré sur la fiche Allemagne, avec / sans les listes complètes :**

| | menu complet (retenu) | menu réduit (abandonné) |
|---|---|---|
| poids HTML | 166,9 Ko | 68,6 Ko (−59 %) |
| liens `<a>` | 446 | 89 |
| dont liens de menu | 390 (87 %) | 30 (34 %) |
| liens contextuels | 56, soit 12,6 % | 59, soit 66 % |

Le menu est identique sur toutes les pages : les 96 Ko par page représentent **environ
186 Mo sur l'ensemble du site — l'HTML total est de ~280 Mo au lieu de 94 Mo.**

Deux constats de la tentative qui restent vrais et méritent d'être connus :

- **Sous 820 px, le CSS masque les panneaux entièrement** (`.hdr__panel { display: none }`).
  Les 390 liens sont donc, sur mobile, du poids téléchargé et jamais affichable. C'est le
  seul angle où le sujet pourrait se rouvrir sans toucher au confort du desktop.
- **Un panneau « aéroports » était calculé à chaque rendu sans jamais être affiché** —
  `menuList(kb, "airport", …)` alimentait une clé que le gabarit n'utilise pas. Il n'a pas
  été reconstitué au retour en arrière : c'était du calcul pur, invisible.

### F. Accueil : un bloc éditorial statique — ✅ **fait le 30/07**
Un bloc « Par où commencent nos lecteurs » : quatre colonnes — 8 destinations, 6 compagnies,
6 races, 6 aéroports — en HTML statique, plus les quatre liens d'index. **L'accueil passe de
7 à 30 liens statiques**, et les aéroports y gagnent une exposition qu'ils n'avaient nulle
part (ils n'ont jamais eu de panneau dans le menu).

**Placé en fin de parcours, juste avant la FAQ** — et non sous le Finder comme dans la
première version. Sous le Finder, 26 liens vers des fiches détournaient le visiteur de
l'outil, qui est le produit ; le gain SEO de la position haute est marginal (ce qui compte
est que ces liens soient dans le corps de page, pas leur rang parmi dix sections), la perte
de conversion ne l'était pas.

### Le classement vient de la mesure, pas de l'intuition
F repose sur `packages/ui/src/data/popular.generated.json`, produit par
`packages/knowledge/scripts/build-popular.mjs` depuis l'export Search Console. Deux limites,
inscrites dans le fichier lui-même :

- **C'est une photographie** — propriété créée le 5 juillet 2026, fenêtre de 28 jours.
  À régénérer à chaque nouvel export ; le script prend le chemin du CSS en argument.
- **Le signal est très inégal** : 3 942 impressions pour les pays (88 des 140 en ont),
  977 pour les compagnies (31), **453 pour les races** et **169 pour les aéroports**. Sur
  les races, la première pèse 29 impressions : l'ordre des dix premières est du bruit, seul
  le fait qu'elles soient consultées est solide. Un complément par poids de la race est
  prévu dans le script si la mesure ne suffit plus à remplir le quota — il ne s'est pas
  déclenché ici, 100 races ayant au moins une impression.

### Bilan : A, B, C, D et F appliquées ; E abandonnée

Le maillage ne dépend plus des menus. Vérification faite sur le build, **header et footer
exclus**, parcours en largeur depuis l'accueil de chaque langue :

| | atteintes | profondeur |
|---|---|---|
| pays | **140/140** | 8 à 1 clic, 132 à 2 |
| compagnies | **78/78** | 12 à 1 clic, 66 à 2 |
| races | **172/172** | 6 à 1 clic, 166 à 2 |
| aéroports | **250/250** | 6 à 1 clic, 243 à 2, 1 à 3 |

Identique en anglais, en français et en espagnol. C'est **mieux qu'avant** l'intervention,
où 4 fiches aéroports et 13 pages restaient inatteignables sans les menus : le bloc de
l'accueil fournit les entrées à 1 clic, les pages d'index le reste. L'audit ne trouve
**aucune page orpheline** (0, contre 13 auparavant).

Ce résultat ne dépend pas de E : il est mesuré menus exclus, donc il tient avec le menu
complet rétabli.

### Déjà fait pendant l'analyse
- Les 7 URL `/dog-heat-safety/` (1 175 impressions) : 410 → 301 vers les fiches races.
- `/tools/iata-dog-crate-calculator/` (148 impressions) : 404 → 301 vers l'outil caisse,
  via `_redirects` (le chemin est exclu du Worker).

---

## 6. Ce que je ne propose pas, et pourquoi

- **Des liens « articles similaires » génériques** : le site est un référentiel, pas un
  blog. Chaque lien doit répondre à la question suivante du parcours, pas occuper de
  l'espace.
- **Ajouter les guides d'achat au maillage** : gelé par toi, motif commercial. La case
  reste vide en connaissance de cause.
- **Toucher aux paramètres contextuels** (`?to=`, `?breed=`, `?via=`) : ils font leur
  travail (120 URL à paramètres correctement canonicalisées côté Google), n'en
  rajoutons pas.
