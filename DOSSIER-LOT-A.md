# Lot A — Audit des 18 pays sans source · dossier de mesure et de conception (v4)

**Mesuré sur `main` après fusion du dossier d'achèvement (`1dd62010ea183422f02553877df4706714739080`).
Ce dossier ne corrige rien : aucune date, aucune source, aucune donnée métier n'est écrite.
Il sera soumis à contre-revue AVANT toute exécution.**

Reproduction :

```bash
node --import tsx mesurer-lot-a.mjs --as-of=2026-08-24   # l'état contre le scellé — sortie 1 au premier écart
node test-mesure-lot-a.mjs                               # 16 cas : le scellé est exact, et il ne se remplace pas
```

La liste des 18 est celle que le bloc contractuel du dossier d'achèvement fige
(`pays.identites_sans_source`, annexe A).

---

## 0. Erreurs de la v1, corrigées — et ce qu'elles auraient coûté

**Le garde de mesure produisait trois faux verts** (contre-revue du 24/08/2026, reproduits) :
une URL remplacée par une autre URL valide sortait en 0 ; un lien retiré avec une
`verified_date` « 2026-02-31 » sortait en 0 ; une règle ajoutée visant `country_fj` par
`route.dest_country_id` sortait en 0 — la v1 ne scellait ni les 91 liens, ni les métadonnées,
ni l'égalité YAML ↔ artefact, et recomptait les règles avec un filtre sur le seul `scope` au
lieu de la sémantique canonique. Un état de référence qui ne sait pas rougir aurait laissé
l'audit travailler sur un inventaire silencieusement altéré.

