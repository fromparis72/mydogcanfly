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
Le run CI de `main` sur ce SHA est à confirmer vert avant tout gel de préversion.

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

**Blocage matériel mesuré (28/08, 07:00 UTC)** : le conteneur de cette session ne porte
AUCUN identifiant Cloudflare (zéro variable `CLOUDFLARE_*`/`CF_*`) — `deploy:preview` ne
peut pas partir d'ici. Deux voies, au choix du propriétaire : (a) Philippe exécute
lui-même `npm run --silent deploy:preview -- --json` sur un poste authentifié (arbre
propre, HEAD = `3a65e55`), et me transmet le manifeste ; (b) un `CLOUDFLARE_API_TOKEN`
est ajouté à l'environnement de la session (portée Pages+Workers minimale) et je déroule
la séquence. Séquence, fondée sur l'outillage mesuré du dépôt :

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

- URL de préversion (versionnée, immuable) : `[EN ATTENTE]`
- ID de version Worker + tag `git-<sha>` : `[EN ATTENTE]`
- sha256 du manifeste : `[EN ATTENTE]`

## 5. Rapport SEO/GEO

`[EN ATTENTE]` du codage de la porte (section 3) et de son exécution en mode
production sur l'artefact de la RC. Le rapport listera chaque contrôle P1–P9,
V1–V3, G1–G5 avec son verdict et ses preuves.

## 6. Rapport navigateur

`[EN ATTENTE]` de la préversion immuable (section 4). Vérifications à consigner par
langue (en/fr/es/pt) : rendu des surfaces, console, réseau, santé Worker.

## 7. Défauts restants connus, assumés au lancement

| # | Défaut | Origine | Impact | Suite |
|---|---|---|---|---|
| 1 | ~~La fiche Alaska affiche « Hold ≤ 150 lb »~~ **CORRIGÉ** (tête `806064f`, PR #27) | Le seuil Pet Connect (CARGO) était transposé au bagage accompagné. Retiré de l'échelle et des détails, quatre langues ; garde `test-fiches-affirmations-retirees.mjs` : toute réinsertion rougit. | — | Clos, sous garde. |
| 2 | ~~Garuda « sans seuil »~~ **REQUALIFIÉ** (tête `806064f`, PR #27) | Le rapport antérieur « aucun chiffre inventé ne subsiste » était FAUX (2ᵉ passe Codex) : la fiche affirmait encore l'interdiction cabine, ≤ 32 kg et > 32 kg. Décision cabine → héritage non re-vérifié (« à confirmer ») ; seuils et refus catégorique retirés de la fiche, des guides en/fr et des données générées, sous la même garde. | La fiche est honnête : trois canaux « à confirmer », aucun fait non prouvé. | Reprise quand une page passager officielle lisible existera. |
| 3 | 79 dettes éditoriales scellées | Registre des contradictions éditoriales (`test-entity-pages-harness.mjs`) : l'éditorial d'époque contredit la décision canonique sur 79 canaux · 71 fiches ; la page rend toujours la pastille canonique, vérifiée bloc par bloc. | Aucun sur la décision affichée ; texte d'époque parfois daté. | Résorption progressive post-lancement, compte figé avancé par mouvements nommés. |
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
