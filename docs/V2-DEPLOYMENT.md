# MyDogCanFly V2 — Deployment & Migration Safety

> Goal: see V2 running on a **Cloudflare preview URL** without touching production and without any SEO risk.
> The V2 app lives in `packages/ui` (Astro) + `packages/workers` (API). The current Hugo site at repo root is **not** modified by any of this.

---

## 0. Golden safety rules
- **Production is a separate deploy target.** Preview never routes to `mydogcanfly.com`.
- **Non-production is `noindex` by default** (safe-by-default): unless `PUBLIC_SITE_ENV=production`, every page emits `<meta name="robots" content="noindex, nofollow">` and `robots.txt` returns `Disallow: /`.
- **The API Worker uses a separate name/route per environment.** Preview = `workers.dev` subdomain, no custom route.

---

## 1. Environments

| Env | UI (`packages/ui`) | API (`packages/workers`) | Indexable |
|---|---|---|---|
| **local** | `npm run dev -w @mydogcanfly/ui` (`localhost:4321`) | `npx wrangler dev` (`localhost:8787`) | no (`noindex`) |
| **preview** | Cloudflare Pages **preview** deployment (`*.pages.dev`) | `wrangler deploy --env preview` → `mydogcanfly-api-preview.*.workers.dev` | **no** (`noindex` + `robots Disallow`) |
| **production** | Cloudflare Pages **production** (custom domain, later) | `wrangler deploy --env production` (route `mydogcanfly.com/v1/*`) | yes |

The only switch is the env var **`PUBLIC_SITE_ENV`**:
- unset / `preview` / `local` → **noindex** (safe).
- `production` → indexable + `robots Allow` + sitemap reference.

### `PUBLIC_API_BASE` — where the Finder sends its request

A second, independent env var tells the UI's Flight Finder which Decision Engine (Worker) to call. It is a **build-time** `PUBLIC_` var (inlined by Vite into the Finder island; `src/lib/env.ts` → `API_BASE`). It is orthogonal to `PUBLIC_SITE_ENV`: setting it does **not** affect indexing.

| Env | `PUBLIC_API_BASE` | Finder calls | Notes |
|---|---|---|---|
| **local** | *unset* (same-origin) or `http://localhost:8787` | same-origin static snapshot, **or** `wrangler dev` Worker | Leave unset to use the offline snapshot; point at `localhost:8787` to test the live Worker locally. |
| **preview** | `https://mydogcanfly-api-preview.fromparis.workers.dev` | preview Worker (`workers.dev`, cross-origin, CORS) | UI stays **`noindex`** — only `PUBLIC_API_BASE` is set, `PUBLIC_SITE_ENV` stays unset. Production Hugo is untouched. |
| **production** | *unset* (same-origin) | `/v1/*` served same-origin via the Cloudflare **route** `mydogcanfly.com/v1/*` | No cross-origin, no CORS needed — the Worker route sits on the live domain. |

**Fallback behaviour (all envs):** the Finder first issues `POST ${API_BASE}/v1/finder`. Only if that POST fails (network error or non-2xx) does it fall back to `GET ${API_BASE}/v1/finder`, and the UI also ships a same-origin static `/v1/finder` snapshot (real pipeline, computed at build). **This GET/static path is only a safety net** — when the Worker is reachable (as in preview and production) the POST succeeds and no fallback GET is issued.

Build/deploy the preview with the Worker wired in (note: `PUBLIC_SITE_ENV` deliberately left unset so the preview stays `noindex`):

```bash
PUBLIC_API_BASE=https://mydogcanfly-api-preview.fromparis.workers.dev npm run build
npx wrangler pages deploy packages/ui/dist --project-name mydogcanfly-v2-preview --branch preview --commit-dirty=true
```

---

## 2. Cloudflare Pages — preview deployment

Create a **new, separate Pages project** (do NOT attach the production domain):

- **Framework preset:** Astro
- **Root directory:** `packages/ui`
- **Build command:** `npm --prefix ../.. install && npm --prefix ../.. run build`
  (installs the workspace once, then runs the root `build` script = `astro build` for `@mydogcanfly/ui`)
- **Build output directory:** `packages/ui/dist`
- **Environment variables:** leave `PUBLIC_SITE_ENV` **unset** (or `preview`) so the preview stays `noindex`.

