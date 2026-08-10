# §15 — Plan P0 (nouveau, suite à la contre-revue Codex du 10/08/2026)

**Aucune des deux actions ci-dessous n'a été déployée par Claude. Ce document propose un plan ; Philippe décide et exécute, ou délègue explicitement.**

## P0-1 — La Compagnie erronée en production

**Diagnostic** : le correctif existe déjà et fonctionne (document 10, #1) — `origin/main` est correct. Le seul problème est que le Worker de production n'a pas été redéployé depuis avant le 10/08 09:48. Ce n'est pas un correctif de code à écrire, c'est un déploiement à faire.

**Action proposée** — déjà communiquée dans cette conversation, reproduite ici pour mémoire et traçabilité dans l'inventaire :
```bash
cd /Users/philippe/Documents/GitHub/mydogcanfly
git pull origin main
npm run check && npm run typecheck
cd packages/workers
npx wrangler deploy --env production
```
Vérification après coup :
```bash
curl -s "https://mydogcanfly.com/v1/finder?origin=EWR&destination=ORY&weight_kg=32" | grep -o '"airline_id":"airline_la_compagnie"[^}]*'
```
Attendu : `"cabin":false,"hold":false,"cargo":false`.

**Point de vigilance ajouté par la contre-revue** : ce déploiement redéploiera le code de `origin/main` tel quel — donc aussi le mécanisme générique (document 10, #3) qui corrige, en principe, les 6 autres compagnies en écart fiche↔moteur. **Il ne redéploiera pas** les correctifs du patch `weight-brachy-conditions-10-08.patch` (poids cabine, Pegasus, SAA, Qantas), qui n'est ni sur `origin/main` ni donc concerné par ce déploiement — voir document 13.

**Recommandation** : ce déploiement peut être fait dès maintenant, indépendamment de tout le reste (Lots, accès GitHub/Cloudflare, réponse aux DECISION_REQUIRED) — c'est un rattrapage d'un déploiement en retard sur du code déjà validé, pas une nouvelle migration.

## P0-2 — Modalités détaillées falsifiables (`fiche.astro`)

**Diagnostic confirmé en direct** (document 10, #2) : n'importe qui peut forger une URL affichant un nom de compagnie arbitraire, un score de 100 %, une disponibilité cabine/soute/fret entièrement fictive, et des liens sortants vers un domaine `https://` de son choix, présentés comme émanant de MyDogCanFly. C'est un risque de crédibilité et de phishing potentiel, pas un risque XSS direct (`safeUrl()` bloque bien les schémas `javascript:`/`data:`).

**Ce document ne tranche pas la mitigation — trois options sont posées à Philippe (DR-10) :**

### Option A — Désactivation temporaire des liens vers cette page
Retirer, depuis les résultats du Finder (`FlightFinder.astro`, `DestinationFinder.astro`) et depuis toute autre page qui construit un lien vers `/tools/fiche`, le bouton/lien menant à la fiche détaillée, jusqu'à la reconstruction sécurisée. La page resterait techniquement accessible par URL directe (donc toujours falsifiable si quelqu'un connaît l'URL), mais ne serait plus mise en avant ni indexée comme un chemin normal du site.
**Avantage** : rapide, réversible, pas de risque de régression fonctionnelle. **Limite** : ne corrige rien pour quelqu'un qui atteint la page par un lien déjà partagé ou forgé directement.

### Option B — Version minimale ne lisant plus aucun verdict/lien depuis l'URL
Réduire la page à ce qui est déjà légitimement dérivé de données canoniques côté build (`countryData`, §1-2 du fichier — les fiches pays YAML, non falsifiables) et supprimer entièrement le bloc « The flight & the airline » (nom de compagnie, placements, tarif, score, liens `as`/`af`) tant que la reconstruction cible n'est pas prête.
**Avantage** : la page reste utile (partie pays/formalités, qui n'est pas falsifiable) sans la partie exploitable. **Limite** : nécessite un changement de code, donc une PR — pas une action immédiate comme l'option A.

### Option C — Ne rien changer dans l'immédiat, prioriser la reconstruction cible
Accepter le risque le temps du Lot dédié (voir architecture cible ci-dessous), si Philippe juge l'exposition réelle faible (page `noindex`, pas de trafic organique significatif dessus).

**Architecture cible, pour le Lot correspondant (hors périmètre immédiat de ce document)** : l'URL partageable ne devrait contenir que des entrées validables permettant un nouveau calcul (origine, destination, race, poids — comme le fait déjà `/v1/finder`), ou l'identifiant opaque d'un rapport immuable généré et stocké côté serveur. Le nom de compagnie, les placements, le score, le tarif, les sources et les liens sortants doivent provenir exclusivement du moteur ou de la Knowledge Base au moment du rendu, jamais de la query string.

**Ce que Claude propose de faire ensuite, selon la réponse de Philippe** : si Option A est retenue, préparer un patch minimal (retrait des liens, pas de changement de `fiche.astro` lui-même) ; si Option B, préparer un patch de réduction de la page ; si Option C, ne rien produire avant le Lot structurel. Dans les trois cas, rien n'est déployé sans validation explicite, conformément à la demande de Codex et à la règle déjà en vigueur pour cette session.
