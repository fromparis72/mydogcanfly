# Dossier d'achèvement — MyDogCanFly

**Données mesurées sur `cbf442974fceb720cce05df29d16d53d1f31bd51`, à la date fixée du 23/08/2026.**

Ce dossier **ne corrige rien**. Il mesure, il chiffre, il découpe. Aucune donnée métier n'a été
touchée : cette branche ajoute le dossier, son annexe de mesure et le harnais de cette annexe —
rien d'autre, ce qui se vérifie d'une commande (chapitre 7).

> **Ce que les chiffres de ce document engagent.** Ce dossier embarque un **bloc contractuel
> JSON** (annexe A), produit par `mesurer-achevement.mjs --bloc`. `--verifier-dossier` recalcule
> le relevé et le confronte au bloc **à égalité exacte, dans les deux sens** : valeur modifiée,
> entrée supprimée du bloc, entrée ajoutée au bloc, donnée source qui a bougé sous un bloc resté
> figé, bloc dupliqué ou absent — chaque classe d'écart sort en 1 avec son diagnostic. Le bloc
> fige aussi le **registre exact** des sources, pas seulement ses agrégats : empreintes SHA-256
> des objets `Source` canoniques et de leurs locators — globale, par famille, archives à part —
> si bien qu'une source remplacée par une autre d'apparence équivalente rougit même quand aucun
> total ne bouge. La prose de ce document est narrative ; **le bloc fait foi**, et tout chiffre
> de dette du chapitre 4 en provient. Les nombres de **contexte** ne relèvent pas de l'instrument et portent chacun
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

Ce dossier en est à sa cinquième version, et chacune a corrigé des chiffres ou des mécanismes de
la précédente. C'est le fonctionnement voulu — les erreurs sont nommées, pas effacées :

**Les pays étaient lus au mauvais niveau** (v2). Le script cherchait `pays.verified_date` ; la
date vit sous `pays.source.verified_date`. Il concluait « 0 pays daté sur 140 » là où **122** le
sont. Une lecture fausse qui rend zéro ressemble à une découverte : la v1 en tirait un lot qui
aurait fabriqué 122 dates existantes et inventé 18 provenances sans audit.

**La fraîcheur ne couvrait que `rules.json`** (v2). `objects.json` porte 1 098 sources vivantes de
plus. La v1 ignorait 73 % du référentiel.

**La concordance dossier/relevé n'existait que dans un shell** (v3). Elle était annoncée
« 19 contrôles, zéro écart » sans vivre dans les livrables : altérer un chiffre du Markdown
laissait tout sortir en 0. `--verifier-dossier` a d'abord exécuté ces contrôles dans l'instrument,
par recherche de fragments.

**La concordance par fragments était vaincue par les doublons** (v4). Un fragment présent deux
fois dans le dossier — contre-épreuve de Codex : « 28/09/2026 », dans la section fraîcheur ET
dans le lot B — laissait l'altération de l'une des occurrences sortir en 0. Un `includes()` ne
sait pas non plus voir une entrée **ajoutée** ni un bloc **dupliqué**. Le dossier embarque
désormais un **bloc contractuel JSON** unique (annexe A), comparé au relevé recalculé à égalité
exacte et dans les deux sens ; `test-mesure-achevement.mjs` prouve que chaque classe d'écart
rougit.

**Le validateur de forme était partiel** (v4). L'instrument exigeait « `url`, `source_type`,
`review_due` » — un validateur maison qui laissait passer une confiance absente, un relecteur
absent, un type inconnu, une date impossible. Deux validateurs pour un même contrat finissent
par diverger, et c'est le partiel qu'on croit. L'instrument réutilise désormais **le schéma
canonique `Source`** de `packages/knowledge/src/common.ts` — celui de `npm run check` — sur les
1 505 vivantes ET les 20 archives, en bloquant : toute source rejetée nomme son chemin et le champ
en défaut.