La v2 scelle l'état dans `etat-reference-lot-a.json` : **empreinte SHA-256 par pays des
triplets (label, url) complets**, identité de `verified_date`, `reviewer`, `confidence`,
**compte de règles ciblantes par `rulesForCountry`** (scope ET prédicats de destination —
la fonction canonique de `views.ts`, pas une réimplémentation), **relecture des YAML et
égalité canonique avec l'artefact généré** (l'artefact ne fait pas foi seul), **validation
calendaire des dates** (reconstruction UTC — la regex de l'ingestion accepte « 2026-02-31 »)
et **validation http(s) de chaque URL**.

**Le scellé v2 n'était pas encore exact** (contre-revue, trois passages indus reproduits) :
`pet_scheme` — **le fait même que la future source doit étayer** — pouvait changer sans
rougir ; un scellé altéré (iso2 modifié, pays parasite ajouté) passait, faute d'égalité
structurelle ; et `--sceller` relancé sur des données dérivées **consacrait la dérive** au
lieu de la révéler. La v3 ferme les trois : `pet_scheme` est scellé à valeur exacte ; la
comparaison est **structurelle et symétrique sur l'objet entier** (pays absent ou
supplémentaire, champ absent ou supplémentaire, `iso2` compris — chacun nommé) ; et le
scelleur est **verrouillé** — refus si les données mesurées ne sont pas propres au sens de
git, et remplacement d'un scellé existant subordonné à `--remplace=<sha256 du scellé en
place>` : un acte explicite et tracé, jamais un réflexe. `--as-of` est devenu obligatoire et
calendaire, et une `verified_date` postérieure à `--as-of` rougit — une vérification datée du
futur n'en est pas une.

**Le scelleur v3 consacrait encore une dérive commitée** (contre-revue v3, reproduite) : la
propreté git ne voit que le non-commité — muter, commiter, `--sceller --remplace=…` sortait
en 0 et le nouveau scellé consacrait la dérive ; et `_scelle`, exclu de la comparaison, se
falsifiait sans échec (son `sha_base` désignait d'ailleurs la tête de branche, pas la base
mesurée). La v4 ferme les deux : **le remplacement du scellé est supprimé** — l'instrument
n'écrit plus jamais `etat-reference-lot-a.json` ; `--generer-scelle-candidat` ne produit
qu'un **candidat**, et seulement si les données mesurées sont **identiques à la base exacte
`1dd62010…`** (`git diff --exit-code <base> -- <données>`, dérives commitées comprises, plus
`git status --porcelain` pour le non-suivi) ; la promotion du candidat est un geste git
humain, sous revue. `_scelle` est **validé strictement** : exactement `{ sha_base }`, égal à
la base — falsifié, il rougit. `test-mesure-lot-a.mjs` : **16 cas**, dont la dérive commitée
(génération refusée, candidat absent, scellé intact) et le `_scelle` falsifié.

## 1. La mesure a changé la nature de la dette — et ce que la promotion fait, honnêtement

Le dossier d'achèvement décrivait la dette ainsi : « 18 pays n'ont AUCUNE source ». C'est vrai
**du référentiel** (`packages/knowledge/raw/objects.json`), la couche que le registre des 1 505
mesure. Mais il existe une **seconde couche de provenance** :

| couche | contenu pour les 18 | contrat de forme |
|---|---|---|
| **Référentiel** (`objects.json`) | cinq champs (`id, iso2, name, region, pet_scheme`), `pet_scheme` générique « National import rules », **0 règle ciblante** (sémantique canonique `rulesForCountry`, scellée), **pas de `source`** | schéma canonique `Source` — absent ici |
| **Guides pays** (`content/countries/<iso2>.yml` → `countries.generated.json`) | un guide **riche et publié** par pays : exigences détaillées, races restreintes, autorité de sortie, **91 liens sources** (3 à 7 par pays), `verified_date`, `reviewer`, `confidence` | zod à l'ingestion : `label+url` par lien, `verified_date` par regex |

**Ce que la promotion fait — et ne fait pas.** `Country.source` est un champ facultatif du
petit objet pays. La mesure établit qu'il n'est consommé **ni par le moteur** (aucune règle ne
le lit) **ni par la page** (`CountryGuidePage` rend exclusivement `g.sources`, les liens du
guide). Promouvoir une source dans `objects.json` améliore donc **le registre** — le substrat
que le lot B surveillera — avec **zéro effet moteur et zéro effet public**. Le dossier
l'annonce plutôt que de le laisser croire : le lot A ne « relie » pas les couches par magie ;
il crée, par pays, UN lien explicite et vérifiable entre une candidate auditée et le
référentiel.

**Ce que `Country.source` atteste — le fait ciblé, précisément défini.** Pas les exigences
détaillées du guide (elles restent adossées à `g.sources`, hors périmètre du lot A) :

> *« L'importation des chiens vers ce pays est soumise à des conditions nationales, publiées
> par l'autorité compétente du pays à l'URL citée. »*

C'est exactement ce que le champ `pet_scheme` (« National import rules ») affirme aujourd'hui
sans preuve. Une candidate n'étaye ce fait que si la page consultée **décrit effectivement des
conditions d'importation d'animaux de compagnie** — une page d'accueil d'autorité, même
officielle, ne l'étaye pas (cas éthiopien, § 2).

Deux faits de mesure encadrent la barre :

- Les guides des 18 citent presque exclusivement des hôtes gouvernementaux du pays. Le
  panorama des **122 pays déjà sourcés** : 44 × `mydogcanfly.com`, 5 × `pettravel.com`, 1 ×
  `anivetvoyage.com`, 1 × `kenya.org.za`. **Les 18 ont des candidates souvent meilleures que
  les sources actuelles des 122.** La barre se fixe vers le haut, pas vers l'existant.
- La couche guides, globalement : 140/140 guides datés, 800 liens sources, hors du registre
  des 1 505. L'unification des deux couches est une question de conception pour le **lot B**.

## 2. Inventaire exact, et les cinq cas nommés — mis à jour en contre-revue

Inventaire scellé par `etat-reference-lot-a.json` (empreintes par pays) ; la table complète
des hôtes est dans la v1 de ce dossier (`git show 28b48b8:DOSSIER-LOT-A.md`, § 2) et reste
exacte — le scellé la rend désormais inviolable. Les cinq cas d'attention, **avec les
constats de contre-revue** :

| cas | état après contre-revue | pièces fournies en contre-revue (à consulter et documenter pendant l'audit) |
|---|---|---|
| **Fidji** (`baf.com.fj`) | **éligible en principe** : le portail gouvernemental identifie `baf.com.fj` comme le site de la Biosecurity Authority of Fiji, la loi institue l'autorité, la page animaux décrit les conditions | `directory.digital.gov.fj/organisation?orgId=62` · `laws.gov.fj/Acts/DisplayAct/2994` · page BAF chats/chiens |
| **Bahamas** (`bahfsabahamas.com`) | **éligible en principe** : un document gouvernemental qualifie BAHFSA d'autorité SPS sous tutelle ministérielle ; sa page chats/chiens publie les conditions | document `cdn.bahamas.gov.bs` (RFP e-inspection) · page BAHFSA trade-facilitation chats/chiens |
| **Liban** | **classification v1 à corriger** : `nylebcons.org` est le consulat général officiel (confirmé par l'ambassade) — `mission_diplomatique`, pas « autre » ; sa valeur probante s'évalue séparément. Le ministère publie déjà un décret de quarantaine vétérinaire et une rubrique importation | `regulations.agriculture.gov.lb/en/legislation/523` · rubrique `agriculture.gov.lb` Animal-Wealth/Import-Export · `lebanonembassyus.org` (juridictions consulaires) |
| **Éthiopie** | **éditeur officiel, pertinence NON démontrée** : EAA est bien l'autorité fédérale, mais les pages examinées sont génériques — un éditeur officiel ne suffit pas, la page doit étayer le fait | `eaa.gov.et/overview` · `eaa.gov.et/services` |
| **Koweït** | **à maintenir ouvert** : la page MOFA dédiée a répondu **403** pendant la contre-revue. Elle ne sera déclarée auditée qu'après consultation réelle **avec capture de preuve** | — |

## 3. Conception — la matrice d'audit sur quatre axes, et les contrats existants réutilisés

**Livrable d'exécution : `audit-pays.json`**, versionné, à **schéma strict permanent**
(un champ inconnu est une erreur, pas une tolérance) et **contrôlé en CI** — contrairement aux
harnais de dossier (preuves manuelles datées), la cohérence matrice ↔ liens publiés ↔
référentiel est un invariant permanent du dépôt, donc un pas de `ci.yml`.

Une entrée par pays, exactement les 18. Chaque **candidate** est évaluée sur **quatre axes
séparés** — et la contre-revue de la v2 a exigé qu'ils soient **réellement indépendants dans
la forme** : la v2 les déclarait séparés mais les rendait dépendants (une page inaccessible
ne pouvait plus être rattachée à une autorité ; une candidate non officielle aurait exigé un
`source_type: "other"` que `SourcedQuote` refuse à bon droit). La candidate est donc une
**union discriminée stricte** dont chaque branche ne porte que ce qu'elle peut porter :

1. **Observation d'accès** — discriminant `acces` :
   `{ acces: "consultee", consultee_le, url_finale }` ou
   `{ acces: "tentative", tentee_le, resultat }` (« 403 », « timeout », « DNS »…).
   Les dates existent au calendrier et ne sont pas futures. Une tentative n'est pas une
   consultation : elle date un échec, elle n'autorise aucun verdict de contenu.
2. **Nature de l'éditeur** — `autorite_pays` · `mission_diplomatique_pays` ·
   `officiel_tiers` (USDA APHIS, trade.gov…) · `non_officiel` · `non_etabli` — **établie
   indépendamment de l'accès à la page** : un domaine inaccessible peut être rattaché à une
   autorité par un annuaire gouvernemental (cas fidjien). Le rattachement se **prouve** par
   `preuves_rattachement`, à forme stricte (P1) : chaque pièce est un **`SourcedQuote`** dont
   la citation établit la propriété institutionnelle (« BAF est l'autorité de biosécurité
   instituée par… », depuis l'annuaire ou le texte de loi) — une URL nue ne prouve rien.
   `non_etabli` est l'état honnête par défaut.
3. **Pertinence au fait ciblé** (§ 1) — `etaye_le_fait` · `partielle` · `page_generique` ·
   `hors_sujet` · **`non_evaluee`**. Une page non consultée est **forcée** à `non_evaluee`
   (le schéma strict de la matrice l'impose) — sans que cela n'efface le rattachement
   institutionnel établi par ailleurs. Une page d'accueil d'autorité est `page_generique`
   (cas éthiopien).
4. **Preuve factuelle décisive** — un **`SourcedQuote`** (contrat existant de
   `breed-restrictions.ts` : `Source` + `quote` ≥ 10 caractères + `quote_language` BCP-47 +
   `locator`, strict, http(s), anti-auto-citation, types factuels, `review_due` ≥
   `verified_date`), présent **uniquement** sur une candidate `acces: "consultee"` dont
   l'éditeur et la pertinence la rendent promouvable. Les candidates non officielles ou non
   consultées n'en portent pas — leur observation suffit, et aucun `source_type: "other"`
   n'est forcé dans un contrat qui le refuse. **Aucun modèle parallèle n'est créé.**

**L'observation d'audit — obligatoire, pour que les verdicts NÉGATIFS se contre-vérifient**
(P0 de contre-revue v3) : réserver la pièce au seul `SourcedQuote` des promouvables laissait
le cas éthiopien être classé `page_generique` sans conserver ce qui permet de contre-vérifier
ce verdict. Toute candidate `acces: "consultee"` porte donc une **observation stricte** :
`url_finale`, `statut_http`, `consultee_le`, `langue` de la page, `locator` et **extrait
verbatim ou identifiant de capture**. Cette observation est **non probante et non projetée** —
elle ne concurrence ni `Source` ni `SourcedQuote`, elle documente ce qui a été vu, y compris
pour `partielle`, `page_generique`, `hors_sujet` et `non_officiel`. Une promotion porte **en
plus** le `SourcedQuote` canonique. Symétriquement, toute `acces: "tentative"` conserve la
**preuve de tentative** : URL, `tentee_le`, résultat précis (« HTTP 403 », « timeout DNS »…)
et trace ou capture lorsqu'elle existe.

Quatre exigences transverses (P1 de contre-revue) :

- **`locator` obligatoire pour toute promotion** : le contrat canonique le laisse facultatif,
  le lot A l'exige — une citation qu'on ne sait pas retrouver sur la page ne se contre-vérifie
  pas.
- **`url_publiee` ≠ `url_finale`** : la bijection 91/91 porte sur le **triplet exact
  `(country_id, label, url_publiee)`** — les 91 URL sont uniques aujourd'hui, mais un libellé
  modifié doit rougir autant qu'une URL ; la consultation enregistre l'`url_finale` après
  redirections ; la projection dans `Country.source` utilise **explicitement l'`url_finale`**.
- **`--as-of` obligatoire et relations temporelles contrôlées** : toutes les dates existent au
  calendrier et ne sont pas futures ; `audite_le` ≥ toute `consultee_le`/`tentee_le` du pays ;
  `verified_date` de la promue = `consultee_le` de la candidate retenue. Le validateur CI de
  la matrice prend `--as-of` comme l'instrument de mesure.
- **Schéma strict partout** : un champ inconnu dans la matrice est une erreur.

**Décision par pays** — deux états, pas de troisième :

- `promue` : porte le **`SourcedQuote` complet** (avec `locator`, obligatoire ici) d'une
  candidate `acces: "consultee"` + `autorite_pays` + `etaye_le_fait`, sur son **`url_finale`**.
  `verified_date` = la `consultee_le` de cette candidate ; `review_due` **dérivée** par
  `reviewDueFrom(verified_date, "country")` (ADR-0007) — vérifié : le schéma `Source` seul
  accepte une `review_due` antérieure, la dérivation exacte est donc exigée en plus.
  `Country.source` dans `objects.json` reçoit la **projection canonique `Source`** de ce
  `SourcedQuote` (les champs communs, à l'identique — `Country` n'est pas strict, y glisser
  les champs de citation serait silencieusement toléré puis perdu : la citation vit dans la
  matrice, la liaison est l'égalité de projection, vérifiée en CI).
- `aucune_source_officielle` : `motif` obligatoire. `objects.json` reste sans `source`.
  Une `mission_diplomatique_pays` qui étaye le fait sans qu'aucune page de l'autorité ne
  tienne est un cas d'**arbitrage** (Philippe), pas une promotion automatique.

**Bijection avec les liens publiés** : chacun des **91 liens** des guides des 18 apparaît dans
la matrice, classé sur les quatre axes — aucun lien publié laissé sans verdict, aucune
candidate sortie de nulle part (les pièces de contre-revue entrent comme
`preuves_rattachement`, pas comme candidates). Si un lien publié est classé `non_officiel`
alors que la fiche continue de le présenter sous « Sources officielles », le constat est
**bloquant** — documenté et escaladé, jamais corrigé en silence dans ce lot.

**Qui audite** : je consulte et documente (URL finale, citation, langue, locator, capture) ;
Codex contre-vérifie sur pièces ; Philippe arbitre les cas nommés. Aucun verdict sur une page
non consultée.

## 4. Critères d'acceptation

1. `audit-pays.json` couvre exactement les 18 ; schéma strict (union discriminée du § 3,
   champ inconnu = erreur) ; contrôle câblé en CI, avec `--as-of` et les relations
   temporelles du § 3.
2. Bijection exacte sur le triplet `(country_id, label, url_publiee)` : 91/91 ; les pièces de
   rattachement entrent comme `preuves_rattachement` (`SourcedQuote`), jamais comme candidates.
   Toute candidate `consultee` porte son observation d'audit complète ; toute `tentative`, sa
   preuve de tentative.
3. Toute `promue` : `SourcedQuote` valide **avec `locator`**, sur l'`url_finale` d'une
   candidate `acces: "consultee"` + `autorite_pays` + `etaye_le_fait` ; `review_due` égale à
   la dérivation ADR-0007 ; `verified_date` = `consultee_le` de la candidate retenue ;
   `reviewer` = `audite_par` ; `audite_le` ≥ toutes les consultations du pays.
4. `Country.source` = projection canonique exacte du `SourcedQuote` de la matrice (dont
   l'`url_finale`) — l'égalité champ à champ est le lien entre les couches, vérifiée
   mécaniquement.
5. Tout `aucune_source_officielle` : motif non vide, et **aucune candidate éligible
   existante** (une candidate `consultee` + `autorite_pays` + `etaye_le_fait` rend cet état
   invalide).
6. `objects.json` ne change que par l'ajout des blocs `source` promus (`git diff` en fait foi).

## 5. Contre-épreuves — celles du harnais d'exécution

Les **16 premières** sont éprouvées par `test-mesure-lot-a.mjs` sur l'état de référence —
les trois faux verts de la v1, les trois passages indus de la v2, la dérive commitée et le
`_scelle` falsifié de la v3, les contrôles `--as-of`, la date future, et la génération saine
(candidat égal au scellé, scellé jamais touché par l'instrument).
Le harnais d'exécution devra faire rougir, en plus, les contrôles **17 à 36** — le total est
**verrouillé à 36** :

| # | mutation | attendu |
|---|---|---|
| 17 | candidate publiée retirée, remplacée ou ajoutée dans la matrice | échec — bijection triplet 91/91 |
| 18 | **libellé** d'un lien publié modifié, URL intacte | échec — la bijection porte sur `(country_id, label, url_publiee)` |
| 19 | candidate `page_generique` (officielle) promue | échec — pertinence exigée |
| 20 | candidate `acces: "tentative"` avec pertinence ≠ `non_evaluee`, ou porteuse d'un `SourcedQuote` | échec — l'union discriminée l'interdit ; son rattachement d'éditeur, prouvé par ailleurs, reste licite |
| 21 | `aucune_source_officielle` alors qu'une candidate éligible existe dans la matrice | échec |
| 22 | `source.verified_date` ≠ `consultee_le` de la candidate retenue | échec |
| 23 | `source.reviewer` ≠ `audite_par` | échec |
| 24 | champ inconnu dans la matrice | échec — schéma strict |
| 25 | lien classé `non_officiel` toujours présenté « Sources officielles » par la fiche | échec bloquant — escalade |
| 26 | `review_due` ≠ `reviewDueFrom(verified_date, "country")` | échec — dérivation, pas ordre |
| 27 | promotion dans `objects.json` sans entrée `promue` dans la matrice | échec — la matrice fait foi |
| 28 | hôte `mydogcanfly.com` promu | échec — `SourcedQuote` le refuse déjà, la contre-épreuve le prouve |
| 29 | citation absente ou < 10 caractères sur une promue | échec — `SourcedQuote` |
| 30 | promue sans `locator` | échec — obligatoire au lot A, au-delà du contrat canonique |
| 31 | projection dans `Country.source` sur l'`url_publiee` au lieu de l'`url_finale` | échec |
| 32 | `preuves_rattachement` réduites à une URL nue (sans citation qui établit la propriété institutionnelle) | échec — forme `SourcedQuote` exigée |
| 33 | `consultee_le` ou `audite_le` future par rapport à `--as-of`, ou `audite_le` antérieure à une consultation | échec — relations temporelles |
| 34 | candidate `consultee` sans observation d'audit complète (extrait ou capture manquants) | échec — les verdicts doivent se contre-vérifier |
| 35 | verdict négatif (`partielle`, `page_generique`, `hors_sujet`, `non_officiel`) sans extrait ni capture | échec — même exigence que pour les positifs |
| 36 | `tentative` sans résultat précis, ou sans trace alors qu'elle existe | échec — la preuve de tentative est symétrique |

## 6. Interdits, et effets de bord assumés

- **Interdit : poser une date sans audit.** Fabriquer une provenance est pire que n'en avoir
  aucune.
- **Interdit : modifier les guides YAML dans ce lot.** Un guide non soutenu par ses propres
  sources est documenté et escaladé — sa correction est un autre lot.
- **Interdit : promouvoir un `officiel_tiers`** — la corroboration n'est pas la provenance.
- **Interdit : tout verdict sur une page non consultée** (le 403 koweïtien reste ouvert tant
  que la page n'a pas été réellement lue, preuve à l'appui).
- **Effet de bord assumé :** l'exécution fera rougir le bloc contractuel du dossier
  d'achèvement (« donnée source modifiée sous bloc figé ») — instantané daté du 23/08/2026,
  vérifiable sur son SHA de référence ; personne ne régénère ce bloc en silence.

## 7. Séquence d'exécution (après feu vert sur cette v4)

1. **Contre-revue de cette v4** — aucune exécution avant.
2. **Remplissage de `audit-pays.json`** : consultation réelle des 91 liens + pièces de
   rattachement, quatre axes, citations verbatim — **sans aucune mutation d'`objects.json`**.
   Le harnais d'exécution et le pas CI arrivent dans ce même livrable.
3. **Contre-revue des 18 décisions** sur pièces.
4. **Application des seules promotions approuvées** dans `objects.json` (projection canonique),
   contre-vérifiée par le critère 4, puis PR, CI, fusion sur décision de Philippe.
