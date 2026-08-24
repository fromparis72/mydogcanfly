# Dossier d'achèvement — MyDogCanFly

**Données mesurées sur `cbf442974fceb720cce05df29d16d53d1f31bd51`, à la date fixée du 23/08/2026.**

Ce dossier **ne corrige rien**. Il mesure, il chiffre, il découpe. Aucune donnée métier n'a été
touchée : cette branche ajoute le dossier, son annexe de mesure et le harnais de cette annexe —
rien d'autre, ce qui se vérifie d'une commande (chapitre 7).

> **Ce que les chiffres de ce document engagent.** Tout chiffre de dette du chapitre 4 provient de
> `mesurer-achevement.mjs` et est **confronté mécaniquement** à ce document par
> `--verifier-dossier` : un écart — donnée qui a bougé, ou dossier altéré — sort en 1 avec le
> contrôle nommé. Les nombres de **contexte** ne relèvent pas de l'instrument et portent chacun
> leur provenance : les 3 121 pages et les durées de CI viennent des journaux du run GitHub cité
> au chapitre 1 ; les cinq commits historiques, de `mesures/DEPENDANCE-HISTORIQUE.md` ; les
> constats sur l'outil de chaleur, de l'arborescence `packages/ui/src/pages` lue au chapitre 4.
> La promesse est donc exacte au lieu d'être large.

---

## 1. État de référence, vérifié et non supposé

| | valeur | contrôle |
|---|---|---|
| commit mesuré | `cbf442974fceb720cce05df29d16d53d1f31bd51` | `git rev-parse` |
| écart de cette branche | dossier + annexe + harnais, **0 donnée métier** | `git diff --name-only` |
| `.nvmrc` | `22.22.2` | **plancher**, au sens de `scripts/lib/require-node.mjs` : même majeure, version ≥ — `22.23.2` est conforme, `24.x` ne l'est pas |
| npm | `10.9.7` ici | indicatif, non bloquant |
| CI | verte sur les deux jobs requis | `Vérifications` 10 min 46 s · `Site entier` 14 min 40 s (journaux du run GitHub sur `cbf4429`) |
| workflows présents | **2** — `ci.yml`, `contre-epreuves-completes.yml` | rien d'autre |
| contre-épreuves | **65**, bijection exacte avec la référence versionnée | `npm run contre-epreuves -- --contrat` |

---

## 2. Erreurs de mesure corrigées en route, et ce qu'elles auraient coûté

Ce dossier en est à sa troisième version, et chacune a corrigé des chiffres de la précédente.
C'est le fonctionnement voulu — les erreurs sont nommées, pas effacées :

**Les pays étaient lus au mauvais niveau** (v2). Le script cherchait `pays.verified_date` ; la
date vit sous `pays.source.verified_date`. Il concluait « 0 pays daté sur 140 » là où **122** le
sont. Une lecture fausse qui rend zéro ressemble à une découverte : la v1 en tirait un lot qui
aurait fabriqué 122 dates existantes et inventé 18 provenances sans audit.

**La fraîcheur ne couvrait que `rules.json`** (v2). `objects.json` porte 1 098 sources vivantes de
plus. La v1 ignorait 73 % du référentiel.

**La concordance dossier/relevé n'existait que dans un shell** (v3). Elle était annoncée
« 19 contrôles, zéro écart » sans vivre dans les livrables : altérer un chiffre du Markdown
laissait tout sortir en 0. `--verifier-dossier` exécute désormais ces contrôles **dans
l'instrument**, en bloquant, et `test-mesure-achevement.mjs` prouve qu'un chiffre altéré d'un
caractère sort en 1 avec le contrôle nommé.

**`--as-of` acceptait des dates inexistantes** (v3). `Date.parse` normalise « 2026-02-31 » en
3 mars au lieu de refuser. La date est reconstruite en UTC et confrontée champ à champ ;
« 2026-02-31 », « 2026-13-01 » et un 29 février non bissextile sortent en 2, un 29 février
bissextile passe.

**Vingt « sources » étaient des archives** (v3). Le total de 1 525 comptait 20 instantanés
passés logés sous `airlines[*].premium.history[]` — supplantés par la source vivante du même
objet, immuables par construction. Les compter dans la charge de revue reviendrait à réviser des
archives. Le registre vivant est donc de **1 505**, et l'exclusion est **comptée et nommée** dans
le relevé (`archives_dans_history: 20`) plutôt que tue : une exclusion silencieuse est une mesure
qu'on ne peut plus contester.

