import type { NormalizedKB, Rule, Predicate, Condition } from "@mydogcanfly/knowledge";
import type { FinderRequest, Decision, AirlineDecision, FiredRule } from "./contracts";

type Ctx = Record<string, string | number | boolean>;
const PLACEMENTS = ["cabin", "hold", "cargo"] as const;

// Great-circle distance (km) — used by the connection-plausibility ("maximum permitted detour") filter.
function greatCircleKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat), dLon = rad(b.lon - a.lon);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(x));
}

function evalCondition(c: Condition, ctx: Ctx): boolean {
  const left = ctx[c.fact];
  const v = c.value as string | number | boolean | Array<string | number>;
  switch (c.op) {
    case "eq": return left === v;
    case "neq": return left !== v;
    case "in": return Array.isArray(v) && v.includes(left as string | number);
    case "nin": return Array.isArray(v) && !v.includes(left as string | number);
    case "gt": return typeof left === "number" && typeof v === "number" && left > v;
    case "gte": return typeof left === "number" && typeof v === "number" && left >= v;
    case "lt": return typeof left === "number" && typeof v === "number" && left < v;
    case "lte": return typeof left === "number" && typeof v === "number" && left <= v;
    default: return false;
  }
}

function evalPredicate(p: Predicate, ctx: Ctx): boolean {
  if ("all" in p) return p.all.every((q) => evalPredicate(q, ctx));
  if ("any" in p) return p.any.some((q) => evalPredicate(q, ctx));
  if ("not" in p) return !evalPredicate(p.not, ctx);
  return evalCondition(p as Condition, ctx);
}

// Coarse seasonal climate model: estimate a peak temperature from the destination region and travel month,
// so users never have to guess a temperature months ahead (the heat embargo becomes automatic).
const CLIMATE: Record<string, { hemi: "N" | "S"; summer: number; winter: number }> = {
  "Middle East": { hemi: "N", summer: 42, winter: 22 },
  "Africa": { hemi: "N", summer: 35, winter: 24 },
  "Asia": { hemi: "N", summer: 34, winter: 16 },
  "Europe": { hemi: "N", summer: 28, winter: 6 },
  "European Union / Schengen": { hemi: "N", summer: 28, winter: 6 },
  "North America": { hemi: "N", summer: 30, winter: 4 },
  "Central America": { hemi: "N", summer: 33, winter: 27 },
  "Caribbean": { hemi: "N", summer: 32, winter: 26 },
  "South America": { hemi: "S", summer: 32, winter: 17 },
  "Oceania": { hemi: "S", summer: 32, winter: 15 },
};
function estimateTempC(region: string | undefined, month: number | undefined): number | undefined {
  if (!region || !month) return undefined;
  const c = CLIMATE[region] ?? { hemi: "N" as const, summer: 30, winter: 12 };
  const peak = c.hemi === "S" ? 1 : 7; // Jan (south) / Jul (north)
  const dist = Math.min(Math.abs(month - peak), 12 - Math.abs(month - peak)); // 0..6
  return Math.round(c.summer - (c.summer - c.winter) * (dist / 6));
}

// "Possible but unconfirmed" heat: the seasonal AVERAGE stays under the embargo threshold, yet in temperate
// regions (Europe, North America) climate-change heat waves regularly spike above it during the two peak
// summer months. We flag the risk WITHOUT denying any placement (that stays a rules/temperature decision).
const HEAT_RISK_MIN_SUMMER_C = 27; // region must be warm enough to plausibly exceed 30 °C in a heat wave
function heatRiskSeason(region: string | undefined, month: number | undefined, temperature_c: number): boolean {
  if (!month || temperature_c > 30) return false; // no date, or already a confirmed embargo
  const c = CLIMATE[region ?? ""] ?? { hemi: "N" as const, summer: 30, winter: 12 };
  if (c.summer < HEAT_RISK_MIN_SUMMER_C) return false;
  const peak = c.hemi === "S" ? 1 : 7;
  const next = (peak % 12) + 1; // the month after the peak: {Jul,Aug} north / {Jan,Feb} south
  return month === peak || month === next;
}

/* Traduction d'une catégorie de règle en motif de refus affichable.
   POURQUOI : jusqu'ici l'interface déduisait le motif d'un raisonnement en creux — « la compagnie
   prend des animaux mais aucun mode n'est accepté, donc c'est la race ». C'était faux trois fois
   sur trois (Delta, JetBlue, Brussels refusent un golden de 30 kg pour son POIDS, ou parce qu'ils
   ne proposent ni soute ni fret). Le motif se lit sur la règle qui a refusé : sa catégorie et les
   placements qu'elle vise sont des données, pas une interprétation. Une catégorie inconnue ne
   produit AUCUN motif — mieux vaut un libellé neutre qu'un motif inventé. */
