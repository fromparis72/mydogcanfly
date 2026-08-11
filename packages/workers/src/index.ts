import { loadKB, LOCALES } from "@mydogcanfly/knowledge";
import { FinderRequest, runFinder, DestinationsRequest, rankDestinations } from "@mydogcanfly/engine";

/**
 * The API layer only (ADR-0010). No business logic, no data — those live in
 * @mydogcanfly/engine and @mydogcanfly/knowledge. This Worker does routing + HTTP + CORS.
 *
 *   Knowledge → Normalization → Decision Engine → Explanation Engine → Decision Report
 *   (loadKB)                    (runFinder = evaluate → explain)
 */

// Normalize the knowledge base once, at cold start, and reuse across requests (low-cost).
const kb = loadKB();

const CORS: Record<string, string> = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

const json = (data: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS, ...extraHeaders },
  });

/* ── GET /v1/finder : lire la requête, ne jamais l'inventer ────────────────────────────
 *
 * Cet endpoint renvoyait, pour TOUTE requête GET, une démo « CDG → Tokyo, Golden Retriever ».
 * Un rapport complet, crédible, daté de l'instant — pour un voyage que personne n'avait
 * demandé. Combiné au repli silencieux du Finder (voir FlightFinder.astro), un visiteur a vu
 * apparaître Tokyo dans ses résultats et nous l'a signalé le 30/07/2026.
 *
 * Désormais : GET lit la query string, et s'il n'y a rien à lire il répond 400 avec le mode
 * d'emploi. Aucune réponse de cet endpoint ne peut plus être un rapport que personne n'a
 * demandé.
 */
const IATA_RE = /^[A-Za-z]{3}$/;

/** « CDG » ou « airport_cdg » → l'identifiant de la KB, ou null si l'aéroport est inconnu. */
function airportId(raw: string): string | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  const id = v.startsWith("airport_") ? v : IATA_RE.test(v) ? `airport_${v}` : "";
  return id && kb.airports.has(id) ? id : null;
}

/** « labrador_retriever » ou « breed_labrador_retriever » → identifiant de race, ou null. */
function breedId(raw: string): string | null {
  const v = raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (!v) return null;
  const id = v.startsWith("breed_") ? v : `breed_${v}`;
  return kb.breeds.has(id) ? id : null;
}

/* Locale : jamais fatal. `t()` (packages/knowledge/src/i18n.ts) retombe déjà gracieusement sur
 * l'anglais pour toute clé/locale manquante — une valeur invalide ici suit la même philosophie :
 * on l'ignore silencieusement (le schéma appliquera son défaut "en") plutôt que de renvoyer 400
 * pour un paramètre purement cosmétique. `LOCALES` (8 valeurs, schéma) est plus large que
 * `UI_LOCALES` (4 valeurs, réellement traduites) — de/it/nl/ja passent le schéma mais s'affichent
 * intégralement en anglais aujourd'hui ; documenté, pas un bug (cf. usage ci-dessous). */
function normalizeLocale(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const v = raw.trim().toLowerCase();
  return (LOCALES as readonly string[]).includes(v) ? v : undefined;
}

type QueryResult =
  | { ok: true; input: Record<string, unknown> }
  | { ok: false; body: Record<string, unknown> };

/* BUG corrigé (audit du 09/08/2026) : POST /v1/finder et POST /v1/destinations envoyaient
 * origin/destination/dog.breed_id BRUTS à FinderRequest.parse/DestinationsRequest.parse, qui ne
 * vérifient que le TYPE (z.string()), jamais l'existence dans le référentiel — contrairement à GET,
 * qui passe déjà par airportId()/breedId(). Reproduit en direct : POST avec un breed_id inconnu
 * répondait 200 "conditional" pour un chien fictif (poids retombé à 0 kg par défaut, evaluate.ts) ;
 * un aéroport inconnu répondait 200 avec un pays de destination vide plutôt qu'un 400 propre.
 * Cette fonction applique désormais la MÊME vérification qu'en GET, à un body JSON. */