**L'auto-citation se juge désormais au nom d'hôte** (v3), URL parsée — `mydogcanfly.com` et ses
sous-domaines — et non plus à la sous-chaîne, qui attraperait `example.com/mydogcanfly-review`.
Les deux mesures coïncident aujourd'hui (226) : durcir maintenant ne coûte aucun écart à expliquer.

Deux chiffres du cadrage initial restent périmés : « 124 traductions ES/PT » (mesuré : **144**) et
« 171 règles auto-citées » (mesuré : **130** dans les règles, 226 toutes familles).

---

## 3. Ce qui est acquis

- **`main` est vert** sur les deux jobs protégés, dont le site complet (3 121 pages — journaux CI).
- **72 clés de guides × 4 langues**, bijection vérifiée.
- **72 couvertures**, présentes, décodées, conformes à leur manifeste.
- **Les quatre index du Travel Hub** exposent les mêmes rubriques, chacun dans sa langue.
- **La production est intacte.**
- **`t0b3-source-fige` ne doit jamais être supprimée** — cinq dossiers de mesure en dépendent
  (`mesures/DEPENDANCE-HISTORIQUE.md`).

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

### P0-2 · Provenance métier — **226 sources auto-citées sur 1 505**

Le référentiel porte **1 505 sources datées** vivantes — plus 20 archives dans `history`, hors
registre et hors totaux, comptées à part :

| famille | objets | sources datées | dont auto-citées |
|---|---|---|---|
| `airlines` | 102 | **445** | **52** |
| `airports` | 268 | 377 | 0 |
| `breeds` | 172 | 154 | 0 |
| `countries` | 140 | 122 | **44** |
| `partners` | 6 | 0 | 0 |
| `rules` | 407 | **407** | **130** |
| **total vivant** | | **1 505** | **226** |

| type de source | sources |
|---|---|
| `official_website` | 804 |
| `other` | 411 |
| `government` | 264 |
| `airline_contact` | 23 |
| `regulation` | 3 |

**Les 226 auto-citations sont le cœur de la dette.** Une source dont l'hôte est
`mydogcanfly.com` n'est pas une source : elle affirme ce qu'elle prétend justifier. C'est une
**boucle**, et elle touche **15 %** du registre — dont **32 % des règles** du moteur.

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
| sous 90 jours | **702** |
| au-delà | 803 |
| sans `review_due` | 0 |

De **28/09/2026** à **30/07/2027**. Par mois : 09 → 122 · 10 → **407** · 11 → 173 · 12 → 44 ·
01 → 159 · 02 → 68 · 07 → 532.

**Octobre 2026 est la plus grosse vague de 2026** : 407 échéances, soit **330** `airlines` et **77** `rules` — plus du triple d'un mois ordinaire. Ce que ce dossier peut dire s'arrête là : savoir si
cette vague est **absorbable** — par qui, à quel rythme, en priorisant quoi — est un **arbitrage
de capacité** qui appartient à Philippe, pas une conclusion de mesure. Rien n'est échu
aujourd'hui, et rien ne le sera avant le 28/09.

Côté compagnies : aucune sans `verified_date`, âge médian **43 jours**, aucune au-delà des 90 jours
de cadence cible.

### P0-3 · Dix-huit pays sans aucune source

**122 pays sur 140 portent une source datée. Les 18 autres n'ont AUCUNE source** — ni URL, ni
date, ni échéance :

`country_bh` · `country_bs` · `country_ci` · `country_ec` · `country_et` · `country_fj` ·
`country_gh` · `country_jm` · `country_kw` · `country_lb` · `country_mg` · `country_mv` ·
`country_ng` · `country_np` · `country_om` · `country_ru` · `country_sc` · `country_uy`

Ce n'est **pas** un champ manquant : c'est une **absence d'audit**. Poser une date sur ces fiches
sans les auditer fabriquerait une provenance, ce qui est pire que de n'en avoir aucune.

### P0-4 · Outil de chaleur locale

