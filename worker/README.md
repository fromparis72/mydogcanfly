# mydogcanfly-api — Cloudflare Worker

Backend for the heat tool (weather proxy + alerts) and the formalities lead-capture
(rétroplanning + dated reminders). See `../PHASE-2-BACKEND-SPEC.md` for the design.

This is a **skeleton**: it runs, but the plan step rules (`DEST_RULES` in
`src/worker.js`) are minimal placeholders — wire them to the real country lead-times
before going live.

## Endpoints

| Method | Route | Purpose |
|---|---|---|
| GET  | `/api/weather?lat=&lon=` | cached weather (30 min per ~11 km cell) |
| POST | `/api/subscribe/heat` | `{email,lat,lon,place,threshold,consent}` |
| POST | `/api/subscribe/plan` | `{email,pet,origin,destination,travelDate,consent}` |
| GET  | `/api/confirm?token=` | double opt-in confirmation |
| GET  | `/api/unsubscribe?token=` | one-click unsubscribe |
| cron | hourly | heat alerts + dated reminders |

Every form must include an empty hidden field named `website` (honeypot) and a
truthy `consent`.

## One-time setup

```bash
cd worker
npm install

# 1) Create resources and paste the IDs into wrangler.toml
wrangler kv namespace create WX_CACHE      # -> id
wrangler d1 create mydogcanfly             # -> database_id

# 2) Create the tables (remote D1)
npm run db:init:remote

# 3) Secrets
wrangler secret put RESEND_API_KEY         # from resend.com (verify your domain + DKIM)
# wrangler secret put OPEN_METEO_KEY       # only for the commercial tier

# 4) Deploy
npm run deploy
```

## DNS / routing

Point a subdomain (e.g. `api.mydogcanfly.com`) at the Worker (Cloudflare dashboard →
Workers Routes, or a custom domain on the Worker). Keep `API_URL` in `wrangler.toml`
in sync with it. CORS is locked to `ALLOWED_ORIGIN`.

## Front-end wiring

- **Heat tool**: replace the direct `api.open-meteo.com` call with
  `${API_URL}/api/weather?lat=..&lon=..`.
- **Subscribe forms**: POST JSON to `/api/subscribe/heat` or `/api/subscribe/plan`
  with the honeypot + consent checkbox.

## Email

Uses **Resend** (`https://api.resend.com/emails`). Verify your sending domain and set
up DKIM/SPF so alerts land in the inbox. If `RESEND_API_KEY` is unset, the Worker logs
instead of sending (safe for local dev).

## GDPR

Double opt-in, explicit un-checked consent box, unsubscribe link in every email,
minimal data stored. Purge unconfirmed `pending` rows after ~7 days (add a cron/query).
