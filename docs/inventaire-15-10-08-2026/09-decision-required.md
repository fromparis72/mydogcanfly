# §15.9 — Points DECISION_REQUIRED (v2, corrigé après contre-revue Codex du 10/08/2026)

**Baseline métier auditée : `e2b27799de335558afc165ee1763ad4613ca4ed9`. État Git du document : commit indiqué par son propre historique Git. Ne pas interpréter cette baseline comme le HEAD courant de `origin/main` — un SHA recopié ici deviendrait faux dès le commit suivant ; Git connaît déjà le HEAD réel, ce document ne le republie pas.**
Deux points (DR-01, DR-02) sont désormais tranchés par des tests réels et ne sont plus des questions ouvertes ; ils restent listés pour mémoire avec leur réponse. Trois points nouveaux (DR-09 à DR-11) sont ajoutés suite à la contre-revue Codex. Les autres points (DR-03 à DR-08) restent ouverts ; les recommandations proposées par Codex y sont ajoutées comme options pour Philippe, pas comme décisions déjà prises par Claude ou Codex.

## DR-01 — État réel de la coexistence Hugo/V2 en production — **TRANCHÉ PAR TEST**
**Réponse confirmée le 10/08/2026** : la page d'accueil `mydogcanfly.com` est le V2 Astro, indexable (pas de balise noindex), avec les métadonnées SEO d'un site en production réelle. Ce n'est plus une hypothèse.
**Correction (10/08/2026, après le déploiement `feb7b25d`)** : le diagnostic initial « le Worker sert une version ancienne du code » était faux — une réponse ancienne a été servie par une couche de cache non encore localisée sur des URLs de test répétées, pas une staleness réelle. **Correction supplémentaire (contre-revue Codex, tour 3)** : rien ne démontre que cette couche soit spécifiquement le cache d'edge Cloudflare plutôt que le client de test, un intermédiaire, ou une autre couche — le retest HTTP brut de Codex n'a observé ni `CF-Cache-Status`, ni `Age`, ni `Cache-Control` dans les réponses `/v1/finder`/`/v1/health`, et le Worker V2 ne fixe pas non plus `Cache-Control: no-store`. Une fois retesté avec un paramètre anti-cache, les comportements testés de Phase 1/2 sont actuellement observés en production (Melbourne, Hawaï, La Compagnie, mécanisme fiche-baseline) — ce qui est différent d'affirmer que le Worker « reflète bien `origin/main` », affirmation trop forte sans `git_sha` déployé ni preuve de la configuration de cache. Voir document 10 v4.

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

## DR-09 — NOUVEAU : dérive entre le dépôt Git et l'artefact réellement déployé, ET une couche de cache non localisée sur les tests
**Constat** : aucun mécanisme du dépôt ne garantit qu'un déploiement correspond à un SHA identifiable. `/v1/health` ne renvoie que `{"ok":true,"service":"mydogcanfly-api","version":"v1"}` — rien qui permette de savoir, sans test manuel indirect, quelle version de code tourne réellement. **Aggravé par une découverte du 10/08/2026** : une couche de cache non encore localisée peut retourner une réponse figée pour une URL de test exacte pendant un temps indéterminé après un déploiement, ce qui a produit un faux diagnostic de staleness sur ce dossier avant d'être corrigé (document 10 v4). Toute vérification de production doit désormais inclure un paramètre anti-cache **et** l'enregistrement des en-têtes HTTP bruts (`CF-Cache-Status`, `Age`, `Cache-Control`), pour identifier la couche en cause plutôt que la supposer.
**Décision nécessaire** : Philippe valide-t-il l'ajout de métadonnées de version (`git_sha`, `built_at`, `environment`) injectées au build plutôt que renseignées à la main, à `/v1/health` ? Peut-il vérifier directement les Cache Rules Cloudflare de la zone pour confirmer ou infirmer que la couche en cause est bien le cache d'edge Cloudflare ? Valide-t-il l'ajout, dans un lot contrôlé et testé séparément, de `Cache-Control: no-store` sur les réponses décisionnelles et de santé du Worker ?

## DR-10 — sort de la page « modalités détaillées » falsifiable — **TRANCHÉ PAR PHILIPPE (10/08/2026)**
**Constat** : `fiche.astro` est activement exploitable en production (document 10, #2 ; document 11 pour le détail). Seul `FlightFinder.astro` construit un lien vers cette page (2 occurrences, `ficheBase`/`href` autour de la ligne 211/470) — **`DestinationFinder.astro` n'en construit aucun**, correction d'une imprécision de portée signalée par la contre-revue.

Trois options avaient été posées (document 11) :
- **Option A — désactivation temporaire des liens** depuis le Finder. Ne neutralise ni les anciens liens déjà partagés, ni une URL forgée directement — **réduit l'exposition, ne ferme pas le P0**.
- **Option B — version minimale ne lisant plus aucun verdict/lien depuis l'URL**, ne conservant que la partie recalculée depuis les données pays canoniques.
- **Option C — ne rien changer dans l'immédiat**, accepter le risque le temps du Lot structurel.

**Décision de Philippe : Option B retenue.** Le patch doit ignorer totalement, sans les injecter dans le DOM (pas un simple masquage CSS), les paramètres non fiables suivants : nom de compagnie, score, cabine, soute, fret, vol direct, tarif, embargo, liens sortants compagnie. Option A peut servir de mesure d'attente si B ne peut pas être livrée immédiatement, jamais comme solution de clôture.

**Tests d'acceptation exigés avant de considérer ce point clos** :
- l'URL forgée de test (`FAUSSE COMPAGNIE`, `sc=100`, `evil.example.com`) n'affiche plus aucun de ces éléments et ne contient aucun lien vers ce domaine ;
- une URL légitime issue du Finder affiche toujours correctement les formalités pays ;
- comportement vérifié dans les 4 langues (en/fr/es/pt) ;
- les anciennes URL déjà partagées restent sans danger même avec leurs anciens paramètres présents ;
- la page conserve `noindex`.

**Statut (10/08/2026) : patch livré, les 5 tests d'acceptation vérifiés, aucun déploiement.** Voir document 11 (résumé) et document 16 (détail, diff, preuves de test) pour le compte rendu complet. En attente de l'application du patch par Philippe puis de la contre-revue de Codex.

## DR-11 — NOUVEAU : abonnés et désinscription du Worker legacy
**Constat** : `api.mydogcanfly.com/api/confirm` et `/api/unsubscribe` renvoient 404. Si la base D1 du Worker legacy (`worker/wrangler.toml`, binding `DB`, base `mydogcanfly`) contient des abonnés réels aux alertes chaleur/rappels, leurs liens de désinscription envoyés par email sont probablement cassés depuis que le Worker V2 a pris le nom `mydogcanfly-api`.
**Décision nécessaire** : Philippe confirme (lecture Cloudflare D1, hors de portée de Claude) si des abonnés existent. Si oui, ce point devient P0 — un abonné qui ne peut plus se désinscrire est un problème de conformité, pas seulement un bug produit. Voir document 14 pour la vérification exacte à effectuer.

## Points explicitement NON bloquants
Inchangé : Lot 1 (CI) et Lot 2 (doc fiche) restent préparables sans attendre ces décisions. En revanche, **les deux P0 (La Compagnie, modalités détaillées falsifiables) doivent être traités avant toute autre chose** — voir document 11, qui précède maintenant les lots 1 à 7 dans l'ordre de travail (document 00 mis à jour).