| constat | provenance du constat |
|---|---|
| `/tools/heat/` existe — embargo en soute par itinéraire et par mois | `packages/ui/src/pages/[...loc]/tools/heat.astro` |
| « is it too hot here, now » n'existe pas | même arborescence, aucune page |
| `/tools/is-it-too-hot-for-my-dog/` : aucune redirection | `gen-redirects.mjs`, `redirections-v1.mjs` |
| citations dans le contenu : 0 | `grep` sur `packages/ui/src/content` |

> **ARBITRAGE DU PROPRIÉTAIRE, 23/08/2026 : les journaux d'accès n'existent pas.**
>
> Le trafic sur cette adresse est **définitivement inconnaissable**. Il faut trancher sans lui
> plutôt que de laisser le point ouvert en invoquant une mesure impossible.
>
> **Construire l'outil ne peut plus se justifier par la demande.** Cela reste défendable pour des
> raisons éditoriales — mais ce serait une décision de **produit**, sans rapport avec cette
> adresse morte.
>
> Restent deux voies : laisser en 404, ou servir une page qui explique ce qui existe à la place.
> **Je recommande la seconde**, en sachant qu'elle n'est pas mesurable.
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

Ce n'est pas un défaut de données mais **une limite de modèle**. Quelles contraintes s'appliquent
alors au voyageur — celles du **transporteur qui opère**, celles du **vendeur**, ou une
combinaison des deux selon le segment et le contrat — est précisément la question que le dossier
de conception du lot G devra documenter **sur sources officielles**, sans la préjuger ici.

### P1-2 · Système de mises à jour

Deux workflows existent — `ci.yml` et `contre-epreuves-completes.yml` (lundi 04:00 UTC). **Aucun ne
surveille la fraîcheur des sources.** Il n'y a donc pas de second système à créer : il n'y en a
aucun. Le workflow hebdomadaire offre un emplacement et une cadence déjà arbitrés, et le relevé
fournit désormais l'**identité de chemin stable** de chaque source — la clé du futur registre.

### Hors priorités · Provenance des dix couvertures — **dette acceptée, close**

10 images, toutes à `verifie: false` ; auteur et URL d'origine inconnus ; base de droits DÉCLARÉE
par le propriétaire.

> **ARBITRAGE DU PROPRIÉTAIRE, 23/08/2026, validé en contre-revue.** Les URL Unsplash ne seront
> pas recherchées. État : **provenance lacunaire, acceptée par le propriétaire.** Aucun lot,
> aucune action attendue.

Reste interdit : passer une entrée à `verifie: true` sans auteur, URL absolue HTTP(S), vérificateur
et date ISO. Renoncer à chercher n'autorise pas à déclarer trouvé.

---

## 5. Découpage proposé — **sept lots, A à G**

Chaque lot est **fusionnable seul**. L'ordre est un ordre d'**impact**, pas de dépendance.

### Lot A — Audit des 18 pays sans source

- **Impact mesuré :** les 18 pays nommés au P0-3.
- **Acceptation :** chaque pays obtient une source réelle avec `url`, `source_type`,
  `verified_date`, `review_due`, ou reste **explicitement déclaré sans source**, avec son motif.
- **Contre-épreuves :** une `verified_date` posée sans `url` échoue ; une `review_due` antérieure à
  sa `verified_date` échoue ; un pays retiré de la liste sans source échoue.
- **Interdit :** poser une date sans audit. Fabriquer une provenance est pire que n'en avoir aucune.

### Lot B — Surveillance de fraîcheur *(étend l'existant)*

- **Impact mesuré :** **1 505** sources vivantes, **702** sous 90 jours, **407 pour le seul mois
  d'octobre 2026**, première échéance le **28/09/2026**.
- **Acceptation :** le workflow hebdomadaire produit une liste d'audit **par identité de chemin**
  de source (fournie par le relevé) ; il distingue **trois états** — changement détecté, source
  inaccessible, revue humaine terminée ; il compare des versions **figées par SHA**, jamais un
  alias ; il ne promeut rien et ne touche pas la production.
- **Contre-épreuves :** une source injoignable doit produire « inaccessible » et **non**
  « inchangée » ; un catalogue vide doit échouer au lieu de conclure « rien à faire ».
- **À arbitrer :** **aucun seuil bloquant au premier lot**, selon ma recommandation. Un contrôle
  qui rougit pour une échéance naturelle serait désarmé en deux semaines, et emporterait les
  autres.

