# Compte rendu d'activité — période sans contre-revue

**Destinataire : Claude Codex.** Ce document couvre ce qui a été fait pendant que la contre-revue
était indisponible. Il est écrit pour être **contredit** : chaque affirmation est chiffrée et
accompagnée de la commande qui la vérifie. Là où je n'ai pas vérifié, je le dis.

## Périmètre exact

Dernier commit que tu as contre-examiné : **`8636d99`** (T0-B3-b, les preuves du lot référentiel).
Tout ce qui suit est en attente.

```
git log --oneline 8636d99..HEAD          # 19 commits
git diff --shortstat 8636d99..HEAD       # 206 fichiers, +23 790 / −36
```

Branche : `claude/t0b3a-arbitrage-brachy`, **39 commits en avance sur `origin/main`**.
Rien n'est fusionné, **aucune PR n'a été ouverte, aucun déploiement ni preview n'a eu lieu.**

---

## 1. Ce qui a été MESURÉ — quatre dossiers scellés

Aucun ne corrige quoi que ce soit. Chacun fige une base SHA en dur, relit l'empreinte du
référentiel avant et après, et porte des contre-épreuves qui doivent sortir en 1 avec **leur**
diagnostic.

| dossier | question | constat principal |
|---|---|---|
| **T0-B3-c** `118fd15` | les seuils de soute auto-cités | 34 règles mesurées |
| **T0-B3-d** `34b04cd` | le poids du contenant | **le défaut est de 95 règles sur deux canaux, pas 34** — et **21 citent un tiers**, donc un lot « retirer les auto-citées » laisserait le défaut debout |
| **T0-B3-e** `3927b43` | ce que le site montre, et en quelle langue | **148 règles sur 407 seulement atteignent un lecteur** ; `EntityPage` est du code mort mais armé |
| **T0-B3-f** `5fe5534` | ce que les règles affirment vs leur propre phrase | **14 délais divergent, dont 3 dans le sens dangereux** |

### T0-B3-d — ce qu'il a renversé
T0-B3-c cadrait le problème sur 34 règles. La mesure exhaustive l'a démenti : **95 règles** portent
l'ambiguïté contenant/animal, sur **deux canaux**. Et 21 d'entre elles citent une source tierce
réelle : le lot correctif envisagé (« retirer les auto-citées ») n'aurait donc pas refermé le
défaut. Trois erreurs de ma part y ont été corrigées en cours de route, consignées dans le README :
deux entrées de lexique inventées qui n'attrapaient rien, une règle que je croyais morte et qui
portait en fait une troisième condition, et une hypothèse de publication que le rendu a démentie.

### T0-B3-e — ce qu'il a établi
Grille **exhaustive de 108 × 108 couples de pays**, sans échantillon. Résultat : **148 des 407
règles** atteignent `report.conditions` ; les 259 autres ne montrent jamais leur texte. Le portugais
reçoit **100 % d'anglais**, l'espagnol **80 %**.

### T0-B3-f — le dernier, et le plus méthodologique
Il confronte le `params` que le moteur applique à la `rationale` que le lecteur lit.
**Trois versions du contrôle ont été rejetées** parce que chacune aurait produit une accusation
fausse — le README les consigne toutes les trois :

1. « le nombre doit figurer dans la phrase » → aurait dénoncé **65** règles. Faux : `lead_time_days:
   60` face à « 1 to 2 months » est un changement d'unité, pas un mensonge.
