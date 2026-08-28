# Porte de lancement SEO/GEO — dossier de conception

**Version 2 — 28/08/2026, sur `main` `b500168`. Conception avant code : aucun harnais n'est
écrit tant que cette conception révisée n'est pas contre-revue.**

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
- `--attendu=preview` : **chaque page** porte `noindex, nofollow` et `robots.txt` interdit
  tout. Une préversion qui fuit dans l'index est le défaut symétrique, et il est aussi grave.
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

**P3 — sitemaps exacts.** L'index référence exactement les 4 sitemaps de langue. Chaque URL
listée : (a) correspond à un fichier réellement présent dans `dist/` (aucune 404) ; (b) est
sur le domaine de production ; (c) n'est la cible d'aucune règle de `_redirects` (une URL de
sitemap qui redirige est une URL fausse) ; (d) n'est pas une page `noindex` ; (e) aucune URL
retirée n'y figure — `/tools/is-it-too-hot-for-my-dog/` nommément (recouvrement assumé avec
la garde du lot F : deux gardes valent mieux qu'un trou).

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

## 2 bis. La porte scelle l'ARTEFACT, pas seulement ses propriétés (v2)

Sans cela, la porte est un faux vert de la même classe que « agrégats exacts, registre non
figé » : toutes les propriétés du site seraient exactes sans que l'objet réellement publié
soit figé. Trois pièces :

1. **Provenance de build production** — le build production (wrapper autour de `build:prod`,
   même patron que `build-preview.mjs` qui écrit déjà la sienne) écrit
   `porte-provenance.json` : SHA de HEAD, arbre Git PROPRE exigé (sinon refus d'écrire),
   portée complète prouvée (le compte de pages du build, confronté au manifeste), variables
   d'environnement de build (`PUBLIC_SITE_ENV=production`, `API_BASE`), et **empreinte exacte
   du `dist/`** : liste triée des fichiers + SHA-256 par fichier + empreinte globale de
   l'ensemble. La porte REFUSE de juger un `dist/` sans provenance, avec une provenance dont
   l'empreinte ne correspond pas aux octets présents, ou dont le SHA n'est pas celui demandé.
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

**Option nommée pour arbitrage propriétaire** : l'invisibilité GARANTIE (personne n'atteint
la préversion sans s'authentifier) existe — Cloudflare Access sur les préversions Pages.
Coût : une authentification pour chaque contre-test navigateur (Philippe, et Codex via
Philippe). La porte fonctionne dans les deux cas ; sans Access, la protection réelle reste
« URL versionnée non devinable + noindex lisible », et le dossier de lancement le dit en
toutes lettres.

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

## 5. Les onze contre-épreuves de la porte (exigées avant tout feu vert)

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
9. **(v2)** une source modifiée APRÈS le build (SHA de HEAD ≠ SHA de la provenance) → le
   scellement rougit ;
10. **(v2)** un fichier du `dist/` modifié APRÈS le passage de la porte → la revérification
    d'empreinte de la commande de déploiement rougit — le verdict ne se transfère pas à
    d'autres octets ;
11. **(v2)** un ancien `dist/` complet, provenant d'un autre SHA, présenté à la porte → le
    scellement rougit (provenance d'un autre commit, empreinte cohérente mais SHA étranger).

## 6. Câblage — où la porte tourne, et sur quoi

- **CI, job « Site entier »** : le build actuel est un build de préversion (pas de
  `PUBLIC_SITE_ENV`) → la porte y tourne en `--attendu=preview` sur le dist existant (coût
  nul), ET un **second build en mode production** (`PUBLIC_SITE_ENV=production`, jamais
  déployé, `API_BASE` factice versionné) est jugé en `--attendu=production`. Coût estimé :
  ~8 min de job en plus — c'est le prix de ne jamais découvrir un `noindex` le jour du
  lancement. Alternative si le coût est refusé à la contre-revue : le build production + porte
  ne tournent que sur `workflow_dispatch` et avant release — nommée ici pour l'arbitrage.
- **Commande atomique de lancement (v2)** : `deployer-production.mjs` — un seul processus qui
  (a) vérifie la provenance et l'empreinte du `dist/` (§ 2 bis), (b) exécute la porte
  `--attendu=production` ET les prérequis P9 (audit + liens) sur ce même `dist/`, (c) SANS
  AUCUNE RECONSTRUCTION, déploie ce répertoire tel quel : `wrangler pages deploy <dist>
  --commit-hash=<sha de la provenance>` (Cloudflare Pages accepte un dossier préconstruit et
  ce drapeau — Direct Upload). Toute étape rouge arrête tout ; `npm run release`, qui
  reconstruit, est remplacé par cette commande — changement nommé pour arbitrage.
- **Contre-test HTTP post-déploiement (v2 — exhaustif, pas un échantillon)** : une règle
  Cloudflare peut être conditionnée par chemin, un échantillon peut donc passer À CÔTÉ du
  chemin transformé. Le contre-test rejoue en ligne, sur la production servie : TOUTES les
  URL des sitemaps (meta robots + `X-Robots-Tag` reçus + canonique + statut 200), toutes les
  pages volontairement `noindex` de la liste admise, `robots.txt`, et chaque redirection
  vérifiée (statut + cible). **Au premier écart : la soumission Search Console est BLOQUÉE et
  la procédure de rollback du dossier de lancement est déclenchée** (sur ordre propriétaire,
  conformément aux limites d'autorité en vigueur). Puis seulement : soumission du sitemap en
  Search Console, sur ordre propriétaire uniquement.

## 7. Ce que cette porte ne fait pas

Pas de SEO de contenu, pas de mots-clés, pas de refonte : hors périmètre par arbitrage. Pas
d'appel réseau en CI (le contre-test HTTP est post-déploiement, manuel dans la séquence). Pas
de soumission Search Console automatisée. Pas de double des contrôles existants (liens,
clôture chaleur, annonce du site) : elle les cite et s'y adosse.

---

*Prochaine étape : contre-revue de cette conception RÉVISÉE (v2) par Codex. Le code de la
porte, sa liste `porte-noindex-admis.json`, le wrapper de provenance, la commande
`deployer-production.mjs`, le changement de `robots.txt.ts` en préversion et les onze
contre-épreuves ne s'écrivent qu'après son feu vert.*