### Lot C — Les 226 auto-citations, par ordre d'exposition publique

- **Impact mesuré :** 226 sources — 130 règles, 52 compagnies, 44 pays — soit 15 % du registre.
- **Acceptation :** chaque source traitée devient `government` ou `official_website` vérifiable, ou
  est **explicitement déclassée** avec son motif écrit.
- **Contre-épreuves :** une auto-citation réintroduite échoue — jugée au **nom d'hôte**, pas à la
  sous-chaîne ; l'**ensemble exact** est exigé, pas un décompte.
- **Découpe :** par **effet public**. Les sources qui changent un verdict d'abord.

### Lot D — Les 83 politiques `legacy_unreviewed`

- **Impact mesuré :** 83 politiques, 74 compagnies sur 102, dont **73 en fret**.
- **Acceptation :** chaque politique obtient un état revu **avec preuve datée**, ou reste
  `legacy_unreviewed` avec un motif écrit. Le compte diminue de façon traçable.
- **Contre-épreuves :** un état revu sans preuve échoue ; le passage à « revu » sans source
  officielle échoue.
- **Recommandation :** **le fret en premier** — c'est là qu'une erreur coûte le plus cher à
  l'animal.

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
  un **410** dirait aux moteurs que la ressource a disparu, ce qu'un 404 laisse ambigu.
- **Interdit :** rediriger vers `/tools/heat/`.

### Lot G — Correspondances multi-opérateurs *(dossier de conception seul)*

- **Impact mesuré :** modèle limité à `direct_routes` et `seasonal_routes`, zéro marqueur
  d'opérateur dans tout le moteur.
- **Livrable :** **un dossier, pas du code.** Il devra : représenter « vendu par X, opéré par Y » ;
  **documenter sur sources officielles** quelles contraintes pèsent sur le voyageur — celles de
  l'opérateur, celles du vendeur, ou les deux selon le segment — **sans préjuger de la réponse** ;
  et définir ce que l'interface montre.
- **Interdit :** ajouter Air France à KUL sans modèle. Une réponse juste en apparence et fausse en
  droit est plus dangereuse qu'une absence de réponse.

---

## 6. Ce que ce dossier ne fait pas

- **Aucune correction métier.** Quatre dettes réunies en un patch seraient illisibles en revue.
- **Aucun travail SEO**, hors périmètre. **Aucun dossier d'affiliation hôtels**, hors périmètre.
- **Aucune preview, aucune promotion, aucune production.**
- **Aucun chiffre repris sans recalcul** — deux du cadrage et six des miens s'étaient périmés ou
  révélés faux au fil des versions.

---

## 7. Reproduire ce dossier

```bash
git fetch origin claude/dossier-achevement
git checkout claude/dossier-achevement

# la branche n'ajoute que le dossier, son annexe et le harnais de l'annexe :
git diff --name-only cbf442974fceb720cce05df29d16d53d1f31bd51..HEAD
# → DOSSIER-ACHEVEMENT-PROJET.md, mesurer-achevement.mjs, test-mesure-achevement.mjs

node -v   # doit SATISFAIRE le plancher .nvmrc (même majeure, version >=) — pas être identique

node mesurer-achevement.mjs --as-of=2026-08-23                     # le relevé
node mesurer-achevement.mjs --as-of=2026-08-23 --verifier-dossier  # CE dossier contre le relevé
node test-mesure-achevement.mjs                                    # la vérification sait rougir
npm run contre-epreuves -- --contrat                               # 65 garanties, bijection exacte
```

> **`--as-of` est obligatoire** et la date doit exister — « 2026-02-31 » est refusé. Une autre
> date valide donnera d'autres compteurs d'échéance, et c'est voulu.
>
> `--verifier-dossier` confronte ce document au relevé, contrôle par contrôle, et sort en 1 au
> premier écart en le nommant. `test-mesure-achevement.mjs` prouve que cette vérification **mord** :
> un chiffre altéré d'un caractère dans une copie du dossier produit la sortie 1 et le nom du
> contrôle en écart.

Les chiffres de dette de ce document sont ceux que `--verifier-dossier` confronte ; les nombres de
contexte portent leur provenance en tête de document.
