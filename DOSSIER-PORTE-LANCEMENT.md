# Porte de lancement SEO/GEO — dossier de conception

**Version 6 — 28/08/2026, sur `main` `52fe123` (branche resynchronisée — P1 de la 5ᵉ
contre-revue). Conception avant code : aucun harnais n'est écrit tant que cette conception
révisée n'est pas contre-revue.**

**Ce que la v6 corrige (5ᵉ contre-revue Codex du 28/08/2026), nommé :**
1. **P0-1 — la contre-épreuve 17 bis ne pouvait pas mordre.** Retirer une URL d'un sitemap
   enfant RÉDUIT l'ensemble parcouru : toutes les URL restantes répondent encore 200, et
   P3 ne vérifiait que « URL listée → fichier existant », jamais l'inverse. P3 exige
   désormais l'ÉGALITÉ EXACTE entre l'ensemble des pages HTML publiques et indexables du
   dist et l'union dédupliquée des quatre sitemaps enfants — une page publique absente des
   sitemaps rougit, une URL surnuméraire rougit. 17 bis peut alors réellement échouer.
2. **P0-2 — le scellé ne couvrait pas les trois pièces EXACTES du routage.** Le registre
   couvrait les tables extraites, pas l'objet exact de `_routes.json` ni le code dynamique
   du Worker (`heatRaceTarget()`, `presskitTarget()`) : une exclusion de `_routes.json`
   troquée contre une autre non exercée par les sondes, ou une logique dynamique modifiée
   sans toucher aux tables, passaient. Le scellé couvre désormais TROIS niveaux : la
   représentation canonique exacte de `_routes.json`, le registre canonique des règles
   parsées (diagnostics lisibles, diff approuvable), et l'empreinte SHA-256 de chacun des
   trois fichiers du dist (`_routes.json`, `_redirects`, `_worker.js`) — les empreintes
   garantissent qu'aucune logique ne change hors rescellement nommé. Contre-épreuves 19
   et 20.
3. **P1 — exécution des mutations** : un Worker muté doit être importé dans un processus
   NEUF ou via une URL ESM unique (suffixe de cache-busting), sinon le cache de modules
   ferait exercer l'ancienne copie pendant la contre-épreuve — consigné en tête du § 5.
   Et la branche est resynchronisée sur le `main` réel `52fe123`.