const REASON_BY_CATEGORY: Record<string, string> = {
  breed_ban: "breed_restricted",
  cabin_weight: "weight_limit",
  hold_weight: "weight_limit",
};
/** Ordre d'affichage : d'abord ce qui tient au chien, ensuite ce que la compagnie ne propose pas. */
const REASON_ORDER = ["breed_restricted", "weight_limit", "cabin_unavailable", "hold_unavailable", "cargo_unavailable"];
function denyReasonsOf(perPlacement: { placement: string; fires: Rule[] }[]): string[] {
  const found = new Set<string>();
  for (const { placement, fires } of perPlacement) {
    for (const r of fires) {
      if (r.effect.action !== "deny") continue;
      if (r.effect.placement && !(r.effect.placement as string[]).includes(placement)) continue;
      // L'embargo chaleur est déjà porté par son propre bandeau, et il est temporaire : le
      // ranger parmi les motifs de refus laisserait croire à une incompatibilité de fond.
      if (r.category === "summer_embargo") continue;
      const code = REASON_BY_CATEGORY[r.category] ?? (r.category === "placement" ? `${placement}_unavailable` : undefined);
      if (code) found.add(code);
    }
  }
  return REASON_ORDER.filter((c) => found.has(c));
}

function toFired(r: Rule, locale: string): FiredRule {
  return {
    rule_id: r.id, action: r.effect.action, category: r.category, criticality: r.criticality,
    rationale: r.rationale_i18n?.[locale] ?? r.rationale, // localized where available, else EN
    source_url: r.source.url, confidence: r.source.confidence, params: r.params,
  };
}

/**
 * Decision Engine (ADR-0013): pure evaluation of the normalized knowledge base against a request.
 * No narration, no localization — that is the Explanation Engine's job.
 */
