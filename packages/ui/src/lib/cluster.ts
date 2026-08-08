// Internal-linking (maillage) helpers — geographic cluster: Country ⇄ Airports ⇄ Airlines.
// Pure data extraction from the KB; pages turn ids into hrefs via hrefFor().
import { slugFor, cityName } from "@mydogcanfly/knowledge";

const loc = (lt: any, locale: string): string => lt?.[locale] ?? lt?.en ?? "";

export interface AirportLink { id: string; slug: string; iata: string; city: string }
export interface CountryLink { id: string; slug: string; iso2: string; name: string }

/** All airports whose country is `countryId`, sorted by city. */
export function airportsInCountry(kb: any, countryId: string, locale: string): AirportLink[] {
  return [...kb.airports.values()]
    .filter((a: any) => a.country_id === countryId)
    .map((a: any) => ({ id: a.id, slug: slugFor(a.id), iata: a.iata, city: cityName(a, locale) }))
    .sort((a, b) => a.city.localeCompare(b.city, locale));
}

/** Other airports in the same country as `airportId` (excludes itself), capped. */
export function siblingAirports(kb: any, airportId: string, locale: string, cap = 6): AirportLink[] {
  const a: any = kb.airports.get(airportId);
  if (!a) return [];
  return airportsInCountry(kb, a.country_id, locale).filter((x) => x.id !== airportId).slice(0, cap);
}

/** The country an airport belongs to. */
export function countryOfAirport(kb: any, airportId: string, locale: string): CountryLink | null {
  const a: any = kb.airports.get(airportId);
  const c: any = a ? kb.countries.get(a.country_id) : undefined;
  if (!c) return null;
  return { id: c.id, slug: slugFor(c.id), iso2: c.iso2, name: loc(c.name, locale) };
}

/** What an airline reaches: served countries (capped) + hub airports (capped) + totals. */
export function airlineReach(kb: any, airlineId: string, locale: string, countryCap = 14, airportCap = 8) {
  const a: any = kb.airlines.get(airlineId);
  if (!a) return { countries: [] as CountryLink[], hubs: [] as AirportLink[], totalCountries: 0, totalAirports: 0 };
  const cids: string[] = a.serves_country_ids || [];
  const countries: CountryLink[] = cids
    .map((id) => kb.countries.get(id))
    .filter(Boolean)
    .map((c: any) => ({ id: c.id, slug: slugFor(c.id), iso2: c.iso2, name: loc(c.name, locale) }))
    .sort((x: CountryLink, y: CountryLink) => x.name.localeCompare(y.name, locale));
  // prefer declared hubs, then fall back to a sample of served airports
  const hubIds: string[] = (a.hub_airport_ids && a.hub_airport_ids.length ? a.hub_airport_ids : (a.served_airport_ids || [])).slice(0, airportCap);
  const hubs: AirportLink[] = hubIds
    .map((id) => kb.airports.get(id))
    .filter(Boolean)
    .map((ap: any) => ({ id: ap.id, slug: slugFor(ap.id), iata: ap.iata, city: cityName(ap, locale) }));
  return {
    countries: countries.slice(0, countryCap),
    hubs,
    totalCountries: cids.length,
    totalAirports: (a.served_airport_ids || []).length,
  };
}

/** Airlines that serve a given country (capped) — for the country page. */
export function airlinesServingCountry(kb: any, countryId: string, locale: string, cap = 10) {
  return [...kb.airlines.values()]
    .filter((a: any) => (a.serves_country_ids || []).includes(countryId))
    .map((a: any) => ({ id: a.id, slug: slugFor(a.id), name: a.name as string }))
    .sort((x, y) => x.name.localeCompare(y.name, locale))
    .slice(0, cap);
}

// ─────────────────────────────────────────────────────────────────────────────
// Pays → compagnies : la case la plus déséquilibrée du maillage (14,7 liens dans
// un sens, 0,6 dans l'autre). Le visiteur qui atterrit sur une fiche pays — la
// moitié des arrivées Google — connaît les formalités et cherche ensuite QUI
// l'emmène. Ce bloc lui répond sans qu'il repasse par le menu.

// ─────────────────────────────────────────────────────────────────────────────
// Compagnie → race : la fiche compagnie décrivait ses restrictions de races en
// texte, sans jamais lier une seule fiche race. Le lecteur qui découvre que sa
// compagnie refuse les museaux courts n'a aucun moyen de vérifier si son chien
// en fait partie.

export interface BreedLink { id: string; slug: string; name: string; weightKg: number }

/** Races brachycéphales documentées, de la plus lourde à la plus légère : ce sont les plus
 *  lourdes qui sont réellement piégées par un refus en soute, faute de solution cabine. */
