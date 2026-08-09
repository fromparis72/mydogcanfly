import type { NormalizedKB } from "@mydogcanfly/knowledge";
import { cityName } from "@mydogcanfly/knowledge";
import type { DestinationsRequest, DestinationMatch, DestinationsResult } from "./contracts";
import { evaluate } from "./evaluate";

// Must match explain.ts HEAT_EMBARGO_THRESHOLD_C (seasonal hold/cargo suspension threshold).
const HEAT_EMBARGO_THRESHOLD_C = 30;
const HEAT_RISK_MIN_C = 27; // warm-but-not-embargo band

// Rough direct flight-time estimate from great-circle distance: cruise ~800 km/h + ~40 min taxi/climb/descent.
const CRUISE_KMH = 800;
const GROUND_H = 0.7;
function greatCircleKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x));
}

/* Per-airport seasonal temperature estimate from LATITUDE + month. Coarse but continuous and honest:
   it differentiates north/south and hot/temperate cities (fixing the "whole country = one temperature"
   flaw) while, by design, NOT capturing altitude (e.g. Bogotá reads warmer than it is). The summer/winter
   daytime-high curves peak in the subtropics (deserts), so hot desert cities are not under-flagged. */
const SUMMER_HIGH: [number, number][] = [[0, 31], [10, 32], [20, 35], [27, 37], [35, 33], [45, 27], [55, 21], [65, 17], [90, 9]];
const WINTER_HIGH: [number, number][] = [[0, 30], [10, 30], [20, 27], [30, 22], [40, 12], [50, 6], [60, 0], [90, -20]];
function piecewise(points: [number, number][], x: number): number {
  if (x <= points[0][0]) return points[0][1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i];
    if (x <= x1) {
      const [x0, y0] = points[i - 1];
      return y0 + ((y1 - y0) * (x - x0)) / (x1 - x0);
    }
  }
  return points[points.length - 1][1];
}
function estimateTempByLat(lat: number, month: number | undefined): number | undefined {
  if (!month) return undefined;
  const a = Math.abs(lat);
  const summer = piecewise(SUMMER_HIGH, a), winter = piecewise(WINTER_HIGH, a);
  const peak = lat < 0 ? 1 : 7; // warmest month by hemisphere
  const dist = Math.min(Math.abs(month - peak), 12 - Math.abs(month - peak)); // 0..6 from peak
  const s = (Math.cos((dist / 6) * Math.PI) + 1) / 2; // 1 at peak month, 0 at opposite
  return Math.round(winter + (summer - winter) * s);
}

/**
 * Destination finder — "which CITIES can I fly my dog to directly on this date?".
 *
 * Reuses the route graph + rules engine (source of truth): for every airport reachable by a DIRECT
 * dog-accepting flight from the origin, it estimates the city's seasonal climate from its latitude and
 * returns a compact match. Ranking + formalities-vs-documents are left to the UI.
 */
export function rankDestinations(kb: NormalizedKB, req: DestinationsRequest): DestinationsResult {
  const originSet = req.origins && req.origins.length ? req.origins : [req.origin];
  const originSetHas = new Set(originSet);
  const originCountries = new Set(
    originSet.map((o) => kb.airports.get(o)?.country_id).filter((x): x is string => !!x),
  );
  const month = req.date ? parseInt(req.date.slice(5, 7), 10) : undefined;

  // Candidate destination airports: served by an airline that also serves an origin airport.
  const candidates = new Set<string>();
  for (const a of kb.airlines.values()) {
    const served = a.served_airport_ids;
    if (!served || !served.length) continue;
    if (!originSet.some((o) => served.includes(o))) continue;
    for (const ap of served) {
      if (originSetHas.has(ap)) continue;
      const airport = kb.airports.get(ap);
      if (!airport || originCountries.has(airport.country_id)) continue;
      candidates.add(ap);
    }
  }

  const placementPref = req.placement ?? "any";
  const out: DestinationMatch[] = [];

  for (const airportId of candidates) {
    const airport = kb.airports.get(airportId);
    const country = airport ? kb.countries.get(airport.country_id) : undefined;
    if (!airport || !country) continue;

    const lat = airport.geo?.lat;
    const tLat = lat != null ? estimateTempByLat(lat, month) : undefined;
    const climate_estimated = tLat != null;
    const temperature_c = tLat ?? 20;

    const decision = evaluate(kb, {
      origin: originSet[0],
      origins: originSet,
      destination: airportId,
      destinations: [airportId],
      dog: req.dog,
      travel_type: "pet",
      placement: placementPref,
      date: req.date,
      // Per-airport temperature drives the airline heat embargo (overrides the coarse region model).
      weather: climate_estimated ? { temperature_c } : undefined,
      locale: req.locale,
    });

    // DIRECT flights only (the tool's contract). Keep direct airlines that accept the dog somewhere.
    const direct = decision.airlines.filter((a) => a.direct && a.placements.some((x) => x.allowed));
    if (!direct.length) continue;

    const allows = (p: string) => direct.some((a) => a.placements.find((x) => x.placement === p)?.allowed);
    const cabin_ok = allows("cabin");
    const hold_ok = allows("hold");
    const cargo_ok = allows("cargo");
    const placement_ok = placementPref === "any" ? cabin_ok || hold_ok || cargo_ok : allows(placementPref);

    // Shortest origin→this-airport distance → estimated direct flight time.
    let bestKm = Infinity;
    const dg = airport.geo;
    if (dg) for (const oId of originSet) {
      const og = kb.airports.get(oId)?.geo;
      if (og) { const km = greatCircleKm(og, dg); if (km < bestKm) bestKm = km; }
    }
    const flight_hours = Number.isFinite(bestKm) ? Math.round((bestKm / CRUISE_KMH + GROUND_H) * 2) / 2 : 0;

    const localized = (lt: unknown): string => (lt as Record<string, string>)?.[req.locale] ?? (lt as { en: string })?.en ?? "";

    out.push({
      airport_id: airportId,
      iata: airport.iata,
      city: cityName(airport, req.locale),
      country_id: country.id,
      iso2: country.iso2,
      country_name: localized(country.name),
      region: country.region,
      temperature_c,
      climate_estimated,
      heat_embargo: climate_estimated && temperature_c > HEAT_EMBARGO_THRESHOLD_C,
      heat_risk: climate_estimated && temperature_c > HEAT_RISK_MIN_C && temperature_c <= HEAT_EMBARGO_THRESHOLD_C,
      airlines_total: direct.length,
      cabin_ok,
      hold_ok,
      placement_ok,
      entry_allowed: decision.destination.entry_allowed,
      flight_hours,
    });
  }

  // Stable default order (by city) — the UI applies the soft score that also weighs formalities.
  // Retest 09/08/2026, point 2 : `candidates.size` distingue "aucune ville même desservie depuis
  // cette origine" de "des villes sont desservies mais aucune n'accepte ce chien" — cf. commentaire
  // sur DestinationsResult dans contracts.ts.
  return {
    matches: out.sort((a, b) => a.city.localeCompare(b.city, req.locale)),
    candidates_total: candidates.size,
  };
}
