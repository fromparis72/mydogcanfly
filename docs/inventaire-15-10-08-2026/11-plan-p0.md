# §15 — Plan P0 (nouveau, suite à la contre-revue Codex du 10/08/2026)

**Aucune des deux actions ci-dessous n'a été déployée par Claude. Ce document propose un plan ; Philippe décide et exécute, ou délègue explicitement.**

## P0-1 — La Compagnie erronée en production — **RÉSOLU, mais procédure non reproductible signalée par la contre-revue**

**Ce qui s'est passé** : Philippe a exécuté la procédure ci-dessous (encore décrite telle qu'elle a été donnée, pour l'historique) directement depuis son répertoire de travail habituel, avec `git pull origin main` puis `wrangler deploy --env production`. Le résultat est confirmé correct (document 10, #1). **Mais la contre-revue Codex signale à juste titre que cette procédure n'est pas reproductible** : le répertoire de travail peut contenir des modifications non commitées, et `git pull` ne garantit pas de savoir exactement quel SHA a été buildé et déployé — aucun identifiant de déploiement n'a été consigné en lien avec un SHA précis au moment du geste.

**Procédure exigée pour tout déploiement futur (Worker ou Pages), retenue à partir de maintenant** :
1. choisir et consigner un SHA exact ;
2. préparer un checkout/worktree propre sur ce SHA (jamais le répertoire de travail habituel, qui peut contenir des modifications non commitées) ;
3. exécuter `check`, `typecheck` et les tests locaux sur ce worktree ;
4. déployer ce SHA exact sur l'environnement de **preview**, jamais directement en production ;
5. tester la preview avec la matrice de référence (document 10), au minimum La Compagnie, Melbourne, une compagnie sans soute/fret, et les routes de santé — **avec un paramètre anti-cache systématique** (leçon du faux diagnostic Melbourne) ;
6. faire contre-tester cette preview par Codex ;
7. seulement après validation explicite de Philippe, déployer le même SHA, sans modification intermédiaire, en production ;
8. vérifier la production avec une lecture JSON structurée (`jq` ou test automatisé), pas un `grep` tronqué ;
9. noter l'identifiant du déploiement et le SHA dans le compte rendu.

Le déploiement Pages et celui du Worker restent deux opérations distinctes — ne jamais lancer `npm run release` (qui déploie Pages) pour corriger quelque chose qui relève du Worker, et inversement.

**Section originale, conservée pour mémoire :**

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

## P0-2 — Modalités détaillées falsifiables (`fiche.astro`) — **Option B tranchée par Philippe (10/08/2026)**

**Précision de portée** : seul `FlightFinder.astro` construit un lien vers cette page (`ficheBase`/`href`, lignes ~211/470) — `DestinationFinder.astro` n'en construit aucun, aucune correction n'y est donc nécessaire pour ce point.

**Diagnostic confirmé en direct** (document 10, #2) : n'importe qui peut forger une URL affichant un nom de compagnie arbitraire, un score de 100 %, une disponibilité cabine/soute/fret entièrement fictive, et des liens sortants vers un domaine `https://` de son choix, présentés comme émanant de MyDogCanFly. C'est un risque de crédibilité et de phishing potentiel, pas un risque XSS direct (`safeUrl()` bloque bien les schémas `javascript:`/`data:`).

**Ce document ne tranche pas la mitigation — trois options sont posées à Philippe (DR-10) :**

### Option A — Désactivation temporaire des liens vers cette page — **mesure d'attente possible, ne ferme jamais le P0 à elle seule**
Retirer, depuis `FlightFinder.astro` (seul composant concerné — voir précision de portée ci-dessus), le bouton/lien menant à la fiche détaillée, en attendant l'Option B. La page resterait techniquement accessible par URL directe (donc toujours falsifiable si quelqu'un connaît l'URL, y compris tout lien déjà partagé par un visiteur avant ce correctif). **Codex insiste, et c'est retenu ici : cette option réduit l'exposition, elle ne corrige rien pour une URL déjà en circulation ou forgée directement — elle ne doit jamais être présentée comme une clôture du P0, seulement comme une mesure d'attente si l'Option B ne peut pas être livrée immédiatement.**

### Option B — Version minimale ne lisant plus aucun verdict/lien depuis l'URL — **RETENUE PAR PHILIPPE**
Réduire la page à ce qui est déjà légitimement dérivé de données canoniques côté build (`countryData` — les fiches pays YAML, non falsifiables) et supprimer entièrement l'injection dans le DOM (pas un simple masquage CSS) des champs non fiables : nom de compagnie, score, cabine, soute, fret, vol direct, tarif, embargo, liens sortants compagnie (`as`/`af`).
**Tests d'acceptation exigés** (repris du document 09, DR-10) : l'URL forgée de test n'affiche plus aucun de ces éléments ni aucun lien vers le domaine forgé ; une URL légitime issue du Finder affiche toujours correctement les formalités pays ; comportement vérifié en français, anglais, espagnol et portugais ; les anciennes URL déjà partagées restent sans danger même avec leurs anciens paramètres présents ; la page conserve `noindex`.

### Option C — Ne rien changer dans l'immédiat — **non retenue**
Écartée par la décision de Philippe (Option B retenue directement).

**Architecture cible, pour le Lot correspondant (hors périmètre immédiat de ce document)** : l'URL partageable ne devrait contenir que des entrées validables permettant un nouveau calcul (origine, destination, race, poids — comme le fait déjà `/v1/finder`), ou l'identifiant opaque d'un rapport immuable généré et stocké côté serveur. Le nom de compagnie, les placements, le score, le tarif, les sources et les liens sortants doivent provenir exclusivement du moteur ou de la Knowledge Base au moment du rendu, jamais de la query string.

**Décision prise : Option B.** Claude prépare le patch de réduction de `fiche.astro` (suppression de l'injection DOM des champs non fiables, conservation du bloc pays/formalités), avec les 5 tests d'acceptation ci-dessus vérifiés avant livraison. Rien n'est déployé sans validation explicite de Philippe puis contre-test de Codex, conformément à la procédure retenue au P0-1.
