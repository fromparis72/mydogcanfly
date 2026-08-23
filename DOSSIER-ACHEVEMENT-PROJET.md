# Dossier d'achèvement — MyDogCanFly

**Établi sur `cbf442974fceb720cce05df29d16d53d1f31bd51`, le 23/08/2026.**

Ce dossier **ne corrige rien**. Il mesure, il chiffre, il découpe. Aucune ligne de code métier n'a
été touchée pour le produire, et le découpage proposé au chapitre 5 attend la contre-revue avant
qu'un seul lot ne commence.

---

## 1. État de référence, vérifié et non supposé

| | valeur | contrôle |
|---|---|---|
| `origin/main` | `cbf442974fceb720cce05df29d16d53d1f31bd51` | `git rev-parse` — concorde avec la passation |
| arbre de travail | propre avant l'ajout des deux fichiers de ce dossier | `git status --porcelain -uall` |
| `.nvmrc` | `22.22.2` | plancher exact, `node -v` identique |
| npm | `10.9.7` | |
| CI | verte sur les deux jobs requis | `Vérifications` 10 min 46 s · `Site entier` 14 min 40 s |
| workflows présents | **2** — `ci.yml`, `contre-epreuves-completes.yml` | rien d'autre |
| contre-épreuves au catalogue | **65**, bijection exacte avec la référence versionnée | `npm run contre-epreuves -- --contrat` |

Le relevé complet se rejoue d'une commande :

```bash
node mesurer-achevement.mjs          # texte lisible
node mesurer-achevement.mjs --json   # le même relevé, exploitable
```

> Le script signale « arbre MODIFIÉ » lorsqu'il est lui-même encore non suivi par git. C'est
> exact et voulu : il rapporte l'état au moment où il tourne, sans indulgence pour sa propre
> présence.

---

## 2. Méthode : pourquoi chaque nombre est recalculé

Un chiffre écrit à la main dans un document vieillit sans prévenir. Il reste juste le jour où on
l'écrit et devient faux au commit suivant, **sans que rien ne le signale**. Tous les nombres de ce
dossier proviennent donc de `mesurer-achevement.mjs`, qui lit les sources vivantes.

Ce n'est pas une précaution théorique. **Le cadrage de cette mission contenait deux chiffres
périmés**, et les reprendre aurait produit un dossier d'achèvement fondé sur un état disparu.

| chiffre annoncé | chiffre mesuré | pourquoi l'écart |
|---|---|---|
| « 124 traductions ES/PT » | **144** (72 + 72) | le 124 valait 62 + 62, avant que les dix articles du lot 2 ne soient traduits |
| « 171 règles auto-citées » | **130** | mesure T0-B3, antérieure aux corrections de sources |

Deux autres points du cadrage ne résistent pas à la mesure, et le chapitre 4 y revient : la
cadence « 180 jours pour les pays » n'a **aucune donnée** sur quoi mordre, et « inspecter d'abord
les workflows existants » donne un résultat net — **il n'existe aucun système de fraîcheur**, donc
rien à dupliquer.

---

## 3. Ce qui est acquis, et qu'il n'est pas question de rouvrir

- **`main` est vert** sur les deux jobs protégés, dont le site complet (3 121 pages).
- **72 clés de guides × 4 langues**, bijection vérifiée, aucune clé orpheline.
- **72 couvertures**, toutes présentes sur le disque, décodées et conformes à leur manifeste.
- **Les quatre index du Travel Hub** exposent les mêmes rubriques, chacun dans sa langue.
- **La production est intacte** et n'a jamais été touchée.
- **`t0b3-source-fige` ne doit jamais être supprimée** — cinq dossiers de mesure en dépendent.

---

## 4. Les dettes, mesurées

### P0-1 · Relecture linguistique — **154 textes**, et non 124

| langue | textes nés ici (traductions) | originaux importés |
|---|---|---|
| fr | **10** | 62 |
| es | **72** | 0 |
| pt | **72** | 0 |
| **total à relire** | **154** | |

Une traduction se reconnaît **à son origine, pas à sa langue** : un guide non anglais sans
`sourceUrl` est né ici, donc traduit. Les 62 français importés sont des originaux écrits dans leur
langue — les compter gonflerait la dette d'un tiers.

**Ce qui est déjà prouvé, et ce qui ne l'est pas.** `test-guides-traduits.mjs` établit structure,
métadonnées, langue déclarée, exhaustivité des quatre langues et validité des liens. Il écrit
lui-même sa limite : *« la JUSTESSE de la traduction n'est pas contrôlable ici — cette relecture
reste humaine »*. Aucun harnais ne jugera jamais une tournure espagnole.