**250 sources vivaient sous un indice numérique** (v4). `contacts[0].source` : une insertion ou un
tri changeait leur adresse, ce qui rendait tout futur registre de suivi (lot B) inconstruisible.
Chaque élément de tableau est désormais adressé par son `id`, sinon par l'**empreinte de l'URL de
sa source** — jointe à son `year` pour les évènements de frise historique, qui citent légitimement
la même page. Zéro identité instable aujourd'hui, et le bloc contractuel **fige ce compteur à 0**.
Ce locator est un **fingerprint provisoire, pas une identité longitudinale** (v5, contre-revue) :
il résiste aux insertions et aux tris, **pas au déménagement d'une source** — si une URL
officielle change, un suivi y verrait une suppression et une création, pas la mise à jour d'une
même source. Le lot B devra soit introduire des identifiants explicites, soit assumer cette
sémantique par écrit.

**Le bloc figeait les agrégats, pas le registre** (v5). Contre-épreuve de Codex : remplacer une
URL par une autre URL valide de même type ne changeait aucun total, aucune répartition, aucune
classe d'auto-citation — la vérification sortait en 0 pendant qu'une source métier était
**remplacée en silence**. Le bloc porte désormais l'**empreinte SHA-256 du registre exact** : les
objets `Source` canoniques complets, appariés à leur locator, triés, sérialisés en JSON canonique
— une empreinte **globale**, une **par famille** (pour localiser l'écart), une **séparée pour les
20 archives**. Une URL remplacée, un relecteur modifié, une `verified_date` déplacée sans changer
de tranche : aucun agrégat ne bouge, l'empreinte rougit — et le harnais le prouve.

**L'exclusion des archives était un mot-clé, pas un contrat** (v4). Tout champ `history`, où qu'il
soit, sortait ses sources du registre en silence. Seul le chemin d'archive connu —
`airlines[*].premium.history[*]` — est désormais admis ; une source datée sous tout autre
`history` est **bloquante et nommée**.

**`--as-of` acceptait des dates inexistantes** (v3). `Date.parse` normalise « 2026-02-31 » en
3 mars au lieu de refuser. La date est reconstruite en UTC et confrontée champ à champ ;
« 2026-02-31 », « 2026-13-01 » et un 29 février non bissextile sortent en 2, un 29 février
bissextile passe.

**Vingt « sources » étaient des archives** (v3 ; nature précisée en v5). Le total de 1 525
comptait 20 citations logées sous `airlines[*].premium.history[]` — les **frises historiques**
des compagnies : année + évènement + citation, deux évènements d'une même frise citant
légitimement la même page. Elles adossent des **faits passés immuables** (une fondation, une
alliance), pas des politiques vivantes : les compter dans la charge de revue reviendrait à
réviser l'histoire. Le registre vivant est donc de **1 505**, et l'exclusion est **comptée et
nommée** dans le relevé (`archives_dans_history: 20`) plutôt que tue : une exclusion silencieuse
est une mesure qu'on ne peut plus contester.

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

Le référentiel porte **1 505 sources datées** vivantes — plus 20 archives sous
`airlines[*].premium.history[*]` (les frises historiques des compagnies), hors registre et hors
totaux, comptées à part. Les 1 525 passent **toutes** le schéma canonique `Source` — l'instrument
bloque au premier rejet, et n'a rien rejeté. Zéro identité instable : chaque source est adressable
par un chemin qui survit aux insertions et aux tris.

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

**Octobre 2026 est la plus grosse vague de 2026** : 407 échéances, soit **330** `airlines` et
**77** `rules`. Ce que ce dossier peut dire s'arrête là : savoir si
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
fournit désormais un **locator** par source — un fingerprint **provisoire** : il résiste aux
insertions et aux tris, pas au déménagement d'une source (une URL officielle qui change y paraît
comme une suppression plus une création). Le lot B devra soit introduire des **identifiants
explicites**, soit assumer cette sémantique par écrit — c'est sa première décision de conception.

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
- **Acceptation :** le workflow hebdomadaire produit une liste d'audit **par locator** de source
  (fourni par le relevé — fingerprint provisoire, voir P1-2 : le lot tranche d'abord entre
  identifiants explicites et sémantique suppression + création) ; il distingue **trois états** —
  changement détecté, source inaccessible, revue humaine terminée ; il compare des versions
  **figées par SHA**, jamais un alias ; il ne promeut rien et ne touche pas la production.
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
- **CLOS par arbitrage propriétaire (27/08/2026) :** les 72 traductions espagnoles et 72
  portugaises sont **acceptées dans leur état actuel et considérées comme définitives**. La
  relecture native globale — et sa matrice — sortent du programme d'achèvement. Les contrôles
  automatisés existants restent actifs ; toute modification factuelle future suit le processus
  normal. Le lot ci-dessus reste consigné tel qu'il avait été conçu : c'est l'arbitrage qui le
  ferme, pas une exécution.

