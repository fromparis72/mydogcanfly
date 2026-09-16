# Passation à Codex — état exact du chantier au 13/09/2026, 22 h

Réponse point par point aux neuf questions. Aucune solution générale proposée : uniquement
l'état du dépôt, les contraintes laissées en cours, et ce qui mord si on ne le sait pas.

---

## 1. Branche et commit servant de base

**`main` = `8c0f0dc`**, identique à `origin/main`. C'est le dernier état stable ET l'état
actuellement déployé en production. Fusion de la PR #64 (`claude/indexation-socle`, 17 commits).

Autres branches locales présentes sur le Mac, à ignorer :

| Branche | SHA | État |
|---|---|---|
| `main` | `8c0f0dc` | base, déployée, poussée |
| `claude/indexation-socle` | `d76ee70` | déjà fusionnée dans `main`, conservée par commodité |
| `garde-jeton-purge` | `86c2e82` | **locale, non poussée**, un commit, ne touche que `purger-cache.mjs` |

`garde-jeton-purge` n'a aucun rapport avec le SEO : elle ajoute un contrôle de forme sur la valeur
de `CLOUDFLARE_PURGE_TOKEN` avant l'appel à l'API. À pousser séparément ou à reporter ; ne pas
partir de cette branche.

## 2. Déployé / en cours

**Tout ce qui est dans `8c0f0dc` est déployé et vérifié en ligne.** Il n'y a aucun travail en
cours, aucune branche de fonctionnalité ouverte, aucune PR en attente. Le chantier est à l'arrêt
propre.

Livré et vérifié en production : `_headers` (cache de bord), redirection `/tools/can-my-dog-fly/`,
`llms.txt` dynamique, portes d'indexation races et guides, menu déporté en JSON, bloc de citation
et page `/citing/` en quatre langues, citations `CreativeWork` datées dans le JSON-LD des
compagnies, `lastmod` calculé sur les dates de vérification réelles, script de purge du cache.

Côté Cloudflare, hors dépôt : règle de cache « HTML — cache everything » (24 h + 7 j de
`stale-while-revalidate`) et Browser Cache TTL ajusté. Ces deux réglages vivent dans le tableau de
bord et ne sont pas versionnés.

## 3. Modifications non commitées

`git status --porcelain` ne montre qu'une entrée : `?? "Claude outputs/"`, dossier non suivi
contenant les deux documents de passation. **Aucun fichier suivi n'est modifié.** L'arbre est
propre.

## 4. `countries.generated.json` — chaîne de génération complète

```
content/countries/*.yml
   └─ packages/knowledge/scripts/ingest-countries.mjs
        └─ packages/ui/src/data/countries.generated.json
             └─ packages/ui/src/data/countries.ts
                  └─ packages/ui/src/components/CountryGuidePage.astro
```

Le chemin de sortie est en dur à la ligne 16 du script (`OUT`). **Ne jamais éditer le JSON à la
main** : l'étape CI `npm run ingest:check` vérifie que les artefacts correspondent à leurs sources
et rougit sinon.

Sur le faux relecteur, deux précisions qui changent la manœuvre :

- La chaîne `"MyDogCanFly Data Team"` ne naît pas dans `ingest-countries.mjs` mais dans les
  scripts de règles qui alimentent les YAML :
  `regles-retour-ue-passeport.mjs:78`, `regles-ue-origine.mjs:75`,
  `regles-ch-li-no-origine.mjs:72` (constante `REVIEWER`), et en littéral dans
  `add-gb-approved-carriers-rules.mjs:64-65`.
- Le schéma d'ingestion **exige** ce champ : `reviewer: z.string().min(1)` (ligne 162). Le vider
  fait échouer l'ingestion.

D'où une remarque technique, à arbitrer et non tranchée ici : `reviewer` sert aussi de piste
d'audit interne (il apparaît dans les `history` de chaque règle, avec la note de méthode). Le
supprimer partout efface une traçabilité utile. La seule chose fausse est sa **publication** :
`CountryGuidePage.astro:111` en fait un `reviewedBy` typé `Person` dans le JSON-LD. Cesser
d'émettre cette ligne supprime l'affirmation publique sans toucher à la provenance interne.
Une ligne à retirer, contre une refonte de quatre scripts et d'un schéma.

## 5. Fonctionnement des portes actuelles

