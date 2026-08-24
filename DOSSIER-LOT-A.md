# Lot A — Audit des 18 pays sans source · dossier de mesure et de conception (v5-octies)

**Mesuré sur `main` après fusion du dossier d'achèvement (`1dd62010ea183422f02553877df4706714739080`).
Ce dossier ne corrige rien : aucune date, aucune source, aucune donnée métier n'est écrite.
Il sera soumis à contre-revue AVANT toute exécution.**

Reproduction :

```bash
node --import tsx mesurer-lot-a.mjs --as-of=2026-08-24   # l'état contre le scellé — sortie 1 au premier écart
node test-mesure-lot-a.mjs                               # 16 cas : le scellé est exact, et il ne se remplace pas
node test-audit-pays.mjs                                 # 57 cas : le validateur de la matrice mord (17-72)
node test-consulter-lot-a.mjs                            # 14 cas au faux curl : le collecteur ne fabrique rien
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

**L'observation v4 n'était ni durable ni univoque** (contre-revue v4). `url_finale` et
`consultee_le` étaient définies deux fois — dans la branche `consultee` puis dans
l'« observation stricte » — deux copies qui pouvaient diverger ; un « identifiant de
capture » pouvait désigner un fichier absent ou remplacé ; et « trace ou capture lorsqu'elle
existe » laissait passer une tentative sans preuve, le validateur ne pouvant pas savoir si
une trace existait. La v4-bis fond l'observation DANS la branche (aucune duplication), met la
pièce sous **union stricte vérifiable** (extrait verbatim, ou capture **versionnée** à chemin
et SHA-256 dont l'existence et l'empreinte se vérifient), rend la **trace durable
obligatoire** pour toute tentative, exige la **concordance** entre la promotion et son
observation décisive, et interdit toute nature d'éditeur autre que `non_etabli` sans preuve
de rattachement. Cinq contre-épreuves (37–41).

**La v4-bis rendait indéfinissable une promotion fondée sur une capture** (contre-revue
v4-bis) : la branche `capture` ne porte ni citation, ni langue, ni locator — exiger la
concordance rendait toute capture impromouvable, l'ignorer fabriquait un faux vert. La
v4-ter tranche : **la pièce décisive d'une promotion est obligatoirement un `extrait`** ;
une capture peut être jointe en complément, jamais remplacer l'extrait. Et « versionnée »
se **prouve** désormais : chemin relatif sous le répertoire fixe du lot, fichier régulier
(pas un lien symbolique), présence confirmée par `git ls-files --error-unmatch`, SHA-256 de
64 caractères égal au contenu. Trois contre-épreuves (42–44), et `statut_http` est défini —
un entier 200–299 : tout le reste est une tentative.

**Les extraits n'étaient ancrés nulle part, et le collecteur fabriquait des tentatives**
(contre-revue de l'outillage d'exécution). Une citation inventée passait : `PieceExtrait` ne
vérifiait que longueur, langue et locator, sans lien à aucune capture. Et le collecteur v1
transformait ses propres pannes en observations — contre-épreuve : `curl` ABSENT produisait
« 91 tentatives », sortie 0 ; il lisait l'inventaire sans le confronter au scellé, effaçait
les captures précédentes, faisait DEUX requêtes par échec (statut de l'une, transcript de
l'autre), laissait un relevé partiel après interruption, et versionnait des traces porteuses
d'informations de proxy. La v5 ferme tout : chaque consultation référence sa **capture brute
versionnée**, tout extrait — pièce décisive comme citation de rattachement — doit s'y
**retrouver après normalisation déterministe** (balises ôtées, entités décodées, blancs
unifiés, casse conservée), et chaque preuve de rattachement est appariée à sa propre capture
scellée (contre-épreuves 45–47). Le collecteur v2 reconfronte l'inventaire au scellé avant
toute écriture, exige `curl` et une sonde verte (refus explicite des signatures de proxy
bloquant), fait UNE invocation par URL (corps, métadonnées et trace corrélés), écrit dans un
répertoire de run neuf sans rien effacer, assainit les traces (lignes proxy/authentification
expurgées), refuse de publier sur 0 consultation (la signature d'une panne), et ne publie le
manifeste que complet, par renommage atomique — 8 contre-épreuves au faux `curl` (absent,
proxy bloquant, inventaire dérivé, nominale, 403+timeout, dérive d'URL, interruption, zéro
consultation).

**L'ancrage v5 acceptait un extrait vide, et lisait les PDF comme du HTML** (contre-revue
v5). Un « extrait » fait de balises (`<b></b><i></i>`, 14 caractères) se normalisait en
chaîne vide — et le vide s'ancre dans n'importe quelle capture ; et 17 des 91 candidates
sont des PDF, que le collecteur nommait `.html` sans Content-Type et que le validateur
lisait en UTF-8 avant d'y ôter des balises — une citation de PDF ne pouvait pas s'ancrer
honnêtement. Par ailleurs, la détection environnementale ne valait que pour la sonde : la
sonde verte, une autorité répondant « CONNECT tunnel failed » devenait une « tentative » de
la source, sa signature expurgée. La v5-bis ferme tout : au moins **dix caractères
significatifs après normalisation** et **aucun balisage** dans l'extrait ; le collecteur
scelle le **Content-Type et les en-têtes corrélés**, conserve le **brut** (extension selon
le type), et produit le **texte dérivé** par l'**extracteur déterministe versionné**
`extraire-texte-lot-a.mjs` (HTML et PDF — flux dégonflés par zlib, opérateurs de texte
relevés ; un PDF scanné donne une chaîne vide où rien ne s'ancre) — brut, texte dérivé et
version scellés ensemble, le validateur **re-dérivant** le texte depuis le brut ; et la
**détection environnementale vaut pour chaque requête** (`r.error`, statut nul, signature de
proxy dans la trace brute → tout le run s'interrompt, manifeste intact). Contre-épreuves
48–51 et cas collecteur 9.

**Le manifeste n'était relié à rien, l'extracteur PDF ne fermait pas l'échec, et la détection
restait partielle** (contre-revue v5-bis, trois P0). (1) Le validateur ne lisait jamais le
manifeste de consultation : réécrire `url_finale` ET `source.url` ensemble — concordance
verte, capture intacte — sortait en 0. Désormais **le manifeste fait foi de l'observation** :
chaque candidate le référence par `manifeste_n` (identité stable, unicité exigée, pays et
indice vérifiés), et tous les champs OBSERVÉS — triplet, accès, statut, URL finale, date,
Content-Type, capture scellée, en-têtes, trace — doivent lui être ÉGAUX ; la matrice n'ajoute
que le jugement (contre-épreuve 52). (2) L'extracteur `lot-a-1` produit sur les PDF réels des
mots éclatés et des caractères de contrôle (contre-examen indépendant : APHIS, Bahamas,
Fidji) — une citation illisible aurait pu être copiée depuis ce dérivé. Voie simple retenue,
comme proposé : les PDF bruts sont conservés, mais **ni pièce `extrait`, ni preuve de
rattachement, ni candidate décisive ne peuvent venir d'un PDF** en lot-a-1 — chaque pays a
au moins trois candidates non-PDF ; aucun décodeur ToUnicode n'est nécessaire dans ce lot
(contre-épreuves 50–51, refusées MÊME quand l'extrait s'ancre). (3) La détection
environnementale n'inspectait que stderr : un 403 dont seul le corps ou les en-têtes
portaient « EGRESS_BLOCKED » devenait une tentative légitime ; et les en-têtes se scellaient
sans assainissement (`Set-Cookie` versionnable). Désormais stderr + en-têtes + corps sont
inspectés avant toute classification, et les en-têtes sont EXPURGÉS (`Set-Cookie`,
`Authorization`, `WWW-Authenticate`, `Proxy-*`) avant scellement — cas collecteur 10 et 11.

**Un PDF mal étiqueté redevenait une preuve, les refus fuyaient des secrets, les rattachements
restaient hors manifeste, et le manifeste n'était pas un ensemble exact** (contre-revue
v5-ter, trois P0 + un P1). (1) L'interdiction PDF reposait sur le seul `Content-Type` : les
mêmes octets `%PDF-` servis en `text/plain` refaisaient preuve. Le **format se détecte
désormais depuis les octets** (`detecterFormat`, signature `%PDF-` dans les 1024 premiers
octets), est enregistré comme `format_detecte`, **recalculé par le validateur**, et porte
toutes les interdictions PDF — extracteur passé en `lot-a-2` (routage par octets).
(2) Les en-têtes BRUTS restaient dans les runs partiels lors d'un refus : ils ne touchent
plus JAMAIS `audit-pays-pieces/` — curl écrit dans un temporaire hors dépôt, seule la
projection assainie entre dans le run, et la contre-épreuve inspecte TOUS les fichiers des
runs interrompus. (3) Une `preuve_rattachement` à capture ancrée pouvait porter une URL
gouvernementale inventée : chaque rattachement référence désormais une **observation du
manifeste** (`manifeste_n`), concorde sur URL finale, date et capture — et les URL hors des
91 candidates sont collectées par le collecteur comme **observations de rattachement de rôle
dédié** (liste versionnée `rattachements-a-consulter.json`, curée des pièces de contre-revue,
url et motif obligatoires). (4) Le manifeste est validé comme **ensemble exact** : schéma
strict, `total` = nombre de résultats, identifiants uniques, candidates = exactement les 91
couples publiés, aucun résultat sans jugement ni rôle exercé, tous les fichiers sous le
répertoire de run déclaré. Contre-épreuves 53–57 et cas collecteur 12.

**La liste des rattachements acceptait des URL locales, certaines observations n'avaient
aucun état légal, et le manifeste n'était toujours pas un ensemble exact** (contre-revue
v5-quater, trois P0). (1) `file:///etc/passwd` avec motif passait — le vrai curl aurait
laissé du contenu LOCAL dans le run. La liste est désormais au **schéma strict, refus avant
toute écriture** : HTTP(S) uniquement, exactement `{ url, motif }`, motif non blanc, URL
uniques, fichier obligatoire et JSON valide (batterie de six variantes au harnais collecteur).
(2) Un rattachement PDF réussi, un échec réseau ou une pièce non pertinente rendaient la
matrice invalidable (cité-par-preuve obligatoire vs preuve-PDF interdite). Chaque observation
de rattachement reçoit désormais **exactement une décision éditoriale** dans la matrice :
`utilisee` (citée par au moins une preuve) ou `ecartee` (motif obligatoire, citée par
aucune) — la fixture écarte proprement un PDF et une tentative (vert), l'absence de décision
et le « PDF utilisé » rougissent. (3) Le manifeste est durci : compteurs `candidates` et
`rattachements` OBLIGATOIRES et **recalculés** (`rattachements: 999` rougit), `n` uniques et
**contigus** de 1 à total, **rôles littéraux** dans les quatre branches du schéma,
**égalité exacte** des rattachements avec la liste versionnée (url et motif, dans l'ordre),
`run` contraint à `audit-pays-pieces/run-*`, appartenance des fichiers jugée sur **chemins
résolus** et non au préfixe. Contre-épreuves 58–63.

**Une redirection sortait de HTTP(S), le validateur sautait la liste versionnée difforme,
les pièces d'un rattachement écarté n'étaient jamais vérifiées, et une preuve pouvait viser
une candidate ordinaire** (contre-revue v5-quinquies, quatre faux verts reproduits).
(1) curl suivait les redirections sans contrainte de protocole : une
`url_finale = file:///etc/passwd` était persistée et le manifeste remplacé, sortie 0. Le
protocole est désormais **épinglé** (`--proto =http,https`, `--proto-redir =http,https`) et
l'`url_finale` **revalidée au même contrat HTTP(S) avant toute persistance** — refus, corps
provisoire détruit, manifeste intact (cas collecteur 13 ; l'épinglage de chaque appel est
exigé au cas nominal). (2) Le schéma strict de la liste des rattachements ne vivait que dans
le collecteur : `{}` remplaçant le tableau versionné laissait le validateur permanent vert.
Le schéma vit désormais dans **un module partagé** (`liste-rattachements-lot-a.mjs`) importé
par les DEUX outils — toute liste non-tableau, URL non HTTP(S), champ inconnu, motif blanc
ou duplication rougit aussi en CI (contre-épreuve 64, deux variantes). (3) Les pièces d'un
rattachement **écarté** n'étaient vérifiées par personne : chemins et empreintes remplacés
par des fichiers inexistants, décision `ecartee` conservée, sortie 0. **Chaque résultat du
manifeste est contre-vérifié indépendamment de toute décision** — consultation : brut, texte
dérivé, en-têtes et trace prouvés ; tentative : trace prouvée (contre-épreuve 65). (4) Une
preuve de rattachement pouvait viser la candidate ELLE-MÊME (citation ancrée dans sa capture,
concordance verte, observation dédiée écartée) et contourner toute la liste versionnée : la
garde `obs.role === "rattachement"` est explicite (contre-épreuve 66). Au passage, le verdict
« suivi par git » est **mémoïsé par chemin** — pure mémoïsation d'un fait stable pendant le
run, chaque contexte gardant son propre diagnostic ; la double preuve manifeste + matrice ne
double pas les appels git.

**Les tentatives laissaient des pièces orphelines dans le run, et le contrat des observations
restait plus faible dans le validateur que dans le collecteur** (contre-revue v5-sexies, deux
P0 au bord collecte/manifeste, plus un P1). (1) Le corps et les en-têtes assainis d'une
tentative (403, timeout) restaient dans le run sans être référencés par le manifeste — le
répertoire contenait plus que l'inventaire déclaré. Une **tentative ne garde désormais que sa
trace** (corps provisoire et en-têtes supprimés), et le validateur exige l'**inventaire
exact** : chaque fichier du répertoire de run est référencé par un résultat du manifeste, une
pièce orpheline rougit (cas collecteur 5 durci — égalité dans les deux sens ; contre-épreuve
69). (2) Le schéma du manifeste acceptait `statut_http: 404` sous `acces: "consultee"` et
`url_finale: "file:///etc/passwd"` (`z.string().url()` accepte `file://`) — le collecteur ne
produit plus ces états, mais le validateur permanent devait les refuser par lui-même. Le
schéma exige désormais `statut_http` 200-299 pour toute consultation et le **contrat HTTP(S)
partagé** (`estUrlHttp`, un seul code : liste, collecteur, validateur) pour TOUTES les URL
observées — `url_publiee`, `url_demandee`, `url_finale`, matrice comme manifeste
(contre-épreuves 67 et 68, qui rougissent au schéma même quand l'observation est ensuite
écartée). (3) P1 fermé avant tout réseau réel : le corps est **borné en octets** (25 MiB) —
`--max-filesize` côté curl ET stat du fichier avant toute lecture en mémoire ; un corps
au-delà devient une tentative explicite « au-delà de la borne », jamais une capture ni une
lecture (cas collecteur 14, borne exigée sur chaque appel au cas nominal). Le PDF « scanné »
de la fixture historique, référencé par personne, a été retiré — l'inventaire exact l'aurait
refusé, à raison.

**L'inventaire était exact comme ensemble, pas comme bijection — et `octets` restait
déclaratif** (contre-revue v5-septies, un P0 + un P1). (1) La fixture « conforme » portait
94 résultats pour 8 fichiers distincts : traces et en-têtes partagés, que le `Set` des
références masquait — deux résultats pouvaient partager les mêmes pièces, leurs anciennes
pièces retirées du run, sortie 0. L'inventaire est désormais une **bijection** : chaque
pièce appartient à UN SEUL couple (résultat n, champ) — un partage rougit en nommant tous
les couples — et la **fixture a été reconstruite** avec une pièce par (résultat, champ)
(`n-<n>.*`, ~370 fichiers), le collecteur réel étant déjà bijectif par construction
(`<num>-<hôte>.*`). Contre-épreuve 70 : pièces partagées entre n 1 et n 2, anciennes pièces
retirées, matrice alignée — rouge avec les deux n nommés. Le verdict « suivi par git » se lit
désormais dans l'index chargé une fois par run (`git ls-files -z`) — même preuve
d'appartenance, sans un appel git par pièce. (2) `capture.octets` est **obligatoire** au
schéma du manifeste, **borné** par la limite partagée (`LIMITE_CORPS_OCTETS`, 25 MiB,
exportée du module commun) et **confronté à `statSync(...).size`** — le supprimer échoue au
schéma (contre-épreuve 71), le falsifier échoue à la taille réelle (contre-épreuve 72).

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

1. **Observation d'accès** — discriminant `acces`, et l'observation EST la branche : chaque
   champ n'existe qu'à UN endroit (contre-revue v4 : deux copies d'`url_finale` pouvaient
   diverger).
   - `{ acces: "consultee", url_finale, statut_http, consultee_le, capture, piece }` — la
     **capture brute** de la page (fichier versionné + SHA-256) est OBLIGATOIRE : c'est
     l'**ancre** de tout extrait. `statut_http`
     est un **entier 200–299** : une consultation est une page réellement obtenue ; toute
     autre issue (403, 5xx, timeout…) est une **tentative**. La **pièce est obligatoire**,
     sous union stricte :
     `{ type: "extrait", extrait, langue, locator }` (verbatim) **ou**
     `{ type: "capture", chemin, sha256 }` — et **la pièce décisive d'une promotion est
     obligatoirement un `extrait`** : une capture ne porte ni citation, ni langue, ni
     locator, elle ne peut donc pas fonder la concordance ; elle peut être **jointe en
     complément**, jamais remplacer l'extrait (contre-revue v4-bis). Tout extrait doit se
     **retrouver dans la capture brute** après une normalisation DÉTERMINISTE, définie une
     fois : balises HTML ôtées (`script`/`style` compris), entités décodées (`&amp;`,
     `&lt;`, `&gt;`, `&quot;`, `&#39;`, `&nbsp;`, numériques), blancs unifiés, casse
     conservée — une citation inventée, ou réécrite de façon concordante des deux côtés,
     est INTROUVABLE et rougit.
     Une capture (ou un transcript) est « versionnée » au sens **prouvé** : chemin relatif
     sous le répertoire fixe `audit-pays-pieces/`, fichier **régulier** (un lien symbolique
     est refusé), présence dans l'index confirmée par `git ls-files --error-unmatch`, et
     `sha256` de 64 caractères hexadécimaux égal au contenu — existence seule et empreinte
     seule ne prouvent pas l'appartenance au dépôt.
   - `{ acces: "tentative", url, tentee_le, resultat, trace }` — le résultat est précis
     (« HTTP 403 », « timeout DNS »…) et la **trace durable est OBLIGATOIRE** :
     `{ type: "transcript" | "capture", chemin, sha256 }`, versionnée et vérifiée comme
     ci-dessus. « Lorsqu'elle existe » n'existe pas : le validateur ne peut pas savoir si une
     trace existait — donc elle existe, ou la tentative n'est pas enregistrable.
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

**Pourquoi la pièce est obligatoire jusque sur les verdicts NÉGATIFS** (P0 de contre-revue
v3) : réserver la preuve au seul `SourcedQuote` des promouvables laissait le cas éthiopien
être classé `page_generique` sans conserver ce qui permet de contre-vérifier ce verdict. La
pièce de l'observation est **non probante et non projetée** — elle ne concurrence ni `Source`
ni `SourcedQuote`, elle documente ce qui a été vu, y compris pour `partielle`,
`page_generique`, `hors_sujet` et `non_officiel`. Une promotion porte **en plus** le
`SourcedQuote` canonique, concordant avec elle.

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

- `promue` : **désigne l'observation décisive** (la candidate et sa pièce) et porte le
  **`SourcedQuote` complet** (avec `locator`, obligatoire ici) d'une candidate
  `acces: "consultee"` + `autorite_pays` + `etaye_le_fait`, sur son **`url_finale`**. Le
  `SourcedQuote` doit **concorder avec l'observation désignée** sur l'URL finale, la date, la
  citation (l'extrait), la langue et le locator — une promotion qui dit autre chose que sa
  pièce est contradictoire, donc rouge.
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
   Toute candidate `consultee` porte sa pièce (extrait verbatim, ou capture versionnée à
   empreinte vérifiée) ; toute `tentative`, sa trace durable ; toute nature d'éditeur autre
   que `non_etabli`, au moins une preuve de rattachement ; toute promotion désigne son
   observation décisive et son `SourcedQuote` concorde avec elle.
3. Toute `promue` : `SourcedQuote` valide **avec `locator`**, sur l'`url_finale` d'une
   candidate `acces: "consultee"` + `autorite_pays` + `etaye_le_fait`, dont la pièce
   décisive est un **`extrait`** (une capture ne peut être que complémentaire) ;
   `review_due` égale à la dérivation ADR-0007 ; `verified_date` = `consultee_le` de la
   candidate retenue ; `reviewer` = `audite_par` ; `audite_le` ≥ toutes les consultations
   du pays.
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
Le harnais d'exécution `test-audit-pays.mjs` éprouve les contrôles **17 à 72** (57 cas — la
fixture porte un manifeste en ensemble exact égal à la liste versionnée, UNE pièce par
(résultat, champ), un rattachement utilisé, un PDF et une tentative proprement écartés, une
candidate PDF à pièce-capture), et `test-consulter-lot-a.mjs` éprouve le collecteur (14 cas
au faux `curl`, dont la batterie de six listes malformées, la redirection hors HTTP(S), le
corps au-delà de la borne et l'inventaire exact du run). Le total est **verrouillé à
72 + 14** :

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
| 34 | candidate `consultee` sans pièce (ni extrait verbatim, ni capture versionnée) | échec — les verdicts doivent se contre-vérifier |
| 35 | verdict négatif (`partielle`, `page_generique`, `hors_sujet`, `non_officiel`) sans pièce | échec — même exigence que pour les positifs |
| 36 | `tentative` sans résultat précis | échec — la preuve de tentative est symétrique |
| 37 | pièce `capture` dont le `chemin` ne désigne aucun fichier versionné | échec — existence vérifiée |
| 38 | capture dont le contenu change à chemin constant (SHA-256 ≠ scellé) | échec — empreinte vérifiée |
| 39 | `tentative` sans trace durable (transcript ou capture versionnée) | échec — « lorsqu'elle existe » n'existe pas |
| 40 | observation désignée et `SourcedQuote` contradictoires (URL finale, date, citation, langue ou locator) | échec — concordance exigée |
| 41 | `autorite_pays` (ou toute nature ≠ `non_etabli`) sans `preuve_rattachement` | échec |
| 42 | candidate éligible promue avec une **capture seule** comme pièce | échec ciblé — la pièce décisive d'une promotion est un `extrait` |
| 43 | pièce dont le fichier existe mais n'est **pas suivi** par git (`git ls-files --error-unmatch`) | échec — « versionnée » se prouve |
| 44 | pièce dont le chemin est un **lien symbolique** pointant hors de `audit-pays-pieces/` | échec — fichier régulier exigé |
| 45 | extrait **absent** de la capture brute référencée | échec — ancré ou inventé |
| 46 | extrait **réécrit de façon concordante** des deux côtés (concordance verte) mais introuvable dans la capture | échec — seule l'ancre le voit |
| 47 | preuve de rattachement **sans capture** appariée | échec — schéma, la paire est obligatoire |
| 48 | extrait fait de **balises seules** (se normalise en vide) | échec — dix caractères significatifs exigés, le vide s'ancre partout |
| 49 | extrait fait d'**entités seules** | échec — même garde |
| 50 | pièce `extrait` depuis un **PDF** — même quand l'extrait s'ancre dans le texte dérivé dégradé | échec — aucune preuve textuelle depuis un PDF en lot-a-1 |
| 51 | preuve de rattachement dont la capture est un **PDF** | échec — même interdiction |
| 52 | `url_finale` ET `source.url` réécrites ENSEMBLE, capture et manifeste intacts (concordance verte) | échec — le manifeste fait foi : observation réécrite hors manifeste |
| 53 | les mêmes octets `%PDF-` servis en `text/plain`, alignés matrice + manifeste + dérivé | échec — le format recalculé depuis les OCTETS prime, l'interdiction PDF avec lui |
| 54 | résultat de manifeste supplémentaire (n : 999), non référencé | échec — ensemble exact : aucun résultat sans jugement ni rôle exercé |
| 55 | `citation.url` de rattachement inventée, capture et citation intactes | échec — rattachement hors manifeste |
| 56 | preuve de rattachement sans `manifeste_n` | échec — schéma |
| 57 | pièce du manifeste hors du répertoire de run déclaré (chemins résolus) | échec |
| 58 | observation de rattachement **sans décision** éditoriale | échec — utilisee ou ecartee, rien d'implicite |
| 59 | rattachement **PDF déclaré `utilisee`** | échec — utilisée exige d'être citée, et une preuve PDF est interdite |
| 60 | compteur `rattachements` falsifié (999) | échec — compteurs recalculés |
| 61 | `run` hors du motif `audit-pays-pieces/run-*` | échec — schéma du manifeste |
| 62 | `n` non contigus | échec — 1..total, sans trou ni doublon |
| 63 | rattachements du manifeste ≠ liste versionnée `rattachements-a-consulter.json` | échec — égalité exacte, url et motif |
| 64 | liste versionnée difforme au VALIDATEUR (`{}` à la place du tableau, puis URL locale `file://`) | échec — le schéma strict est partagé avec le collecteur, la CI rougit sur la même cause |
| 65 | pièces d'un rattachement **écarté** remplacées par des fichiers inexistants, décision conservée | échec — tout résultat du manifeste reste contre-vérifiable, décision ou pas |
| 66 | preuve de rattachement visant une **candidate ordinaire** (citation ancrée, capture concordante, observation dédiée écartée) | échec — `role === "rattachement"` exigé, la liste versionnée ne se contourne pas |
| 67 | rattachement écarté muté en `statut_http: 404` sous `acces: "consultee"` | échec — le schéma du manifeste borne 200-299, même sur une observation écartée |
| 68 | rattachement écarté muté en `url_finale: "file:///etc/passwd"` | échec — contrat HTTP(S) partagé sur toutes les URL observées, `z.string().url()` ne suffit pas |
| 69 | pièce présente dans le run mais référencée par aucun résultat du manifeste | échec — le run est l'inventaire EXACT des pièces, l'orpheline est nommée |
| 70 | deux résultats PARTAGEANT les mêmes pièces, anciennes pièces retirées du run, matrice alignée | échec — l'inventaire est une BIJECTION : chaque pièce appartient à un seul (n, champ), les deux n sont nommés |
| 71 | `capture.octets` supprimé d'un résultat du manifeste | échec — obligatoire au schéma, borné par la limite partagée (25 MiB) |
| 72 | `capture.octets` falsifié (taille + 1) | échec — égal à la taille réelle du fichier, jamais déclaratif |

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

## 7. Séquence d'exécution (après feu vert sur cette v4-ter)

1. **Contre-revue de cette v4-ter** — aucune exécution avant.
2. **Remplissage de `audit-pays.json`** : consultation réelle des 91 liens + pièces de
   rattachement, quatre axes, citations verbatim — **sans aucune mutation d'`objects.json`**.
   Le harnais d'exécution et le pas CI arrivent dans ce même livrable.
3. **Contre-revue des 18 décisions** sur pièces.
4. **Application des seules promotions approuvées** dans `objects.json` (projection canonique),
   contre-vérifiée par le critère 4, puis PR, CI, fusion sur décision de Philippe.
