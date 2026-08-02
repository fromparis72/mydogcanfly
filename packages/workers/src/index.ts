import { loadKB } from "@mydogcanfly/knowledge";
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

const json = (data: unknown, status = 200): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", ...CORS },
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

type QueryResult =
  | { ok: true; input: Record<string, unknown> }
  | { ok: false; body: Record<string, unknown> };

function finderInputFromQuery(q: URLSearchParams): QueryResult {
  const usage = {
    usage: "GET /v1/finder?origin=CDG&destination=NRT&weight_kg=8[&breed=pug][&date=2026-08-15][&placement=cabin|hold|cargo|any][&locale=en|fr|es]",
    note: "origin and destination accept an IATA code or a full airport id. POST accepts the same fields as JSON.",
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

  const num = (key: string) => {
    const v = q.get(key);
    if (v == null || v.trim() === "") return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  const weight = num("weight_kg");
  const temp = num("temperature_c");

  return {
    ok: true,
    input: {
      origin: oid,
      destination: did,
      origins: set("origins"),
      destinations: set("destinations"),
      dog: { breed_id: bid ?? undefined, weight_kg: weight && weight > 0 ? weight : undefined },
      travel_type: q.get("travel_type") ?? undefined,
      placement: q.get("placement") ?? undefined,
      date: q.get("date") ?? undefined,
      weather: temp != null ? { temperature_c: temp } : undefined,
      locale: q.get("locale") ?? undefined,
    },
  };
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
    if (url.pathname === "/v1/health") return json({ ok: true, service: "mydogcanfly-api", version: "v1" });

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
          input = await request.json();
        } else {
          const q = finderInputFromQuery(url.searchParams);
          if (!q.ok) return json(q.body, 400);
          input = q.input;
        }
        const req = FinderRequest.parse(input);
        return json(runFinder(kb, req)); // → typed DecisionReport, same contract as the UI
      } catch (e) {
        return json({ error: "invalid_request", detail: String(e) }, 400);
      }
    }

    // Destination finder: "where can I fly my dog on this date?" — scans every reachable country.
    if (url.pathname === "/v1/destinations") {
      try {
        const input = await request.json();
        const req = DestinationsRequest.parse(input);
        return json({ matches: rankDestinations(kb, req) });
      } catch (e) {
        return json({ error: "invalid_request", detail: String(e) }, 400);
      }
    }

    return json({ error: "not_found" }, 404);
  },
};