**Effet public :** 144 pages hispanophones et lusophones sont publiées sans qu'un locuteur natif
les ait lues. C'est la dette la plus visible du site et la moins détectable par machine.

### P0-2 · Provenance des dix couvertures

| | |
|---|---|
| images | **10** |
| `verifie: false` | **10** |
| sans `auteur` | **10** |
| sans `url_origine` | **10** |
| base de droits | « licence Unsplash standard, **DÉCLARÉE** par le propriétaire » |

Le manifeste est **honnête** : il distingue le déclaré de l'établi, et le contrat interdit désormais
de passer à `verifie: true` sans auteur, URL absolue HTTP(S), vérificateur et date ISO réelle. Mais
il reste lacunaire, et une provenance lacunaire ne devient pas complète en attendant.

**Effet public :** dix fichiers binaires publiés dont personne ne peut, aujourd'hui, retracer
l'auteur. La licence standard n'exige pas l'attribution ; le risque n'est pas juridique mais
**probatoire** — si l'origine déclarée s'avérait inexacte, rien ne permettrait de le savoir.

> **ARBITRAGE DU PROPRIÉTAIRE, 23/08/2026 : dette ACCEPTÉE, recherche abandonnée.**
>
> Philippe a tranché : les URL Unsplash ne seront pas recherchées. Ce point cesse donc d'être une
> action en attente et devient un **état choisi**, ce qui n'est pas la même chose et ne doit pas
> se relire comme un oubli dans six mois.
>
> Conséquences, écrites pour qu'elles soient tenues :
>
> - les dix entrées **restent à `verifie: false`**, définitivement en l'état ;
> - le contrat du manifeste n'a **rien à changer** — il est déjà exact, il distingue le déclaré de
>   l'établi et interdit de relever le statut sans auteur, URL et vérificateur ;
> - **aucun lot n'est ouvert** pour ce point ;
> - si un tiers conteste un jour l'origine d'une image, la réponse est celle du manifeste : origine
>   déclarée par le propriétaire, non vérifiée, et le dépôt le dit depuis le premier jour.
>
> Ce qui reste interdit, et le demeure : passer une entrée à `verifie: true` sans les quatre champs
> exigés. Renoncer à chercher n'autorise pas à déclarer trouvé.

### P0-3 · Outil de chaleur locale

| constat | mesure |
|---|---|
| `/tools/heat/` existe | oui — embargo en soute **par itinéraire et par mois** |
| « is it too hot here, now » | **n'existe pas** |
| `/tools/is-it-too-hot-for-my-dog/` | **aucune redirection déclarée** |
| citations dans le contenu | **0** — l'appel a été retiré des six fichiers au lot 2 |

Les deux questions sont différentes : l'une porte sur un **itinéraire futur**, l'autre sur un
**lieu et un instant**. Y rediriger par commodité fabriquerait un lien **trompeur — pire qu'un
lien mort, parce qu'il aboutit**.

**Effet public :** si cette adresse a été publiée avant la refonte, les liens entrants tombent en
404. Le volume réel est **inconnu** : il demande les journaux du fournisseur, que je n'ai pas.
C'est une donnée à produire avant d'arbitrer, pas après.

### P1-1 · Provenance métier

**407 règles**, réparties ainsi :

| type de source | nombre | lecture |
|---|---|---|
| `government` | 192 | source publique officielle |
| `other` | 142 | dont **130 auto-citations** vers `mydogcanfly.com` |
| `official_website` | 73 | site de la compagnie |

Les **12 sources `other` non auto-citées** sont nommément : `pettravel.com` (8),
`anivetvoyage.com`, `iata.org`, `kenya.org.za`, `petabroad.eu`.

| confiance déclarée | règles |
|---|---|
| 2 | 48 |
| 3 | 142 |
| 4 | 96 |
| 5 | 121 |

**Les 130 auto-citations sont le cœur de la dette.** Une règle dont la source est le site
lui-même n'a pas de source : elle affirme ce qu'elle prétend justifier. C'est une **boucle**, et
elle porte aujourd'hui **32 %** des règles du moteur.

**Politiques non revues, sur les 102 compagnies :**

| canal | politiques `legacy_unreviewed` |
|---|---|
| `cargo` | **73** |
| `hold` | 8 |
| `cabin` | 2 |
| **total** | **83**, réparties sur **74 compagnies sur 102** |

Le fret concentre presque tout : c'est le canal le moins documenté publiquement, et celui dont les
conséquences pour l'animal sont les plus lourdes.

**Fraîcheur — rien n'est échu, mais la vague est datée :**

| horizon | règles |
|---|---|
| échues | **0** |
| sous 30 jours | **0** |
| sous 90 jours | **214** |
| au-delà | 193 |

