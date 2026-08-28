# Porte de lancement SEO/GEO — dossier de conception

**Version 1 — 28/08/2026, sur `main` `b500168`. Conception avant code : aucun harnais n'est
écrit tant que cette conception n'est pas contre-revue.**

Commande donnée (arbitrage propriétaire du 28/08/2026, spécification Codex) : une **porte de
lancement unique**, automatisée, limitée aux **risques de lancement** — pas un chantier SEO.
« Aucun déploiement si la porte d'indexabilité n'est pas intégralement verte. »

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
une liste versionnée unique (`porte-noindex-admis.json`), la même que celle que le site
consulte déjà implicitement via `Base.astro`. Un `noindex` hors liste rougit ; une entrée de
liste qui ne correspond plus à aucune page rougit aussi (liste morte = liste fausse).

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
vérifiées dans les deux sens. Aucun fichier `_headers` ne pose `X-Robots-Tag: noindex` sur la
surface publique (s'il n'existe pas de `_headers`, le contrôle le dit et passe — l'en-tête ne
peut pas venir d'ailleurs sur Pages ; les réponses du Worker sont hors surface indexable).

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

**P7 — redirections saines.** Analyse statique de `_redirects` : aucune boucle, aucune chaîne
(A→B→C), aucune cible morte (la cible de chaque règle existe dans `dist/` ou est une règle
elle-même — interdit), aucun statut hors {301, 302, 303, 307, 308}.

**P8 — JSON-LD.** Chaque bloc `application/ld+json` parse ; les types utilisés sont ceux que
le site émet sciemment (liste versionnée) ; pour une `FAQPage`, **chaque question et chaque
réponse du bloc existent dans le texte visible de la page** — une FAQ structurée invisible
est exactement le « contenu artificiel » que l'arbitrage interdit.

**P9 — liens internes.** Déjà couverts par `npm run audit` + `test-liens-internes.mjs` (job
site-complet) : la porte les **cite comme prérequis** et vérifie qu'ils ont tourné (même job),
elle ne les réimplémente pas.

## 3. Les contrôles du mode `preview`

**V1** — chaque page HTML du `dist/` porte `noindex, nofollow`. **V2** — `robots.txt` est
`Disallow: /`. **V3** — aucune ligne `Sitemap:` n'y annonce quoi que ce soit. C'est court à
dessein : une préversion n'a qu'une obligation, être invisible.

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

## 5. Les contre-épreuves de la porte (exigées avant tout feu vert)

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
   peuvent pas être verts sur le même artefact — c'est la preuve que la porte distingue).

## 6. Câblage — où la porte tourne, et sur quoi

- **CI, job « Site entier »** : le build actuel est un build de préversion (pas de
  `PUBLIC_SITE_ENV`) → la porte y tourne en `--attendu=preview` sur le dist existant (coût
  nul), ET un **second build en mode production** (`PUBLIC_SITE_ENV=production`, jamais
  déployé, `API_BASE` factice versionné) est jugé en `--attendu=production`. Coût estimé :
  ~8 min de job en plus — c'est le prix de ne jamais découvrir un `noindex` le jour du
  lancement. Alternative si le coût est refusé à la contre-revue : le build production + porte
  ne tournent que sur `workflow_dispatch` et avant release — nommée ici pour l'arbitrage.
- **Séquence de lancement** (ordre déjà arbitré) : porte verte sur le build production du SHA
  figé → preview immuable + contrôle navigateur → déploiement de l'artefact approuvé →
  **contre-test HTTP sur la production** (les mêmes contrôles P1–P5, rejoués en ligne sur un
  échantillon — c'est le seul moment où la porte touche le réseau) → soumission du sitemap en
  Search Console, sur ordre propriétaire uniquement.

## 7. Ce que cette porte ne fait pas

Pas de SEO de contenu, pas de mots-clés, pas de refonte : hors périmètre par arbitrage. Pas
d'appel réseau en CI (le contre-test HTTP est post-déploiement, manuel dans la séquence). Pas
de soumission Search Console automatisée. Pas de double des contrôles existants (liens,
clôture chaleur, annonce du site) : elle les cite et s'y adosse.

---

*Prochaine étape : contre-revue de cette conception par Codex. Le code de la porte, sa liste
`porte-noindex-admis.json` et ses huit contre-épreuves ne s'écrivent qu'après son feu vert.*
