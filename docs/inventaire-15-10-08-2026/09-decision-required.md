# §15.9 — Points DECISION_REQUIRED (v2, corrigé après contre-revue Codex du 10/08/2026)

**SHA de référence : `e2b27799de335558afc165ee1763ad4613ca4ed9` (origin/main).**
Deux points (DR-01, DR-02) sont désormais tranchés par des tests réels et ne sont plus des questions ouvertes ; ils restent listés pour mémoire avec leur réponse. Trois points nouveaux (DR-09 à DR-11) sont ajoutés suite à la contre-revue Codex. Les autres points (DR-03 à DR-08) restent ouverts ; les recommandations proposées par Codex y sont ajoutées comme options pour Philippe, pas comme décisions déjà prises par Claude ou Codex.

## DR-01 — État réel de la coexistence Hugo/V2 en production — **TRANCHÉ PAR TEST**
**Réponse confirmée le 10/08/2026** : la page d'accueil `mydogcanfly.com` est le V2 Astro, indexable (pas de balise noindex), avec les métadonnées SEO d'un site en production réelle. Ce n'est plus une hypothèse.
**Correction (10/08/2026, après le déploiement `feb7b25d`)** : le diagnostic initial « le Worker sert une version ancienne du code » était faux — c'était un faux négatif dû à un cache d'edge Cloudflare sur des URLs de test répétées, pas une staleness réelle. Une fois retesté avec un paramètre anti-cache, le Worker de production reflète bien `origin/main` (Phase 1 + Phase 2 confirmées live : Melbourne, Hawaï, La Compagnie, mécanisme fiche-baseline). Voir document 10 v3.