Première échéance le **28/09/2026** (dans 36 jours), dernière le **08/02/2027**. Par mois :
09 → 78 · 10 → 77 · 11 → 59 · 12 → 44 · 01 → 81 · 02 → 68.

Côté compagnies : **aucune sans `verified_date`**, âge médian **43 jours**, maximum 43,
**aucune au-delà des 90 jours** de cadence cible. Cette dette-là est **saine aujourd'hui** et le
restera jusqu'à fin septembre.

**Côté pays, en revanche : 140 fiches, ZÉRO `verified_date`.** La cadence de 180 jours annoncée
au cadrage ne peut mordre sur rien — le champ n'existe pas dans les données. C'est un prérequis,
pas un réglage.

### P1-2 · Correspondances et vols multi-opérateurs

| ce qui est modélisé | mesure |
|---|---|
| champs de route disponibles | **`direct_routes`**, **`seasonal_routes`** — et rien d'autre |
| compagnies pourvues | 101 |
| marqueurs `codeshare`, `operating_carrier`, `marketing_carrier`, `operated_by` | **AUCUN**, dans `engine/src` comme dans `knowledge/src` |

Le cas Paris → Kuala Lumpur s'explique entièrement : **KLM apparaît parce que le moteur connaît
deux segments directs KLM** (CDG→AMS, AMS→KUL) et les enchaîne. Air France n'apparaît pas parce
qu'elle ne vole pas elle-même jusqu'à KUL — l'itinéraire réellement vendu passe par un partenaire,
notion que le modèle de données **n'a pas**.

Ce n'est donc pas un défaut de données mais **une limite de modèle** : il n'existe aujourd'hui
aucun endroit où écrire « vendu par AF, opéré par MH ». Et la distinction est **décisive pour
l'animal** — les règles de transport sont celles de l'**opérateur**, pas du vendeur.

**Interdit explicite, et je le fais mien :** ne pas ajouter Air France à KUL artificiellement.
Cela produirait une réponse juste en apparence et fausse en droit.

### P1-3 · Système de mises à jour

**Inspection d'abord, comme demandé.** Deux workflows existent :

| workflow | déclencheurs |
|---|---|
| `ci.yml` | `pull_request`, `push` sur `main` |
| `contre-epreuves-completes.yml` | `schedule` lundi 04:00 UTC, `workflow_dispatch`, `pull_request` étiquetée |

**Aucun ne surveille la fraîcheur des sources.** Il n'y a donc pas de second système à créer : il
n'y en a aucun. Le workflow hebdomadaire existant offre en revanche un **emplacement, une cadence
et une heure déjà arbitrés**, et une extension y coûterait moins qu'un nouveau fichier.

---

## 5. Découpage proposé — sept lots indépendants

Chaque lot est **fusionnable seul**, sans attendre les autres. L'ordre ci-dessous est un ordre
d'**impact**, pas de dépendance technique.

### Lot A — `verified_date` pour les 140 pays *(prérequis, petit)*

**Pourquoi en premier :** sans ce champ, aucun système de fraîcheur ne peut couvrir les pays.
C'est le seul lot dont un autre dépend.

- **Impact mesuré :** 140 fiches, 0 date aujourd'hui.
- **Acceptation :** chaque pays porte `verified_date` et `review_due` ; le schéma les rend
  obligatoires ; la cadence de 180 jours devient calculable.
- **Contre-épreuves :** une fiche sans date empêche le build ; une date au format libre échoue ;
  une `review_due` antérieure à sa `verified_date` échoue.
- **Ne fait pas :** ne juge pas la fraîcheur, n'audite aucun pays. Il pose le champ, rien de plus.

### Lot B — Surveillance de fraîcheur *(étend l'existant)*

- **Impact mesuré :** 407 règles, 214 échéances sous 90 jours, première le 28/09.
- **Acceptation :** le workflow hebdomadaire produit une liste d'audit **par identité** de règle
  et de source ; il distingue **trois états** — changement détecté, source inaccessible, revue
  humaine terminée ; il compare des versions **figées par SHA**, jamais un alias ; il ne promeut
  rien et ne touche pas la production ; une source inaccessible n'est **jamais** silencieuse.
- **Contre-épreuves :** une source injoignable doit produire « inaccessible » et non « inchangée » —
  c'est l'échec ouvert que ce dépôt a déjà fermé trois fois ; une échéance dépassée doit
  apparaître ; un catalogue vide doit échouer au lieu de conclure « rien à faire ».
- **À arbitrer :** la cadence exacte et le seuil qui rend la CI rouge. Ma recommandation : **aucun
  seuil bloquant au premier lot**. Un contrôle qui rougit pour une échéance naturelle serait
  désarmé en deux semaines.

### Lot C — Auto-citations, par ordre d'exposition publique

