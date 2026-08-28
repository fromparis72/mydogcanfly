# Dossier de lancement — mydogcanfly.com

**État : BROUILLON en construction (28/08/2026).** Ce dossier est le livrable du
chantier 5 du mandat de 48 h. Il est rédigé au fil de l'eau : chaque section porte
soit un **fait mesuré** (avec sa preuve), soit un **`[EN ATTENTE]`** explicite qui
nomme ce qui le débloquera. Rien ici n'autorise quoi que ce soit : la fusion des PR,
la promotion d'alias, le déploiement de production et toute soumission Search Console
attendent chacun un ordre explicite du propriétaire.

---

## 1. État des PR au 28/08/2026 (07:00 UTC) — LES DEUX FUSIONNÉES

| PR | Objet | Tête fusionnée | Verdict Codex | Fusion |
|---|---|---|---|---|
| #26 | Lot F clos : outil chaleur jamais construit, adresse morte partout, garde opposable | `6cf18b6` → squash `d817e41` | feu vert final | **fusionnée** sur ordre Philippe (« OK pour fusion »), CI de main verte (run 79) |
| #27 | RC — corrections de lancement (sources vérifiées, VA conditionnelle, fiches sans faits non prouvés, mention transporteur) | `4cb0417` (resync post-#26, réserve soldée en `dae5063`) → squash `3a65e55` | feu vert v2 + réserve soldée | **fusionnée** sur ordre Philippe (confirmation explicite pour la #27) ; CI de main sur `3a65e55` : `[EN COURS]` |

Historique CI de la PR #27 : trois pannes successives, chacune nommée dans le corps
de la PR et dans les messages de commit (sentinelle caisse corrigée à la dérivation ;
registre des contradictions 78 → 79 par mouvement nommé ; contre-épreuve muette par
reformatage — le format d'un fichier visé par une mutation est porteur).

- Base commune : `main` = `b500168` (première référence de fraîcheur China Eastern, PR #25).
- **Contre-revue Codex, 1ʳᵉ passe reçue le 28/08 (12:43)** : PR #26 corrigée (promesses
  fonctionnelles de `/tools/` alignées sur trois outils + contrôle de cardinalité, tête
  `6cf18b6`, jobs verts) ; PR #27 corrigée (P0 Alaska 150 lb, P0 Garuda toutes surfaces,
  P1 Smartwings review_due, garde `test-fiches-affirmations-retirees.mjs`, tête `806064f`).
  Selon la consigne Codex : #26 « pourra être revérifiée rapidement », #27 « devra être
  reconstruite et rejouée entièrement » — revérification `[EN ATTENTE]`.

## 2. SHA de la release candidate

**`3a65e556d477cad2aef9670dc2c3e38ade5155f3`** — `main` après les fusions #26 (`d817e41`,
CI verte, run 79) puis #27 (squash de `4cb0417`, les deux jobs verts sur la branche).
**CI de `main` sur ce SHA : VERTE** — run 81, conclusion success, les deux jobs :
https://github.com/fromparis72/mydogcanfly/actions/runs/33150628720 (28/08/2026, 07:12→07:27
UTC). La RC est consacrée : c'est ce SHA que la préversion immuable devra geler.

## 3. Porte SEO/GEO

- Conception livrée : `DOSSIER-PORTE-LANCEMENT.md`, branche `claude/porte-seo-geo`,
  tête `be8772c`. **Contre-revue Codex reçue (28/08)** : direction bonne, quatre points à
  corriger AVANT le code — (P0) l'invisibilité de la preview ne peut pas être promise avec
  `Disallow: /` + `noindex` (robots bloqué ⇒ noindex illisible ; Cloudflare Access ou promesse
  réduite) ; (P0) la porte doit sceller l'ARTEFACT exact (provenance de build, trois
  contre-épreuves, vérifier-puis-déployer atomique sans reconstruction, `--commit-hash`) ;
  (P0) l'absence de `_headers` ne prouve pas l'absence de `X-Robots-Tag` (transform rules) —
  le contrôle hors ligne conclut sur l'artefact, l'autorité finale est la réponse HTTP servie,
  contre-test post-déploiement sur TOUTES les URL du sitemap ; (P1) quatre contrats à rendre
  exécutables (porte-noindex-admis consommé réellement, P9 orchestré, P7 redirections
  dynamiques, P8 « texte visible » défini). Conception révisée `[EN COURS]` — **aucun code
  avant le feu vert Codex sur la conception révisée**.