## DR-02 — Collision de nom entre les deux Workers — **TRANCHÉ PAR TEST**
**Réponse confirmée le 10/08/2026** : le Worker V2 occupe le nom Cloudflare `mydogcanfly-api`, et répond aussi bien sur `mydogcanfly.com/v1/*` que sur `api.mydogcanfly.com/v1/health` (custom domain d'origine du Worker legacy). Les trois routes propres au Worker legacy (`/api/weather`, `/api/confirm`, `/api/unsubscribe`) renvoient toutes 404 sur `api.mydogcanfly.com` — le Worker legacy ne répond plus sur son propre domaine. **Conséquence potentiellement grave, non encore quantifiée : si des abonnés existent dans la base D1 du Worker legacy, leurs liens de confirmation/désinscription sont cassés.** Voir DR-11.

## DR-03 — Page chaleur legacy (`static/tools/is-it-too-hot-for-my-dog/`)
Codex a testé cette URL en production : elle renvoie 404 aujourd'hui (déjà retirée ou jamais servie sous ce chemin en prod). **Ne pas migrer son modèle de seuil (29,4 °C) — la question n'est plus « faut-il la retirer » mais « faut-il rediriger d'éventuels liens externes existants vers l'outil Heat V2 »**, à vérifier par Philippe (Search Console, liens entrants connus).

## DR-04 — Modèle de température canonique
Toujours ouvert. Proposition de Codex à considérer, distincte des deux modèles déjà en conflit (région vs latitude) : distinguer explicitement (a) une prévision météo réelle et datée pour un voyage proche, (b) une estimation climatique clairement étiquetée comme telle pour un voyage lointain, (c) un embargo compagnie déclenché uniquement par une politique sourcée, et (d) un seuil physiologique de risque santé traité comme un module séparé de la politique commerciale. C'est une option parmi d'autres pour trancher le Lot 5 — Philippe décide.

## DR-05 — Plafond générique de poids hold/cargo
Toujours ouvert. Point de vigilance ajouté par Codex, cohérent avec la règle maison « aucune affirmation sans source officielle » : un plafond générique inventé (ex. 90 kg) serait aussi peu défendable qu'une absence totale de plafond. Option proposée : quand une compagnie propose le service sans limite connue, afficher explicitement `dog_weight_eligibility: unknown` et un verdict `conditional`, plutôt qu'un `allow` plein ou un refus à un seuil arbitraire. Codex signale aussi que le plafond cabine générique existant (10 kg) mériterait la même réévaluation — un filet générique ne doit pas se substituer à une limite propre à la compagnie quand elle existe. Philippe tranche.

## DR-06 — Patch `weight-brachy-conditions-10-08.patch`
**Mise à jour** : Codex a testé le patch dans un worktree temporaire et confirmé qu'il s'applique proprement et passe le contrôle de schéma, mais que son exception Qantas est incomplète (voir #7 du document 10 et document 13 pour le découpage révisé proposé). **Recommandation : ne pas appliquer ce patch tel quel.** Le découper en 3 lots indépendants (poids cabine / règles route-scopées Pegasus+SAA / exception Qantas réécrite avec une règle `require` explicite et sourcée) — détail dans le document 13.

## DR-07 — Contrat fiche compagnie
Toujours ouvert. Proposition de Codex, alternative aux deux options déjà envisagées (documenter le legacy tel quel / migrer aveuglément vers la spec) : produire deux documents distincts — `CURRENT-AIRLINE-PIPELINE.md` (état réel du pipeline `ingest-airlines.mjs`) et `V2-AIRLINE-CONTRACT.md` (contrat canonique cible) — plus une ADR et un plan de migration contrôlé entre les deux. Point de principe à valider : les champs qui ne servent qu'à l'affichage ne doivent pas être présentés comme la source de vérité métier. Philippe tranche la direction.

## DR-08 — Accès GitHub/Cloudflare
Inchangé sur le fond (document 08). Codex confirme la même recommandation : mode transitoire document/patch en premier, ruleset + branche `rebuild/v2` + CI + previews automatiques avant tout accès direct, aucun token de production Cloudflare pour Claude.

## DR-09 — NOUVEAU : dérive entre le dépôt Git et l'artefact réellement déployé, ET cache d'edge sur les tests
**Constat** : aucun mécanisme du dépôt ne garantit qu'un déploiement correspond à un SHA identifiable. `/v1/health` ne renvoie que `{"ok":true,"service":"mydogcanfly-api","version":"v1"}` — rien qui permette de savoir, sans test manuel indirect, quelle version de code tourne réellement. **Aggravé par une découverte du 10/08/2026** : un cache d'edge Cloudflare peut retourner une réponse figée pour une URL de test exacte pendant un temps indéterminé après un déploiement, ce qui a produit un faux diagnostic de staleness sur ce dossier avant d'être corrigé (document 10 v3). Toute vérification de production doit désormais inclure un paramètre anti-cache.
**Décision nécessaire** : Philippe valide-t-il l'ajout de métadonnées de version (`git_sha`, `built_at`, `environment`) injectées au build plutôt que renseignées à la main, à `/v1/health` ? Et confirme-t-il l'existence/la configuration de ce cache d'edge (Cache Rule ou comportement par défaut de la zone) pour qu'elle soit documentée plutôt que redécouverte à chaque audit ?

## DR-10 — NOUVEAU : sort immédiat de la page « modalités détaillées » falsifiable
**Constat** : `fiche.astro` est activement exploitable en production aujourd'hui (document 10, #2 ; document 11 pour le détail).
**Décision nécessaire** : Philippe choisit entre désactiver temporairement les liens vers cette page (depuis les résultats du Finder) le temps d'une reconstruction sécurisée, ou accepter le risque le temps que la correction structurelle soit prête. Aucune des deux options n'est engagée par Claude sans validation explicite — voir document 11.

## DR-11 — NOUVEAU : abonnés et désinscription du Worker legacy
**Constat** : `api.mydogcanfly.com/api/confirm` et `/api/unsubscribe` renvoient 404. Si la base D1 du Worker legacy (`worker/wrangler.toml`, binding `DB`, base `mydogcanfly`) contient des abonnés réels aux alertes chaleur/rappels, leurs liens de désinscription envoyés par email sont probablement cassés depuis que le Worker V2 a pris le nom `mydogcanfly-api`.
**Décision nécessaire** : Philippe confirme (lecture Cloudflare D1, hors de portée de Claude) si des abonnés existent. Si oui, ce point devient P0 — un abonné qui ne peut plus se désinscrire est un problème de conformité, pas seulement un bug produit. Voir document 14 pour la vérification exacte à effectuer.

## Points explicitement NON bloquants
Inchangé : Lot 1 (CI) et Lot 2 (doc fiche) restent préparables sans attendre ces décisions. En revanche, **les deux P0 (La Compagnie, modalités détaillées falsifiables) doivent être traités avant toute autre chose** — voir document 11, qui précède maintenant les lots 1 à 7 dans l'ordre de travail (document 00 mis à jour).
