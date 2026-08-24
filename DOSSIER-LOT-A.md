# Lot A — Audit des 18 pays sans source · dossier de mesure et de conception (v3)

**Mesuré sur `main` après fusion du dossier d'achèvement (`1dd62010ea183422f02553877df4706714739080`).
Ce dossier ne corrige rien : aucune date, aucune source, aucune donnée métier n'est écrite.
Il sera soumis à contre-revue AVANT toute exécution.**

Reproduction :

```bash
node --import tsx mesurer-lot-a.mjs --as-of=2026-08-24   # l'état contre le scellé — sortie 1 au premier écart
node test-mesure-lot-a.mjs                               # 14 cas : le scellé est exact, le scelleur ne consacre rien
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
futur n'en est pas une. `test-mesure-lot-a.mjs` : **14 cas**, dont les trois faux verts de la
v1 et les trois passages indus de la v2, chacun exigeant la sortie attendue avec pays et
champ nommés.

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

Quatre exigences transverses (P1 de contre-revue) :

- **`locator` obligatoire pour toute promotion** : le contrat canonique le laisse facultatif,
  le lot A l'exige — une citation qu'on ne sait pas retrouver sur la page ne se contre-vérifie
  pas.
- **`url_publiee` ≠ `url_finale`** : la bijection 91/91 se fait sur l'`url_publiee` (celle du
  guide) ; la consultation enregistre l'`url_finale` après redirections ; la projection dans
  `Country.source` utilise **explicitement l'`url_finale`**.
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
2. Bijection exacte : 91/91 `url_publiee` des guides classées ; les pièces de rattachement
   entrent comme `preuves_rattachement` (`SourcedQuote`), jamais comme candidates.
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

Les 14 premières sont déjà éprouvées par `test-mesure-lot-a.mjs` sur l'état de référence —
dont les trois faux verts de la v1, les trois passages indus de la v2 (pet_scheme, scellé
altéré, scelleur sur dérive), les contrôles `--as-of` et la date future.
Le harnais d'exécution devra faire rougir, en plus :

| # | mutation | attendu |
|---|---|---|
| 9 | candidate publiée retirée, remplacée ou ajoutée dans la matrice | échec — bijection 91/91 |
| 10 | candidate `page_generique` (officielle) promue | échec — pertinence exigée |
| 11 | candidate `acces: "tentative"` avec une pertinence affirmée (≠ `non_evaluee`) | échec — une page non consultée n'a pas de verdict de contenu ; son rattachement d'éditeur, prouvé par ailleurs, reste licite |
| 12 | `aucune_source_officielle` alors qu'une candidate éligible existe dans la matrice | échec |
| 13 | `source.verified_date` ≠ `consultee_le` de la candidate retenue | échec |
| 14 | `source.reviewer` ≠ `audite_par` | échec |
| 15 | champ inconnu dans la matrice | échec — schéma strict |
| 16 | lien classé `non_officiel` toujours présenté « Sources officielles » par la fiche | échec bloquant — escalade |
| 17 | `review_due` ≠ `reviewDueFrom(verified_date, "country")` | échec — dérivation, pas ordre |
| 18 | promotion dans `objects.json` sans entrée `promue` dans la matrice | échec — la matrice fait foi |
| 19 | hôte `mydogcanfly.com` promu | échec — `SourcedQuote` le refuse déjà, la contre-épreuve le prouve |
| 20 | citation absente ou < 10 caractères sur une promue | échec — `SourcedQuote` |
| 21 | promue sans `locator` | échec — obligatoire au lot A, au-delà du contrat canonique |
| 22 | projection dans `Country.source` sur l'`url_publiee` au lieu de l'`url_finale` | échec |
| 23 | `preuves_rattachement` réduites à une URL nue (sans citation qui établit la propriété institutionnelle) | échec — forme `SourcedQuote` exigée |
| 24 | candidate `acces: "tentative"` avec une pertinence autre que `non_evaluee`, ou porteuse d'un `SourcedQuote` | échec — l'union discriminée l'interdit |
| 25 | `consultee_le` ou `audite_le` future par rapport à `--as-of`, ou `audite_le` antérieure à une consultation | échec — relations temporelles |

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

## 7. Séquence d'exécution (après feu vert sur cette v2)

1. **Contre-revue de cette v2** — aucune exécution avant.
2. **Remplissage de `audit-pays.json`** : consultation réelle des 91 liens + pièces de
   rattachement, quatre axes, citations verbatim — **sans aucune mutation d'`objects.json`**.
   Le harnais d'exécution et le pas CI arrivent dans ce même livrable.
3. **Contre-revue des 18 décisions** sur pièces.
4. **Application des seules promotions approuvées** dans `objects.json` (projection canonique),
   contre-vérifiée par le critère 4, puis PR, CI, fusion sur décision de Philippe.