export function brachyBreeds(kb: any, locale: string): BreedLink[] {
  return [...kb.breeds.values()]
    .filter((b: any) => b.brachycephalic)
    .map((b: any) => ({
      id: b.id, slug: slugFor(b.id), weightKg: b.weight_kg ?? 0,
      name: (locale === "en" ? b.name : b.name_i18n?.[locale]) || b.name,
    }))
    .sort((x, y) => y.weightKg - x.weightKg || x.name.localeCompare(y.name, locale));
}

/**
 * La compagnie restreint-elle les races brachycéphales, et sur quelle base ?
 *  - `explicit` : un canal porte `brachy_allowed: false` — refus déclaré, 25 compagnies.
 *  - `mentioned` : aucun drapeau, mais les conditions publiées parlent de museaux courts —
 *    6 compagnies. On ne transforme pas une mention en refus : le libellé reste prudent.
 */
export function brachyRestriction(a: any): { kind: "explicit" | "mentioned"; channels: string[] } | null {
  const p = a?.premium?.policy || {};
  const explicit = Object.entries(p).filter(([, v]: any) => v && v.brachy_allowed === false).map(([k]) => k);
  if (explicit.length) return { kind: "explicit", channels: explicit };
  // Les conditions ne sont testées que sur l'anglais : c'est la seule langue toujours présente.
  const RX = /brachyc|snub-nos|snub nos|short-nos|pug\b|bulldog|boxer/i;
  const mentioned = Object.entries(p).filter(([, v]: any) => RX.test(v?.conditions?.en || "")).map(([k]) => k);
  return mentioned.length ? { kind: "mentioned", channels: mentioned } : null;
}

export type DogChannel = "cabin" | "hold" | "cargo" | "none";

export interface CountryAirline {
  id: string; slug: string; name: string;
  channel: DogChannel;
  /** Plafond cabine annoncé, en kg. Absent = la compagnie accepte sans chiffre publié. */
  maxKg?: number;
  /** Aéroports du pays effectivement desservis d'après les routes AeroDataBox. */
  airports: number;
  /** Compagnie immatriculée dans ce pays. */
  national: boolean;
  /** Taille du réseau (routes directes + saisonnières) — sert uniquement à départager. */
  net: number;
}

/** Aéroports du pays desservis par chaque compagnie, calculé une seule fois pour tout le build.
 *  Sans ce cache : 140 pays × 3 langues × 78 compagnies × ~200 routes à chaque rendu. */
let servedCache: Map<string, Map<string, number>> | null = null;
function servedCounts(kb: any): Map<string, Map<string, number>> {
  if (servedCache) return servedCache;
  const countryOf = new Map<string, string>();
  for (const ap of kb.airports.values() as Iterable<any>) countryOf.set(ap.id, ap.country_id);
  const out = new Map<string, Map<string, number>>(); // countryId -> airlineId -> nb aéroports
  for (const a of kb.airlines.values() as Iterable<any>) {
    const seen = new Map<string, Set<string>>();
    // Les routes saisonnières comptent : une liaison estivale reste une liaison. La fiche
    // compagnie, elle, distingue les deux — ici seule la présence dans le pays nous intéresse.
    for (const r of [...(a.direct_routes || []), ...(a.seasonal_routes || [])]) {
      for (const ep of String(r).split("|")) {
        const c = countryOf.get(ep);
        if (!c) continue;
        (seen.get(c) ?? seen.set(c, new Set()).get(c)!).add(ep);
      }
    }
    for (const [c, aps] of seen) (out.get(c) ?? out.set(c, new Map()).get(c)!).set(a.id, aps.size);
  }
  servedCache = out;
  return out;
}

/** Le canal réellement praticable pour un chien, par ordre de préférence du maître.
 *  `none` couvre aussi bien le refus explicite (Ryanair) que la politique non documentée :
 *  ces compagnies ne sont jamais affichées, seulement comptées, pour ne rien affirmer de faux. */
function dogChannel(a: any): { channel: DogChannel; maxKg?: number } {
  const p = a?.premium?.policy || {};
  if (p.cabin?.allowed) return { channel: "cabin", maxKg: p.cabin.max_weight_kg ?? undefined };
  if (p.hold?.allowed) return { channel: "hold" };
  if (p.cargo?.allowed) return { channel: "cargo" };
  return { channel: "none" };
}

/**
 * Compagnies desservant un pays et acceptant le chien, du plus pertinent au moins.
 * Deux sources concordantes : les routes AeroDataBox (présence mesurée) et
 * `serves_country_ids` (déclaratif). L'union des deux évite d'oublier une compagnie
 * dont le pays n'a aucun aéroport dans la base.
 *
 * `reachable` dit si ce pays possède au moins un aéroport dans le référentiel. C'est la
 * condition d'honnêteté du bloc : sans aéroport, la fiche annonce des compagnies vers une
 * destination que le Finder ne sait pas proposer — deux affirmations contraires sur le même
 * site (constaté sur le Cap-Vert le 08/08/2026). On ne cache pas les compagnies pour autant :
 * la desserte est vraie et sourcée. On rend la limite visible plutôt que de la taire, et le
 * contrôle qualité `coherence: countries served by an airline have at least one airport`
 * réclame de son côté que la donnée finisse par être comblée.
 */
