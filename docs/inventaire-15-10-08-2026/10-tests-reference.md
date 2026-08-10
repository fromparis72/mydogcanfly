# §15.10 — Premier lot de tests de référence (v4 — corrections suite à contre-revue Codex du 10/08/2026, tour 2)

**SHA de référence pour le code métier audité : `e2b27799de335558afc165ee1763ad4613ca4ed9`.**
**Note sur ce repère (ajoutée après que la contre-revue a signalé un SHA de référence déjà obsolète)** : `origin/main` évolue à chaque commit — de patch appliqué comme de document d'inventaire livré. Au moment d'écrire cette version, `origin/main` HEAD est `922786eb4a3451720717bfec00d45198ee7b769f` (inclut désormais aussi le patch New York et les corrections d'inventaire du tour 1). **Le SHA `e2b2779` reste la référence pour les comportements de code métier décrits ici** (Phase 1 + Phase 2), qui n'ont pas changé depuis ; il ne décrit plus le HEAD réel du dépôt. C'est précisément le problème que corrige DR-09 (métadonnées de version automatiques) — tant qu'il n'est pas livré, tout SHA cité dans ce dossier doit être lu comme « au moment du test », pas comme un repère permanent.

**Correction importante par rapport à la v2 de ce document** : la v2 affirmait que le Worker de production servait un code antérieur au 10/08 09:58 (« antérieur à la Phase 1 »), en se fondant sur l'absence de la règle Melbourne lors de plusieurs tests répétés. **Ce diagnostic était faux.** Après le redéploiement de production effectué par Philippe (`npx wrangler deploy --env production`, version `feb7b25d`, confirmée à 100 % du trafic par `wrangler deployments list` — aucun rollout progressif en cause), un nouveau test de Melbourne avec un paramètre de contournement de cache (`&cachebust=...`) a immédiatement montré le résultat correct. **La cause réelle était un cache d'edge Cloudflare qui retournait une réponse figée pour cette URL exacte, pas un Worker resté sur un ancien code.** Toutes les requêtes de test faites APRÈS un déploiement doivent désormais inclure un paramètre variable pour éviter ce faux négatif — leçon retenue pour la suite des vérifications de ce dossier.

## Distinction utilisée

- **LOCAL_GIT** : comportement du code au SHA `e2b2779` (origin/main), vérifié par exécution directe du moteur dans un worktree propre.
- **PREVIEW** : toujours NON VÉRIFIABLE — aucune URL de preview connue.
- **PRODUCTION** : `mydogcanfly.com`, retesté le 10/08/2026 après le déploiement `feb7b25d`, systématiquement avec un paramètre de contournement de cache.

## #1 — La Compagnie, EWR→ORY, 32 kg — **FIXED en production, confirmé indépendamment**

Confirmé par le `curl` de Philippe ET retesté indépendamment par Claude après déploiement : `cabin:false, hold:false, cargo:false`. Le P0 est clos.

## #2 — Modalités détaillées falsifiables par URL — **FAIL, toujours actif, sans rapport avec le déploiement**

Inchangé sur le fond (document 11). C'est un défaut de conception du code client (`fiche.astro`), pas un problème de déploiement ou de cache — un redéploiement du Worker ne peut rien y changer, puisque cette page ne rappelle jamais le moteur. **Précision de portée (contre-revue Codex)** : seul `FlightFinder.astro` construit un lien vers `/tools/fiche` ; aucune construction équivalente n'existe dans `DestinationFinder.astro`. P0 désormais tranché sur la mitigation : Option B approuvée par Philippe (document 09, DR-10), pas encore livrée.

## #3 — Écart fiche↔moteur (Air Serbia, Aircalin, Bangkok Airways, Batik Air Indonesia/Malaysia, ITA Airways, La Compagnie, Pegasus) — **FIXED en production (mécanisme), correction du diagnostic v2**

Le mécanisme général (`policy?.[p]?.allowed !== true` inconditionnel) est confirmé actif en production depuis le déploiement `feb7b25d`, la même version qui corrige #1. La v2 de ce document classait ce point « FAIL » sur la foi du faux diagnostic de staleness — **corrigé ici**. Les 6 compagnies autres que La Compagnie n'ont pas été retestées individuellement avec cache-bust ; à faire si un doute subsiste, mais la cause commune est confirmée en production.

## #4 — Qantas, CDG→SYD, revendication « direct » exacte — **FAIL, confirmé de nouveau après cache-bust**

Retesté le 10/08/2026 avec paramètre anti-cache : `direct:true, itinerary_confidence:"direct_assumed"`, inchangé. Ce n'est ni un problème de déploiement ni de cache — le code de l'heuristique de hub (`evaluate.ts`, non modifié aujourd'hui) est identique sur `origin/main` et en production. Un vrai bug, pas encore traité.

## #5 — Pegasus, hold domestique vs cargo — **NON TESTÉ — correctif absent, échec attendu**

**Précision de vocabulaire demandée par la contre-revue, appliquée ici** : `rule_pegasus_hold_domestic_only` n'existe ni sur `origin/main` ni donc en production — ceci est confirmé par lecture de code (absence de la règle), **pas par l'exécution d'une requête live montrant le comportement erroné**. Le distinguo compte : « correctif absent » garantit qu'un échec est probable, pas qu'il a été observé avec ce jeu de paramètres précis. Voir document 13 pour le découpage révisé du patch.

## #6 — South African Airways, cargo international — **NON TESTÉ — correctif absent, échec attendu**

Identique à #5 sur le plan méthodologique.

## #7 — Exceptions cargo spécialisé brachycéphale — **NON TESTÉ — correctif absent, échec attendu ; ET défaut de conception confirmé même une fois le correctif appliqué**

Le statut « correctif absent » suit la même règle que #5/#6. Ce qui EST confirmé, par lecture de code (`packages/engine/src/contracts.ts`, `explain.ts`) et pas seulement supposé : même en ajoutant la règle `require` proposée au document 13 v1, elle entrerait bien dans `AirlineDecision.fired` mais **`explain()` ne la transforme pas en condition du `DecisionReport`, et `AirlineResult` n'a aujourd'hui aucun champ pour transporter une condition par compagnie jusqu'au rapport JSON ni jusqu'à l'interface** — vérifié en lisant la définition de `AirlineResult` (aucun champ `conditions`/`requires`, seulement `deny_reasons` pour les refus) et la construction de `conditions[]` dans `explain()` (alimentée uniquement par les formalités pays, jamais par les règles `fired` au niveau compagnie). Le document 13 doit donc être revu avant tout codage — voir document 13 v2.

## #8 — Melbourne (correction du diagnostic v2) + Dogo Argentino (non testé)

**Melbourne : FIXED en production, confirmé après cache-bust.** `CDG→MEL, weight_kg=5&cachebust=1` → Qantas, Air India et Malaysia Airlines tous en `cabin:false, hold:false, cargo:true` (« Cargo only »), cohérent avec `rule_au_mel_cargo_only`. La v2 de ce document classait ce point « FAIL confirmé » — **c'était le faux négatif de cache déjà expliqué en tête de ce document.** Dogo Argentino non sur-généralisé reste non testé, dans aucun environnement.

## #9 — Staffordshire Bull Terrier → Allemagne — À EXÉCUTER
Inchangé, non testé.

## #10 — Hawaï, régime distinct — **FIXED en production (avec la même limite domestique que sur origin/main), correction du diagnostic v2**

Retesté le 10/08/2026 avec paramètre anti-cache : `CDG→HNL` retourne bien la mention complète du régime hawaïen (5-Day-Or-Less, port d'entrée unique Honolulu, 120 jours de quarantaine sinon). **La v2 de ce document classait ce point « FAIL — absence totale », sur la foi du même faux diagnostic de staleness — corrigé ici.** La limite déjà documentée (cas domestique LAX→HNL non couvert, `isDomestic` masque le scope pays) reste valable, identique à `origin/main` — ce n'est pas un problème de déploiement.

## #11 à #14 — À EXÉCUTER
Inchangé.

## #15 — Séparation des trois notions de chaleur — **FAIL, confirmé, sans rapport avec le déploiement**

Inchangé (document 04) — c'est un problème de code source (4 modèles indépendants), pas de déploiement.

## Synthèse corrigée

| Statut | Scénarios |
|---|---|
| FIXED en production, confirmé par test après cache-bust | #1, #3 (mécanisme), #8 (Melbourne), #10 (Hawaï, avec limite domestique connue) |
| FAIL réel, sans rapport avec le déploiement ni le cache | #2, #4, #15 |
| FAIL — patch livré mais non appliqué sur `origin/main` | #5, #6, #7 |
| À EXÉCUTER | #9, #11, #12, #13, #14 (+ Dogo Argentino du #8) |

**Un seul P0 reste actif en production aujourd'hui : #2 (falsification de rapport via `fiche.astro`).** Le P0 #1 (La Compagnie) est clos. Voir document 11 pour la suite sur #2, et document 13 pour le découpage révisé du patch couvrant #5/#6/#7.