- Après feu vert : `porte-lancement.mjs` + `porte-noindex-admis.json` + 8 contre-épreuves
  + câblage CI (mode preview sur le build existant ; second build en mode production).
- Rapport d'exécution de la porte : `[EN ATTENTE]` (dépend du codage post-feu-vert).
- Règle propriétaire en vigueur : **« Aucun déploiement si la porte d'indexabilité
  n'est pas intégralement verte. »**
- Outillage existant à articuler avec la porte : `npm run verify:index`
  (`verifier-indexation.mjs`), déjà appelé par `npm run release` avant tout déploiement.

## 4. Préversion finale immuable (chantier 4)

**DÉPLOYÉE ET VÉRIFIÉE (28/08/2026, ~09:12 UTC)** — voie (a) : Philippe a exécuté
`npm run --silent deploy:preview -- --json` depuis un clone frais de `main` (le blocage
matériel du conteneur — aucun identifiant Cloudflare — reste vrai et documenté plus bas).
Manifeste transmis, **statut `verified`, `failed_step: null`, les 7 étapes vraies** :

| champ | valeur |
|---|---|
| `git_sha` = `origin_main_sha` | `3a65e556d477cad2aef9670dc2c3e38ade5155f3` (la RC), arbre propre |
| version Worker | `f1de133d-0381-46c0-a589-ee9c761809c1` |
| URL Worker versionnée | `https://f1de133d-mydogcanfly-api-preview.fromparis.workers.dev` |
| santé Worker | double concordance : `worker_health_sha` = SHA RC, `worker_health_version_id` = version |
| projet · branche Pages | `mydogcanfly-v2-preview` · `review-3a65e556d477` |
| déploiement Pages | `c069856d-1dc6-47a7-a4fa-57102e98b952` |
| **URL de préversion IMMUABLE** | **`https://c069856d.mydogcanfly-v2-preview.pages.dev`** |
| alias de branche | `https://review-3a65e556d477.mydogcanfly-v2-preview.pages.dev` |
| `public_api_base` du bundle | l'URL Worker versionnée (jamais l'alias) |
| smoke | 200 · noindex présent · bundle épinglé sur l'URL versionnée |
| wrangler | 3.114.17 |
| alias Worker partagé | **NON modifié** (invariant tenu) |

Manifeste local : `.artifacts/previews/3a65e556…/manifest.json` sur le poste de Philippe
(copie `~/manifest-preview.json`) ; contenu intégral relayé en session le 28/08. Étape
suivante : le contre-test navigateur du § 6 sur l'URL immuable, puis — sur ordre
propriétaire uniquement — `npm run promote:preview-alias -- .artifacts/previews/3a65e556…/manifest.json`.
Observation consignée sans action : le projet Pages porte d'anciens déploiements
« Production main » (tête `922786e`, il y a 2 semaines) — l'état de la production Pages
sera re-vérifié par les quatre concordances du § 6 de la conception porte avant tout
déploiement. Séquence, fondée sur l'outillage mesuré du dépôt :

1. **Préflight** : arbre Git propre ET `HEAD == origin/main` — exigé sans dérogation
   par `deploy-preview.mjs` ; le SHA de la préversion est donc mécaniquement celui
   de la RC fusionnée.
2. `npm run --silent deploy:preview -- --json` : séquence vérifiée en 7 étapes
   (version Worker téléversée SANS toucher au trafic, tag `git-<sha>` à correspondance
   unique, santé `/v1/health` en double concordance sur l'URL VERSIONNÉE, build Pages
   épinglé sur cette URL, smoke : 200 + noindex + bundle portant l'URL versionnée,
   manifeste écrit dans `.artifacts/previews/<sha>/manifest.json`).
3. Contre-test navigateur sur la préversion, **quatre langues** : Flight Finder,
   fiches compagnies, Travel Hub, couvertures, mention « transporteur effectif » ;
   console sans erreur, réseau sain, `/v1/health` concordant. Compte rendu consigné
   en section 6.
4. **L'alias partagé n'est jamais promu par le déploiement** (invariant du script).
   Sa promotion (`npm run promote:preview-alias -- .artifacts/previews/<sha>/manifest.json`)
   exige le manifeste au statut `verified` et un **ordre explicite du propriétaire**.

