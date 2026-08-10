# §15 — Inventaire de premières actions (Protocole Claude–Codex) — v2, corrigé après contre-revue Codex du 10/08/2026

**SHA de référence pour le code : `e2b27799de335558afc165ee1763ad4613ca4ed9` (origin/main, 2026-08-10 10:16:24 +0200).**

## Verdict de la contre-revue Codex

Codex a contre-audité le Lot 0 (v1 de ce dossier) et a testé, en plus de la lecture de code, l'API et l'UI publiques de production. Verdict : **le Lot 0 n'était pas encore validable**. Plusieurs constats de la v1 mélangeaient l'état du code (`origin/main`) et l'état réellement servi aux visiteurs — deux choses différentes, comme la contre-revue l'a démontré avec deux P0 actifs en production que la v1 classait « corrigé » ou « à exécuter » sans les avoir testés en direct.

**Chaque affirmation de Codex a été vérifiée indépendamment par Claude avant correction du dossier** (requêtes HTTP publiques + un test navigateur réel avec exécution JS pour la faille la plus sérieuse) — pas acceptée telle quelle, conformément à la règle « aucune affirmation sans source officielle », qui s'applique aussi aux affirmations de Codex, pas seulement aux sources tierces.

## Ce qui a changé dans cette version

| Document | Changement |
|---|---|
| 02 | Ajout §3bis : collision de Workers confirmée avec effet réel (404 sur les routes legacy) |
| 03 | Correction : `docs/V2-DEPLOYMENT.md` n'est plus classé « fiable et à jour » — ses affirmations de statut de déploiement sont contredites par la production |
| 09 | DR-01 et DR-02 tranchés par test ; ajout de DR-09 (dérive Git↔production), DR-10 (falsification fiche.astro), DR-11 (abonnés/désinscription) |
| 10 | Refonte complète : matrice LOCAL_GIT / PREVIEW / PRODUCTION pour les 15 scénarios, avec deux P0 confirmés en production |
| **11 (nouveau)** | Plan P0 : redéploiement La Compagnie (prêt à exécuter) + 3 options de mitigation pour `fiche.astro` (à trancher par Philippe) |
| **12 (nouveau)** | Plan de séparation des deux Workers, sans mutation Cloudflare |
| **13 (nouveau)** | Découpage révisé du patch `weight-brachy-conditions` en 3 sous-lots, l'exception Qantas à réécrire |
| **14 (nouveau)** | Liste exacte des vérifications nécessitant Philippe ou un accès Cloudflare en lecture, sans jamais demander de secret |

Les documents 01, 04, 05, 06, 07, 08 restent valides tels que livrés — aucune objection de fond de la contre-revue sur leur contenu.

## Les deux P0 confirmés en production aujourd'hui

1. **La Compagnie, 32 kg** : le correctif existe sur `origin/main` et fonctionne (testé), mais le Worker public n'a pas été redéployé depuis avant ce matin — le visiteur reçoit toujours le résultat faux. Correctif : un déploiement, pas une ligne de code (document 11, P0-1 — commandes déjà transmises).
2. **Modalités détaillées falsifiables** (`/tools/fiche`) : confirmé en direct, avec exécution JavaScript réelle dans un navigateur — une URL forgée affiche un nom de compagnie inventé, une disponibilité fictive et des liens sortants vers un domaine de son choix, présentés comme émanant de MyDogCanFly. Pas de correctif immédiat proposé unilatéralement : trois options de mitigation posées à Philippe (document 11, P0-2).

**Constat transversal, découvert en testant #1** : le Worker de production sert un code antérieur au 10/08 09:48 (confirmé par l'absence de la règle Melbourne, mergée ce matin-là) — donc aucun correctif du jour, Phase 1 ou Phase 2, n'est en production. La collision de nom entre les deux Workers (document 02) est elle aussi confirmée avec effet réel : les routes du Worker legacy (météo, confirmation d'abonnement, désinscription) répondent toutes 404 sur leur propre domaine.

## Ordre de travail corrigé (remplace celui de la v1)

1. Corriger l'inventaire avec la contre-revue — **fait, ce document**.
2. Établir le SHA réellement servi en production — **fait par déduction indirecte (antérieur au 10/08 09:48) ; confirmation exacte nécessite Philippe (document 14, point 3)**.
3. Redéployer le correctif La Compagnie déjà présent sur `origin/main` (document 11, P0-1) — prêt, geste de Philippe.
4. Trancher et, si nécessaire, appliquer la mitigation des modalités détaillées falsifiables (document 11, P0-2, DR-10) — décision de Philippe.
5. Séparer/vérifier les Workers, confirmer l'état des abonnés D1/cron (document 12, document 09 DR-11) — nécessite les vérifications du document 14.
6. Ajouter les métadonnées de version à `/v1/health` (document 09, DR-09).
7. Construire de vrais tests de production, distincts des tests locaux (le `smoke.ts` actuel importe le Worker directement et ne fait aucun appel réseau — confirmé par lecture du code ; son message « Worker pipeline live and correct » est donc trompeur tel quel).
8. Re-soumettre ce Lot 0 corrigé à Philippe et à une nouvelle contre-revue Codex.
9. Seulement après validation : CI (Lot 1) et les lots structurels (2 à 7, document 07 — le sous-lot Qantas du patch weight-brachy étant révisé au document 13).

## Sommaire complet des 15 documents

| # | Document | Statut |
|---|---|---|
| 00 | Cette synthèse | v2 |
| 01 | Inventaire Hugo vs V2 | inchangé |
| 02 | Topologie Cloudflare | v2 (§3bis ajouté) |
| 03 | Divergences doc/code/prod | v2 (§2 corrigé) |
| 04 | Logique métier dupliquée | inchangé |
| 05 | Données sous-qualifiées | inchangé |
| 06 | Plan de branches et CI | inchangé |
| 07 | Lots proposés | inchangé (le Lot 6 est maintenant détaillé au document 12) |
| 08 | Accès nécessaires | inchangé |
| 09 | DECISION_REQUIRED | v2 (DR-01/02 tranchés, DR-09 à 11 ajoutés) |
| 10 | Tests de référence | v2 (matrice LOCAL_GIT/PREVIEW/PRODUCTION) |
| 11 | Plan P0 | nouveau |
| 12 | Plan de séparation des Workers | nouveau |
| 13 | Découpage révisé du patch weight-brachy | nouveau |
| 14 | Vérifications nécessitant Philippe | nouveau |

Aucune action de code ou de déploiement n'est engagée par ce dossier au-delà de ce qui est explicitement proposé comme prêt à exécuter par Philippe (P0-1). Tout le reste attend sa décision et, le cas échéant, une nouvelle contre-revue Codex — conformément à la demande explicite de Codex de ne fermer aucun P0 avant un retest sur l'URL publique correspondant exactement au SHA déployé.
