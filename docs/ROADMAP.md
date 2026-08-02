# MyDogCanFly — Roadmap / Backlog

> Mis à jour le 30 juillet 2026 (session commencée le 29). Vérifié contre l'état réel du
> dépôt, pas contre la mémoire.
> Le rapport d'audit associé : `RAPPORT-COHERENCE.md`. L'étude des fiches pays : `ETUDE-PAGES-PAYS.md`.

---

## 0. En attente de toi — rien ne peut avancer sans une décision

| Sujet | Ce qui bloque |
|---|---|
| **Pages commerciales** (traceurs GPS, anti-chaleur, transporteurs IPATA, assurance) | Tu as gelé le sujet pour ne pas polluer le maillage. À rouvrir quand tu voudras monétiser. |
| **`hero.intro` des fiches pays** | 7,1 % du poids de chaque fiche, redit le sommaire. Réécriture de 140 × 3 textes — gros gain, gros effort. |
| **Langues supplémentaires** : allemand, italien, polonais, portugais brésilien | Validées par toi, jamais commencées. Aucune entrée dans `i18n.ts`. Le chinois a été retiré à ta demande. |

---

## 1. Prêt à déployer — dans le code, pas encore en ligne

Tout ce qui suit est écrit, construit et vérifié ; il ne manque que la commande de déploiement.

- FAQ : 91 fiches annonçaient comme exigées des pièces facultatives → corrigé
- 228 étiquettes d'origine fausses retirées, titre de bloc adaptatif, champ `tag` au schéma
- Bouton email immunisé contre l'email-protection Cloudflare
- Grammaire FR des 140 fiches (« Mexique : trouver un vol », « Aéroports — Mexique »)
- Carte « Retours de voyageurs » vide retirée de 420 pages
- Travel Hub : vraie page « en construction »
- 7 pages d'index : titres mots-clés, suffixe de marque retiré
- Bible : outils internes dans le même onglet
- Précisions données KR / SV / GE
- `/airports/pet-relief/` ↔ `/tools/pet-relief/` reliés dans les deux sens
- Pied de page unifié `PageActions` sur les quatre familles de pages
- **Bible : 420 liens morts corrigés** — le lien « Fiche pays » pointait vers
  `/countries/greece/` au lieu de `/countries/gr/`, sur 140 pays × 3 langues
- **Routes AeroDataBox fusionnées** — 6 345 directes + 1 721 saisonnières, 78/78 compagnies
- **Coins pipi : 28 aéroports américains enrichis**, 167 emplacements précis
- **Coins pipi : 76 aéroports mondiaux vérifiés** (30 juillet) — 12 avec zone, 53 sans zone
  de manière sourcée, 11 non publiés. Nouveau champ `assistance_only` : Keflavík, Sydney et
  Tel-Aviv ont une zone réservée aux chiens d'assistance, inaccessible à un chien de compagnie.
  **142 aéroports documentés sur 249, dont 70 avec emplacements précis.**
  Meilleures zones hors États-Unis : Bogotá (9 zones), Quito (3), Panama et San José
  (une chacune, après les contrôles). L'Europe et l'Asie sont quasi désertes.
  Onze faux sites « officiels » et six synthèses de moteur inventées ont été écartés.
- Verdict distingué « zone relevée » / « imposée par la loi, emplacement non publié »
- Titre FR de l'outil coin pipi : « Coin pipi pour chien en aéroport — Toilettes pour chiens »
- `audit-coherence.mjs` : nouveau contrôle des liens construits en JavaScript
- **Maillage A — race → pays** : les badges climatiques des fiches races sont des liens
  vers les fiches pays. 2 382 liens, 516 fiches sur 516, aucune cible cassée. Au passage,
  la fiche race déclare enfin sa propre race comme contexte de session — sans quoi ses
  liens `data-carry` ne transportaient rien pour un visiteur venu de Google.
- **Maillage B — pays → compagnie** : nouveau bloc « Compagnies qui desservent ce pays
  avec un chien », qui remplace « Compagnies nationales ». 1 668 liens, 282 fiches sur
  420, aucune cible cassée ; **0,6 → 4,0 lien par fiche**. Les nationales restent en tête,
  drapeau à l'appui. Hongrie et Islande perdent la leur (Wizz Air et Icelandair
  n'acceptent pas le chien) et gagnent six compagnies qui l'acceptent.
  Détail et réserves : `ANALYSE-MAILLAGE.md` §5.
