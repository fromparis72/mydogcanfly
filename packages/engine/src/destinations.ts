import type { NormalizedKB } from "@mydogcanfly/knowledge";
import { cityName } from "@mydogcanfly/knowledge";
import type { DestinationsRequest, DestinationMatch, DestinationsResult, DestinationConfirmationSignal } from "./contracts";
import { signalKey, estCauseClimatique } from "./contracts";
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
    }, { weatherProvenance: "estimated_latitude" });

    // DIRECT flights only (the tool's contract).
    const directAll = decision.airlines.filter((a) => a.direct);
    /* TRI-STATE (P0 climat, 13/08/2026). Deux populations distinctes, comptées séparément :
       - `direct`          : compagnies avec ≥1 canal réellement `allowed` (l'ancien contrat) ;
       - `directToConfirm` : compagnies SANS canal allowed mais avec ≥1 `confirmation_required` —
         typiquement toutes leurs options fermées par un embargo calculé sur l'estimation.
       Une destination dont TOUTES les compagnies sont « à confirmer » est désormais INCLUSE, avec
       `placement_to_confirm` : l'UI l'affiche en alternative, jamais en compatible. Avant ce lot,
       elle disparaissait purement et simplement (mesuré : 27 villes absentes en juillet, dont
       Paris → Miami). */
    const hasStatus = (a: (typeof directAll)[number], st: string, p?: string) =>
      a.placements.some((x) => (p ? x.placement === p : true) && x.status === st);
    const direct = directAll.filter((a) => hasStatus(a, "allowed"));
    const directToConfirm = directAll.filter((a) => !hasStatus(a, "allowed") && hasStatus(a, "confirmation_required"));
    if (!direct.length && !directToConfirm.length) continue;

    const included = [...direct, ...directToConfirm];
    const statusOfChannel = (p: string): "allowed" | "denied" | "confirmation_required" =>
      included.some((a) => hasStatus(a, "allowed", p)) ? "allowed"
      : included.some((a) => hasStatus(a, "confirmation_required", p)) ? "confirmation_required"
      : "denied";
    const cabin_status = statusOfChannel("cabin");
    const hold_status = statusOfChannel("hold");
    const cargo_status = statusOfChannel("cargo");
    /* T0-A — signaux de confirmation : la cause SANS perdre la compagnie ni le canal. Triés et
       dédupliqués sur le triplet complet (deux causes identiques chez deux compagnies restent
       deux signaux). */
    const confirmation_signals: DestinationConfirmationSignal[] = (() => {
      const m = new Map<string, DestinationConfirmationSignal>();
      for (const a of included) for (const d of a.placements) {
        if (d.status !== "confirmation_required") continue;
        for (const cause of d.confirmation_causes) {
          const s = { airline_id: a.airline_id, placement: d.placement, cause };
          m.set(signalKey(s), s);
        }
      }
      return [...m.values()].sort((x, y) => signalKey(x).localeCompare(signalKey(y)));
    })();
    /* Booléens de transition : vrais UNIQUEMENT pour `allowed`. Le fret est désormais ÉMIS
       (arbitrage option 1) : il était calculé, décidait de `placement_ok`, et n'apparaissait
       nulle part — 3 à 5 destinations étaient compatibles par un canal invisible. */
    const cabin_ok = cabin_status === "allowed";
    const hold_ok = hold_status === "allowed";
    const cargo_ok = cargo_status === "allowed";
    const prefStatus = placementPref === "any"
      ? (cabin_ok || hold_ok || cargo_ok ? "allowed"
         : [cabin_status, hold_status, cargo_status].includes("confirmation_required") ? "confirmation_required" : "denied")
      : statusOfChannel(placementPref);
    const placement_ok = prefStatus === "allowed";
    const placement_to_confirm = prefStatus === "confirmation_required";

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
      /* P0 climat, v3 (contre-revue du 13/08/2026) : `heat_confirmation_required` DÉRIVE DE LA
         DÉCISION — il n'est vrai que si au moins une compagnie directe porte réellement un canal
         `confirmation_required`. La v2 le dérivait du seul seuil de température : un carlin à
         Athènes (soute et fret refusés par les règles de race, AUCUNE confirmation nulle part)
         recevait quand même « à confirmer » — un conseil que le moteur contredisait. L'indicateur
         brut de température, lui, existe sous son vrai nom : `estimated_heat_signal`, qui ne
         prétend ni refléter une règle compagnie ni demander confirmation d'un canal refusé. */
      heat_embargo: false,
      /* T0-A : filtré PAR CAUSE — une confirmation de politique (T0-B) ne produira plus un
         drapeau chaleur. Les signaux gardent compagnie + canal (jamais aplatis) et survivent
         à l'agrégation `allowed > confirmation_required > denied` du statut. */
      heat_confirmation_required: confirmation_signals.some((s) => estCauseClimatique(s.cause)),
      confirmation_signals,
      estimated_heat_signal: climate_estimated && temperature_c > HEAT_EMBARGO_THRESHOLD_C,
      heat_risk: climate_estimated && temperature_c > HEAT_RISK_MIN_C && temperature_c <= HEAT_EMBARGO_THRESHOLD_C,
      airlines_total: direct.length,
      airlines_to_confirm_total: directToConfirm.length,
      cabin_ok,
      hold_ok,
      cargo_ok,
      cabin_status,
      hold_status,
      cargo_status,
      placement_ok,
      placement_to_confirm,
      /* LE TERNAIRE VOYAGE JUSQU'ICI (contre-revue du 05/09/2026). Ce champ seul a fait remonter
         au rang des destinations sans restriction celles dont l'entrée est seulement « à
         confirmer » : depuis que la frontière garde ce chemin, `entry_allowed` y vaut `true`, et
         la porte de classement de l'outil Destinations valait donc 1 pour Édimbourg, Cork et
         Berlin avec un American Bully XL — exactement comme pour une ville sans la moindre
         restriction connue. Le booléen restait juste ; c'est la question posée qui était trop
         pauvre. */
      entry_status: decision.destination.entry_status,
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