### Lot F — Arbitrage de l'outil de chaleur *(conception avant code)*

- **Préalable levé par la négative :** les journaux **n'existent pas**. Le lot tranche sans eux.
- **Deux voies :** laisser en 404, ou page explicative. **La seconde est recommandée.**
- **Première étape, avant tout code :** vérifier quels codes de statut l'hébergement sait servir —
  un **410** dirait aux moteurs que la ressource a disparu, ce qu'un 404 laisse ambigu.
- **Interdit :** rediriger vers `/tools/heat/`.
- **CLOS par arbitrage propriétaire (27/08/2026) :** l'outil ne sera pas construit ;
  `/tools/is-it-too-hot-for-my-dog/` est retirée définitivement, sans redirection. La première
  étape a été faite et tranche la question du 410 par la négative : l'hébergement (Pages) n'admet
  que 200/301/302/303/307/308 dans `_redirects`, et `/tools/*` est exclu du Worker — la fermeture
  propre est donc le **404 franc**, qui était déjà l'état servi (aucune page, aucune redirection,
  aucun lien de guide — dette soldée par un lot antérieur, gardée par `audit-site` et le contrôle
  des liens). Restait UNE promesse vivante : le lien « Open the checker » de l'e-mail d'alerte
  chaleur du worker — retiré. La source héritée `static/tools/is-it-too-hot-for-my-dog/` (Hugo,
  non servie) est supprimée. La recommandation « page explicative » du présent dossier n'est pas
  suivie : c'est la voie 404, choisie par le propriétaire — déviation d'arbitrage, nommée, pas
  une erreur d'exécution.
  **Correction de contre-revue (28/08/2026), nommée :** le premier compte rendu affirmait un
  retrait « définitif dans les sources » alors que **44 chemins hérités** portaient encore des
  CTA vers l'adresse — 40 fiches `content/dog-heat-safety/`, deux articles `content/posts/`,
  la carte de `content/tools.md` (qui présentait quatre outils) et une entrée de
  `layouts/sitemap.xml`. Non servis par le build Astro, mais réimportables et rebâtissables :
  l'affirmation était plus large que le geste. Les 44 sont purgés, `tools.md` présente trois
  outils, et la clôture est désormais **opposable** par `test-cloture-outil-chaleur.mjs`
  (CI des deux jobs) : page absente, zéro mention dans les sources publiables ou rebâtissables,
  sitemaps construits muets, aucune redirection — et la contre-épreuve prouve qu'un CTA
  réintroduit rougit. Seules subsistent les mentions historiques qualifiées (dossiers,
  commentaires d'audit, contre-épreuves, docs d'inventaire), hors du périmètre balayé.
  **Seconde correction de contre-revue (28/08/2026), nommée :** « `tools.md` présente trois
  outils » n'était vrai que des CARTES — le texte de la page promettait encore l'outil chaleur
  en quatre passages (« see if it's too hot… », « know when it's too hot to travel », « Four
  free tools », « these four tools […] whether the heat is safe »), et le scanner, qui ne
  cherche que l'ancien slug, restait vert : la promesse fonctionnelle survivait à l'adresse
  morte. Les quatre passages sont alignés sur trois outils, et la garde gagne le contrôle 6 :
  le nombre d'outils ANNONCÉ dans le texte est confronté au nombre RÉEL de cartes, les motifs
  de promesse chaleur sont interdits, et deux contre-épreuves prouvent que « four tools » sans
  quatrième carte comme une promesse chaleur réintroduite font rougir.

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
npm ci   # l'instrument importe le schéma canonique TypeScript via tsx