Trois fichiers, dans `packages/ui/src/lib/` :

| Famille | Fichier | Règle |
|---|---|---|
| Aéroports | `reliefEtat.ts` | indexable si la fiche documente une zone de soulagement |
| Races | `raceEtat.ts` | `faitsDeRace(kb, breed)` filtre `kb.breedRestrictions` sur `applies_to.breed_id` ou `applies_to.trait` ; indexable si au moins un fait. 22 races brachycéphales passent |
| Guides | `guideEtat.ts` | `domainesCites(entry)` scanne `entry.body` (liens markdown et HTML) et exclut `DOMAINES_DU_RESEAU` + `RESEAUX_SOCIAUX` ; indexable si au moins un domaine extérieur. 204 sur 288 |

**Le point structurant** : chaque fichier exporte **une seule fonction de règle**, consommée à la
fois par `packages/ui/src/lib/sitemapEntries.ts` et par la propriété `noindex` de la page. Le
sitemap et la balise `robots` lisent donc la même vérité et ne peuvent pas diverger. Une porte
écrite en dupliquant la condition des deux côtés tiendra quelques semaines puis se
désynchronisera silencieusement.

`Base.astro` décide de la balise ainsi :
`(!IS_PRODUCTION || isPreviewLocale(locale)) ? "noindex, nofollow" : noindex && "noindex, follow"`.
Les `alternates` sont supprimés quand la propriété `noindex` est vraie.

**Invariant à vérifier avant de livrer une porte** : la symétrie linguistique. Une clé doit être
annoncée dans TOUTES ses langues ou dans aucune. Une porte asymétrique casse les `hreflang` sur
l'ensemble du site. `test-annonce-du-site.mjs` teste cet invariant ; la porte des guides a été
mesurée à zéro asymétrie sur 72 clés avant livraison.

## 6. Tests et commandes

**Avant de pousser, au minimum** :

```
npm run check && npm run ingest:check && npm run typecheck && npm run test:unit
npm run build:ci && npm run test:built-ui && npm run test:entities
```

**Ce que la CI ajoute, et qui ne se voit qu'en PR** — job `site-complet`, ~12 min :

```
npm run build:preview -- --api-base=…
npm run test:entities:complet && npm run audit && npm run test:annonce
npm run test:liens && npm run test:guide-page
node --import tsx test-etape3-dom.mjs --dist=packages/ui/dist
npm run contre-epreuves -- --dist-complet
```

Le job `verify` (~40 s) enchaîne `check`, `ingest:check`, la matrice d'audit des 18 pays, le
rescellement du registre des sources, le typecheck, `smoke`, `test:unit`, le **contrat de
provenance**, `build:ci`, les harnais DOM et les contre-épreuves.

**Déploiement** : `npm run release` =
`build:prod && verify:index && wrangler pages deploy packages/ui/dist --project-name=mydogcanfly-v2-preview --branch=main --commit-dirty=true && purge:cache`.
`verify:index` doit annoncer **1 856 URL** (464 × 4) dans l'état actuel.

## 7. Fichiers concernés par le double `s-maxage`

Un seul : **`packages/ui/public/_headers`**.

Le défaut vient de ce que Cloudflare Pages **concatène** les règles dont le motif correspond au
lieu de laisser la plus spécifique l'emporter. Le bloc `/*` pose
`public, max-age=0, s-maxage=86400, stale-while-revalidate=604800` ; les blocs `/sitemap.xml`,
`/sitemap-*.xml`, `/robots.txt` et `/llms.txt` ajoutent `public, max-age=0, s-maxage=3600`. En
ligne, l'en-tête sort avec les deux, dans cet ordre — donc `s-maxage=86400` l'emporte et les
sitemaps sont gardés 24 h au lieu d'une heure. Vérifiable par
`curl -sI https://mydogcanfly.com/sitemap.xml`. Sans gravité SEO, mais l'intention n'est pas
respectée.

## 8. Pièges, invariants, zones à ne pas toucher

**Le piège qui coûte le plus de temps** : le HTML est gardé 24 h au bord. Après un déploiement,
tant que le cache n'est pas purgé, `curl` sur la production renvoie l'ancienne version. Purger
(`npm run purge:cache`, jeton déjà en place dans `~/.zshrc`) **avant** toute mesure de validation.

