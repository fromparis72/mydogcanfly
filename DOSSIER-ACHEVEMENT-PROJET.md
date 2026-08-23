# Dossier d'achèvement — MyDogCanFly

**Données mesurées sur `cbf442974fceb720cce05df29d16d53d1f31bd51`, à la date fixée du 23/08/2026.**

Ce dossier **ne corrige rien**. Il mesure, il chiffre, il découpe. Aucune donnée métier n'a été
touchée : cette branche ajoute **exactement deux fichiers** — ce document et son annexe de mesure —
et rien d'autre, ce qui se vérifie d'une commande (chapitre 7).

> **Cette version corrige la précédente.** Trois de ses mesures étaient fausses, et le chapitre 2
> les nomme. Un dossier d'achèvement qui se trompe de chiffres oriente les lots vers le mauvais
> travail — la première version en tirait un lot qui aurait fabriqué des dates sans audit.

---

## 1. État de référence, vérifié et non supposé

| | valeur | contrôle |
|---|---|---|
| commit mesuré | `cbf442974fceb720cce05df29d16d53d1f31bd51` | `git rev-parse` |
| écart de cette branche | **2 fichiers, 0 donnée métier** | `git diff --name-only` |
| `.nvmrc` | `22.22.2` | plancher exact, `node -v` identique |
| npm | `10.9.7` | |
| CI | verte sur les deux jobs requis | `Vérifications` 10 min 46 s · `Site entier` 14 min 40 s |
| workflows présents | **2** — `ci.yml`, `contre-epreuves-completes.yml` | rien d'autre |
| contre-épreuves | **65**, bijection exacte avec la référence versionnée | `npm run contre-epreuves -- --contrat` |

---

## 2. Trois mesures fausses, et ce qu'elles auraient coûté

**Les pays étaient lus au mauvais niveau.** Le script cherchait `pays.verified_date` ; la date vit
sous `pays.source.verified_date`. Il concluait **« 0 pays daté sur 140 »** là où **122** le sont.

C'est la pire espèce d'erreur : **une lecture fausse qui rend zéro ressemble à une découverte.** La
version précédente en tirait un « lot A » consistant à poser le champ sur 140 fiches — c'est-à-dire
à **fabriquer 122 dates qui existaient déjà**, et à en inventer 18 sans audit. Le lot A de cette
version est tout autre chose, et beaucoup plus petit.

**La fraîcheur ne couvrait que `rules.json`.** Les 407 règles ne sont pas toutes les sources datées
du référentiel : `objects.json` en porte **1 118** de plus. Le total réel est **1 525**, et la
version précédente en ignorait **73 %**.

**Les auto-citations n'étaient comptées que dans les règles.** Il y en a **226**, pas 130, réparties
sur trois familles — 130 règles, 52 compagnies, 44 pays.

**En outre, l'annexe n'était pas reproductible.** Elle appelait `new Date()` : ses compteurs
d'échéance dépendaient du jour où on la lançait. `--as-of` est désormais **obligatoire**, et le
script refuse de tourner sans.

Deux chiffres du cadrage étaient par ailleurs périmés, et le sont toujours :

| chiffre annoncé | mesuré | pourquoi l'écart |
|---|---|---|
| « 124 traductions ES/PT » | **144** (72 + 72) | le 124 valait 62 + 62, avant la traduction des dix articles du lot 2 |
| « 171 règles auto-citées » | **130** règles (226 sources au total) | mesure T0-B3, antérieure aux corrections |

---

## 3. Ce qui est acquis

- **`main` est vert** sur les deux jobs protégés, dont le site complet (3 121 pages).
- **72 clés de guides × 4 langues**, bijection vérifiée.
- **72 couvertures**, présentes, décodées, conformes à leur manifeste.
- **Les quatre index du Travel Hub** exposent les mêmes rubriques, chacun dans sa langue.
- **La production est intacte.**
- **`t0b3-source-fige` ne doit jamais être supprimée** — cinq dossiers de mesure en dépendent.

---

## 4. Les dettes, mesurées

### P0-1 · Relecture linguistique — **154 textes**

| langue | traductions (nées ici) | originaux importés |
|---|---|---|
| fr | **10** | 62 |
| es | **72** | 0 |
| pt | **72** | 0 |
| **total à relire** | **154** | |

Une traduction se reconnaît **à son origine, pas à sa langue** : un guide non anglais sans
`sourceUrl` est né ici, donc traduit. Les 62 français importés sont des originaux — les compter
gonflerait la dette d'un tiers.

`test-guides-traduits.mjs` établit structure, métadonnées, langue déclarée, exhaustivité et liens.
Il écrit lui-même sa limite : *« la JUSTESSE de la traduction n'est pas contrôlable ici — cette
relecture reste humaine »*.