export function dogAirlinesForCountry(kb: any, countryId: string, locale: string, cap = 6): {
  list: CountryAirline[]; total: number; hidden: number; undocumented: number; reachable: boolean;
} {
  const served = servedCounts(kb).get(countryId) ?? new Map<string, number>();
  const all: CountryAirline[] = [];
  let undocumented = 0;
  for (const a of kb.airlines.values() as Iterable<any>) {
    const n = served.get(a.id) ?? 0;
    const declared = (a.serves_country_ids || []).includes(countryId);
    const national = a.country_id === countryId;
    if (!n && !declared && !national) continue;
    const { channel, maxKg } = dogChannel(a);
    if (channel === "none") { undocumented++; continue; }
    const net = (a.direct_routes || []).length + (a.seasonal_routes || []).length;
    all.push({ id: a.id, slug: slugFor(a.id), name: a.name, channel, maxKg, airports: n, national, net });
  }
  // La compagnie du pays d'abord — c'est celle que le voyageur cherche en premier pour
  // une destination. Ensuite la présence réelle (nombre d'aéroports du pays desservis),
  // puis la taille du réseau, qui départage les ex æquo bien mieux que l'ordre alphabétique :
  // sur une petite destination, toutes les compagnies desservent le même unique aéroport.
  all.sort((x, y) =>
    Number(y.national) - Number(x.national) ||
    y.airports - x.airports ||
    y.net - x.net ||
    x.name.localeCompare(y.name, locale));
  const reachable = [...kb.airports.values()].some((a: any) => a.country_id === countryId);
  return { list: all.slice(0, cap), total: all.length, hidden: Math.max(0, all.length - cap), undocumented, reachable };
}

// ─────────────────────────────────────────────────────────────────────────────
// Aéroport → compagnie : dernière case vide du maillage. La fiche aéroport ne disait
// pas quelles compagnies acceptant le chien y opèrent, alors que les routes le disent
// aéroport par aéroport. Bénéfice secondaire : ces fiches sont les plus minces du site.

/** Nombre de routes de chaque compagnie touchant chaque aéroport — calculé une fois. */
let atAirportCache: Map<string, Map<string, number>> | null = null;
function routesAtAirport(kb: any): Map<string, Map<string, number>> {
  if (atAirportCache) return atAirportCache;
  const out = new Map<string, Map<string, number>>(); // airportId -> airlineId -> nb routes
  for (const a of kb.airlines.values() as Iterable<any>) {
    for (const r of [...(a.direct_routes || []), ...(a.seasonal_routes || [])]) {
      for (const ep of String(r).split("|")) {
        const m = out.get(ep) ?? out.set(ep, new Map()).get(ep)!;
        m.set(a.id, (m.get(a.id) ?? 0) + 1);
      }
    }
  }
  atAirportCache = out;
  return out;
}

export interface AirportAirline {
  id: string; slug: string; name: string;
  channel: Exclude<DogChannel, "none">;
  maxKg?: number;
  /** L'aéroport est un hub déclaré de la compagnie. */
  hub: boolean;
}

/**
 * Compagnies opérant à cet aéroport et acceptant le chien, les plus présentes d'abord.
 * Le nombre de routes sert uniquement au classement : l'échantillonnage des routes n'est
 * pas symétrique d'un aéroport à l'autre, l'afficher donnerait une fausse précision.
 */
export function dogAirlinesForAirport(kb: any, airportId: string, locale: string, cap = 8): {
  list: AirportAirline[]; total: number; hidden: number;
} {
  const at = routesAtAirport(kb).get(airportId) ?? new Map<string, number>();
  const rows: (AirportAirline & { n: number })[] = [];
  for (const [airlineId, n] of at) {
    const a: any = kb.airlines.get(airlineId);
    if (!a) continue;
    const { channel, maxKg } = dogChannel(a);
    if (channel === "none") continue;
    rows.push({
      id: a.id, slug: slugFor(a.id), name: a.name, channel, maxKg,
      hub: (a.hub_airport_ids || []).includes(airportId), n,
    });
  }
  rows.sort((x, y) => Number(y.hub) - Number(x.hub) || y.n - x.n || x.name.localeCompare(y.name, locale));
  return { list: rows.slice(0, cap), total: rows.length, hidden: Math.max(0, rows.length - cap) };
}