export function evaluate(kb: NormalizedKB, req: FinderRequest): Decision {
  const dest = kb.airports.get(req.destination);
  const origin = kb.airports.get(req.origin);
  const destCountry = dest?.country_id ?? "";
  const originCountry = origin?.country_id ?? "";
  const destCountryObj = kb.countries.get(destCountry);
  const destCountryName =
    (destCountryObj?.name as Record<string, string> | undefined)?.[req.locale] ??
    (destCountryObj?.name as Record<string, string> | undefined)?.en ??
    destCountry;
  const breed = req.dog.breed_id ? kb.breeds.get(req.dog.breed_id) : undefined;
  const weight = req.dog.weight_kg ?? breed?.weight_kg ?? 0;
  const brachy = req.dog.brachycephalic ?? breed?.brachycephalic ?? false;

  // Seasonal temperature: explicit wins; otherwise estimate from travel month + destination climate; else a mild default.
  const month = req.date ? parseInt(req.date.slice(5, 7), 10) : undefined;
  const estimatedTemp = estimateTempC(destCountryObj?.region, month);
  const temperature_c = req.weather?.temperature_c ?? estimatedTemp ?? 20;
  const climate = {
    temperature_c,
    estimated: req.weather?.temperature_c == null && estimatedTemp != null,
    provided: req.weather?.temperature_c != null || estimatedTemp != null,
    month,
    risk: heatRiskSeason(destCountryObj?.region, month, temperature_c),
  };

  const baseCtx: Ctx = {
    "dog.weight_kg": weight,
    "dog.brachycephalic": brachy,
    "dog.size": breed?.size ?? "medium",
    "dog.breed_id": req.dog.breed_id ?? "",
    "travel_type": req.travel_type,
    "route.dest_country_id": destCountry,
    "route.origin_country_id": originCountry,
    "route.dest_airport_id": req.destination,
    "weather.temperature_c": temperature_c,
    // Situation du chien, déclarée dans le formulaire : "yes" il vit dans l'UE, "no" il la découvre.
    // Sans réponse → chaîne vide, volontairement DIFFÉRENTE de "no" : les règles de retour vers l'UE
    // testent `in ["yes","unknown",""]` d'un côté et `in ["no","unknown",""]` de l'autre, si bien
    // qu'une absence de réponse fait sortir LES DEUX parcours. On n'impose jamais le certificat
    // sanitaire par défaut d'information. (Le "unknown" listé par les règles n'est plus produit
    // depuis que le formulaire n'a que deux options ; il y reste sans nuire, l'absence le remplace.)
    "docs.eu_passport": req.eu_passport ?? "",
  };

  // A domestic flight crosses no border, so the destination country's IMPORT rules simply do not apply
  // (no passport, no rabies titer, no entry certificate). Same-country special regimes — Hawaii, Guyane… —
  // are surfaced separately from the country's `domestic` data, not from these import rules.
  const isDomestic = !!originCountry && originCountry === destCountry;
  const countryRequirements = isDomestic ? [] : kb.rules
    .filter((r) => r.scope.type === "country" && r.scope.id === destCountry)
    .filter((r) => evalPredicate(r.applies_when, baseCtx))
    .map((r) => toFired(r, req.locale));

  // Origin/destination airport SETS — a city search (e.g. Paris = CDG + ORY) passes several; a single airport
  // falls back to [origin]/[destination]. An airline is a candidate if it reaches ANY origin airport AND ANY
  // destination airport (broadening the results across a city's airports).
  const originSet = req.origins && req.origins.length ? req.origins : [req.origin];
  const destSet = req.destinations && req.destinations.length ? req.destinations : [req.destination];
  const pairKeys = new Set<string>();
  for (const o of originSet) for (const d of destSet) pairKeys.add([o, d].sort().join("|"));

  // Candidate airlines. Route-aware when we have the route graph: the airline must actually reach an origin
  // AND a destination airport. Airlines without route data fall back to the coarser country-level rule.
  const airlines = [...kb.airlines.values()].filter((a) => {
    const served = a.served_airport_ids;
    return served && served.length
      ? originSet.some((o) => served.includes(o)) && destSet.some((d) => served.includes(d))
      : a.serves_country_ids.includes(destCountry);
  });

  // Global rules (e.g. the universal cabin size/weight backstop) apply to every airline.
  const globalRules = kb.rules.filter((r) => r.scope.type === "global");
  const airlineDecisionsRaw = airlines.map((a): AirlineDecision & { _plausible: boolean } => {
    const airlineRules = [...kb.rules.filter((r) => r.scope.type === "airline" && r.scope.id === a.id), ...globalRules];
    // Evaluate ALL placements (cabin/hold/cargo) so the comparison cards are complete;
    // the requested placement is applied later, when computing the headline verdict.
    const perPlacement = PLACEMENTS.map((p) => {
      const ctx: Ctx = { ...baseCtx, placement: p };
      const fires = airlineRules.filter((r) => evalPredicate(r.applies_when, ctx));
      const denied = fires.some(
        (r) => r.effect.action === "deny" && (!r.effect.placement || r.effect.placement.includes(p)),
      );
      return { placement: p, allowed: !denied, fires };
    });
    // Does this airline carry pets at all, structurally? Re-evaluate with a neutral small non-brachy dog:
    // a low-cost that never carries pets stays false; an airline that takes pets but rules THIS dog out
    // (e.g. a snub-nosed breed → hold/cargo denied) is true. Lets the UI say "breed not accepted" vs "no pets".
    const neutralCtx: Ctx = { ...baseCtx, "dog.weight_kg": 5, "dog.brachycephalic": false, "dog.size": "small" };
    const carries_pets = PLACEMENTS.some((p) => {
      const nf = airlineRules.filter((r) => evalPredicate(r.applies_when, { ...neutralCtx, placement: p }));
      return !nf.some((r) => r.effect.action === "deny" && (!r.effect.placement || r.effect.placement.includes(p)));
    });

    const hubs = (a as { hub_airport_ids?: string[] }).hub_airport_ids ?? [];
    const served = a.served_airport_ids ?? [];
    // Accurate "direct" when we have the route graph: any origin→destination nonstop pair is in the airline's
    // routes. Otherwise fall back to the hub heuristic (a hub at either endpoint implies a likely nonstop).
    // Nonstop ATTESTÉ : la paire origine|destination est dans le graphe de routes de la compagnie.
    const direct_documented = !!(a.direct_routes && a.direct_routes.length && a.direct_routes.some((k) => pairKeys.has(k)));
    let direct = a.direct_routes && a.direct_routes.length
      ? direct_documented
      : hubs.some((h) => originSet.includes(h) || destSet.includes(h));
    // Which endpoint airports the airline actually uses — surfaced only when they differ from the searched one
    // (city search), e.g. "from ORY" when Paris was searched and this airline flies out of Orly.
    const servedOrigins = originSet.filter((o) => served.includes(o));
    const servedDests = destSet.filter((d) => served.includes(d));
    const usedOrigin = servedOrigins.includes(req.origin) ? req.origin : servedOrigins[0];
    const usedDest = servedDests.includes(req.destination) ? req.destination : servedDests[0];
    const origin_airport_id = usedOrigin && usedOrigin !== req.origin ? usedOrigin : undefined;
    const destination_airport_id = usedDest && usedDest !== req.destination ? usedDest : undefined;
    // Connection plausibility — "maximum permitted detour". A non-direct airline is only kept when it
    // can route via one of ITS hubs without an absurd detour: origin → hub → dest must add no more than
    // max(1500 km, 50% of the direct distance). This kills nonsense like Paris→Barcelona via Mexico City.
    // A non-direct airline with no usable hub geometry can't justify an itinerary → dropped.
    const originId = usedOrigin ?? req.origin;
    const destId = usedDest ?? req.destination;
    const og = kb.airports.get(originId)?.geo;
    const dg = kb.airports.get(destId)?.geo;
    // Arêtes nonstop attestées de la compagnie (paires triées) — la seule chose qui permette de
    // distinguer un itinéraire établi d'un itinéraire déduit.
    const routeSet = new Set(a.direct_routes ?? []);
    const edge = (x: string, y: string) => routeSet.has([x, y].sort().join("|"));
    let connect_airport_id: string | undefined;
    let detour_km = 0;
    let plausible = true;
    let connection_documented = false;
    if (!direct) {
      // A hub in the origin OR destination city means the airline flies this route on its own metal —
      // treat as direct rather than inventing a same-city "connection" (e.g. Air France "via ORY" when
      // Paris was searched via CDG). A connection point must be a genuinely intermediate airport, never
      // one of the endpoint-city airports.
      const endpointSet = new Set<string>([...originSet, ...destSet]);
      if (hubs.some((h) => endpointSet.has(h))) {
        direct = true;
      } else if (og && dg) {
        const dOD = greatCircleKm(og, dg);
        const cap = Math.max(800, 0.5 * dOD);
        /* Deux passes, et la distinction est le cœur du sujet. Un hub est ÉTAYÉ quand les deux
           segments — origine→hub et hub→destination — figurent dans les arêtes nonstop de la
           compagnie. Sinon il n'est que géométriquement plausible : on ne sait pas si la
           compagnie relie l'origine à son hub. On préfère toujours un hub étayé, même plus long,
           à un hub déduit ; et on garde la trace de ce qui a été retenu. */
        const pick = (only: "documented" | "any") => {
          let bestExtra = Infinity, bestHub: string | undefined;
          for (const h of hubs) {
            if (endpointSet.has(h)) continue;            // never connect via an endpoint-city airport
            if (only === "documented" && !(edge(originId, h) && edge(h, destId))) continue;
            const hg = kb.airports.get(h)?.geo;
            if (!hg) continue;
            const extra = greatCircleKm(og, hg) + greatCircleKm(hg, dg) - dOD;
            if (extra < bestExtra) { bestExtra = extra; bestHub = h; }
          }
          return bestHub != null && bestExtra <= cap ? { hub: bestHub, extra: bestExtra } : undefined;
        };
        const documented = routeSet.size ? pick("documented") : undefined;
        const chosen = documented ?? pick("any");
        if (chosen) {
          connect_airport_id = chosen.hub;
          detour_km = Math.round(chosen.extra);
          connection_documented = documented != null;
        } else {
          plausible = false;
        }
      } else {
        plausible = false;
      }
    }
    const fired = dedupe(perPlacement.flatMap((x) => x.fires.map((r) => toFired(r, req.locale))));
    // Published fee for the primary accepted placement (cabin > hold > cargo), when the airline states one.
    const policy = (a as { premium?: { policy?: Record<string, { fee?: string }> } }).premium?.policy;
    const fees = (a as { fees?: Record<string, string | undefined> }).fees;
    const okPlacement = perPlacement.find((x) => x.allowed)?.placement;
    const fee = okPlacement ? (policy?.[okPlacement]?.fee ?? fees?.[okPlacement]) : undefined;
    return {
      airline_id: a.id,
      airline_name: (a as { name?: string }).name ?? a.id,
      country_id: (a as { country_id?: string }).country_id,
      direct,
      carries_pets,
      itinerary_confidence: direct
        ? (direct_documented ? "direct_documented" : "direct_assumed")
        : (connection_documented ? "connection_documented" : "connection_unverified"),
      deny_reasons: denyReasonsOf(perPlacement),
      connect_airport_id,
      detour_km,
      source_url: (a as { source?: { url?: string } }).source?.url,
      fee,
      origin_airport_id,
      destination_airport_id,
      placements: perPlacement.map(({ placement, allowed }) => ({ placement, allowed })),
      fired,
      _plausible: plausible,
    };
  });
  // Drop connections whose only routing is an implausible detour (kept: direct + sensible connections).
  const airlineDecisions: AirlineDecision[] = airlineDecisionsRaw
    .filter((a) => a._plausible)
    .map(({ _plausible, ...rest }) => rest);

  const entry_allowed = !countryRequirements.some((f) => f.action === "deny");

  return {
    request: req,
    airlines: airlineDecisions,
    countryRequirements,
    destination: { country_id: destCountry, country_name: destCountryName, entry_allowed },
    origin_country_id: originCountry,
    domestic: isDomestic,
    brachycephalic: brachy,
    climate,
  };
}

function dedupe(f: FiredRule[]): FiredRule[] {
  return [...new Map(f.map((x) => [x.rule_id, x])).values()];
}