**Effet public :** 144 pages hispanophones et lusophones publiées sans qu'un locuteur natif les ait
lues. Dette la plus visible du site, la moins détectable par machine.

### P0-2 · Provenance métier — **226 sources auto-citées sur 1 525**

Le référentiel porte **1 525 sources datées** :

| famille | objets | sources datées | dont auto-citées |
|---|---|---|---|
| `airlines` | 102 | **465** | **52** |
| `airports` | 268 | 377 | 0 |
| `breeds` | 172 | 154 | 0 |
| `countries` | 140 | 122 | **44** |
| `partners` | 6 | 0 | 0 |
| `rules` | 407 | **407** | **130** |
| **total** | | **1 525** | **226** |

| type de source | sources |
|---|---|
| `official_website` | 804 |
| `other` | 431 |
| `government` | 264 |
| `airline_contact` | 23 |
| `regulation` | 3 |

**Les 226 auto-citations sont le cœur de la dette.** Une source qui pointe vers le site lui-même
n'est pas une source : elle affirme ce qu'elle prétend justifier. C'est une **boucle**, et elle
touche **15 %** du référentiel — dont **32 % des règles** du moteur.

**Politiques non revues, sur les 102 compagnies :**

| canal | `legacy_unreviewed` |
|---|---|
| `cargo` | **73** |
| `hold` | 8 |
| `cabin` | 2 |
| **total** | **83**, sur **74 compagnies sur 102** |

Le fret concentre presque tout : canal le moins documenté publiquement, et celui dont les
conséquences pour l'animal sont les plus lourdes.

**Fraîcheur, à la date du 23/08/2026 :**

| horizon | sources |
|---|---|
| échues | **0** |
| sous 30 jours | **0** |
| sous 90 jours | **722** |
| au-delà | 803 |
| sans `review_due` | 0 |

De **28/09/2026** à **30/07/2027**. Par mois : 09 → 122 · 10 → **427** · 11 → 173 · 12 → 44 ·
01 → 159 · 02 → 68 · 07 → 532.

**Octobre 2026 est la vraie échéance du projet** : 427 sources y arrivent à terme, presque le
quadruple d'un mois ordinaire. Rien n'est échu aujourd'hui, et rien ne le sera avant le 28/09.

Côté compagnies : aucune sans `verified_date`, âge médian **43 jours**, aucune au-delà des 90 jours
de cadence cible.

### P0-3 · Dix-huit pays sans aucune source

**122 pays sur 140 portent une source datée. Les 18 autres n'ont AUCUNE source** — ni URL, ni date,
ni échéance :

`country_bh` · `country_bs` · `country_ci` · `country_ec` · `country_et` · `country_fj` ·
`country_gh` · `country_jm` · `country_kw` · `country_lb` · `country_mg` · `country_mv` ·
`country_ng` · `country_np` · `country_om` · `country_ru` · `country_sc` · `country_uy`

Ce n'est **pas** un champ manquant : c'est une **absence d'audit**. Poser une date sur ces fiches
sans les auditer fabriquerait une provenance, ce qui est pire que de n'en avoir aucune.

### P0-4 · Outil de chaleur locale

| constat | mesure |
|---|---|
| `/tools/heat/` existe | oui — embargo en soute **par itinéraire et par mois** |
| « is it too hot here, now » | **n'existe pas** |
| `/tools/is-it-too-hot-for-my-dog/` | **aucune redirection déclarée** |
| citations dans le contenu | **0** — l'appel a été retiré au lot 2 |

> **ARBITRAGE DU PROPRIÉTAIRE, 23/08/2026 : les journaux d'accès n'existent pas.**
>
> Le trafic sur cette adresse est **définitivement inconnaissable**. Ce n'est plus une donnée en
> attente : il faut trancher sans elle plutôt que de laisser le point ouvert en invoquant une
> mesure impossible.
>
> **Construire l'outil ne peut plus se justifier par la demande.** Cela reste défendable pour des
> raisons éditoriales — la question « fait-il trop chaud ici, maintenant ? » mérite une réponse —
> mais ce serait alors une décision de **produit**, sans rapport avec cette adresse morte.
>
> Restent deux voies : laisser en 404, ou servir une page qui explique ce qui existe à la place.
> **Je recommande la seconde**, en sachant qu'elle n'est pas mesurable : un visiteur arrivant par
> un lien ancien cherchait précisément ce sujet, et lui servir une page vide quand `/tools/heat/`
> traite une question voisine est un gâchis que coûte une page d'explication.
>
> **Interdit, et le demeure :** rediriger vers `/tools/heat/`. Un lien qui aboutit sur une réponse
> à une autre question est pire qu'un lien mort.