**Ce que la v5 corrige (4ᵉ contre-revue Codex du 28/08/2026, après sa contre-vérification
de la préversion — 2 536 URL en 200 + noindex), nommé :**
1. **P7 bis jugeait les SOURCES, pas l'artefact.** La bijection de la v4 comparait
   `content/posts/*.md` (sources du dépôt) au `packages/ui/public/_worker.js` (source du
   dépôt) — or la porte scelle et juge un `dist/` : ses objets sont `dist/_worker.js`,
   `dist/_routes.json` et `dist/_redirects` (présents dans l'artefact, couverts par
   l'empreinte de provenance — mesuré). Une porte qui lit hors de l'artefact qu'elle
   scelle rejuge autre chose que ce qui sera publié. Corrigé : P7 bis ne lit QUE le dist ;
   la cohérence sources ↔ registre vit dans une garde de test:unit, séparée et nommée.
2. **Le parcours des sitemaps s'arrêtait à l'INDEX.** `dist/sitemap.xml` est un index à
   4 entrées (mesuré) : un parcours de ses `<loc>` ne visite que les 4 sitemaps de langue,
   jamais les 2 536 URL de pages. Corrigé : la porte parse l'index, PUIS chaque sitemap
   enfant, et fait passer TOUTES les URL de pages par le routage reproduit.
3. **Le « dénombrement par famille » était un agrégat, pas un registre.** Un décompte
   stable peut couvrir une règle remplacée par une autre — la leçon du lot B, encore.
   Corrigé : l'attente devient un REGISTRE EXACT versionné (`porte-routage-scelle.json`) —
   chaque règle sérialisée canoniquement avec sa famille, empreintes SHA-256 globale et
   par famille, comparaison BIDIRECTIONNELLE avec les tables parsées du `dist/_worker.js`
   et du `dist/_redirects` ; les décomptes en dérivent, ils ne tiennent jamais seuls ;
   tout mouvement passe par un rescellement nommé, dans la même PR que le changement.
Constat vivant consigné par la même contre-revue : le `robots.txt` SERVI par la préversion
porte encore `Disallow: /` — c'est précisément le changement de `robots.txt.ts` nommé
depuis la v3, à livrer AVEC le code de la porte ; la contre-épreuve 13 le garde ensuite.

**Ce que la v4 corrige (3ᵉ contre-revue Codex du 28/08/2026), nommé :**
1. **P0-1 — la surface réelle des redirections était absente du contrat.** La v3 (et ma
   garde RC, et mon rapport) affirmaient que les 62 anciennes URL `*-dog-policy` répondent
   404 : FAUX. Ma mesure s'était arrêtée à `_redirects` sans ouvrir `_worker.js` ni
   `_routes.json` — le Worker Pages (`LEGACY_REDIRECTS`) redirige les 62/62 en 301 vers
   leur cible exacte, périmètre contrôlé par `_routes.json`, et le contrôle HTTP de
   contre-revue l'a établi. `_redirects` est une VUE PARTIELLE du routage Pages, pas son
   registre effectif — même classe que « agrégats exacts, registre non figé ». P7 couvre
   désormais les TROIS pièces du routage avec une attente INDÉPENDANTE du Worker
   (§ 2, P7 bis), et trois contre-épreuves l'exercent (15–17). Le faux constat est corrigé
   dans la garde RC (PR #28) et au dossier de lancement.
2. **P0-2 — le déploiement n'était pas explicitement dirigé vers la production.** Sans
   `--branch`, Wrangler peut déduire la branche courante et produire une PREVIEW depuis
   une branche de travail — et le contrôle « production inchangée » passerait à tort. La
   commande impose désormais `--project-name` + `--branch=main` + `--commit-hash`, et
   quatre concordances sont vérifiées AVANT le contre-test HTTP (§ 6) ; contre-épreuve 18 :
   l'omission de `--branch=main` interdit tout déploiement.
3. **P1 — la conception se disait fondée sur `b500168`** : elle repart du `main` réel
   `3a65e556` (branche fusionnée avec lui, CI verte confirmée).

**Ce que la v3 corrige (2ᵉ contre-revue Codex du 28/08/2026), nommé :**
1. **Le contrat preview se contredisait encore** : le résumé du § 0 exigeait toujours que
   `robots.txt` « interdise tout » pendant que le § 3 exigeait, correctement, l'absence de
   `Disallow: /`. Le résumé est aligné, et deux contre-épreuves preview sont ajoutées
   (13 : un `Disallow: /` fait rougir V2 ; 14 : une ligne `Sitemap:` fait rougir V3).
2. **La v2 créait une seconde provenance** (`porte-provenance.json`) alors que le dépôt
   possède déjà LE contrat — `packages/knowledge/scripts/lib/provenance.mjs`
   (`ecrireProvenance`, `verifierProvenance`, `empreinteDist`, `.provenance.json` : SHA,
   empreintes des entrées par paquets entiers, propreté à échec fermé, paramètres, portée,
   empreinte exacte du dist). Deux contrats concurrents divergeraient — c'est la leçon écrite
   dans l'en-tête de ce module même. Le § 2 bis RÉUTILISE ce module et n'ajoute que
   l'exigence propre au lancement : SHA courant exactement égal au SHA demandé. La
   contre-épreuve 9 de la v2 était mal formulée (une modification non commitée ne change pas
   HEAD) : scindée en 9 (source modifiée non commitée après build → refus, par la propreté et
   les empreintes d'entrées) et 10 (nouveau commit après build → refus, par le SHA).
3. **Le contrôle en ligne et le rollback appartenaient à deux moments différents** — un
   contre-test « dans la séquence » puis un rollback « sur ordre » pouvait laisser une
   production fautive visible pendant l'attente. `deployer-production.mjs` (§ 6) porte
   désormais TOUT le cycle : mémoriser le déploiement production précédent, déployer les
   octets scellés, contrôler immédiatement en HTTP exhaustif, et au premier défaut appeler
   lui-même le rollback Cloudflare Pages vers ce déploiement précédent, vérifier que le
   rollback a réellement abouti, et interdire la Search Console dans tous les cas d'échec.
   L'autorité reste intacte : la commande entière ne se lance QUE sur ordre explicite du
   propriétaire, et cet ordre inclut le rollback automatique en cas d'échec — c'est une seule
   décision, pas deux.
4. **P1 documentaire** : la variable de build s'appelle `PUBLIC_API_BASE` (pas `API_BASE`) ;
   en production sa valeur attendue est VIDE — le bundle appelle `/v1/*` en same-origin — et
   la CI utilise une sentinelle versionnée. Le contrôle de bundle correspondant est ajouté
   (P10). Recommandation Codex consignée : activer Cloudflare Access sur les dernières
   previews (les URL de preview Pages sont publiques par défaut, même si Pages leur ajoute
   automatiquement `X-Robots-Tag: noindex`).

Commande donnée (arbitrage propriétaire du 28/08/2026, spécification Codex) : une **porte de
lancement unique**, automatisée, limitée aux **risques de lancement** — pas un chantier SEO.
« Aucun déploiement si la porte d'indexabilité n'est pas intégralement verte. »

**Ce que la v2 corrige (contre-revue Codex du 28/08/2026), nommé :**
1. **La v1 promettait une préversion « intégralement invisible » avec `Disallow: /` +
   `noindex` — c'est contradictoire** : une page bloquée par robots.txt ne peut pas être
   explorée pour lire son `noindex`, et son URL peut malgré tout apparaître dans l'index
   (doc Google Search Central, block-indexing). La promesse est réduite et le mécanisme
   corrigé — § 3, avec l'option Cloudflare Access nommée pour arbitrage.
2. **La v1 jugeait un répertoire sans sceller l'ARTEFACT** : ni SHA, ni arbre source, ni
   portée, ni preuve que ces mêmes octets seraient déployés — et `npm run release`
   RECONSTRUIT le site aujourd'hui, donc l'artefact vérifié pouvait différer de l'artefact
   publié. Même classe que le faux vert « agrégats exacts, registre non figé » du lot B.
   Corrigé — § 2 bis (provenance scellée), § 5 (trois contre-épreuves), § 6 (commande
   atomique vérifier-puis-déployer, sans reconstruction, `--commit-hash` transmis).
3. **La v1 affirmait « l'en-tête ne peut pas venir d'ailleurs sur Pages » — c'est faux** :
   des Response Header Transform Rules ou une couche Worker peuvent ajouter `X-Robots-Tag`
   après lecture des fichiers. Le contrôle hors ligne ne conclut plus que sur l'artefact ;
   l'autorité finale est la réponse HTTP réellement servie, contre-testée sur TOUTES les
   URL — § 2 (P1 reformulé), § 6 (contre-test post-déploiement exhaustif, bloquant).
4. **Quatre contrats de la v1 n'étaient pas exécutables** : `porte-noindex-admis.json`
   n'était consulté par rien ; P9 prétendait prouver depuis `dist/` que d'autres étapes
   avaient tourné ; P7 ignorait les règles dynamiques (`*`, `:splat`) déjà présentes ;
   P8 ne définissait pas « texte visible ». Chacun est rendu exécutable ou requalifié
   honnêtement — § 0, § 2 (P7, P8, P9).

---

## 0. Le principe : une porte, deux verdicts, zéro déduction

La porte est UN exécutable (`porte-lancement.mjs`, à écrire après contre-revue) qui juge un
`dist/` construit, hors ligne, et rend un verdict binaire selon le mode annoncé :

```
node porte-lancement.mjs --dist=packages/ui/dist --attendu=production   # porte de lancement
node porte-lancement.mjs --dist=packages/ui/dist --attendu=preview     # garde de préversion
```

- `--attendu=production` : la surface publique est **intégralement indexable** — zéro
  `noindex` accidentel, robots ouvert, sitemaps exacts, canoniques de production, hreflang
  réciproques. C'est la porte que le déploiement exige verte.
- `--attendu=preview` : **chaque page** porte `noindex, nofollow`, et `robots.txt` n'empêche
  PAS la lecture de ce `noindex` (pas de `Disallow: /`) ni n'annonce de sitemap — le
  mécanisme exact est au § 3. Une préversion qui fuit dans l'index est le défaut symétrique,
  et il est aussi grave.
- Tout écart est nommé (page, contrôle, valeur vue/attendue) ; la sortie est 0 ou 1, jamais
  un avertissement. Une porte qui « signale » sans bloquer n'est pas une porte.

**Ce que la porte ne devine jamais** : la liste des pages volontairement non indexables
(`404`, `/lab/`, fiches imprimables) n'est pas re-décidée par la porte — elle est **lue** dans
une liste versionnée unique (`porte-noindex-admis.json`). **Statut honnête de cette liste
(v2)** : `Base.astro` ne la consulte pas — les `noindex` volontaires sont décidés page par
page dans les gabarits. La liste est donc un **contrat externe bidirectionnel**, pas la source
des décisions : la porte vérifie l'inclusion dans les deux sens (tout `noindex` du dist est
dans la liste ; toute entrée de la liste correspond à une page `noindex` du dist), si bien
qu'un écart dans un sens comme dans l'autre rougit. En faire la vraie source commune
(refactor de `Base.astro`) est nommé comme alternative — plus forte mais plus invasive
pré-lancement — pour l'arbitrage.

---

## 1. L'état mesuré — la porte vérifie un mécanisme qui existe déjà

Mesures faites sur `main` (rien n'est supposé) :

| mécanisme | état mesuré |
|---|---|
| pilotage | `packages/ui/src/lib/env.ts` : `SITE_ENV = PUBLIC_SITE_ENV ?? "preview"` — **sûr par défaut**, tout ce qui n'est pas `production` est non-indexable |
| robots | `robots.txt.ts` : production = `Allow: /` + `Disallow: /lab/` + `Sitemap:` ; préversion = `Disallow: /` |
| meta robots | `Base.astro` : `!IS_PRODUCTION` → `noindex, nofollow` global ; `noindex` volontaire par page (404, lab, fiches imprimables) → `noindex, follow` |
| canoniques + hreflang | `Base.astro` : canonique par page ; alternates quadrilingues + `x-default`, **jamais sur une page noindex** ; langues annoncées déduites de `PREVIEW_LOCALES` |
| sitemaps | index `/sitemap.xml` → 4 fichiers par langue (`sitemapEntries.ts`) — l'adresse annoncée à la Search Console ne change pas |
| 404 | `fix-404.mjs` post-build ; l'ancienne route chaleur est morte et **gardée** (`test-cloture-outil-chaleur.mjs`, lot F) |
| redirections | `packages/ui/public/_redirects` (86 règles v1→v2), servies par l'hébergement |
| préversion | `build-preview.mjs` : `PUBLIC_API_BASE` → Worker **versionné** (jamais l'alias mutable), provenance écrite, vérifications post-build |
| Worker | `/v1/health` versionné, interrogé par le monitoring |
| liens internes | `test-liens-internes.mjs` + `npm run audit` (job site-complet) — déjà en CI |

Conséquence de conception : la porte **réutilise** ces contrats au lieu d'en créer des
doubles — « deux modèles dans le même dépôt, c'est la garantie qu'ils divergeront ».

---

## 2. Les contrôles du mode `production` (la porte de lancement)

Chaque contrôle est hors ligne, sur le `dist/` :

**P1 — indexabilité.** Aucune page de la surface publique ne porte `<meta name="robots">`
avec `noindex` ; les seules exceptions sont les entrées de `porte-noindex-admis.json`,
vérifiées dans les deux sens. Si un fichier `_headers` existe, il ne pose `X-Robots-Tag:
noindex` sur aucune page publique. **Portée honnête (v2)** : ce contrôle conclut sur
l'ARTEFACT, et seulement sur lui — des Response Header Transform Rules ou une couche Worker
peuvent ajouter ou remplacer des en-têtes après lecture des fichiers, et aucun contrôle hors
ligne ne peut le voir. L'autorité finale est la réponse HTTP réellement servie : c'est le
contre-test post-déploiement du § 6, exhaustif et bloquant, qui la juge.

**P2 — robots.txt.** Contient `Allow: /`, le `Disallow: /lab/` attendu, la ligne `Sitemap:`
pointant le domaine de production, et **rien d'autre** — un `Disallow: /` résiduel de
préversion est le défaut classique du lancement raté.

**P3 — sitemaps exacts, dans les DEUX sens (v6).** L'index référence exactement les
4 sitemaps de langue. Puis **égalité exacte d'ensembles** : l'union DÉDUPLIQUÉE des URL des
quatre sitemaps enfants doit être identique à l'ensemble des pages HTML publiques et
INDEXABLES du dist (toutes les pages construites, moins les entrées de
`porte-noindex-admis.json`) —
- une page publique indexable ABSENTE des sitemaps rougit (le défaut que « URL listée →
  fichier existant » ne voyait pas : c'est ce qui rend la contre-épreuve 17 bis capable de
  mordre) ;
- une URL SURNUMÉRAIRE des sitemaps (sans page, ou vers une page `noindex`) rougit ;
- un doublon entre sitemaps enfants rougit (l'union se calcule, les doublons se nomment).
Chaque URL listée reste en outre : (a) sur le domaine de production ; (b) jamais cible d'une
règle de `_redirects` ni du Worker (une URL de sitemap qui redirige est une URL fausse) ;
(c) aucune URL retirée n'y figure — `/tools/is-it-too-hot-for-my-dog/` nommément
(recouvrement assumé avec la garde du lot F : deux gardes valent mieux qu'un trou).

**P4 — canoniques.** Chaque page publique porte exactement une canonique, absolue, sur le
domaine de production, pointant une page qui existe dans `dist/` ; une canonique de préversion
(`*.pages.dev`, Worker, localhost) rougit.

**P5 — hreflang réciproques.** Sur chaque page publique à variantes : les alternates couvrent
exactement les langues publiées + `x-default` ; **réciprocité vérifiée par calcul** (si A
annonce B, B annonce A) ; chaque cible existe dans `dist/` ; le `lang` du `<html>` de la cible
correspond à la langue annoncée.

**P6 — cohérence de tête.** Chaque page publique : `<title>` non vide, `<meta description>`
non vide, `<html lang>` cohérent avec son chemin (`/fr/` → `fr`…). Pas de jugement de qualité
— une présence et une cohérence, c'est tout.

**P7 — redirections saines.** Analyse statique de `_redirects`, **avec les règles dynamiques
définies (v2)** — le fichier en contient déjà (`*`, `:splat`), une cible littérale ne se
vérifie pas comme une redirection statique :
- règles **statiques** : la cible existe dans `dist/`, n'est pas elle-même une source de
  règle (aucune chaîne A→B→C), aucun statut hors {301, 302, 303, 307, 308} ;
- règles **dynamiques** : détection de boucles et de chaînes au niveau SYMBOLIQUE (graphe
  des préfixes — une règle dont le motif cible retombe dans son propre motif source, ou dans
  le motif source d'une autre règle, rougit) ; l'existence des cibles se juge par
  CONCRÉTISATION : chaque règle dynamique doit porter, dans un fichier d'exemples versionné,
  au moins une instance concrète (source réelle du site v1 → cible attendue), que la porte
  résout par substitution du `:splat` et vérifie dans `dist/` — une règle dynamique sans
  exemple versionné rougit (règle non prouvable = règle non prouvée).

**P7 bis — le routage EFFECTIF de l'ARTEFACT, contre un registre exact (v4, réusiné v5).**
Le routage Pages a TROIS pièces, et la porte les lit **dans le dist qu'elle scelle** —
`dist/_redirects`, `dist/_routes.json`, `dist/_worker.js` (présents dans l'artefact,
couverts par l'empreinte de provenance) — jamais dans les sources du dépôt : une porte qui
lit hors de son artefact juge autre chose que ce qui sera publié. Contrôler le seul
`_redirects` — le défaut de la v3, qui a produit le faux constat « 62 URL en 404 » — c'est
juger une vue partielle. La porte :
- **réutilise la mécanique de `packages/knowledge/scripts/test-legacy-urls.mjs`**, pointée
  sur les copies du DIST : reproduction du périmètre `_routes.json`, exécution du vrai
  `_worker.js` ;
- **parcourt les sitemaps EN ENTIER (v5)** : parse de l'index `dist/sitemap.xml`, puis de
  chacun de ses sitemaps enfants (4 langues), et TOUTES les URL de pages (2 536 au
  28/08/2026) passent par le routage reproduit — aucune ne doit répondre 301/410 ;
- **confronte le Worker du dist à un REGISTRE EXACT versionné (v5)** :
  `porte-routage-scelle.json` porte CHAQUE règle, sérialisée canoniquement avec sa famille
  (redirection 301 exacte, 410 exact, 410 par préfixe, mapping chaleur/races, alias
  presskit) et sa cible ou son statut, avec empreintes SHA-256 globale et par famille.
  Comparaison BIDIRECTIONNELLE : une règle du dist absente du registre rougit, une règle
  du registre absente du dist rougit, une cible ou un statut qui change rougit — les
  décomptes dérivent du registre et ne tiennent jamais seuls (« agrégats exacts, registre
  non figé » ne peut plus se produire ici). Tout mouvement = rescellement nommé, dans la
  même PR que le changement, revu par son diff. Chaque cible de redirection doit être
  construite dans le dist et vivante à travers le routage réel ;
- **le scellé couvre les trois pièces EXACTES, pas seulement les tables (v6)** — les
  tables parsées ne voient ni l'objet de `_routes.json` ni le code dynamique du Worker
  (`heatRaceTarget()`, `presskitTarget()`) : une exclusion troquée contre une autre non
  exercée par les sondes, ou une logique modifiée sans toucher aux tables, passeraient.
  `porte-routage-scelle.json` porte donc trois niveaux : (a) la représentation canonique
  EXACTE de `_routes.json` (include/exclude, ordonnés) ; (b) le registre canonique des
  règles parsées, ci-dessus ; (c) l'**empreinte SHA-256 de chacun des trois fichiers du
  dist** — `_routes.json`, `_redirects`, `_worker.js`. Les empreintes garantissent
  qu'aucune logique dynamique ne change hors d'un rescellement nommé ; le registre garde
  les diagnostics lisibles et le diff approuvable — les deux se complètent, aucun ne
  remplace l'autre ;
- **la cohérence SOURCES ↔ registre vit ailleurs, et c'est nommé** : une garde de
  test:unit (côté sources, hors porte) vérifie que les 62 fichiers
  `content/posts/*-dog-policy.md` ont chacun leur règle au registre scellé et
  réciproquement — la porte, elle, ne lit que l'artefact.

**P8 — JSON-LD.** Chaque bloc `application/ld+json` parse ; les types utilisés sont ceux que
le site émet sciemment (liste versionnée) ; pour une `FAQPage`, **chaque question et chaque
réponse du bloc existent dans le texte visible de la page** — une FAQ structurée invisible
est exactement le « contenu artificiel » que l'arbitrage interdit.
**« Texte visible », défini (v2)** — sans définition, le bloc structuré pouvait se prouver
lui-même : concaténation des nœuds texte du DOM en EXCLUANT `script` (donc le JSON-LD
lui-même), `style`, `template`, `noscript`, tout élément portant l'attribut `hidden` ou
`aria-hidden="true"`, et leurs descendants. Normalisation déterministe des deux côtés avant
comparaison : Unicode NFKC, espaces réduits à un, casse pliée (locale-indépendante),
guillemets/apostrophes typographiques ramenés aux formes droites. L'appartenance se juge en
sous-chaîne sur ces formes normalisées.

**P9 — liens internes.** Déjà couverts par `npm run audit` + `test-liens-internes.mjs`.
**Rendu exécutable (v2)** — la v1 prétendait « vérifier qu'ils ont tourné » depuis `dist/`,
ce qu'aucune lecture de `dist/` ne peut prouver : la commande d'orchestration (le pas de CI
pour la porte, et `deployer-production.mjs` au § 6 pour le lancement) les **exécute
elle-même**, dans le même processus, contre le même `dist/` scellé, avant de rendre son
verdict — l'ordre des étapes n'est plus une croyance, c'est un appel de fonction. Aucune
réimplémentation : ce sont les scripts existants, invoqués.

**P10 — le bundle appelle la bonne API (v3).** En mode production, aucun asset construit ne
porte d'URL d'API de préversion — pas de `*.workers.dev`, pas de `localhost` : la valeur
attendue de `PUBLIC_API_BASE` est VIDE et le bundle appelle `/v1/*` en same-origin. En mode
preview, l'inverse est déjà garanti par `build-preview.mjs` (URL Worker versionnée exigée
dans le bundle) : la porte le cite, elle ne le réimplémente pas.

## 2 bis. La porte scelle l'ARTEFACT, pas seulement ses propriétés (v2, réusiné v3)

Sans cela, la porte est un faux vert de la même classe que « agrégats exacts, registre non
figé » : toutes les propriétés du site seraient exactes sans que l'objet réellement publié
soit figé. Trois pièces :

1. **Provenance de build production — LE module existant, jamais un second contrat (v3).**
   Le dépôt possède déjà la carte d'identité d'un site construit :
   `packages/knowledge/scripts/lib/provenance.mjs` (`ecrireProvenance` / `verifierProvenance`
   / `empreinteDist`, fichier `.provenance.json` dans le dist), déjà écrit par `build-ci.mjs`
   et `build-preview.mjs` — SHA de HEAD, empreintes des ENTRÉES par paquets entiers avec
   exclusions vérifiées, propreté de l'arbre à échec FERMÉ, paramètres de build, portée,
   empreinte exacte du dist. Son propre en-tête raconte pourquoi les copies divergent : la v2
   de ce dossier, avec son `porte-provenance.json`, recréait exactement ce défaut. Le wrapper
   de build production RÉUTILISE ce module tel quel (avec `PUBLIC_SITE_ENV=production` et
   `PUBLIC_API_BASE` vide parmi les paramètres inscrits) ; la porte appelle
   `verifierProvenance` et n'ajoute que l'exigence propre au lancement : **le SHA de la
   provenance est exactement le SHA demandé au déploiement**.
2. **Le verdict est lié à l'empreinte** — le rapport de la porte cite l'empreinte globale
   jugée : un verdict ne porte jamais sur « un dist », il porte sur CES octets.
3. **Déploiement sans reconstruction** — § 6 : la commande de lancement revérifie l'empreinte
   puis déploie CE répertoire, jamais un rebuild. `npm run release` reconstruit aujourd'hui :
   ce script est **remplacé** par la commande atomique (changement nommé pour arbitrage).

## 3. Les contrôles du mode `preview`

**Promesse corrigée (v2)** : la v1 promettait l'invisibilité par `Disallow: /` + `noindex` —
contradictoire : une page bloquée par robots.txt ne peut pas être explorée pour lire son
`noindex`, et son URL peut malgré tout apparaître (Google Search Central, block-indexing).
La préversion promet désormais **« non indexée »**, pas « invisible », et le mécanisme est
celui qui tient cette promesse :

**V1** — chaque page HTML du `dist/` porte `noindex, nofollow`. **V2** — `robots.txt` de
préversion n'empêche PAS la lecture du `noindex` : aucun `Disallow: /` global (le
`robots.txt.ts` actuel fait l'inverse — **changement de code nommé**, à faire avec la porte).
**V3** — aucune ligne `Sitemap:` n'y annonce quoi que ce soit.

**Option nommée pour arbitrage propriétaire — recommandée par la contre-revue (v3)** :
l'invisibilité GARANTIE (personne n'atteint la préversion sans s'authentifier) existe —
Cloudflare Access sur les préversions Pages, dont les URL sont publiques par défaut (même si
Pages leur ajoute automatiquement `X-Robots-Tag: noindex`). Codex recommande de l'activer
pour les dernières previews. Coût : une authentification pour chaque contre-test navigateur
(Philippe, et Codex via Philippe). La porte fonctionne dans les deux cas ; sans Access, la
protection réelle reste « URL versionnée non devinable + noindex lisible », et le dossier de
lancement le dit en toutes lettres.

## 4. Le volet GEO — utile et sobre, rien de plus

Conformément à l'arbitrage : **la porte vérifie, elle n'ajoute jamais de contenu.**

- **G1 — les réponses vivent dans le HTML** : sur un échantillon versionné de pages de
  réponse (fiche compagnie, fiche pays, fiche race — une par gabarit et par langue), le
  verdict et ses conditions sont présents dans le HTML servi, pas seulement après JavaScript.
  (Le site est statique par construction — ce contrôle fige cette propriété.)
- **G2 — sources et dates vérifiables** : ces mêmes pages montrent leur bloc source (la
  mention « Source officielle » + date de vérification déjà rendue par les fiches).
- **G3 — entités cohérentes** : le nom de l'entité de la page figure dans `<title>`, `<h1>`
  et le JSON-LD quand il y en a un — la triangulation minimale qu'un moteur conversationnel
  recoupe.
- **G4 — pas de FAQ fantôme** : c'est P8 (le contrôle est le même, il est listé ici parce que
  c'est son motif GEO).
- **G5 — pas de bourrage** : contrôle par ABSENCE — la porte n'exige aucune densité, aucun
  mot-clé, aucun texte additionnel ; ce point est une clause de conception, pas un contrôle
  exécutable, et il est écrit pour qu'on ne puisse pas l'ajouter « en passant ».

## 5. Les vingt et une contre-épreuves de la porte (exigées avant tout feu vert)

**Exécution des mutations (v6, 5ᵉ contre-revue)** : toute contre-épreuve qui mute le
`_worker.js` importe la copie mutée dans un processus NEUF, ou via une URL ESM rendue
unique (suffixe de requête de cache-busting) — sans quoi le cache de modules ferait
exercer l'ANCIENNE copie et la contre-épreuve prouverait le vide.

Sur le modèle des harnais du dépôt : chaque garantie doit avoir été **vue rougir pour sa
cause**, par mutation d'une copie de `dist/` (jamais du dépôt), en exerçant la vraie porte :

1. un `noindex` réintroduit sur une page publique → P1 rougit et nomme la page ;
2. `robots.txt` passé à `Disallow: /` en mode production → P2 rougit ;
3. une canonique réécrite vers un hôte de préversion → P4 rougit ;
4. un hreflang cassé (l'alternate `pt` retiré d'une seule page) → P5 rougit par réciprocité ;
5. une URL 404 ajoutée au sitemap → P3 rougit ;
6. une règle de redirection bouclée ajoutée à `_redirects` → P7 rougit ;
7. une question ajoutée au JSON-LD FAQ sans texte visible → P8 rougit ;
8. le même `dist/` de production jugé en `--attendu=preview` → V1 rougit (les deux modes ne
   peuvent pas être verts sur le même artefact — c'est la preuve que la porte distingue) ;
9. **(v3)** une source modifiée NON COMMITÉE après le build → refus — HEAD n'a pas bougé,
   c'est la propreté de l'arbre et les empreintes d'ENTRÉES de `verifierProvenance` qui
   rougissent (le module échoue FERMÉ, jamais « propre faute d'avoir pu lire ») ;
10. **(v3)** un NOUVEAU COMMIT après le build → refus — le SHA de la provenance n'est plus
    le SHA courant demandé au déploiement ;
11. un fichier du `dist/` modifié APRÈS le passage de la porte → la revérification
    d'empreinte de la commande de déploiement rougit — le verdict ne se transfère pas à
    d'autres octets ;
12. un ancien `dist/` complet et COHÉRENT (provenance intacte) mais provenant d'un autre
    SHA → refus (empreinte juste, SHA étranger) ;
13. **(v3)** un `Disallow: /` introduit dans le `robots.txt` d'un dist de préversion →
    V2 rougit — le défaut qui rendait le `noindex` illisible ne peut pas revenir en silence ;
14. **(v3)** une ligne `Sitemap:` introduite dans le `robots.txt` de préversion → V3 rougit ;
15. **(v4, réancrée v5)** la redirection Alaska retirée de LEGACY_REDIRECTS dans une COPIE
    du `dist/_worker.js`, registre scellé inchangé → la comparaison bidirectionnelle rougit
    et nomme l'entrée manquante (le test qui lit sa liste dans le Worker, lui, ne verrait
    rien — c'est exactement pourquoi le registre indépendant existe) ;
16. **(v4, réancrée v5)** `dist/_routes.json` modifié dans une copie pour qu'une ancienne
    URL n'atteigne plus le Worker → l'exercice du routage réel rougit (l'URL cesse de
    répondre 301) ;
17. **(v5)** une règle du Worker REMPLACÉE par une autre de la même famille, à effectif
    constant (cible changée, ou une entrée troquée contre une autre) → les décomptes ne
    bougent pas, le registre exact rougit — la contre-épreuve qui distingue un registre
    d'un agrégat ;
17 bis. **(v5, rendue mordante en v6)** une URL de page retirée d'un sitemap ENFANT
    (l'index restant intact) → l'ÉGALITÉ D'ENSEMBLES de P3 rougit : la page publique
    indexable existe dans le dist et manque à l'union des sitemaps — c'est le sens
    inverse, celui que « URL listée → fichier existant » ne voyait pas ;
18. **(v4)** `deployer-production.mjs` invoqué avec une commande de déploiement privée de
    `--branch=main` → AUCUN déploiement autorisé, refus avant tout appel réseau ;
19. **(v6)** une exclusion de `dist/_routes.json` troquée contre une autre (même nombre
    d'entrées, périmètre différent) → la représentation canonique scellée de
    `_routes.json` rougit, même si aucune sonde n'exerce le chemin troqué ;
20. **(v6)** une fonction dynamique du Worker (`heatRaceTarget()`, `presskitTarget()`)
    modifiée dans une copie du `dist/_worker.js`, tables et effectifs intacts →
    l'empreinte SHA-256 du fichier, scellée au registre, rougit.

## 6. Câblage — où la porte tourne, et sur quoi

- **CI, job « Site entier »** : le build actuel est un build de préversion (pas de
  `PUBLIC_SITE_ENV`) → la porte y tourne en `--attendu=preview` sur le dist existant (coût
  nul), ET un **second build en mode production** (`PUBLIC_SITE_ENV=production`, jamais
  déployé, `PUBLIC_API_BASE` sentinelle versionnée — en CI le bundle ne peut pas être
  same-origin testable, la sentinelle est inscrite sur la provenance et P10 l'admet
  explicitement en mode CI) est jugé en `--attendu=production`. Coût estimé : ~8 min de job
  en plus — c'est le prix de ne jamais découvrir un `noindex` le jour du lancement.
  Alternative si le coût est refusé à la contre-revue : le build production + porte ne
  tournent que sur `workflow_dispatch` et avant release — nommée ici pour l'arbitrage.
- **Commande atomique de lancement (v3 — TOUT le cycle, rollback compris)** :
  `deployer-production.mjs` — un seul processus, lancé UNIQUEMENT sur ordre explicite du
  propriétaire, et cet ordre couvre le cycle entier, rollback automatique inclus (une seule
  décision, pas deux) :
  1. mémorise l'identifiant du déploiement production précédent (l'API Cloudflare Pages
     liste les déploiements du projet) — sans ce point de retour vérifié, refus de déployer ;
  2. vérifie la provenance et l'empreinte du `dist/` (§ 2 bis) — SHA courant exactement égal
     au SHA demandé ;
  3. exécute la porte `--attendu=production` ET les prérequis P9 (audit + liens) sur ce même
     `dist/` ;
  4. SANS AUCUNE RECONSTRUCTION, déploie ce répertoire tel quel — et **explicitement vers
     la production (v4)** : sans `--branch`, Wrangler peut déduire la branche COURANTE et
     produire une preview depuis une branche de travail, que le contrôle « production
     inchangée » validerait ensuite à tort. La commande impose donc les trois drapeaux :
     `wrangler pages deploy <dist> --project-name=mydogcanfly-v2-preview --branch=main
     --commit-hash=<sha de la provenance>` (Pages accepte un dossier préconstruit,
     `--branch` et `--commit-hash` sont documentés séparément — Direct Upload) ;
  4 bis. **quatre concordances vérifiées AVANT le contre-test HTTP (v4)** :
     (a) `production_branch === "main"` dans la configuration du projet Pages ;
     (b) le déploiement renvoyé est de type PRODUCTION, pas preview ;
     (c) son identifiant est devenu le déploiement ACTIF du projet ;
     (d) son SHA est celui de la provenance.
     Une seule discordance → rollback immédiat vers le déploiement mémorisé en 1, ou refus
     avant publication si rien n'a encore été servi ;
  5. exécute IMMÉDIATEMENT le contre-test HTTP exhaustif sur la production servie — une
     règle Cloudflare pouvant être conditionnée par chemin, un échantillon passerait à côté :
     TOUTES les URL des sitemaps (meta robots + `X-Robots-Tag` reçus + canonique + statut
     200), toutes les pages volontairement `noindex` de la liste admise, `robots.txt`, et
     chaque redirection (statut + cible) ;
  6. **au premier défaut : appelle lui-même le rollback** vers le déploiement mémorisé en 1
     (endpoint de rollback Cloudflare Pages vers un déploiement production antérieur réussi),
     puis VÉRIFIE que le rollback a réellement abouti (relecture du déploiement actif + santé
     sur les URL témoins) — jamais « rollback demandé », toujours « rollback constaté » ;
  7. la **Search Console est interdite dans TOUS les cas d'échec** — écart HTTP, rollback
     réussi ou rollback lui-même en échec ; elle n'est permise qu'après un cycle
     intégralement vert, et reste un geste séparé sur ordre propriétaire.
  `npm run release`, qui reconstruit, est remplacé par cette commande — changement nommé
  pour arbitrage.

## 7. Ce que cette porte ne fait pas

Pas de SEO de contenu, pas de mots-clés, pas de refonte : hors périmètre par arbitrage. Pas
d'appel réseau en CI (le contre-test HTTP appartient à `deployer-production.mjs`, § 6). Pas
de soumission Search Console automatisée. Pas de double des contrôles existants (liens,
clôture chaleur, annonce du site) ni du contrat de provenance : elle les cite et s'y adosse.

---

*Prochaine étape : contre-revue de cette conception RÉVISÉE (v6) par Codex. Le code de la
porte, sa liste `porte-noindex-admis.json`, le wrapper de build production adossé à
`provenance.mjs`, la commande `deployer-production.mjs` (cycle complet, rollback vérifié
compris), le changement de `robots.txt.ts` en préversion et les vingt et une contre-épreuves (le registre de routage scellé à trois niveaux compris) ne
s'écrivent qu'après son feu vert.*