**Le piège de CI** : `build:preview` — utilisé par le job `site-complet` — marque **toutes** les
pages `noindex, nofollow`. Tout harnais qui partitionne les pages sur la balise `robots` lit donc
« zéro page indexable » et échoue ou passe à tort. Partitionner sur l'appartenance au sitemap.
C'est exactement ce qui a coûté un aller-retour complet sur `test-annonce-du-site.mjs`.

**Contrat de provenance** (`packages/knowledge/scripts/lib/provenance.mjs`) : les paquets `ui`,
`knowledge` et `engine` sont scrutés à la recherche de lectures d'environnement ; toute variable
lue à l'intérieur doit figurer dans `PARAMETRES`, car elle est réputée changer le site produit.
C'est pour cette raison que `purger-cache.mjs` est à la racine : le déclarer aurait fait mentir le
contrat pour faire taire le harnais.

**Registre IATA scellé** : `dette-iata-publiee.json` porte une sentinelle
`_mesure.dist_pages_html = 3125`. Ajouter ou retirer des pages HTML la fait échouer. Ne la
déplacer que délibérément :
`node --import tsx test-etape3-dom.mjs --dist=packages/ui/dist --ecrire-registre`.
Passer une page en `noindex` ne change pas le compte — la page est toujours construite.

**Un seul nœud `WebPage` par page.** Les citations du JSON-LD sont typées `CreativeWork` ; la CI
refuse les nœuds `WebPage` multiples.

**Portugais** : les gabarits appellent `inlineT(en, fr, es)` ; le portugais vient de
`translations/pt/inline.json`, indexé par la chaîne anglaise. Une chaîne nouvelle absente du
catalogue **retombe silencieusement en anglais**. La CI le détecte, mais après coup.

**Ne pas toucher** : le méga-menu (décision documentée du 30/07/2026 ; seul le mécanisme de
livraison a été changé, pas la structure), les fichiers `*.generated.json`, la sentinelle IATA
sans intention explicite, et — arbitrage du 13/09 — les aéroports, le portugais et toute autre
famille tant que Google n'a pas assimilé la cohorte actuelle.

Sur le sitemap : le mouvement récent est de **−680 URL nettes** (600 races et 84 guides retirés,
4 pages `/citing/` ajoutées). Les 564 aéroports étaient déjà hors index avant ce chantier.

## 9. Ébauches existantes

**Porte des compagnies : rien n'a été écrit.** Zéro ligne de code, aucune branche, aucun brouillon.

Ce qui existe et sur quoi elle doit s'appuyer : `AirlinePremiumPage.astro` calcule déjà l'état des
preuves d'une fiche, par `politiqueDuCanal(kbAir?.premium?.policy, c.placement, id)` passé à
`preuveAuditee(...)`. Une fiche sans aucune preuve auditée est exactement celle qui affiche
« To confirm » partout. La porte consiste donc à extraire ce calcul dans un
`packages/ui/src/lib/compagnieEtat.ts` sur le patron du §5, puis à le consommer depuis
`sitemapEntries.ts` et depuis la propriété `noindex` de la page — et non à réécrire une condition.

Les neuf fiches concernées, vérifiées en ligne ce soir (« To confirm » sur les trois canaux,
présentes dans les quatre sitemaps, sans balise `noindex`) : Air New Zealand, Air Serbia,
Batik Air Malaysia, EL AL, Icelandair, Norwegian, Pegasus, Saudia, Wizz Air.

**Unification de l'auteur : rien n'a été écrit non plus.** L'état des lieux :

- Source : frontmatter `author: "Camille Roussel"` dans `packages/ui/src/content/guides/**/*.md`.
- Rendu : `packages/ui/src/pages/[...loc]/travel-hub/[slug].astro`, ligne 108 (visible) et
  ligne 72 (`author: { "@type": "Person", name: d.author }` dans le JSON-LD `Article`).
- Vérifié en production : `/travel-hub/flying-with-a-dog/` déclare bien
  `"author":{"@type":"Person","name":"Camille Roussel"}`.

**`_headers` : rien n'a été fait** depuis la livraison ; le défaut du §7 est intact. Noter que
l'en-tête de commentaire du fichier affirme encore que « le déploiement de production ne purge
rien aujourd'hui » — c'était vrai à l'écriture, ça ne l'est plus depuis que `purge:cache` est
enchaîné dans `release`. À rafraîchir en même temps.