- **Impact mesuré :** 130 règles, 32 % du moteur.
- **Acceptation :** chaque règle traitée porte une source `government` ou `official_website`
  vérifiable, ou est **explicitement déclassée** avec son motif ; aucune ne reste `other`
  auto-citée sans décision écrite.
- **Contre-épreuves :** une auto-citation réintroduite doit échouer ; un décompte figé est
  interdit — l'ensemble exact, comme pour les pages sans crédit.
- **Découpe :** par **effet public**, pas par ordre alphabétique. Les règles qui changent un
  verdict d'abord, celles qui n'affectent qu'une note ensuite.

### Lot D — Les 83 politiques `legacy_unreviewed`

- **Impact mesuré :** 83 politiques, 74 compagnies sur 102, dont **73 en fret**.
- **Acceptation :** chaque politique traitée obtient un état revu et une preuve datée, ou reste
  `legacy_unreviewed` **avec un motif écrit**. Le compte diminue de façon traçable.
- **Contre-épreuves :** un état revu sans preuve doit échouer ; le passage de `legacy_unreviewed`
  à revu sans source officielle doit échouer.
- **Recommandation :** traiter le **fret en premier** — c'est le canal où une erreur coûte le plus
  cher à l'animal.

### Lot E — Relecture native es/pt *(humain, non automatisable)*

- **Impact mesuré :** 144 textes es/pt, plus 10 français nés ici.
- **Livrable :** une **matrice par guide et par langue** — relu par, date, corrections proposées,
  statut — versionnée comme `couvertures-guides.json` l'est pour les images.
- **Acceptation :** aucun statut « validé » ne peut être posé par un script ; le harnais vérifie la
  **forme** de la matrice et son **exhaustivité**, jamais la qualité de la traduction ; il écrit
  lui-même qu'il ne juge pas la langue.
- **Contre-épreuves :** un statut « validé » sans relecteur ni date doit échouer ; un guide absent
  de la matrice doit échouer ; une matrice vide doit échouer.
- **Ne fait pas :** ne corrige aucune traduction. Il rend l'état lisible et empêche de le
  surestimer.

> **Aucun lot pour la provenance des couvertures (P0-2).** Le propriétaire a arbitré le 23/08/2026
> en faveur de l'état actuel : dette acceptée, recherche abandonnée, manifeste inchangé.

### Lot F — Arbitrage de l'outil de chaleur *(conception avant code)*

Trois voies, à trancher **avant** d'écrire une ligne :

1. **Construire l'outil local** — répond à la question posée, coût le plus élevé.
2. **Laisser l'adresse sans destination** — honnête, coût nul, perd les liens entrants.
3. **Répondre par une page explicative** en 404 ou 410, qui dit ce qui existe à la place.

- **Préalable de mesure :** le volume réel de trafic sur l'ancienne adresse, à tirer des journaux
  du fournisseur. **Je ne l'ai pas** et ne peux pas l'inventer.
- **Interdit :** rediriger vers `/tools/heat/`, qui répond à une autre question.

### Lot G — Correspondances multi-opérateurs *(dossier de conception seul)*

- **Impact mesuré :** modèle de route limité à `direct_routes` et `seasonal_routes`, zéro marqueur
  d'opérateur dans tout le moteur.
- **Livrable de ce lot :** **un dossier, pas du code.** Il doit trancher comment représenter
  « vendu par X, opéré par Y », quelles règles s'appliquent — celles de l'opérateur — et ce que
  l'interface montre au voyageur.
- **Interdit :** ajouter Air France à KUL sans modèle. Une réponse juste en apparence et fausse en
  droit est plus dangereuse qu'une absence de réponse.

---

## 6. Ce que ce dossier ne fait pas, et pourquoi

- **Aucune correction métier.** Le cadrage l'interdit, et c'est le bon choix : quatre dettes
  distinctes réunies en un patch seraient illisibles en revue.
- **Aucun travail SEO**, hors périmètre.
- **Aucun dossier d'affiliation hôtels**, hors périmètre.
- **Aucune preview, aucune promotion, aucune production.**
- **Aucun chiffre repris du cadrage sans recalcul** — deux s'étaient déjà périmés.

---

## 7. Reproduire ce dossier

```bash
git fetch origin main
git checkout cbf442974fceb720cce05df29d16d53d1f31bd51
git status --porcelain -uall          # doit être vide
node -v && cat .nvmrc                 # doivent concorder
node mesurer-achevement.mjs           # tous les chiffres de ce dossier
npm run contre-epreuves -- --contrat  # 65 garanties, bijection exacte
```

Tout nombre de ce document qui ne se retrouve pas dans la sortie de `mesurer-achevement.mjs` est
une erreur de ma part, et doit être traité comme telle.