- URL de préversion (versionnée, immuable) : **`https://c069856d.mydogcanfly-v2-preview.pages.dev`**
- ID de version Worker : `f1de133d-0381-46c0-a589-ee9c761809c1` (santé concordante sur `3a65e556`)
- sha256 du manifeste : `[EN ATTENTE]` (à relever sur le poste de Philippe : `shasum -a 256 ~/manifest-preview.json`)

## 5. Rapport SEO/GEO

`[EN ATTENTE]` du codage de la porte (section 3) et de son exécution en mode
production sur l'artefact de la RC. Le rapport listera chaque contrôle P1–P9,
V1–V3, G1–G5 avec son verdict et ses preuves.

## 6. Rapport navigateur

`[EN ATTENTE]` de la préversion immuable (section 4). Le rapport sera l'exécution, langue
par langue, du protocole ci-dessous — écrit à l'avance pour que le contre-test soit
reproductible et complet, pas improvisé.

### Protocole de contre-test navigateur (à dérouler sur l'URL VERSIONNÉE de la préversion)

**Préambule, une fois** :
- ouvrir l'URL versionnée du manifeste (jamais l'alias partagé) ; ouvrir les outils de
  développement (F12), onglets Console et Réseau, cocher « conserver le journal » ;
- vérifier `GET <worker versionné>/v1/health` → 200 et la version attendue du manifeste ;
- vérifier qu'une page au hasard porte `<meta name="robots" content="noindex, nofollow">`
  (une préversion qui ne le porte pas s'arrête là : défaut bloquant).

**Par langue — en (racine), /fr/, /es/, /pt/ — dérouler les six points, et noter par point
OK ou le défaut observé (page, texte, capture si utile)** :
1. **Accueil + Flight Finder** : la page rend sans zone vide ; lancer une recherche réelle
   (ex. CDG → JFK, carlin 8 kg, date d'été, « tous placements ») ; le résultat s'affiche
   avec ses pastilles ; la **mention « transporteur effectif »** est visible sous le
   résultat, dans la langue de la page ; l'appel réseau part vers le **Worker versionné**
   (pas l'alias) et répond 200.
2. **Fiche compagnie Virgin Australia** (`/airlines/virgin-australia/`) : la cabine rend
   « à confirmer » avec ses conditions (≤ 8 kg animal + sac) — pas « refusé », pas un oui
   sans condition ; la mention transporteur est présente sur la fiche.
3. **Fiches Alaska et Garuda** : Alaska sans aucun « 150 lb » (les tarifs 150 $ sont
   normaux) ; Garuda : cabine « à confirmer », aucun « 32 kg », aucun refus catégorique.
4. **Travel Hub** (`/travel-hub/`) : l'index rend ses rubriques ; ouvrir un guide au
   hasard : la couverture s'affiche (pas d'image cassée), le texte est dans la langue de
   la page.
5. **Outils** (`/tools/`) : la page annonce TROIS outils, aucune promesse chaleur ;
   `/tools/is-it-too-hot-for-my-dog/` répond **404** (c'est le contrat) ; le calculateur
   de caisse rend et répond à une saisie.
6. **Console + Réseau, bilan de la langue** : zéro erreur console (les avertissements
   sont notés mais non bloquants) ; aucune requête vers un domaine inattendu (uniquement
   la préversion elle-même et le Worker versionné) ; aucune 4xx/5xx hors le 404 voulu du
   point 5.

**Clôture, une fois** : re-vérifier `/v1/health` (même version qu'au préambule — le
déploiement n'a pas bougé sous le test) ; confirmer que l'**alias partagé** et la
**production** n'ont pas été touchés ; consigner ici date, heure, navigateur, et le
verdict par langue (4 × 6 points + préambule + clôture).

## 7. Défauts restants connus, assumés au lancement

| # | Défaut | Origine | Impact | Suite |
|---|---|---|---|---|
| 1 | ~~La fiche Alaska affiche « Hold ≤ 150 lb »~~ **CORRIGÉ** (tête `806064f`, PR #27) | Le seuil Pet Connect (CARGO) était transposé au bagage accompagné. Retiré de l'échelle et des détails, quatre langues ; garde `test-fiches-affirmations-retirees.mjs` : toute réinsertion rougit. | — | Clos, sous garde. |
| 2 | ~~Garuda « sans seuil »~~ **REQUALIFIÉ** (tête `806064f`, PR #27) | Le rapport antérieur « aucun chiffre inventé ne subsiste » était FAUX (2ᵉ passe Codex) : la fiche affirmait encore l'interdiction cabine, ≤ 32 kg et > 32 kg. Décision cabine → héritage non re-vérifié (« à confirmer ») ; seuils et refus catégorique retirés de la fiche, des guides en/fr et des données générées, sous la même garde. | La fiche est honnête : trois canaux « à confirmer », aucun fait non prouvé. | Reprise quand une page passager officielle lisible existera. |
| 3 | 79 dettes éditoriales scellées | Registre des contradictions éditoriales (`test-entity-pages-harness.mjs`) : l'éditorial d'époque contredit la décision canonique sur 79 canaux · 71 fiches ; la page rend toujours la pastille canonique, vérifiée bloc par bloc. | Aucun sur la décision affichée ; texte d'époque parfois daté. | Résorption progressive post-lancement, compte figé avancé par mouvements nommés. |
| — | ~~« Les 62 anciennes URL `*-dog-policy` répondent 404 »~~ **CONSTAT FAUX, corrigé (PR #28)** | Ma mesure s'était arrêtée à `_redirects` (86 règles) sans ouvrir `_worker.js` ni `_routes.json`, deux fichiers du même répertoire : le Worker Pages redirige les 62/62 en 301 vers `/airlines/<slug>/` (contrôle HTTP de contre-revue). L'arbitrage « faut-il ajouter 62 redirections ? » est DISSOUS — elles existent et fonctionnent. | Aucun : le routage réel est meilleur que ce que je rapportais. | La conception porte v4 intègre la leçon : P7 exerce `_routes.json` + `_worker.js` avec une attente indépendante. |
| 4 | Fraîcheur : une seule référence promue | Registre scellé de 1 503 entrées, une référence humainement confirmée (China Eastern, PR #25). Les 81 URL inaccessibles au contrôleur et les états `sans_reference` sont normaux à ce stade (contrat lot B). | Le contrôle hebdomadaire (lundi 05:17 UTC) signale sans bloquer. | Promotion de références au fil des PR humaines, une à une. |

## 8. Procédure de production (PROJET — exécution sur ordre explicite uniquement)

Fondée sur `npm run release` tel qu'il existe dans `package.json` :

1. Pré-requis : RC fusionnée sur `main`, CI de `main` verte, porte SEO/GEO
   **intégralement verte** en mode production, préversion immuable contre-testée,
   ordre écrit du propriétaire.
2. `npm run release` enchaîne, dans l'ordre et en échouant franchement :
   `build:prod` (build production épinglé) → `verify:index` (vérification
   d'indexabilité) → `wrangler pages deploy packages/ui/dist
   --project-name=mydogcanfly-v2-preview --branch=main`.
3. Worker de production : `[EN ATTENTE]` — la promotion du Worker (alias/production)
   est distincte du déploiement Pages et suit `promote-preview-alias.mjs`
   (manifeste `verified`, tag unique, santé en double concordance avant ET après
   bascule du trafic).
4. Après mise en ligne : contrôles post-déploiement (santé, échantillon de pages en
   quatre langues, robots/sitemaps servis) consignés ici.
5. Search Console : **aucune soumission sans ordre explicite du propriétaire.**

## 9. Procédure de rollback (PROJET)

1. **Pages** : redéployer le commit précédent connu-bon (`git checkout <sha-precedent>`
   puis la même commande `wrangler pages deploy` du script `release`) — Cloudflare
   Pages sert la dernière publication du projet ; publier l'artefact précédent revient
   à l'état antérieur. Le SHA connu-bon est consigné en section 2 au moment du
   déploiement.
2. **Worker** : re-promouvoir la version précédente par son manifeste
   (`npm run promote:preview-alias -- .artifacts/previews/<sha-precedent>/manifest.json`) —
   les versions Worker sont immuables et taguées `git-<sha>` ; la promotion re-vérifie
   la santé avant et après bascule. Ne jamais promouvoir un UUID nu.
3. **Ordre** : un rollback touche la production — il suit la même règle que tout
   déploiement : ordre explicite du propriétaire, sauf urgence qualifiée par lui
   à l'avance (aucune délégation de ce type n'est en vigueur).

## 10. Interdits en vigueur (rappel opposable)

- Ne jamais supprimer la branche `t0b3-source-fige`.
- Aucune redirection de `/tools/is-it-too-hot-for-my-dog/` (le 404 franc est le contrat, PR #26).
- Aucun contenu SEO rédactionnel ; affiliation hôtels hors périmètre.
- Aucune fusion, promotion d'alias, déploiement ou soumission Search Console sans
  ordre explicite du propriétaire, chantier par chantier.
