# §15 — Plan de séparation des Workers (nouveau, suite à la contre-revue Codex du 10/08/2026)

**Aucune mutation Cloudflare, aucun secret, dans ce document. C'est un plan technique, à valider par Philippe avant toute exécution — qui restera de toute façon un geste de Philippe (document 08 : aucun token de production Cloudflare pour Claude).**

## Constat (document 02, confirmé en direct)

Le Worker V2 répond aujourd'hui sous le nom `mydogcanfly-api`, sur `mydogcanfly.com/v1/*` **et** sur `api.mydogcanfly.com` (le domaine historique du Worker legacy). Les routes propres au Worker legacy (`/api/weather`, `/api/subscribe/heat`, `/api/subscribe/plan`, `/api/confirm`, `/api/unsubscribe`) renvoient 404 sur ce domaine aujourd'hui.

## Architecture cible proposée (reprise et précisée de la contre-revue Codex)

```
mydogcanfly-decision-api          mydogcanfly-services
  → mydogcanfly.com/v1/*            → api.mydogcanfly.com/api/*
  → moteur de décision uniquement   → météo (KV), abonnés (D1), emails, cron
  → packages/workers/                → worker/ (ou un successeur TypeScript du même périmètre)
  → wrangler.toml sans KV/D1/cron    → wrangler.toml avec KV WX_CACHE + D1 DB + cron horaire
```

Chaque Worker garde : un nom Cloudflare distinct et non ambigu, un fichier `wrangler.toml` propre à lui (renommage du `name` dans les deux fichiers pour lever toute collision), un endpoint de santé distinct et vérifiable (voir document 09, DR-09, pour les métadonnées de version à y ajouter), des responsabilités et des secrets strictement séparés (aucun secret météo/email dans le Worker de décision, aucune donnée de moteur de décision dans le Worker de services).

## Étapes proposées, sans mutation Cloudflare

1. **Vérification préalable, lecture seule** (document 14) : confirmer avec Philippe l'état réel du dashboard — lequel des deux codes tourne aujourd'hui sous quel nom, l'existence et le contenu de la base D1, l'état des cron triggers, l'historique des déploiements. Rien de ce qui suit ne doit être décidé sans ces réponses.
2. **Renommage dans le code** (PR, pas de déploiement) : `worker/wrangler.toml` → `name = "mydogcanfly-services"` ; `packages/workers/wrangler.toml` (`[env.production]`) → `name = "mydogcanfly-decision-api"`, en cohérence avec `[env.preview]` qui a déjà un nom distinct (`mydogcanfly-api-preview`) — seule la ligne `[env.production].name` change.
3. **Redéploiement du Worker de décision sous le nouveau nom** : geste de Philippe (`npx wrangler deploy --env production` depuis `packages/workers`, une fois le renommage fusionné). Cloudflare créera un nouveau Worker sous ce nom plutôt que d'écraser l'existant — à confirmer par Philippe que c'est bien le comportement souhaité (pas de downtime attendu si les routes `mydogcanfly.com/v1/*` sont réattachées au nouveau nom dans la foulée).
4. **Redéploiement du Worker de services sous son propre nom**, avec son binding D1/KV/cron réel, **seulement après confirmation qu'il existe des abonnés à préserver ou que la fonctionnalité doit repartir de zéro** (document 09 DR-11) — sinon ce Worker peut rester non redéployé si Philippe juge la fonctionnalité (alertes chaleur, rappels) obsolète.
5. **Test de non-collision** : vérifier que les deux domaines (`mydogcanfly.com/v1/health`, `api.mydogcanfly.com/api/...`) répondent chacun avec le service attendu, plus les métadonnées de version proposées en DR-09.

## Ce que ce plan ne décide pas

- Si la fonctionnalité du Worker legacy (alertes chaleur par email, rappels, désinscription) doit être conservée, réécrite en TypeScript dans le même monorepo que `packages/workers`, ou abandonnée — c'est un choix produit, pas seulement technique, qui dépend de la réponse à DR-11 (des abonnés réels existent-ils).
- Le calendrier d'exécution : ce plan peut être un Lot à part entière (renommant le Lot 6 déjà proposé au document 07), séquencé après P0-1/P0-2 mais avant les Lots structurels (5, migration Hugo→V2), puisqu'un abonné qui ne peut plus se désinscrire est un problème de conformité potentiellement urgent.