### P1-1 · Correspondances et vols multi-opérateurs

| ce qui est modélisé | mesure |
|---|---|
| champs de route | **`direct_routes`**, **`seasonal_routes`** — et rien d'autre |
| compagnies pourvues | 101 |
| `codeshare`, `operating_carrier`, `marketing_carrier`, `operated_by` | **AUCUN**, dans `engine/src` comme dans `knowledge/src` |

Le cas Paris → Kuala Lumpur s'explique entièrement : **KLM apparaît parce que le moteur connaît
deux segments directs KLM** et les enchaîne. Air France ne peut pas apparaître — l'itinéraire vendu
passe par un partenaire, notion que le modèle **n'a pas**.

Ce n'est pas un défaut de données mais **une limite de modèle**, et elle est décisive : les règles
de transport sont celles de l'**opérateur**, pas du vendeur.

### P1-2 · Système de mises à jour

Deux workflows existent — `ci.yml` et `contre-epreuves-completes.yml` (lundi 04:00 UTC). **Aucun ne
surveille la fraîcheur des sources.** Il n'y a donc pas de second système à créer : il n'y en a
aucun. Le workflow hebdomadaire offre en revanche un emplacement et une cadence déjà arbitrés.

### Hors priorités · Provenance des dix couvertures — **dette acceptée, close**

| | |
|---|---|
| images | 10 · toutes à `verifie: false` |
| auteur, URL d'origine | inconnus pour les dix |
| base de droits | « licence Unsplash standard, **DÉCLARÉE** par le propriétaire » |

> **ARBITRAGE DU PROPRIÉTAIRE, 23/08/2026, validé en contre-revue.** Les URL Unsplash ne seront pas
> recherchées. Les dix entrées restent à `verifie: false` définitivement, et le manifeste n'a rien
> à changer : il distingue déjà le déclaré de l'établi.

Ce point **ne porte plus de priorité** et **n'ouvre aucun lot** : aucune action n'est attendue.
L'état est : **provenance lacunaire, acceptée par le propriétaire.**

Reste interdit : passer une entrée à `verifie: true` sans auteur, URL absolue HTTP(S), vérificateur
et date ISO. Renoncer à chercher n'autorise pas à déclarer trouvé.

---

## 5. Découpage proposé — **sept lots, A à G**

Chaque lot est **fusionnable seul**. L'ordre est un ordre d'**impact**, pas de dépendance.

> **Le compte, puisque la version précédente s'est trompée dessus.** Elle annonçait « sept devenus
> six » en croyant qu'un lot couvrait les couvertures ; il n'en existait aucun, et l'arbitrage n'a
> donc rien retiré. Ce sont **sept lots**, A à G, et la provenance des couvertures n'en a jamais eu.

### Lot A — Audit des 18 pays sans source

**Ce lot a changé de nature depuis la version précédente**, où il consistait à poser un champ sur
140 fiches. 122 le portent déjà ; **18 n'ont aucune source du tout**.

- **Impact mesuré :** 18 pays nommés au P0-3.
- **Acceptation :** chaque pays obtient une source réelle avec `url`, `source_type`,
  `verified_date`, `review_due`, ou reste **explicitement déclaré sans source**, avec son motif.
- **Contre-épreuves :** une `verified_date` posée sans `url` échoue ; une `review_due` antérieure à
  sa `verified_date` échoue ; un pays retiré de la liste sans source échoue.
- **Interdit :** poser une date sans audit. Fabriquer une provenance est pire que n'en avoir aucune.

### Lot B — Surveillance de fraîcheur *(étend l'existant)*

- **Impact mesuré :** **1 525** sources datées, **722** sous 90 jours, **427 pour le seul mois
  d'octobre 2026**, première échéance le 28/09.
- **Acceptation :** le workflow hebdomadaire produit une liste d'audit **par identité** de source ;
  il distingue **trois états** — changement détecté, source inaccessible, revue humaine terminée ;
  il compare des versions **figées par SHA**, jamais un alias ; il ne promeut rien et ne touche pas
  la production.
- **Contre-épreuves :** une source injoignable doit produire « inaccessible » et **non**
  « inchangée » — c'est l'échec ouvert que ce dépôt a déjà fermé quatre fois ; un catalogue vide
  doit échouer au lieu de conclure « rien à faire ».
- **À arbitrer :** **aucun seuil bloquant au premier lot**, selon ma recommandation. Un contrôle qui
  rougit pour une échéance naturelle serait désarmé en deux semaines, et emporterait les autres.

### Lot C — Les 226 auto-citations, par ordre d'exposition publique