type IdCheck = { ok: true; value: Record<string, unknown> } | { ok: false; body: Record<string, unknown> };
function validateJsonIds(input: unknown, opts: { requireDestination: boolean }): IdCheck {
  const usage = { note: "origin/destination accept an IATA code or a full airport id; breed_id likewise." };
  if (typeof input !== "object" || input === null) {
    return { ok: false, body: { error: "invalid_request", detail: "expected a JSON object body", ...usage } };
  }
  const src = input as Record<string, unknown>;
  const out: Record<string, unknown> = { ...src };

  const rawOrigin = typeof src.origin === "string" ? src.origin : "";
  if (!rawOrigin) return { ok: false, body: { error: "missing_parameters", missing: ["origin"], ...usage } };
  const oid = airportId(rawOrigin);
  if (!oid) return { ok: false, body: { error: "unknown_airport", unknown: [`origin=${rawOrigin}`], ...usage } };
  out.origin = oid;

  if (opts.requireDestination) {
    const rawDest = typeof src.destination === "string" ? src.destination : "";
    if (!rawDest) return { ok: false, body: { error: "missing_parameters", missing: ["destination"], ...usage } };
    const did = airportId(rawDest);
    if (!did) return { ok: false, body: { error: "unknown_airport", unknown: [`destination=${rawDest}`], ...usage } };
    out.destination = did;
  }

  const normSet = (key: string): string[] | undefined => {
    const raw = src[key];
    if (!Array.isArray(raw)) return undefined;
    const ids = raw.filter((x): x is string => typeof x === "string").map((s) => airportId(s)).filter((x): x is string => !!x);
    return ids.length > 1 ? ids : undefined;
  };
  if ("origins" in src) out.origins = normSet("origins");
  if ("destinations" in src) out.destinations = normSet("destinations");

  const rawDog = src.dog;
  const dog: Record<string, unknown> = (typeof rawDog === "object" && rawDog !== null) ? { ...(rawDog as Record<string, unknown>) } : {};
  const rawBreed = typeof dog.breed_id === "string" ? dog.breed_id : "";
  if (rawBreed) {
    const bid = breedId(rawBreed);
    if (!bid) return { ok: false, body: { error: "unknown_breed", unknown: [`breed_id=${rawBreed}`], ...usage } };
    dog.breed_id = bid;
  }
  out.dog = dog;

  const normalizedLocale = normalizeLocale(typeof src.locale === "string" ? src.locale : undefined);
  if ("locale" in src) out.locale = normalizedLocale;

  return { ok: true, value: out };
}

/* Limitation de débit — best effort, pas une solution complète (audit du 09/08/2026).
 * Aucune protection n'existait avant. Ce qui suit est délibérément modeste : un compteur glissant
 * EN MÉMOIRE, par isolate Cloudflare Worker. Ça ne partage rien entre isolates/régions (un
 * attaquant distribué le contourne trivialement) et ça se réinitialise à chaque recyclage
 * d'isolate — donc PAS une protection anti-abus sérieuse. C'est un filet minimal contre un script
 * mal écrit qui boucle sur un seul point d'entrée, posé sans ajouter de binding KV/Durable Object
 * (aucun n'existe dans wrangler.toml aujourd'hui, et en poser un sans pouvoir le tester ici serait
 * plus risqué qu'utile). La vraie protection anti-abus pour une Worker déjà derrière Cloudflare
 * est une règle de rate-limiting posée au niveau de la zone (dashboard Cloudflare, gratuit) — hors
 * de portée de ce dépôt de code, à faire côté configuration.
 */
