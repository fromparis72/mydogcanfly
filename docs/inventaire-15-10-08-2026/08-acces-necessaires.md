# §15.8 — Accès réellement nécessaires, avec niveau minimal

**SHA de référence : `e2b27799de335558afc165ee1763ad4613ca4ed9` (origin/main).**
Aucun des accès listés ci-dessous n'est configuré aujourd'hui dans cette session (vérifié : `gh` non authentifiée, aucun credential d'écriture Git, aucun token Cloudflare). Cette liste sert de base de décision pour Philippe — rien n'est demandé à être collé dans cette conversation.

## 1. GitHub — accès minimal proposé

| Élément | Recommandation | Justification |
|---|---|---|
| Type de credential | **Fine-grained Personal Access Token**, scope limité au seul dépôt `mydogcanfly` (jamais un token classique à portée organisation/compte) | Réduit la surface en cas de fuite ; c'est la recommandation officielle GitHub pour un accès automatisé restreint. |
| Permissions du token | Lecture complète du dépôt + écriture sur les branches (contents: write) + Pull requests: write. **Pas** de droits Administration, pas de droits Actions au-delà de la lecture (sauf si Claude doit elle-même créer le workflow CI du Lot 1, auquel cas `workflows: write` doit être accordé explicitement et temporairement pour ce lot précis). | Correspond exactement à ce que le mode cible du document 06 nécessite : créer des branches `v2/*`, y pousser, ouvrir des PR. |
| Protection réelle de `main` | **Ruleset GitHub** sur `main` (PR obligatoire, CI requise, conversations résolues, force-push interdit, fusion réservée à Philippe) | Un token, même scoped, ne peut pas à lui seul garantir l'impossibilité d'écrire sur `main` — c'est une politique de dépôt, pas une propriété du credential (remarque technique déjà actée). |
| Stockage | Géré par Philippe, jamais collé dans une conversation ni stocké dans le sandbox cloud de Claude au-delà de la session où il est utilisé | Cohérent avec la pratique de sécurité déjà en vigueur pour ce projet. |
| Alternative à considérer | Une intégration GitHub officielle / GitHub App dédiée à ce chantier, si l'organisation de Philippe le permet, plutôt qu'un PAT personnel | Plus auditable (permissions granulaires par app), révocable indépendamment d'un compte utilisateur. |

## 2. Cloudflare — accès minimal proposé

| Élément | Recommandation | Justification |
|---|---|---|
| Token de production | **Aucun token de production accordé à Claude.** | Le déploiement en production doit rester un geste humain délibéré (cohérent avec `docs/V2-DEPLOYMENT.md` §8, qui présente déjà le passage en production comme une étape séparée et volontaire). |
| Déploiement preview | Idéalement automatisé **depuis GitHub** (Cloudflare Pages/Workers connectés au dépôt, déploiement de preview déclenché par PR), plutôt que par un token détenu par Claude | Élimine le besoin même d'un token Cloudflare côté Claude pour l'essentiel du travail de refonte. |
| Si un token est malgré tout nécessaire plus tard | Scope le plus étroit possible (déploiement preview uniquement, pas de portée compte/zone globale), stocké dans les secrets de la plateforme CI (jamais en clair, jamais dans une conversation) | Reprend directement la recommandation de Philippe. |
| Lecture de logs de production | Accès en lecture seule aux logs (`wrangler tail` scoped ou équivalent), si et seulement si un diagnostic de production l'exige, à accorder au cas par cas plutôt qu'en permanence | Permet le diagnostic (ex. confirmer laquelle des deux configurations Worker du document 02 est réellement active) sans droit de déploiement. |

## 3. Ce qui N'est PAS demandé

- Aucune clé API globale Cloudflare.
- Aucun accès administrateur du dépôt GitHub.
- Aucun droit de fusion sur `main` ou `rebuild/v2`.
- Aucun mot de passe, secret applicatif (Resend, Open-Meteo…) : ces éléments restent dans les secrets Cloudflare/GitHub existants, gérés par Philippe.

## 4. Séquencement recommandé

1. Philippe met en place le ruleset GitHub sur `main` (indépendant de tout accès accordé à Claude — une politique de dépôt).
2. Philippe crée le PAT fine-grained scoped, ou configure l'intégration GitHub choisie.
3. Une fois ce PAT actif, Claude peut créer la branche `v2/` du Lot 1 (CI) et ouvrir la première vraie PR — qui inclura ce même inventaire §15, transformé en document versionné du dépôt comme l'exige le protocole.
4. La question Cloudflare (preview auto-déployé depuis GitHub, ou token scoped) peut être réglée en parallèle, sans bloquer le point 3 — la CI et les PR ne nécessitent pas d'accès Cloudflare.

Ce document ne fixe pas de délai : c'est un point de décision pour Philippe (document 09), pas une action que Claude peut engager seule.