# la branche n'ajoute que le dossier, son annexe et le harnais de l'annexe :
git diff --name-only cbf442974fceb720cce05df29d16d53d1f31bd51..HEAD
# → DOSSIER-ACHEVEMENT-PROJET.md, mesurer-achevement.mjs, test-mesure-achevement.mjs

node -v   # doit SATISFAIRE le plancher .nvmrc (même majeure, version >=) — pas être identique

node --import tsx mesurer-achevement.mjs --as-of=2026-08-23                     # le relevé
node --import tsx mesurer-achevement.mjs --as-of=2026-08-23 --verifier-dossier  # CE dossier contre le relevé
node --import tsx mesurer-achevement.mjs --as-of=2026-08-23 --bloc              # régénère l'annexe A
node test-mesure-achevement.mjs                                    # la vérification sait rougir
npm run contre-epreuves -- --contrat                               # 65 garanties, bijection exacte
```

> **`--import tsx` est nécessaire** : l'instrument réutilise le schéma canonique `Source` de
> `packages/knowledge/src/common.ts` au lieu d'entretenir un validateur parallèle.
>
> **`--as-of` est obligatoire** et la date doit exister — « 2026-02-31 » est refusé. Une autre
> date valide donnera d'autres compteurs d'échéance, donc un écart avec le bloc contractuel figé
> au 23/08/2026 — et c'est voulu.
>
> `--verifier-dossier` exige le bloc contractuel **exactement une fois** dans ce document, le
> parse, et le compare au relevé recalculé **à égalité exacte, dans les deux sens** : valeur
> modifiée, entrée supprimée, entrée ajoutée, donnée source qui a bougé, bloc dupliqué ou absent —
> chaque classe sort en 1 avec son diagnostic.
>
> **`test-mesure-achevement.mjs` est une preuve manuelle, datée** — comme
> `preuve-migration-categories.mjs`, et pour la même raison : il éprouve la livraison de CE
> dossier, pas un invariant permanent du dépôt, et il n'est délibérément **pas** câblé en CI. Il
> monte ses propres copies altérées du dossier et ses propres arbres de travail git avec données
> mutées, et prouve que chaque classe d'écart — documentaire ET source — produit la sortie 1 avec
> le diagnostic attendu.

Les chiffres de dette de ce document sont ceux du bloc contractuel de l'annexe A ; les nombres de
contexte portent leur provenance en tête de document.

---

## Annexe A — Le bloc contractuel

Ce bloc est produit par `mesurer-achevement.mjs --bloc` et confronté par `--verifier-dossier`.
**Ne pas l'éditer à la main** : s'il diverge du relevé recalculé, la vérification sort en 1 — dans
les deux sens, qu'un chiffre du bloc ait été altéré ou qu'une donnée du dépôt ait bougé sous un
bloc resté figé.

Les champs `empreinte_registre`, `empreinte_par_famille` et `empreinte_archives` sont des
SHA-256 du **registre exact** : les objets `Source` canoniques complets, appariés à leur locator,
triés par locator, sérialisés en JSON canonique (clés ordonnées récursivement). Ils attrapent ce
qu'aucun agrégat ne voit — une URL remplacée par une autre URL valide, un relecteur modifié, une
date déplacée à l'intérieur d'une tranche — et l'empreinte par famille localise l'écart.

<!-- BLOC-CONTRACTUEL:debut -->
```json
{
  "as_of": "2026-08-23",
  "workflows": [
    "ci.yml",
    "contre-epreuves-completes.yml"
  ],
  "guides": {
    "cles_logiques": 72,
    "par_langue": {
      "en": 72,
      "fr": 72,
      "es": 72,
      "pt": 72
    },
    "traductions_a_relire": {
      "fr": 10,
      "es": 72,
      "pt": 72
    },
    "originaux_importes": {
      "fr": 62,
      "es": 0,
      "pt": 0
    },
    "traductions_total": 154
  },
  "couvertures": {
    "images": 10,
    "non_verifiees": 10
  },
  "referentiel": {
    "sources_datees_total": 1505,
    "archives_dans_history": 20,
    "identites_instables": 0,
    "empreinte_registre": "4507876b2f9ab8ddd32242b343b6a623f638c021175997877a6e13e13ff20341",
    "empreinte_par_famille": {
      "countries": "33a1570226fc1cb37493832b2351bb0ee7dff3dba9ea4cd8479966eb85ef1de5",
      "airports": "72113f10e210b05c54ca93b300205fb315c0349071fdca842c6d9ea061dc3628",
      "airlines": "05e069a61ac2965d711d6763f78fd32cf046001d566af66f0e9ce066dacab599",
      "breeds": "6c823a01e3c91c99689418de48abd3d2cccdb5f6c9421a0ae925fb774ffcad82",
      "partners": "4f53cda18c2baa0c0354bb5f9a3ecbe5ed12ab4d8e11ba873c2f11161202b945",
      "rules": "987b86c16f08db22ed790fe5bea4f9e89fd7fbf005109cfcbfb29fa75e13777a"
    },
    "empreinte_archives": "f84d5eba2ce6678678a6baacb559d0d04064e216c99ac7b2edbc187d3137a038",
    "par_famille": {
      "countries": {
        "objets": 140,
        "sources_datees": 122
      },
      "airports": {
        "objets": 268,
        "sources_datees": 377
      },
      "airlines": {
        "objets": 102,
        "sources_datees": 445
      },
      "breeds": {
        "objets": 172,
        "sources_datees": 154
      },
      "partners": {
        "objets": 6,
        "sources_datees": 0
      },
      "rules": {
        "objets": 407,
        "sources_datees": 407
      }
    },
    "par_type_de_source": {
      "government": 264,
      "other": 411,
      "official_website": 804,
      "airline_contact": 23,
      "regulation": 3
    },
    "par_confiance": {
      "1": 1,
      "2": 113,
      "3": 929,
      "4": 304,
      "5": 158
    },
    "autocitees": 226,
    "autocitees_par_famille": {
      "countries": 44,
      "airlines": 52,
      "rules": 130
    },
    "fraicheur": {
      "echue": 0,
      "moins_30j": 0,
      "moins_90j": 702,
      "plus_90j": 803
    },
    "premiere_echeance": "2026-09-28",
    "derniere_echeance": "2027-07-30",
    "echeances_par_mois": {
      "2026-09": 122,
      "2026-10": 407,
      "2026-11": 173,
      "2026-12": 44,
      "2027-01": 159,
      "2027-02": 68,
      "2027-07": 532
    },
    "octobre_2026_par_famille": {
      "airlines": 330,
      "rules": 77
    }
  },
  "pays": {
    "total": 140,
    "avec_source_datee": 122,
    "sans_source": 18,
    "identites_sans_source": [
      "country_bh",
      "country_bs",
      "country_ci",
      "country_ec",
      "country_et",
      "country_fj",
      "country_gh",
      "country_jm",
      "country_kw",
      "country_lb",
      "country_mg",
      "country_mv",
      "country_ng",
      "country_np",
      "country_om",
      "country_ru",
      "country_sc",
      "country_uy"
    ]
  },
  "compagnies": {
    "total": 102,
    "policies_legacy_unreviewed": {
      "cargo": 73,
      "hold": 8,
      "cabin": 2
    },
    "policies_legacy_total": 83,
    "compagnies_touchees": 74,
    "age_verification_jours": {
      "min": 15,
      "mediane": 43,
      "max": 43,
      "au_dela_90j": 0
    }
  },
  "correspondances": {
    "compagnies_avec_routes": 101,
    "champs_de_route": [
      "direct_routes",
      "seasonal_routes"
    ],
    "marqueurs_operateur_trouves": []
  },
  "contre_epreuves": 65
}
```
<!-- BLOC-CONTRACTUEL:fin -->