const RATE_LIMIT_MAX = 60; // requêtes
const RATE_LIMIT_WINDOW_MS = 60_000; // par minute
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function isRateLimited(clientId: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(clientId);
  if (!bucket || now >= bucket.resetAt) {
    rateBuckets.set(clientId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }
  bucket.count++;
  return bucket.count > RATE_LIMIT_MAX;
}

function finderInputFromQuery(q: URLSearchParams): QueryResult {
  const usage = {
    // BUG doc corrigé (audit du 09/08/2026) : "pt" manquait alors qu'il est traduit à 100 % au
    // même titre qu'en/fr/es (packages/knowledge/translations/pt/). "de|fr|it|nl|ja" restent
    // acceptés par le schéma mais ne sont PAS traduits — ils s'affichent intégralement en anglais,
    // silencieusement (t(), packages/knowledge/src/i18n.ts). Documenté ici plutôt que découvert.
    usage: "GET /v1/finder?origin=CDG&destination=NRT&weight_kg=8[&breed=pug][&date=2026-08-15][&placement=cabin|hold|cargo|any][&locale=en|fr|es|pt]",
    note: "origin and destination accept an IATA code or a full airport id. POST accepts the same fields as JSON. locale=en|fr|es|pt are fully translated; other schema-valid locales silently render in English.",
  };
  const origin = q.get("origin") ?? q.get("from") ?? "";
  const destination = q.get("destination") ?? q.get("to") ?? "";
  // Aucun paramètre : ce n'est pas une requête, c'est une visite à vide. On ne devine rien.
  if (![...q.keys()].length) return { ok: false, body: { error: "missing_parameters", ...usage } };

  const missing = [!origin && "origin", !destination && "destination"].filter(Boolean);
  if (missing.length) return { ok: false, body: { error: "missing_parameters", missing, ...usage } };

  const oid = airportId(origin), did = airportId(destination);
  const unknown = [oid ? null : `origin=${origin}`, did ? null : `destination=${destination}`].filter(Boolean);
  if (unknown.length) return { ok: false, body: { error: "unknown_airport", unknown, ...usage } };

  // Les listes d'aéroports (recherche par ville : Paris = CDG + ORY) sont acceptées mais un
  // code inconnu est ignoré plutôt que fatal : le représentant, lui, a déjà été validé.
  const set = (key: string) => {
    const raw = (q.get(key) ?? "").split(",").map((s) => airportId(s)).filter((x): x is string => !!x);
    return raw.length > 1 ? raw : undefined;
  };

  const breedRaw = q.get("breed") ?? q.get("breed_id") ?? "";
  const bid = breedRaw ? breedId(breedRaw) : null;
  if (breedRaw && !bid) return { ok: false, body: { error: "unknown_breed", unknown: [`breed=${breedRaw}`], ...usage } };

  /* Paramètre numérique : ABSENT et INVALIDE sont deux cas différents, et les confondre était un
   * défaut (arbitrage Codex, 11/08/2026). L'ancienne version renvoyait `undefined` dans les deux
   * cas : `weight_kg=beaucoup` ou `weight_kg=-5` étaient silencieusement abandonnés, et le moteur
   * répondait un verdict assuré pour un chien SANS poids connu — un score différent, sans le
   * moindre signal que la saisie avait été ignorée. Même famille de panne que le rapport
   * « CDG → Tokyo » servi à des requêtes que personne n'avait faites.
   *
   * Désormais : absent → `undefined` (poids/température inconnus, cas d'usage légitime) ;
   * présent mais vide, non numérique ou non fini → l'invalidité est COLLECTÉE et la requête
   * répond 400 `invalid_request` en nommant le paramètre. Les bornes de valeur (poids > 0 et
   * ≤ 120), elles, restent du ressort du schéma Zod — qui les appliquait déjà au POST ; il suffit
   * de ne plus filtrer la valeur avant qu'il la voie. */
  const invalidNums: string[] = [];
  const num = (key: string) => {
    const v = q.get(key);
    if (v == null) return undefined;
    const n = v.trim() === "" ? NaN : Number(v);
    if (!Number.isFinite(n)) {
      invalidNums.push(`${key}=${v}`);
      return undefined;
    }
    return n;
  };
  const weight = num("weight_kg");
  const temp = num("temperature_c");
  if (invalidNums.length) {
    return { ok: false, body: { error: "invalid_request", invalid: invalidNums, ...usage } };
  }

  return {
    ok: true,
    input: {
      origin: oid,
      destination: did,
      origins: set("origins"),
      destinations: set("destinations"),
      dog: { breed_id: bid ?? undefined, weight_kg: weight },
      travel_type: q.get("travel_type") ?? undefined,
      placement: q.get("placement") ?? undefined,
      date: q.get("date") ?? undefined,
      weather: temp != null ? { temperature_c: temp } : undefined,
      locale: normalizeLocale(q.get("locale")), // valeur invalide → undefined → défaut "en" du schéma, jamais 400
    },
  };
}

/* Erreur Zod → réponse propre (audit du 09/08/2026). BUG corrigé : le catch générique renvoyait
 * `String(e)`, soit le dump complet d'un ZodError (chemins de champs, structure du schéma,
 * options d'enum) — une forme d'erreur différente et non documentée par rapport au contrat
 * {error, unknown/missing, usage} que ce même endpoint annonce pour origin/destination/breed.
 * Reproduit en direct : `locale=xx` (sinon requête valide) renvoyait ce dump au lieu d'un 400 net.
 */
function formatError(e: unknown): { error: string; detail: string } {
  if (e && typeof e === "object" && "issues" in e && Array.isArray((e as { issues: unknown }).issues)) {
    const issues = (e as { issues: { path: (string | number)[]; message: string }[] }).issues;
    const detail = issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
    return { error: "invalid_request", detail };
  }
  return { error: "invalid_request", detail: e instanceof Error ? e.message : String(e) };
}

/* Traçabilité du déploiement (exigée par Codex avant production, 11/08/2026 ; DR-09 du
 * document 09 de l'inventaire). Jusqu'ici, rien dans la réponse du Worker ne permettait de
 * savoir QUEL commit était réellement déployé : le document 10 de l'inventaire a dû retirer
 * l'affirmation « le Worker reflète bien origin/main », faute justement de `git_sha` exposé.
 *
 * `BUILD_SHA` est une variable Cloudflare injectée au déploiement :
 *   npx wrangler deploy --env preview --var BUILD_SHA:$(git rev-parse HEAD)
 *
 * Volontairement optionnelle, avec repli sur "unknown" : un déploiement fait sans le drapeau
 * doit rester fonctionnel, et afficher honnêtement qu'il n'est pas traçable — plutôt que de
 * casser /v1/health (que le monitoring interroge) ou, pire, d'afficher un SHA figé au build
 * précédent qui laisserait croire à une traçabilité qui n'existe pas. */
interface Env {
  BUILD_SHA?: string;
  /* Binding Cloudflare « Version Metadata » (déclaré dans wrangler.toml). Cloudflare le
   * renseigne lui-même : contrairement à BUILD_SHA, sa valeur n'est PAS déclarative.
   * C'est toute la différence relevée par Codex le 11/08/2026 — `BUILD_SHA` est ce que la
   * commande de déploiement a bien voulu annoncer, et rien ne garantit à lui seul qu'il
   * corresponde au code réellement téléversé. Le couple des deux, lui, est vérifiable :
   * l'ID de version est attribué par Cloudflare au code qu'il a effectivement reçu. */
  CF_VERSION_METADATA?: { id: string; tag?: string };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === "/v1/health")
      /* `Cache-Control: no-store` explicite. L'absence de `CF-Cache-Status` observée sur nos
       * relevés n'est PAS une interdiction contractuelle de mise en cache — Cloudflare
       * documente qu'omettre `Cache-Control` n'équivaut pas à désactiver le cache. Or c'est
       * précisément l'endpoint dont dépend la vérification post-déploiement : une réponse
       * servie depuis un cache y ferait conclure à tort qu'un déploiement n'est pas passé. */
      return json(
        {
          ok: true,
          service: "mydogcanfly-api",
          version: "v1",
          sha: env?.BUILD_SHA ?? "unknown",
          worker_version_id: env?.CF_VERSION_METADATA?.id ?? "unknown",
        },
        200,
        { "cache-control": "no-store" },
      );

    // Limitation de débit best-effort (cf. commentaire sur isRateLimited) — hors santé/CORS, qui
    // doivent toujours répondre pour que le monitoring et les navigateurs ne cassent jamais.
    const clientId = request.headers.get("cf-connecting-ip") ?? "unknown";
    if (isRateLimited(clientId)) {
      return json({ error: "rate_limited", detail: `Max ${RATE_LIMIT_MAX} requests/minute per client.` }, 429);
    }

    // Departure airport from Cloudflare's edge geolocation (no browser prompt, privacy-friendly).
    // Strategy: the PRIMARY international airport of the visitor's CITY — not the closest by distance.
    // e.g. a visitor in Paris always gets CDG, never Orly, even if physically next to Orly.
    if (url.pathname === "/v1/nearest-airport") {
      const cf = (request as unknown as { cf?: { latitude?: string; longitude?: string; city?: string } }).cf;
      const lat = cf?.latitude != null ? parseFloat(cf.latitude) : NaN;
      const lon = cf?.longitude != null ? parseFloat(cf.longitude) : NaN;
      const airports = [...kb.airports.values()].filter((a) => a.geo);
      const norm = (s: string) => s.trim().toLowerCase();

      // Multi-airport cities → the one flagship international gateway. Keyed by geolocated city name.
      const CITY_PRIMARY: Record<string, string> = {
        "paris": "airport_cdg", "london": "airport_lhr", "milan": "airport_mxp", "milano": "airport_mxp",
        "rome": "airport_fco", "roma": "airport_fco", "istanbul": "airport_ist", "moscow": "airport_svo",
        "berlin": "airport_ber", "stockholm": "airport_arn", "oslo": "airport_osl", "tokyo": "airport_hnd",
        "osaka": "airport_kix", "seoul": "airport_icn", "shanghai": "airport_pvg", "beijing": "airport_pek",
        "bangkok": "airport_bkk", "new york": "airport_jfk", "washington": "airport_iad", "chicago": "airport_ord",
        "houston": "airport_iah", "san francisco": "airport_sfo", "los angeles": "airport_lax", "toronto": "airport_yyz",
        "montreal": "airport_yul", "montréal": "airport_yul", "são paulo": "airport_gru", "sao paulo": "airport_gru",
        "buenos aires": "airport_eze", "rio de janeiro": "airport_gig", "dubai": "airport_dxb", "jakarta": "airport_cgk",
        "mexico city": "airport_mex", "ciudad de méxico": "airport_mex", "delhi": "airport_del", "new delhi": "airport_del",
        "mumbai": "airport_bom", "johannesburg": "airport_jnb", "taipei": "airport_tpe", "kuala lumpur": "airport_kul",
      };

      let best = kb.airports.get("airport_cdg");
      const city = norm(cf?.city ?? "");
      const primaryId = city ? CITY_PRIMARY[city] : undefined;
      const cityMatch = city ? airports.find((a) => a.city && norm(a.city) === city) : undefined;

      if (primaryId && kb.airports.get(primaryId)) {
        best = kb.airports.get(primaryId); // curated flagship for known multi-airport cities
      } else if (cityMatch) {
        best = cityMatch; // single-airport city: match the airport that names this city
      } else if (Number.isFinite(lat) && Number.isFinite(lon) && airports.length) {
        // Last-resort fallback only when the city gives us nothing: nearest by distance.
        const rad = (d: number) => (d * Math.PI) / 180;
        const dist = (glat: number, glon: number) => {
          const dLat = rad(glat - lat), dLon = rad(glon - lon);
          const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat)) * Math.cos(rad(glat)) * Math.sin(dLon / 2) ** 2;
          return 2 * 6371 * Math.asin(Math.sqrt(x));
        };
        best = airports.reduce((m, a) => (dist(a.geo!.lat, a.geo!.lon) < dist(m!.geo!.lat, m!.geo!.lon) ? a : m), airports[0]);
      }

      // Weight unit convention by country (config): imperial (lb) for US & UK, metric (kg) elsewhere.
      const LB_COUNTRIES = new Set(["country_us", "country_gb"]);
      const unit = best && LB_COUNTRIES.has(best.country_id) ? "lb" : "kg";
      return json({ airport_id: best?.id ?? "airport_cdg", iata: best?.iata ?? null, city: best?.city ?? null, unit, from_city: cf?.city ?? null });
    }

    if (url.pathname === "/v1/finder") {
      try {
        let input: unknown;
        if (request.method === "POST") {
          const body = await request.json();
          // Même vérification référentielle qu'en GET (airportId/breedId) — voir validateJsonIds.
          const checked = validateJsonIds(body, { requireDestination: true });
          if (!checked.ok) return json(checked.body, 400);
          input = checked.value;
        } else {
          const q = finderInputFromQuery(url.searchParams);
          if (!q.ok) return json(q.body, 400);
          input = q.input;
        }
        const req = FinderRequest.parse(input);
        return json(runFinder(kb, req)); // → typed DecisionReport, same contract as the UI
      } catch (e) {
        console.error("/v1/finder error:", e); // observabilité (audit du 09/08/2026) — rien n'était loggé côté serveur
        return json(formatError(e), 400);
      }
    }

    // Destination finder: "where can I fly my dog on this date?" — scans every reachable country.
    if (url.pathname === "/v1/destinations") {
      try {
        const body = await request.json();
        const checked = validateJsonIds(body, { requireDestination: false });
        if (!checked.ok) return json(checked.body, 400);
        const req = DestinationsRequest.parse(checked.value);
        return json(rankDestinations(kb, req)); // → { matches, candidates_total }
      } catch (e) {
        console.error("/v1/destinations error:", e);
        return json(formatError(e), 400);
      }
    }

    return json({ error: "not_found" }, 404);
  },
};