Result: a `https://<project>.pages.dev` URL that is fully functional and **not indexable**. Production Pages/Hugo is untouched.

> Note: the Astro app is a monorepo package. If Pages' root-directory build has trouble with the workspace, an alternative is to build locally (`npm run build`) and use **Direct Upload**: `npx wrangler pages deploy packages/ui/dist --project-name mydogcanfly-v2-preview`.

---

## 3. Worker API — route plan

| Env | Command | Surface |
|---|---|---|
| local | `npx wrangler dev` (in `packages/workers`) | `http://localhost:8787/v1/finder` |
| **preview** | `npx wrangler deploy --env preview` | `https://mydogcanfly-api-preview.<sub>.workers.dev/v1/*` — **no custom route** |
| production (later) | `npx wrangler deploy --env production` | route `mydogcanfly.com/v1/*` (same-origin for the UI) |

Endpoints: `POST /v1/finder` (real input), `GET /v1/finder` (default demo), `GET /v1/health`.
CORS is enabled, so the preview UI can call the preview Worker cross-origin (`*.workers.dev`).

During preview, point the UI's Finder at the preview Worker if you want the live dynamic path; otherwise the UI's built-in static `/v1/finder` snapshot (real pipeline at build time) works as an offline fallback.

---

## 4. Pre-deploy checklist

Run from repo root — all must pass:

```bash
npm run check        # knowledge quality gates (schema · rules · coverage)
npm run typecheck    # knowledge · engine · workers
npm run smoke        # engine live via Worker (EN + FR + partners + affiliate safeguard)
npm run build        # Astro static build (Cloudflare Pages)
```

Then verify the build artifacts:

- [ ] `packages/ui/dist/robots.txt` → `Disallow: /` (preview) or `Allow: /` + `Sitemap:` (production)
- [ ] `packages/ui/dist/sitemap.xml` exists and lists EN + FR URLs with hreflang alternates
- [ ] Sample pages contain `<meta name="robots" content="noindex, nofollow">` on preview, and **do not** on production
- [ ] `hreflang` + self-canonical present on entity pages
- [ ] No affiliate/sponsored outbound link for non-`active` partners
- [ ] Internal link check: 0 broken

---

## 5. Sitemap verification

- Generated at build by `src/pages/sitemap.xml.ts` from the Knowledge Base (both locales, hreflang).
- Verify: `test -s packages/ui/dist/sitemap.xml && grep -c "<loc>" packages/ui/dist/sitemap.xml`
- On production, `robots.txt` references it; on preview it exists but crawling is blocked by `Disallow: /`.

---

## 6. Robots / noindex for preview

- **`robots.txt`** is environment-driven (`src/pages/robots.txt.ts`): `Disallow: /` unless `PUBLIC_SITE_ENV=production`.
- **Per-page meta**: `<meta name="robots" content="noindex, nofollow">` on every page unless production (`src/lib/env.ts` → `Base.astro`).
- Double protection means a preview deploy cannot be indexed even if `robots.txt` is ignored by a crawler.

---

## 7. Rollback

Everything is additive and isolated; rollback never affects production Hugo.

- **UI (Pages preview):** in the Cloudflare Pages dashboard → the preview project → *Deployments* → **Rollback** to a previous deployment (one click). Or redeploy a previous commit.
- **Worker preview:** `npx wrangler rollback --env preview` (reverts to the previous Worker version), or `npx wrangler deployments list` then `wrangler rollback [id] --env preview`.
- **Git:** the V2 stack lives entirely under `packages/`, `docs/`, `ARCHITECTURE_DECISIONS.md`, root `package.json`/`tsconfig.base.json`. Reverting those commits removes V2 without touching `content/`, `layouts/`, `themes/` (the Hugo production site).
- **Production go-live is a deliberate, separate step**: only `wrangler deploy --env production` + attaching the domain to the V2 Pages project + setting `PUBLIC_SITE_ENV=production` makes V2 live. Until then, production stays 100% Hugo.

---

## 8. Going to production (later — not now)
1. Set `PUBLIC_SITE_ENV=production` on the production Pages project.
2. `wrangler deploy --env production` (routes `mydogcanfly.com/v1/*`).
3. Attach the domain to the V2 Pages project (replacing Hugo) once validated.
4. Confirm `robots.txt` = `Allow: /` + sitemap, and pages have no `noindex`.
5. Submit `sitemap.xml` in Search Console.
