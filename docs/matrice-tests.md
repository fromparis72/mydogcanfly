# Matrice des tests — cas de référence et pipeline CI

> Établie le 11/08/2026 avec Codex, à l'issue du tour 6 et des correctifs P0/P1.
> Règle d'or héritée du projet : **aucune affirmation sans source** — et son corollaire pour les
> tests : aucun contrôle qui « passe » sans démontrer ce qu'il prétend démontrer.

## Les sept cas de référence obligatoires

Ils ne vivent pas tous à la même couche. Un cas testé à la mauvaise couche donne une fausse
assurance : le moteur peut être juste et l'affichage mentir (cas 5), ou l'inverse.

| # | Cas | Couche | Harnais | Ce qui est démontré |
|---|---|---|---|---|
| 1 | La Compagnie, chien de 32 kg (EWR→ORY) | moteur + contrat HTTP | `test-reference-cases.mjs` | cabine refusée pour le poids, soute **et** fret non proposés — les trois motifs ensemble |
| 2 | Conversion 50 lb → 22,7 kg, jusque dans la fiche | Finder construit (DOM) | `test-flightfinder-harness.cjs` | le lien fiche porte le poids converti, jamais la valeur lb brute |
| 3 | Acceptation des 102 identifiants de compagnies | fiche construite (DOM) | `test-fiche-harness.cjs` | l'invariant rejoue les 102 compagnies une à une contre la liste blanche |
| 4 | `/tools/fiche` face aux paramètres forgés | fiche construite (DOM) | `test-fiche-harness.cjs` | paramètres frauduleux supprimés, aucune « FAUSSE COMPAGNIE » dans le DOM, mailto assaini |
| 5 | Qantas CDG–SYD : jamais « direct » sans preuve | moteur + contrat HTTP | `test-direct-claims.mjs` | aucun `direct_assumed` tant que les 102 compagnies ont un graphe ; tout `direct` est `direct_documented` |
| 6 | Formulaire édité pendant une requête en vol | Finder construit (DOM) | `test-flightfinder-harness.cjs` | le résultat décrit le chien réellement recherché, pas celui édité entre-temps |
| 7 | Entrées invalides : rien d'inventé | moteur + contrat HTTP | `test-reference-cases.mjs` | contrat numérique ci-dessous ; toute erreur est nommée, jamais un rapport plausible |

S'y ajoutent, nés des correctifs du 11/08 : les badges d'itinéraire exacts dans les 4 langues
(`test-flightfinder-harness.cjs`, 28 contrôles) et la sémantique réelle de `carrier_of_*`
(`test-direct-claims.mjs`).

## Le contrat numérique du cas 7 (arbitrage Codex, 11/08/2026)

Pour `weight_kg` **et** `temperature_c` (qui pilote les restrictions de chaleur) :

- paramètre **absent** → accepté : « poids/température inconnus » est un cas d'usage légitime ;
- paramètre **présent** mais vide, non numérique, `NaN` ou infini → **400 `invalid_request`**, le
  paramètre fautif nommé dans `invalid` ;
- pour le poids : ≤ 0 ou > 120 → **400** (bornes appliquées par le schéma Zod, désormais atteint
  aussi en GET — l'ancien code filtrait la valeur avant qu'il la voie) ;
- une locale inconnue n'est **pas** une erreur : repli documenté en anglais, le verdict reste
  celui du chien demandé.

Pourquoi ce contrat est strict : avant lui, `weight_kg=beaucoup` était silencieusement remplacé
par « pas de poids » et le moteur répondait un verdict assuré à un score différent, sans signal.
Même famille de panne que le rapport « CDG → Tokyo » du 30/07/2026.

## Les couches du harnais

```
test:unit       sans build — préflight de déploiement (39), vols directs + carrier_of_* (18+),
                cas de référence moteur/HTTP (33)
test:built-ui   lisent packages/ui/dist — fiche (393+) et Finder (28), EXIGENT un build avant
test:ci         n'existe pas en tant que script : c'est le workflow qui ordonne les étapes,
                parce que l'ordre EST la contrainte (build avant harnais DOM)
```

## Le pipeline (.github/workflows/ci.yml)

Mesuré le 11/08/2026, séquence complète hors `npm ci` : **107 s**.

| Étape | PR | main | Durée |
|---|---|---|---|
| `npm ci` (reproductible, lockfile seul) | ✓ | ✓ | ~1 min |
| `npm run check` (base de connaissances) | ✓ | ✓ | 1 s |
| `npm run typecheck` | ✓ | ✓ | 11 s |
| `npm run smoke` | ✓ | ✓ | 1 s |
| `npm run test:unit` | ✓ | ✓ | 2 s |
| Build **réduit** (97 pages, sentinelle versionnée) | ✓ | — | 28 s |
| Build **complet** + noindex sur les 2957 pages | — | ✓ | ~12 min |
| `npm run test:built-ui` | ✓ | ✓ | 49 s |
| `check-bundle` (épinglage, ni alias ni production) | ✓ | ✓ | <1 s |
| `check-astro-debt` (plafond, par code et par fichier) | ✓ | ✓ | 16 s |

**Pourquoi le build réduit suffit en PR** : les 2728 pages d'entités n'apportent rien aux harnais
DOM (qui lisent l'accueil ×4 langues et `/tools/fiche`, toutes présentes dans le réduit), et la
garantie « noindex partout » reste appliquée par `deploy:preview` **avant tout déploiement** —
c'est-à-dire au moment où elle protège réellement. La CI de PR détecte les régressions vite ; elle
ne certifie pas un déploiement.

**La dette Astro n'est pas un contrôle vert.** `check-astro-debt` le rappelle à chaque passage :
175 erreurs connues, chiffrées par code TypeScript et par fichier dans
`docs/astro-check-baseline.json`. Toute hausse échoue — y compris à total constant, pour qu'une
erreur neuve ne remplace pas une ancienne. Toute baisse échoue aussi, en demandant de resserrer la
référence. Plan de résorption : `fiche.astro` (66) d'abord, puis `HeatCalculator` (30) et
`TravelTimeline` (29) ; `ts(7006)` (112, paramètres implicitement `any`) et `ts(6133)` (51, code
mort) sont mécaniques.

## Ce que la CI ne couvre pas, sciemment

Le déploiement lui-même (`deploy:preview`, 7 étapes vérifiées, manifeste) et la promotion d'alias
restent des actes manuels outillés — c'est une décision, pas un oubli. Et les trois étapes qui
parlent à Cloudflare ne peuvent pas être exercées en CI sans identifiants ; leur contrat est figé
par les 39 contrôles hors ligne de `test-preview-select.mjs`.