- **Maillage C — compagnie → race** : bloc « Races concernées par cette politique » sur les
  fiches compagnies. 2 883 liens, 93 fiches sur 234 (31 compagnies × 3 langues).
- **⚠️ Correctif majeur au passage : `brachy_allowed` était absent du schéma Zod** alors que
  les données le renseignaient 25 fois. Zod l'effaçait à l'ingestion, si bien que les
  25 compagnies qui refusent explicitement les races à museau court en soute étaient
  affichées « ✅ Accepté en soute » sur les **93 fiches de races brachycéphales**. Le verdict
  soute de ces races passe de « Restrictions — à confirmer » (orange) à « Souvent refusé »
  (rouge) : **2 325 lignes de verdict corrigées**. Champ ajouté à `PlacementPolicy`.
- **Maillage D — aéroport → compagnie** : bloc « Compagnies acceptant le chien à &lt;IATA&gt; »
  dans le cluster géographique. 5 352 liens, 738 fiches sur 750, 7,1 liens par fiche ; hubs
  marqués, canal affiché. Seuls Kyiv, Istanbul-Sabiha et Bangkok-Don Mueang n'ont pas le bloc.
- **Maillage E — abandonné.** Le menu réduit (10 plus consultés + lien vers l'index) a été
  essayé puis **annulé à ta demande** : mettre en avant les pages les plus consultées est
  contre-productif, et le menu perd sa raison d'être — atteindre n'importe quelle fiche depuis
  n'importe quelle page. Le code est revenu aux listes complètes et au filtre par panneau.
  Le gain auquel on renonce est chiffré dans `ANALYSE-MAILLAGE.md` §5 (fiche Allemagne :
  166,9 Ko contre 68,6 Ko ; ~280 Mo d'HTML sur le site contre 94 Mo). Le panneau « aéroports »,
  calculé à chaque rendu sans jamais être affiché, n'a pas été reconstitué.
- **Maillage F — bloc « Par où commencent nos lecteurs » sur l'accueil** : 8 destinations,
  6 compagnies, 6 races, 6 aéroports en HTML statique + 4 liens d'index. **L'accueil passe de
  7 à 30 liens statiques** et cesse d'être un cul-de-sac pour les moteurs. **Placé juste avant
  la FAQ** et non sous le Finder : sous le Finder, 26 liens détournaient le visiteur de l'outil.
- **Nouveau : `packages/ui/src/data/popular.generated.json`** + `build-popular.mjs`. Le
  classement du bloc F vient de la demande mesurée (export Search Console), pas d'un choix
  éditorial. **À régénérer à chaque nouvel export** :
  `node packages/knowledge/scripts/build-popular.mjs <chemin>/Pages.csv`. Limites inscrites
  dans le fichier : photographie à 28 jours, signal faible sur les races (453 impressions) et
  les aéroports (169).
- **Le maillage ne dépend plus des menus** : parcours en largeur depuis l'accueil, header et
  footer exclus → **140/140 pays, 78/78 compagnies, 172/172 races, 250/250 aéroports** en 1 à
  3 clics, dans les trois langues. **Zéro page orpheline** (13 auparavant). Mesuré menus exclus,
  donc valable avec le menu complet rétabli.
- **A, B, C, D et F appliquées ; E abandonnée.**

### 🔴 La démo Tokyo dans les résultats du Finder — corrigé le 30/07/2026

**Signalé par un visiteur** : « du Tokyo qui apparaît sans raison dans les résultats ».
Diagnostic : ce n'était pas un défaut d'API isolé mais **une chaîne de trois pièges**.

1. **`GET /v1/finder` renvoyait une démo à toute requête** — un rapport complet et crédible
   « CDG → Tokyo, Golden Retriever », daté de l'instant, pour un voyage que personne n'avait
   demandé (`DEFAULT_FINDER_INPUT` dans le Worker).
2. **`fetchReport` retombait silencieusement sur ce GET** dès que le POST n'aboutissait pas :
   `if (res.ok) return …` sans `else`, plus un `catch` vide. Réseau coupé, requête bloquée,
   5xx, démarrage à froid : le visiteur recevait le rapport sur le Japon **à la place du
   sien, sans aucun avertissement**.
3. **L'endpoint prérendu `/v1/finder` du site statique servait la même démo.** En
   développement, POST sur une route prérendue n'existe pas : le Finder retombait donc
   *toujours* sur cette démo. Tout paraissait fonctionner alors que rien n'était calculé —
   c'est ainsi que le défaut a survécu.

**Ce qui a été fait :**

- **Worker** : `GET` lit désormais la query string
  (`?origin=CDG&destination=NRT&weight_kg=8&breed=pug&date=…&placement=…&locale=…`, codes IATA
  ou identifiants complets acceptés) et renvoie **400** s'il n'y a rien à lire, si un paramètre
  manque, ou si un aéroport / une race est inconnu — avec le mode d'emploi dans la réponse.
  `DEFAULT_FINDER_INPUT` est supprimé. Les liens profonds partageables deviennent possibles
  au passage.
- **Front** : plus aucun repli. Une seule nouvelle tentative (démarrage à froid, micro-coupure),
  puis un **message d'erreur explicite en trois langues** — nouvelles clés
  `finder.error_title` / `finder.error_body`. Garde-fou de forme en plus : un corps sans
  `verdict` est refusé même en HTTP 200.
- **Endpoint statique** : rendu inerte. Il renvoie un refus explicite sans `verdict`, donc
  aucune couche du site ne peut plus présenter un exemple comme une réponse.
- **`npm run smoke`** : quatre contrôles ajoutés — GET nu → 400 `missing_parameters`, GET
  incomplet → 400, aéroport inconnu → 400 `unknown_airport`, GET complet → **même verdict que
  le POST équivalent**. Tous passent.

**⚠️ Ce correctif touche les deux Workers** : il faut redéployer `mydogcanfly-api` (la
correction du GET vit là) **et** les pages (le nouveau bundle du Finder).

**Vérifié en production le 30/07, par observation et non par déduction** : recherche réelle
aboutie sur les deux hôtes (rapports horodatés à la seconde) ; `GET /v1/finder` nu → 400 ;
et surtout **test Wi-Fi coupé → encadré rouge, aucun rapport sur le Japon**. C'est ce dernier
test qui ferme le sujet : c'est exactement le scénario qui affichait Tokyo.

**La cause racine, trouvée en testant : `www`.** Les routes Worker de Cloudflare sont liées à
un **hôte**, pas à un domaine. La route est `mydogcanfly.com/v1/*` ; elle ne couvre pas
`www.mydogcanfly.com/v1/*`. Vérifié : sur `www`, `/v1/health` ne répond rien et `/v1/finder`
renvoie un fichier statique (`application/octet-stream`). Donc **tout visiteur arrivé par
`www` voyait son POST échouer en 405 et recevait le snapshot « CDG → Tokyo » — à chaque
recherche, sans exception.** Le site répondait sur deux hôtes ; un seul avait une API.

Le référencement, lui, était protégé : `canonical` et `hreflang` pointent tous vers l'apex.

À faire, par ordre d'importance :

1. ✅ **`www` → apex en 301 — fait le 30/07/2026.** Page Rule `www.mydogcanfly.com/*` →
   `https://mydogcanfly.com/$1`, Forwarding URL 301. Vérifié :
   `www.mydogcanfly.com/fr/countries/de/` renvoie `301` + `location: https://mydogcanfly.com/fr/countries/de/`.
   Le `$1` préserve chemin et query string. Impossible à faire dans `_worker.js` :
   `_routes.json` exclut `/fr/*`, `/es/*` et `/v1/*` du Worker Pages, donc le code ne voit
   jamais ces requêtes — il fallait une règle de zone.
   *Interaction utile* : les redirections de zone s'appliquent avant les Workers, donc la
   route `www/v1/*` devient un simple filet. Et un POST parti d'un vieil onglet `www` sera
   redirigé en 301, converti en GET par le navigateur, donc reçu sans paramètres — où il
   récolte un `400` et le message d'erreur honnête, là où il récoltait Tokyo avant ce matin.
2. **Seconde route Worker `www.mydogcanfly.com/v1/*`** — ajoutée dans `wrangler.toml`.
   Ceinture de sécurité, à déployer avec `--env production`.
3. **Attention au mode de déploiement** : la configuration racine de `wrangler.toml` ne
   déclare **aucune route** (seul `[env.production]` en a). Un `npx wrangler deploy` sans
   `--env production` publie donc le Worker sans route de zone. Toujours utiliser
   `npx wrangler deploy --env production`.
4. **Les déploiements de prévisualisation n'ont pas d'API** : sur `*.pages.dev`, la route de
   zone ne s'applique pas non plus, donc le Finder ne peut pas y être testé. Remède :
   `PUBLIC_API_BASE=https://mydogcanfly-api.fromparis.workers.dev` pour les builds de
   prévisualisation (le Worker envoie déjà les en-têtes CORS `*`).

**Leçon** : le repli silencieux n'a pas seulement affiché une fausse réponse, il a **caché une
panne totale de l'API sur un hôte entier** pendant tout ce temps. C'est le message d'erreur
honnête qui l'a révélée en dix minutes.

### La mémoire de race ne pré-remplit plus rien d'elle-même — 30/07/2026

Deux surprises constatées en testant, sur le même mécanisme : ouvrir la fiche du Jack Russell
suffisait à voir « Jack Russell, 7 kg » pré-rempli au retour sur l'accueil, et un
« Golden Retriever, 32 kg » resté en mémoire sur l'hôte `www` s'affichait sur une page
d'entrée sans que rien ne l'explique.

Cause : `mdcfCtx.breed` mélangeait deux choses très différentes — un `?breed=` dans l'URL
(le visiteur vient de cliquer un lien à propos d'une race : intention explicite) et une valeur
mémorisée plus tôt dans la session (intention supposée). Le risque n'est pas cosmétique : une
race pré-remplie que le visiteur ne remarque pas produit une réponse juste **pour un autre
chien que le sien** — et sur le calculateur de caisse, un refus à l'embarquement.

**Décision (toi, 30/07)** : pré-remplissage **uniquement depuis l'URL**. Appliqué aux quatre
consommateurs : `FlightFinder`, `DestinationFinder`, `CrateCalculator` (race **et** compagnie)
et `HeatCalculator`. L'écriture en mémoire reste : choisir une race dans un outil la transmet
aux liens marqués `data-carry`, qui écrivent le paramètre dans l'URL — l'intention redevient
donc visible dans la barre d'adresse. Aucune fonction perdue : le deep-link `?breed=` était
déjà géré partout.

Corollaire, même journée : **une fiche race n'inscrit plus sa race en mémoire de session.**
Le contexte voyage avec le clic sur un lien d'entonnoir de la fiche, pas avec sa simple
lecture — et les drapeaux climatiques ne le transmettent pas du tout (consulter les formalités
d'un pays ne désigne pas le chien du visiteur).

```
cd ~/Documents/GitHub/mydogcanfly
PUBLIC_SITE_ENV=production npm run build && npm run audit
npx wrangler pages deploy packages/ui/dist --project-name=mydogcanfly-v2-preview --branch=main --commit-dirty=true
```

**Correction du 29/07** : contrairement à ce que je répétais, l'API Worker **est bien
déployée** (`https://mydogcanfly.com/v1/health` répond) et **elle sert les routes
fusionnées** — vérifié en comparant les 19 drapeaux `direct` d'une réponse de production
aux données actuelles : 19/19 concordent. Rien à redéployer de ce côté.

---

## 2. Défauts connus, non corrigés

| Sujet | Détail |
|---|---|
| **Dimensions cabine** | Aucun champ structuré dans `airlines.ts`. Le voyageur ne peut pas comparer les sacs acceptés — c'est la question la plus concrète qu'il se pose. |
| **Soute inconnue** | Air Tahiti Nui, Qantas, Virgin Australia : politique soute non documentée. |
| **6 liens morts** | Sur `/404/` et `/lab/roundtrip/`, pages noindex. Invisibles de Google. |
| ~~**`GET /v1/finder` ignore ses paramètres**~~ | **Corrigé le 30/07/2026.** Voir §1 : c'était bien plus grave qu'un défaut d'API — la démo Tokyo s'affichait dans les résultats de vrais visiteurs. |
| ~~**Lien affilié fictif servi en production**~~ | **Corrigé le 30/07/2026.** `partner_petassure` est repassé en `status: placeholder`, ses deux URL d'exemple supprimées (`track.example-affiliate.com` et `example-petinsurance.com`). Il sort désormais comme les autres : `sponsored: false`, `url: ""`. Le test de fumée n'exige plus « un partenaire actif avec une URL » — cette assertion validait le lien fictif — mais l'invariant **sponsorisé ⇔ URL présente**, plus un contrôle explicite qu'aucune URL ne contient « example ». |
| **Séquence « Dans quel ordre, et quand »** | Certains items ne sont pas des démarches (« Chiots / âge minimum »). Tri éditorial fiche par fiche, non automatisable. |
| **Français fautif sur 28 emplacements de coins pipi** | **Dette acceptée le 30/07.** Mesuré : **28 emplacements sur 243**, répartis sur **14 aéroports** — les plus touchés sont PHL (5), PHX (4), puis MIA, DCA et MCO (3 chacun). Symptômes : articles manquants (« attenant à porte A34 »), contractions ratées (« à l'extérieur de le zone »), ordre nom/adjectif inversé. **L'information est juste, la langue est bancale.** Cause : les emplacements américains sont traduits par table de vocabulaire dans `add-pet-relief-locations.mjs` — une substitution mot à mot ne produit pas du bon français sur des phrases construites. Les emplacements mondiaux (`add-pet-relief-world.mjs`) sont rédigés directement en FR et ES, donc corrects. **Correctif** : écrire à la main les 28 chaînes FR et ES fautives dans le script, sans passer par la table. Travail borné, sans recherche. |

---

## 3. Chantiers de fond

- **Étiquettes `origin` nommées une par une** — le champ `tag` existe désormais ; 46 fiches
  gagneraient à dire « Groupe 2 », « UEEA », « Chien accompagné » plutôt que rien.
- **Pages About / Méthodologie** (E-E-A-T) — la page About fait 1 282 mots, correcte ;
  une page Méthodologie manque toujours.
- **Decap CMS** pour le Travel Hub — à ta demande explicite, jamais commencé.
- **Page « Les 5 erreurs qui font refuser ton chien à l'embarquement »** — seul reliquat
  utile des guides abandonnés.
- **Vet Finder** — outil jamais commencé.
- ~~**Press kit**~~ → **fait le 30/07/2026** : page `/presskit/` en trois langues.
  - **L'URL est `/presskit/`, pas `/press/`** : elle est imprimée sur la plaquette de presse
    diffusée, donc c'est le site qui s'aligne sur le papier. Le Worker redirige en 301 neuf
    alias vers elle (`/press`, `/press-kit`, `/media-kit`, `/presse`, `/dossier-presse`,
    `/dossier-de-presse`, `/prensa`, `/dosier-prensa`, `/dosier-de-prensa`), chacun portant la
    langue qu'il sous-entend — « /presse » mène à `/fr/presskit/`. Un préfixe explicite dans
    l'URL l'emporte toujours.
  - **Sélecteur de langue en tête de page** : l'URL imprimée étant unique, un journaliste
    français ou espagnol atterrit forcément sur la version anglaise. La pastille du gabarit,
    en haut à droite, ne suffit pas pour quelqu'un qui vient du papier.
  - **La page est écrite en Astro, pas servie depuis l'export de l'outil de design.** Les deux
    usages sont séparés : la page pour être trouvée et lue, les documents pour être emportés.
  - **Les trois dossiers publiés sont les versions `.dc.html` corrigées** (Press Book EN,
    Plaquette FR, Dosier ES), avec `support.js`, `doc-page.js` et le dossier `assets/`
    (14 Mo, partagé par les trois). Total `public/presskit/` : 17 Mo.
    *Erreur de ma part corrigée le 30/07* : j'avais affirmé que `support.js` était absent de
    l'archive et que ces fichiers étaient impubliables. Il y était, avec deux autres scripts —
    ma liste de fichiers était tronquée et je n'ai pas vérifié avant d'affirmer. Les exports
    « autonomes » de 10,3 Mo, eux, étaient les versions **non corrigées** : retirés.
  - Les trois documents sont patchés à la copie : `lang`, `<title>` propre et
    `robots: noindex, nofollow`. Sans quoi Google les indexerait comme des pages du site
    (doublon de `/presskit/`) et le journaliste lirait une URL nue dans son onglet.
  - **Un lien de téléchargement n'est rendu que si le fichier existe** (`existsSync` au build).
    Sans ce garde-fou, la page annoncerait un dossier absent — le pire défaut possible sur une
    page destinée à des journalistes.
  - **Manquent encore les PDF** : `press-kit-{en,fr,es}.pdf` à déposer dans
    `packages/ui/public/presskit/`. Les lignes « Télécharger le PDF » apparaîtront d'elles-mêmes.
  - **Les présentations (decks) ne sont pas publiées** : celles de l'archive sont les versions
    non corrigées. `deck-stage.js` n'a donc pas été copié.
  - **Les trois PDF sont générés ici**, pas exportés depuis l'outil de design : Chromium
    installé dans le bac à sable sans droits administrateur (la bibliothèque `libXdamage1`
    manquante a été récupérée en `.deb` et extraite localement), rendu A4 paysage après
    attente du chargement des polices et des composants `<doc-page>`, contrôle de 12 sections
    et de zéro image manquante, puis compression Ghostscript `/printer` : **10,4 Mo → 3,6 Mo**,
    rendus indiscernables à l'œil. Reproductible à chaque nouvelle version des documents.
  - **Origine IA déclarée** : le film de lancement et l'illustration de la page sont
    intégralement générés par IA. C'est écrit, en trois langues, sur le bloc vidéo et sur la
    ligne de téléchargement du visuel. Le mot « tournée / shot / rodada » a été retiré :
    il affirmait un tournage qui n'a pas eu lieu. Beaucoup de rédactions ont une règle sur le
    sujet, et l'apprendre après publication coûterait plus cher que de l'annoncer.
  - **Chiffres de communication : sujet clos.** Les arrondis des dossiers et de l'accueil sont
    un choix éditorial assumé de Philippe (30/07/2026). Signalé, arbitré, refermé à sa demande
    expresse. **Ne pas rouvrir.** La page `/presskit/` n'avance d'elle-même aucun chiffre ; les
    décomptes exacts restent lisibles sur les pages d'index.
  - **Pack de logos** : `mydogcanfly-logos.zip` (1,2 Mo) — 5 PNG en vraie transparence (canal
    alpha vérifié), logo complet 1096×976, bandeau 997×165, plus les variantes fond blanc et
    une note d'usage trilingue avec les couleurs de marque. **Pas de version vectorielle** : le
    SVG fourni n'est qu'un PNG encapsulé (1 `<image>`, 0 `<path>`), il n'apporterait rien — dit
    tel quel dans la note plutôt que présenté comme un vectoriel.
- **Glossaire** — jamais commencé.
- ~~**Rétroplanning public**~~ — **abandonné le 29/07** : doublon avec les fiches pays et la
  Bible. L'outil `timeline` reste en place, `noindex`, comme réserve technique. Décision,
  pas dette.

---

## 4. Décisions actées — ne pas rouvrir sans raison neuve

- **Guides compagnies** (152 brouillons) — **abandonnés le 29/07**, mesure à l'appui :
  sur 34 736 mots, 48 % redisent la fiche, 47 % sont du contexte, **4 % seulement sont
  neufs** (1 420 mots pour 76 compagnies, ~19 mots chacune). Le coût — moteur `{{fait}}`
  pour 1 077 balises, traduction espagnole, risque de cannibalisation 1:1 avec les
  fiches — était sans commune mesure avec l'apport. Les fichiers restent dans
  `content/hub/drafts/` à titre d'archive.
  *Seul reliquat exploitable* : les « erreurs fréquentes » sont génériques et non propres
  aux compagnies (caisse non conforme dans 44 guides sur 76, formalités oubliées dans 23,
  réservation tardive dans 14) — matière pour **une** page du Travel Hub, pas 76.
- **Rétroplanning / outil `timeline`** — doublon assumé avec les fiches pays et la Bible.
  Reste `noindex`.
- **Pages commerciales** — gelées pour ne pas polluer le maillage.

---

## 5. Fait, retiré du backlog

Ces entrées traînaient dans l'ancienne roadmap alors qu'elles étaient livrées :

- ~~i18n : détection de langue + sélecteur~~ → Worker en production, `hreflang` + `x-default` posés
- ~~Déploiement du lot final de pays~~ → 1 986 pages en ligne
- ~~Airport Pet Relief Finder~~ → `/tools/pet-relief/` + liste `/airports/pet-relief/`
- ~~OpenGraph + JSON-LD Organization/WebSite~~ → présents dans `Base.astro`
- ~~Page identité France~~ → mise de côté par toi, sans regret exprimé depuis
- ~~Base de routes~~ → **rafraîchie par AeroDataBox le 29/07** : 6 345 directes + 1 721 saisonnières,
  78/78 compagnies. Les 5 socles (AF/KL/LH/SN/U2) ont enfin une saisonnalité mesurée
  (0 → 190 arêtes saisonnières). Détail : `tools/routes-refresh/RECEPTION-2026-07-29.md`
- ~~Races interdites~~ → Tosa, Pit Bull, American Bully XL + 6 règles pays
- ~~URLs héritées~~ → 99 redirections 301 + 48 réponses 410
- ~~Blacklist Avast / Norton / Fortinet~~ → résolu
