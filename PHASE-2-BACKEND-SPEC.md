# Phase 2 — Spec backend : proxy météo + capture email + alertes

_Architecture cible pour mydogcanfly.com — mutualise deux fonctionnalités sur un seul petit backend Cloudflare : (1) l'outil « Is it too hot for your dog? » et (2) le lead‑capture du rétroplanning des formalités._

---

## 1. Objectif

Le site reste **statique (Hugo → Cloudflare Pages)**. On ajoute **un seul Worker Cloudflare** qui joue trois rôles :

1. **Proxy‑cache météo** — pour ne plus appeler Open‑Meteo depuis le navigateur de chaque visiteur (quota + pas de cache).
2. **Capture d'email** (double opt‑in RGPD) — pour deux « lead magnets » : le rétroplanning daté des formalités, et les alertes chaleur géolocalisées.
3. **Envois programmés (cron)** — alertes chaleur quand un seuil est franchi, et rappels datés des étapes de formalités.

Tout passe par **la même stack, la même base et le même fournisseur d'email**.

---

## 2. Stack Cloudflare

| Brique | Rôle |
|---|---|
| **Cloudflare Pages** | héberge le site statique Hugo (déjà en place). |
| **Cloudflare Workers** | le backend serverless (endpoints API + cron). |
| **Workers KV** | cache météo (clé = zone arrondie, TTL 30 min). |
| **Cloudflare D1** (SQLite) | base des abonnés + étapes datées. |
| **Cron Triggers** | job planifié (évaluation alertes + rappels). |
| **Worker Secrets** | clés API (email, Open‑Meteo commercial le cas échéant). |
| **Fournisseur d'email** | **Resend** recommandé (API HTTP simple, DKIM, 3 000 emails/mois gratuits) — appelable directement depuis un Worker. Alternatives : Postmark, Brevo, AWS SES. _À noter : Cloudflare Email Routing = réception seulement, pas d'envoi transactionnel._ |

> Pourquoi Resend plutôt que MailChannels : l'envoi gratuit MailChannels via Workers n'existe plus. Si tu veux des **séquences visuelles** (drag‑and‑drop) plutôt que du transactionnel piloté par cron, un ESP comme **Brevo** ou **MailerLite** avec automation est une alternative valable.

---

## 3. Composant A — Proxy‑cache météo

**But :** l'outil chaleur appelle *ton* Worker, pas Open‑Meteo directement.

- **Endpoint :** `GET /api/weather?lat={lat}&lon={lon}`
- **Logique :**
  1. Arrondir `lat`/`lon` à ~0.1° (≈ 11 km, granularité « ville ») → clé cache `wx:{latR}:{lonR}`.
  2. Lire KV. Si présent et frais (< 30 min) → renvoyer.
  3. Sinon → `fetch` Open‑Meteo (`current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day`) → stocker en KV (TTL 1800 s) → renvoyer.
- **Réponse :** `{ tempC, feelsC, hum, isDay, place, cached }`
- **Effet :** au lieu d'un appel Open‑Meteo par visiteur, **un seul appel par zone toutes les 30 min**, partagé entre tous les visiteurs. Le quota disparaît.
- **CORS :** limité à `https://mydogcanfly.com`.
- **Rate‑limit :** via Cloudflare (par IP) pour éviter l'abus.

**Modif front (outil chaleur) :** remplacer l'appel `api.open-meteo.com/...` par `/api/weather?lat=..&lon=..`. Le géocodage (recherche/inverse de ville) peut rester côté client ou passer aussi par le Worker si tu veux tout centraliser.

---

## 4. Composant B — Capture d'email (double opt‑in)

Deux points d'entrée, **même mécanique** :

### B1. Rétroplanning des formalités (contenu gated)
- Front : après le calcul, on montre **les 2 premières étapes en clair**, le reste (calendrier daté complet + PDF) **flouté**, avec le formulaire.
- `POST /api/subscribe/plan` → `{ email, pet, origin, destination, travelDate, consent }`
- Worker : valide, crée une ligne D1 (`status = pending`, `token` aléatoire), envoie l'email de **confirmation** (double opt‑in).

### B2. Alertes chaleur géolocalisées
- Front (outil chaleur) : « Prévenez‑moi quand il fait trop chaud pour mon chien ici ».
- `POST /api/subscribe/heat` → `{ email, lat, lon, place, threshold, consent }`
- Même flux : `pending` + email de confirmation.

### Confirmation (commune)
- `GET /api/confirm?token=...` → passe `status = confirmed`, puis :
  - plan → envoie le **rapport complet** (rétroplanning daté) + planifie les rappels ;
  - heat → active la surveillance.
- `GET /api/unsubscribe?token=...` → `status = unsubscribed` (lien présent dans **chaque** email).

---

## 5. Composant C — Envois programmés (cron)

Un **Cron Trigger** (ex. toutes les heures en saison chaude, une fois/jour hors saison) exécute `scheduled()` :