2. « comparons après conversion des unités » → aurait dénoncé **54** règles. Faux aussi : ces phrases
   portent plusieurs durées qui ne parlent **pas du même objet** (âge de vaccination, attente après
   titrage, validité d'un certificat). Erreur de catégorie.
3. Retenue : ne comparer que l'**ouverture** de la phrase, seule forme qui énonce le même objet.

Les 130 phrases muettes ne sont **pas** comptées comme conformes.

**Ce qui tient :** 407/407 règles portent une source dont l'URL se résout ; 0 revue échue ; 0 sans
échéance ; **131/131 seuils directs** (poids, température, validité, âge) sont écrits dans la
phrase, en anglais **et** en français.

**Ce qui ne tient pas :** trois règles où le moteur planifie **moins** que sa propre phrase —
`rule_au_import` et `rule_nz_import` (150 j appliqués contre « 6 to 7 months » annoncés) et
`rule_vn_import` (21 j contre « About 1 month »). Ce sont précisément les destinations où un mois de
retard coûte le voyage. Onze autres divergences vont dans le sens strict.

**Et un constat qui déborde :** la phrase publiée existe en français pour les 407 règles, **en
espagnol pour 48, en portugais pour 8**. C'est la cause, à la source, de ce que T0-B3-e observait à
l'écran. Traduire les guides ne corrige **rien** de ce défaut : ce sont deux corpus distincts.

---

## 2. Ce qui a été PRODUIT — le Travel Hub en quatre langues

| | avant | après |
|---|---|---|
| guides anglais | 62 | **72** |
| guides français | 62 | **72** |
| guides espagnols | **0** | **72** |
| guides portugais | **0** | **72** |

- **124 traductions** des 62 guides existants, en sept lots (`67e66a8` → `6a2b46f`).
- **10 articles anglais neufs** sur le voyage en avion (`5a7d1d2`), écrits pour le maillage interne.
- **30 traductions** de ces dix (`adfd06d`).

**La méthode a changé au lot 5, et c'est mesurable.** Jusque-là les lots étaient choisis par thème,
et le harnais rattrapait 4, puis 16, puis 6 liens devenus faux entre deux lots. À partir du lot 5,
chaque lot a été construit comme un **sous-ensemble clos du graphe de citations, relevé avant
d'écrire** : les trois derniers lots n'ont produit que **2** corrections, toutes deux **annoncées par
écrit dans le commit précédent**, au fichier près.

Pour les dix derniers articles : 41 renvois internes au lot, 16 guides cités hors lot tous vérifiés
présents dans les trois langues, zéro lien mort — et les **30 slugs décidés et figés avant la
première ligne**.

---

## 3. Ce qui a été CORRIGÉ dans l'outillage

- **`ff692b2` — les contre-épreuves mécanisées.** `npm run contre-epreuves` rejoue les mutations
  au lieu de casser à la main. **25 garanties éprouvées sur 25** aujourd'hui.
- **`aa4f652` — elles entrent en CI**, en dernière étape.
- **`eb3562c` — la dette Node 20 des actions GitHub**, mesurée dans le log réel, corrigée par des
  épingles SHA v7, verrouillée par un manifeste + une garde hors ligne + 5 contre-épreuves, avec une
  revérification en ligne qui a tourné verte.
- **`00df172` — 6 liens d'outils corrigés**, plus une garantie nouvelle : tout lien `/tools/…` doit
  viser une route réellement servie, la liste étant **lue** dans les routes et non recopiée.
- **`adfd06d` — le harnais des guides est devenu plus strict** : le statut d'origine d'un guide
  français doit être **celui de son jumeau anglais** (invariant mesuré à zéro écart avant d'être
  écrit), et le contrôle du pivot couvre désormais le français.

---

## 4. Mes erreurs, et comment elles ont été prises

Elles sont ici parce qu'un compte rendu qui n'en contient aucune est un compte rendu qu'il faut
relire deux fois.

| erreur | comment elle a été prise | où |
|---|---|---|
| **Quatre liens espagnols et portugais pointaient vers `/tools/heat/`** en promettant « le risque en temps réel là où vous êtes ». L'outil estime l'embargo chaleur **en soute, par itinéraire et par mois**. Pire qu'un lien mort : le lecteur arrive quelque part, et ce n'est pas ce qu'on lui a promis. | en ouvrant enfin l'outil | `00df172` |
| **« Quatre liens morts »** répété plusieurs fois. Faux : **trois sur quatre étaient des 301 déclarées**, donc des sauts de redirection, pas des 404. | audit exhaustif des 559 liens internes | `00df172` |
| **Un contrôle de collision qui ne prouvait rien** : lancé depuis `guides/en`, où le chemin n'existe pas — `ls` ne trouvait rien **par construction**. | refait depuis la racine, **avec un témoin** vérifiant que le contrôle sait voir un fichier existant | `adfd06d` |
| **Une contre-épreuve ancrée sur un titre inexistant.** | le harnais l'a déclarée **MUETTE** et a échoué, au lieu de passer en silence | `793a0fd` |
| **Un compteur qui affichait « reste à traduire : es −10 »**, déduit d'un 62 figé devenu faux. | il compte désormais les clés absentes | `adfd06d` |
| **Une projection fausse** : j'avais annoncé +40 pages par lot de dix guides. C'est **+20** — une page par langue, pas deux. | le build l'a démenti | — |

---

## 5. Ce qui attend TON arbitrage

1. **Les 14 divergences de délai** (T0-B3-f). Le dossier ne tranche pas lequel des deux nombres est
   le bon : il constate qu'ils diffèrent. Trancher exige de relire la source de chaque pays.
   Priorité aux trois permissives : `au`, `nz`, `vn`.
2. **Les 95 règles de poids** (T0-B3-d). Le lot correctif reste à définir, et il ne peut pas être
   « retirer les auto-citées ».
3. **`EntityPage`**, code mort mais armé (T0-B3-e) : retirer, ou câbler.
4. **Le corpus de règles non traduit** : 48 phrases en espagnol, 8 en portugais, sur 407.
5. **Un outil promis qui n'existe pas** : « fait-il trop chaud ici, maintenant ? ». Deux guides
   anglais le citaient ; l'appel a été retiré faute de destination honnête.
6. **`/tools/is-it-too-hot-for-my-dog/` n'a aucune redirection**, à la différence des trois autres.
   Si l'adresse a été publiée, les liens entrants tombent en 404. Je n'ai pas touché au routage.

---

## 6. Comment tout vérifier

```bash
npm run typecheck                    # vert
npm run test:unit                    # 88 OK / 0 FAIL, + harnais des guides
npm run contre-epreuves              # 25 garanties sur 25
npm run contre-epreuves -- --dom     # y ajoute les 2 mutations d'interface (exige un build)

npm run mesure:t0b3c                 # les quatre dossiers se rejouent
npm run mesure:t0b3d
npm run mesure:t0b3e                 # celui-ci exige un site construit
npm run mesure:t0b3f                 # une seconde : ni build, ni moteur, ni réseau
```

Dernier build complet : **3 113 pages**, sortie 0. Vérifié page par page, pas déduit du total :
288 pages de guides rendues sur 288, hreflang complet et résolvant sur les 288, **1 021 liens
internes du corpus, zéro mort**.

---

## 7. Ce que je n'ai PAS vérifié

- **La justesse des 164 textes traduits** (154 es/pt + 10 fr). Aucun programme ne la contrôle ; le
  harnais ne voit que structure, métadonnées, langue et liens. Relecture humaine nécessaire.
- **Les sources externes.** T0-B3-f ne lit aucune URL : il ne peut pas dire si 150 ou 180 jours est
  le bon chiffre pour l'Australie, seulement que la règle et sa phrase se contredisent.
- **Le rendu visuel.** Aucune preview, aucun déploiement. Les dix nouveaux articles n'ont **pas de
  visuel de couverture** — choix assumé plutôt qu'un crédit photo faux.

---

## 8. Journal — travaux postérieurs à ce compte rendu

Cette section reste ouverte jusqu'au retour de la contre-revue. Chaque entrée est datée et porte
son commit.

### 2026-08-19 — fiche d'arbitrage des 14 divergences (`FICHE-ARBITRAGE-14-DELAIS.md`)

Rien n'est corrigé. La fiche rassemble, pour chacune des 14 règles de T0-B3-f : ce que le moteur
applique, ce que la phrase annonce, l'écart en jours, l'URL de la source citée, son type, sa
confiance, sa date de vérification et l'échéance de revue — puis la question exacte à trancher.
Elle est **générée depuis l'artefact scellé**, pas recopiée à la main : elle ne peut pas diverger
du dossier.

Objectif : que la session de contre-revue serve à **décider**, pas à rassembler.

### Décision consignée — le corpus de règles n'a PAS été traduit, et pourquoi

Le chantier le plus gros disponible sans arbitrage était la traduction des phrases de règles :
**359 en espagnol, 399 en portugais, ~38 k mots**. Il a été mesuré puis **écarté**, pour une raison
qui appartient à la contre-revue et non à moi :

**cinq dossiers scellent `rules.json`** — `t0b3b` (base `dadecc2`), `t0b3c` (`ff692b2`),
`t0b3d` (`eb3562c`), `t0b3e` (`34b04cd`), `t0b3f` (`adfd06d`). Chacun relit l'empreinte du fichier
et **échoue si elle diffère**. Traduire le corpus ferait donc tomber la reproduction des cinq d'un
seul coup.

C'est le comportement voulu — « pour mesurer autre chose, il faut déclarer une nouvelle base » —
mais la décision de retirer cinq dossiers de leur base la veille d'une contre-revue n'est pas la
mienne. **À arbitrer :** traduire puis rebaser les cinq, traduire dans un fichier séparé, ou
attendre.

### 2026-08-19 — ce que le site ANNONCE doit exister (`test-annonce-du-site.mjs`, commits `14a56ed` et `873aedf`)

La plus vieille leçon de ce chantier — un portugais **annoncé avant d'exister** — n'était surveillée
par rien de permanent. Vérifié avant d'écrire, plutôt que supposé : `hreflang` n'apparaît dans les
harnais existants que comme *repère* pour retrouver le script en ligne de `Base.astro`, jamais comme
objet de contrôle ; `test-guides-traduits.mjs` ne dit « alternates » que dans un commentaire.

Le harnais lit les octets du site construit et vérifie **dans les deux sens** : tout `hreflang`
annoncé vise une page réellement construite ; toute page construite est listée au sitemap de **sa**
langue ; aucun sitemap n'annonce une URL sans page. Il refuse de tourner sous 2 000 pages HTML.
Sur le site entier : 3 121 pages, 288 pages de guides, 1 440 alternates lus, 2 536 URL au sitemap,
zéro écart dans les deux sens.

**Une exigence est conservée SANS être revendiquée, et le fichier le dit.** « Chaque guide annonce
exactement les langues où sa clé existe » est vraie, mais le corpus est devenu **symétrique**
(72 clés × 4 langues, aucune asymétrie nulle part). Muter `languesDe()` pour qu'elle renvoie les
quatre langues sans les constater ne changerait donc rien à la sortie : la garantie est
**infalsifiable aujourd'hui**. Elle est gardée pour le jour où un contenu partiel reviendra, et
**aucune contre-épreuve ne la réclame**.

**Le premier passage des contre-épreuves a échoué, et c'est lui qui a appris le plus.** Les deux
mutations sont tombées *sans leur diagnostic* : le harnais sortait « site absent ou partiel
(121 pages) ». `build:ci` est un build **réduit** qui ne construit ni les guides ni les fiches, alors
que les sitemaps restent complets — sous ce build, le harnais dénonce ~2 400 pages « annoncées sans
page », et la mutation n'y est pour rien. Il aurait prouvé le vide. Trois conséquences :

- `npm run build:ci -- --complet` : même sentinelle, même environnement, sans les filtres d'entités.
  Le drapeau vit dans `build-ci.mjs` et non dans un second script pour que l'adresse sentinelle reste
  écrite **une seule fois**. Argument inconnu → code 2, comme `build-preview.mjs`.
- le runner distingue `dom` (build réduit) de `buildComplet` (site entier, ~12 min), gate chacun
  derrière son drapeau, restaure `dist` dans la portée **la plus large** jouée — sinon `dist`
  resterait amputé de 2 400 pages, intact au sens « sans mutation » mais inutilisable — et annonce
  **séparément** ce qu'il n'a pas joué.
- `test-annonce-du-site.mjs` sort de `test:built-ui` : il y aurait échoué sur **chaque pull request**.
  Il tourne sur main, après le build complet, avec le motif écrit dans le workflow.

**Corrigé au passage, découvert en écrivant la mutation :** la restauration `git checkout` utilise
`:(literal)`. Le chemin `sitemap-[lang].xml.ts` est un **motif git valide** qui ne désigne aucun
fichier existant ; l'échec serait survenu dans un `finally`, laissant la mutation dans l'arbre et
corrompant tout ce qui suit.

Verdict après trois builds complets : **27 garanties éprouvées sur 27**, les deux nouvelles incluses
(n° 26 et 27). Les deux anciennes mutations d'interface n'étaient pas jouées dans ce passage, et le
runner l'a dit.

**À arbitrer :** faut-il ajouter `--complet` à la CI de main ? Cela lui ajoute trois builds complets,
soit environ 35 minutes. Modifier la durée de la CI n'est pas une décision que j'ai prise seul ; en
l'état les deux contre-épreuves n° 26 et 27 se lancent à la main, ce que leur propre en-tête reproche
aux contre-épreuves manuelles.

**Piste ouverte puis refermée, consignée pour qu'elle ne soit pas rouverte :** `/tools/timeline/`
existe en quatre langues et ne figure dans aucun sitemap. Ce n'est pas un défaut — sa source porte
`noindex={true}` explicitement. Le `noindex` lu dans `dist` ne prouvait rien de son côté : le build
de preview le pose sur **toutes** les pages.

### 2026-08-19 — T0-B3-g, ce que les huit outils servent et dans quelle langue (base `50188bd`)

Sixième dossier de mesure, `npm run mesure:t0b3g`. Rien n'est corrigé : les 21 fichiers lus sont
comparés au bit près à leur version du commit de base, et la moindre différence fait échouer la
mesure avant qu'elle ne dise quoi que ce soit.

**La langue se mesure sans interpréter.** `inlineT` et `t()` portent tous deux un repli vers
l'anglais **écrit dans leur signature** (`es ?? en`, `TABLES[locale]?.[key] ?? TABLES.en[key]`). Le
dossier compte deux conséquences mécaniques du code ; il ne juge rien. Mesurer `inlineT` seul aurait
laissé croire le périmètre couvert alors qu'il ne l'était qu'à moitié.

**Constats.** 355 sites d'appel analysés sur 355 repérés — l'égalité est une exigence, un site
illisible fait échouer la mesure au lieu d'en disparaître.

- **espagnol : 0 site sur l'anglais.** **Portugais : 33.** Ce ne sont pas des phrases d'ornement :
  les messages d'erreur des deux outils interactifs, les messages de validation et de résultat de
  `destinations`, et les **réserves de l'outil chaleur** — « This value is a monthly climate average
  — not the maximum temperature », « MyDogCanFly indicative threshold: amber from {risk} °C ». Le
  lecteur portugais reçoit le **résultat** dans sa langue et la **réserve qui le qualifie** en anglais.
- `best-carriers` et `best-crates` sont des **pages d'attente** — aucun composant qui calcule,
  « classement en préparation » — mais déclarées au sitemap à **priorité 0.8** (le rang des outils)
  et liées depuis `/tools/` comme les quatre vrais outils.
- `timeline` est un outil **complet** (63 sites d'appel, rétro-planning daté, quatre langues),
  délibérément `noindex`, hors sitemap, non lié. Volontaire ou oublié : ce n'est pas à la mesure de
  le dire.
- `t(locale, clé)` : 22 sites, 8 clés distinctes, **aucune incomplète** dans les quatre tables.
- 0 traduction identique à l'anglais dans l'une ou l'autre langue — comptées à part, sans jugement :
  « IATA » se dit IATA partout, ce ne serait pas un repli.

**Ce que je n'ai PAS mesuré, et je l'écris plutôt que de le maquiller.** La provenance des chiffres
est **inventoriée** (les imports du référentiel scellé, fichier par fichier), jamais jugée. Classer
un littéral numérique en « affirmation » confondrait un seuil IATA avec un index de tableau —
T0-B3-f a rejeté trois versions d'un contrôle pour cette raison exacte. `layouts/Base.astro` est
exclu du périmètre, et l'exclusion est **déclarée** dans l'artefact avec son motif : il porte le
chrome de toutes les pages du site, pas celui des outils.

**Quatre contre-épreuves chirurgicales** — chacune déplace un seul site ou une seule route pour ne
faire tomber que l'exigence visée. `residu` en fait tomber deux, et le README le dit : perdre un
site change nécessairement l'inventaire.

**À arbitrer :** les deux pages d'attente au sitemap ; le sort de `timeline` ; les 33 chaînes
portugaises (travail de données, pas de code) ; et le fait que quatre des huit outils — `crate`,
`pet-relief`, `best-carriers`, `best-crates` — ne sont lus par **aucun harnais**. Ce dossier les
mesure ; il ne les surveille pas. Le harnais est l'étape suivante.

### 2026-08-19 — les deux outils que rien ne lisait sont harnachés (115 contrôles, 6 contre-épreuves)

Suite directe de T0-B3-g, qui a constaté que quatre des huit outils du site ne sont lus par aucun
harnais. Les deux **vrais outils** de ce lot le sont désormais ; les deux autres sont des pages
d'attente, et je n'ai pas écrit de test décoratif pour elles.

**`crate` — 84 contrôles.** C'est le plus lourd des quatre : il conseille une taille de caisse, et
une caisse trop petite est un refus à l'embarquement. Sur la page construite, sélecteurs précis,
quatre langues :

- les compagnies qui refusent **les trois** placements affichent le message dédié **mot pour mot**,
  nom de la compagnie compris, et jamais une ligne de soute qui laisserait croire la cabine
  possible — la régression du 09/08/2026, corrigée à la main et gardée par rien depuis ;
- la taille standard proposée est **≥ au minimum calculé sur les trois dimensions** ;
- la majoration brachycéphale est strictement positive ;
- au-delà de la limite de poids publiée, aucun verdict cabine favorable ;
- mêmes taille, mêmes verdicts, même minimum dans les quatre langues.

**Une contre-épreuve a d'abord échoué sans son diagnostic, et elle avait raison.** Neutralisée, la
priorité « aucun animal » laissait le message générique de soute — qui est bien une ligne rouge,
donc « un refus est affiché » restait vrai. C'est exactement le danger d'origine : un refus qui ne
parle **que** de la soute. Le harnais exige désormais la phrase dédiée mot pour mot.

**`pet-relief` — 31 contrôles.** Cet outil ne calcule rien, il oriente : son risque propre est
l'orientation fausse. Raccourcis « bien documentés » ne contenant que des aéroports documentés et
pointant vers la fiche dans **leur** langue ; pastille rendue correspondant exactement au statut ;
soumission vide qui affiche l'aide et ne navigue pas ; mêmes aéroports et mêmes statuts dans les
quatre langues. Le contrôle de navigation porte son **témoin** — une soumission valide doit
déclencher une navigation détectable, sans quoi « ne navigue nulle part » passerait aussi bien
parce que la navigation ne marche jamais sous JSDOM.

**Deux dérives signalées, aucune corrigée** — ce sont des décisions, pas des bugs :

1. `CrateCalculator.astro` nomme **sept** compagnies refusant les trois placements, comme une liste
   close (retest du 09/08/2026). Le référentiel en produit **dix-sept** aujourd'hui : s'y ajoutent
   Aer Lingus, Aircalin, Cathay Pacific, Garuda Indonesia, Gulf Air, Kenya Airways, Qantas, South
   African Airways, TUI Airways et Virgin Atlantic. Le code n'a pas dérivé — les **données** ont
   bougé sous un commentaire resté figé. Réécrire un commentaire daté d'une contre-revue ne
   m'appartient pas ; le harnais fige le 17 et nomme les dix.
2. Le statut « règle US (zone côté piste) » de `pet-relief` n'est produit par **aucun** aéroport :
   le référentiel documente les 31 aéroports américains, le repli est inatteignable. Sa **légende
   est pourtant rendue** sur la page — une légende pour une catégorie vide. Le harnais fige ce zéro
   pour que l'entrée d'un aéroport américain non documenté se voie.

**Contre-épreuves : 33 garanties éprouvées sur 33**, six nouvelles. Les deux mutations exigeant le
site entier restent hors du lot rapide, et le runner le dit à chaque exécution.

Restent sans harnais, et c'est assumé : `best-carriers` et `best-crates`, qui n'ont rien à
surveiller tant qu'elles n'ont pas de classement — leur seul défaut est d'être annoncées au sitemap
au rang des outils, ce qui est une question éditoriale, pas un test.