- **Impact mesuré :** 226 sources — 130 règles, 52 compagnies, 44 pays — soit 15 % du référentiel.
- **Acceptation :** chaque source traitée devient `government` ou `official_website` vérifiable, ou
  est **explicitement déclassée** avec son motif écrit.
- **Contre-épreuves :** une auto-citation réintroduite échoue ; l'**ensemble exact** est exigé, pas
  un décompte — même leçon que les pages sans crédit et le catalogue de mutations.
- **Découpe :** par **effet public**. Les sources qui changent un verdict d'abord.

### Lot D — Les 83 politiques `legacy_unreviewed`

- **Impact mesuré :** 83 politiques, 74 compagnies sur 102, dont **73 en fret**.
- **Acceptation :** chaque politique obtient un état revu **avec preuve datée**, ou reste
  `legacy_unreviewed` avec un motif écrit. Le compte diminue de façon traçable.
- **Contre-épreuves :** un état revu sans preuve échoue ; le passage à « revu » sans source
  officielle échoue.
- **Recommandation :** **le fret en premier** — c'est là qu'une erreur coûte le plus cher à l'animal.

### Lot E — Relecture native es/pt *(humain, non automatisable)*

- **Impact mesuré :** 144 textes es/pt, plus 10 français nés ici.
- **Livrable :** une **matrice par guide et par langue** — relu par, date, corrections, statut —
  versionnée comme `couvertures-guides.json` l'est pour les images.
- **Acceptation :** aucun statut « validé » ne peut être posé par un script ; le harnais vérifie la
  **forme** et l'**exhaustivité** de la matrice, jamais la qualité de la traduction, et l'écrit.
- **Contre-épreuves :** un « validé » sans relecteur ni date échoue ; un guide absent de la matrice
  échoue ; une matrice vide échoue.

### Lot F — Arbitrage de l'outil de chaleur *(conception avant code)*

- **Préalable levé par la négative :** les journaux **n'existent pas**. Le lot tranche sans eux.
- **Deux voies :** laisser en 404, ou page explicative. **La seconde est recommandée.**
- **Première étape, avant tout code :** vérifier quels codes de statut l'hébergement sait servir —
  un **410** dirait aux moteurs que la ressource a disparu, ce qu'un 404 laisse ambigu ; encore
  faut-il pouvoir le produire sans Worker dédié.
- **Interdit :** rediriger vers `/tools/heat/`.

### Lot G — Correspondances multi-opérateurs *(dossier de conception seul)*

- **Impact mesuré :** modèle limité à `direct_routes` et `seasonal_routes`, zéro marqueur
  d'opérateur dans tout le moteur.
- **Livrable :** **un dossier, pas du code.** Comment représenter « vendu par X, opéré par Y »,
  quelles règles s'appliquent — celles de l'opérateur — et ce que l'interface montre.
- **Interdit :** ajouter Air France à KUL sans modèle. Une réponse juste en apparence et fausse en
  droit est plus dangereuse qu'une absence de réponse.

---

## 6. Ce que ce dossier ne fait pas

- **Aucune correction métier.** Quatre dettes réunies en un patch seraient illisibles en revue.
- **Aucun travail SEO**, hors périmètre. **Aucun dossier d'affiliation hôtels**, hors périmètre.
- **Aucune preview, aucune promotion, aucune production.**
- **Aucun chiffre repris sans recalcul** — deux du cadrage et trois des miens s'étaient périmés ou
  révélés faux.

---

## 7. Reproduire ce dossier

```bash
git fetch origin claude/dossier-achevement
git checkout claude/dossier-achevement

# la branche n'ajoute QUE le dossier et son annexe : les données mesurées sont celles de cbf4429
git diff --name-only cbf442974fceb720cce05df29d16d53d1f31bd51..HEAD
# → DOSSIER-ACHEVEMENT-PROJET.md, mesurer-achevement.mjs, et rien d'autre

node -v && cat .nvmrc                              # doivent concorder
node mesurer-achevement.mjs --as-of=2026-08-23     # tous les chiffres de ce dossier
npm run contre-epreuves -- --contrat               # 65 garanties, bijection exacte
```

> **`--as-of` est obligatoire** et le script refuse de tourner sans. Une autre date donnera d'autres
> compteurs d'échéance, et c'est voulu : ce sont des chiffres datés, pas des constantes.
>
> La version précédente demandait de revenir à `cbf4429` pour lancer un script qui n'y existe pas.
> C'est corrigé : on se place sur cette branche, et le `git diff` ci-dessus prouve qu'elle ne touche
> à aucune donnée.

Tout nombre de ce document absent de la sortie de `mesurer-achevement.mjs` est une erreur de ma
part, et doit être traité comme telle.