- **Alertes chaleur :** pour chaque abonné `heat` confirmé, lire la météo de sa zone (via le **même cache** que le composant A → coût quasi nul), calculer le niveau de risque (mêmes fonctions que l'outil), envoyer un email si le seuil est franchi. **Anti‑spam : 1 alerte max par abonné par jour** (`last_alert_at`).
- **Rappels de formalités :** pour chaque abonné `plan` confirmé, comparer les **dates d'étapes calculées** à aujourd'hui ; envoyer les rappels dus (« J‑180 : titrage antirabique », « J‑21 : rappel vaccin »…) et marquer `sent_at`.

---

## 6. Modèle de données (D1)

```sql
CREATE TABLE subscribers (
  id           INTEGER PRIMARY KEY,
  type         TEXT NOT NULL,        -- 'plan' | 'heat'
  email        TEXT NOT NULL,
  status       TEXT NOT NULL,        -- 'pending' | 'confirmed' | 'unsubscribed'
  token        TEXT NOT NULL UNIQUE, -- confirm + unsubscribe
  -- heat
  lat REAL, lon REAL, place TEXT, threshold TEXT,
  -- plan
  pet TEXT, origin TEXT, destination TEXT, travel_date TEXT,
  created_at   TEXT, confirmed_at TEXT,
  last_alert_at TEXT, unsub_at TEXT
);

CREATE TABLE plan_steps (          -- rappels datés (type='plan')
  subscriber_id INTEGER,
  step_key      TEXT,              -- 'titer', 'vaccine', 'certificate'…
  due_date      TEXT,             -- date d'envoi calculée
  sent_at       TEXT
);
```

---

## 7. Endpoints (contrat)

| Méthode | Route | Corps / params | Réponse |
|---|---|---|---|
| GET | `/api/weather` | `lat`, `lon` | `{tempC,feelsC,hum,isDay,place,cached}` |
| POST | `/api/subscribe/heat` | `{email,lat,lon,place,threshold,consent}` | `202` |
| POST | `/api/subscribe/plan` | `{email,pet,origin,destination,travelDate,consent}` | `202` |
| GET | `/api/confirm` | `token` | `302` → page « confirmé » |
| GET | `/api/unsubscribe` | `token` | `302` → page « désinscrit » |
| (cron) | `scheduled()` | — | évalue alertes + rappels |

---

## 8. RGPD / conformité

- **Double opt‑in** obligatoire (aucun email envoyé avant confirmation).
- **Consentement explicite** : case à cocher **non pré‑cochée** + finalité affichée (« recevoir mon calendrier daté / mes alertes chaleur »). Base légale = consentement.
- **Lien de désinscription** (token) dans **chaque** email.
- **Minimisation** : on ne stocke que l'email + la localisation approximative (ville/zone, pas l'adresse précise) + les préférences.
- **Rétention** : purge automatique des `pending` non confirmés après ~7 jours.
- Mettre à jour la **page Politique de confidentialité** (elle existe déjà) : finalités, durée, fournisseur d'email, droit d'accès/suppression.

---

## 9. Sécurité / anti‑abus

- **CORS** restreint à `mydogcanfly.com`.
- **Rate‑limit** (Cloudflare) sur `/api/subscribe/*` et `/api/weather`.
- **Honeypot** (champ caché) sur les formulaires anti‑bot.
- Le double opt‑in **empêche** d'inscrire l'email d'un tiers.
- **Secrets** (clé Resend, éventuelle clé Open‑Meteo commerciale) en Worker Secrets, jamais dans le front.

---

## 10. Coûts & quotas (ordre de grandeur)

| Service | Palier gratuit | Au‑delà |
|---|---|---|
| Workers | 100 000 req/jour | ~5 $/mois (plan payant) |
| KV | généreux (lectures massives) | négligeable |
| D1 | ~5 M lectures/jour | négligeable à cette échelle |
| Resend | 3 000 emails/mois | ~20 $/mois (50 k) |
| Open‑Meteo | gratuit non‑commercial ; **le proxy‑cache réduit le volume serveur à ~1 appel/zone/30 min** | offre API commerciale si fort trafic |

À l'échelle de démarrage, le tout tient **dans les paliers gratuits** ou pour quelques dollars/mois.

---

## 11. Phasage recommandé

- **Phase 2a — Proxy‑cache météo.** Le plus petit et le plus urgent : débloque l'outil chaleur en production sans risque de quota. (Worker + KV + bascule de l'URL côté front.)
- **Phase 2b — Capture email + double opt‑in + envoi du rapport.** Débloque le lead‑capture du rétroplanning (le gros levier d'acquisition). (Endpoints subscribe/confirm + D1 + Resend.)
- **Phase 2c — Cron : alertes chaleur + rappels datés.** La rétention et la valeur récurrente. (Cron + `scheduled()`.)

---

## 12. Décisions à trancher avant de coder

1. **Fournisseur d'email** : Resend (transactionnel + cron, recommandé) **ou** un ESP avec automation visuelle (Brevo/MailerLite) si tu préfères piloter les séquences dans une interface.
2. **Open‑Meteo** : rester sur le gratuit derrière le proxy‑cache (suffisant au début) **ou** prendre l'offre commerciale dès le lancement pour être 100 % « clean » côté licence.
3. **Seuils** de l'alerte chaleur (à quel niveau on déclenche : « High » ? « Danger » ?) et **fréquence max** (1/jour proposé).
4. **Sourcing** des seuils affichés (bitume, 85 °F d'embargo) pour la crédibilité et le GEO.
