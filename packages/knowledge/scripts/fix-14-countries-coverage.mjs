#!/usr/bin/env node
/* Les "14 pays sans aéroport" signalés par la porte qualité (`npm run check`, contrôle
 * "coherence: countries served by an airline have at least one airport") — point 1 de la liste
 * APRÈS de REPRISE.md.
 *
 * POURQUOI CE SCRIPT EXISTE. Comme pour le Cap-Vert le 8 août : une compagnie annonce desservir
 * un pays via `serves_country_ids` (une liste de PAYS), mais le Finder construit ses destinations
 * en parcourant `kb.airports` — sans aéroport rattaché à ce pays, aucune recherche ne peut y
 * mener, alors même que la fiche compagnie affirme le contraire.
 *
 * QUEL CÔTÉ ÉTAIT FAUX — vérifié pays par pays le 08/08/2026, sur le site officiel de CHAQUE
 * compagnie qui prétendait le desservir (jamais une supposition) :
 *
 *   12 PAYS : c'est le référentiel d'aéroports qui était vide, la desserte est réelle.
 *     Azerbaïdjan (Air Astana, vols Almaty/Atyrau→Bakou repris mars 2026 — ttrweekly.com,
 *       astanatimes.com), Bangladesh (Gulf Air, BAH→DAC en vente sur gulfair.com), Bolivie
 *       (Aerolíneas Argentinas, page AEP→VVI en ligne sur aerolineas.com.ar), Cambodge (Asiana
 *       ICN→Phnom Penh + Bangkok Airways →Phnom Penh/Siem Reap, sur les deux sites officiels —
 *       ATTENTION : l'aéroport de Phnom Penh a changé de code, PNH a fermé le 8/9/2025, tout le
 *       trafic est désormais sur Techo Intl/KTI), Irak (Gulf Air ET Royal Jordanian, Bagdad et
 *       Najaf, confirmés sur gulfair.com et rj.com — des perturbations d'espace aérien régional
 *       ont brièvement affecté les vols mi-2026 selon la presse aéronautique, sans que la desserte
 *       elle-même soit retirée des sites officiels ; à revérifier si l'info se périme), Kazakhstan
 *       (Air Astana — compagnie nationale — et Asiana ICN→Almaty confirmés sur flyasiana.com),
 *       Mozambique (Kenya Airways ET South African Airways, Maputo, confirmés sur kenya-airways.com
 *       et flysaa.com), Pakistan (Gulf Air, BAH→Karachi confirmé), Paraguay (Aerolíneas Argentinas,
 *       AEP→Asunción confirmé sur aerolineas.com.ar et le régulateur paraguayen DINAC), Rwanda
 *       (Kenya Airways, NBO→Kigali confirmé), Tanzanie (Kenya Airways, NBO→Dar es Salaam confirmé),
 *       Ouganda (Kenya Airways, NBO→Entebbe confirmé).
 *
 *   2 PAYS : c'est `serves_country_ids` qui était faux — la compagnie ne dessert plus ce pays.
 *     Angola (South African Airways) : la liaison JNB→Luanda est TERMINÉE — le propre site
 *       « where we fly » de SAA ne la liste plus, Wikipedia la marque « Terminated », et les vols
 *       actuels JNB→Luanda sont opérés par Airlink/TAAG/Air Algérie, pas SAA. On retire donc
 *       country_ao de `airline_south_african_airways.serves_country_ids` au lieu d'inventer un
 *       aéroport pour une route qui n'existe plus.
 *     Myanmar (Bangkok Airways) : le vol BKK→Yangon s'est arrêté le 26/10/2024 (flightsfrom.com,
 *       corroboré par l'absence de Yangon dans la carte de routes 2026 de la compagnie et par des
 *       tarifs "N/A" sur bangkokair.com/flightdeals). Le Myanmar est aujourd'hui desservi par
 *       Myanmar Airways International / Thai Airways / Myanmar National, pas Bangkok Airways.
 *       On retire donc country_mm de `airline_bangkok_airways.serves_country_ids`.
 *
 * CE QUE LE SCRIPT ÉCRIT :
 *   1. 14 aéroports (12 pays), sourcés IATA/ICAO/coordonnées (voir commentaire par entrée).
 *   2. Les liaisons directes confirmées par ces mêmes sources, ajoutées à `direct_routes` /
 *      `served_airport_ids` des compagnies concernées (hub existant du référentiel → nouvel
 *      aéroport) — ni plus ni moins que ce que chaque source atteste explicitement.
 *   3. La correction des deux `serves_country_ids` faux (Angola/SAA, Myanmar/Bangkok Airways).
 *   4. Le hub Air Astana (Almaty + Astana), absent jusqu'ici du référentiel faute d'aéroport
 *      kazakh — sourcé sur la fiche Wikipedia de la compagnie.
 *
 * CE QU'IL N'ÉCRIT PAS. Pas de `pet_relief`, pas de `terminal_rules` : rien n'est publié dessus
 * pour ces aéroports, une absence n'est pas une donnée à zéro. Pas l'aéroport d'Atyrau
 * (Kazakhstan) ni les aéroports secondaires pakistanais (Lahore, Islamabad) que Gulf Air dessert
 * aussi — hors périmètre de cette passe, à ajouter plus tard si besoin, jamais par supposition.
 *
 * Idempotent : relancer ne duplique rien, ne réécrit rien qui existe déjà.
 *   node packages/knowledge/scripts/fix-14-countries-coverage.mjs [--dry]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OBJ = resolve(HERE, "../raw/objects.json");
const dry = process.argv.includes("--dry");

const AIRPORTS = [
  {
    // Wikipedia (IATA/ICAO/nom), coordonnées recoupées world-airport-codes.com — GYD/UBBB.
    id: "airport_gyd", iata: "GYD", country_id: "country_az",
    name: { en: "Heydar Aliyev International", fr: "Heydar-Aliyev international", es: "Heydar Aliyev internacional", pt: "Heydar Aliyev internacional" },
    city: "Baku", city_i18n: { en: "Baku", fr: "Bakou", es: "Bakú", pt: "Baku" },
    geo: { lat: 40.4675, lon: 50.0467 },
  },
  {
    // Wikipedia (IATA/ICAO/nom/ville), coordonnées recoupées greatcirclemapper.net — DAC/VGHS.
    id: "airport_dac", iata: "DAC", country_id: "country_bd",
    name: { en: "Hazrat Shahjalal International", fr: "Hazrat Shahjalal international", es: "Hazrat Shahjalal internacional", pt: "Hazrat Shahjalal internacional" },
    city: "Dhaka", city_i18n: { en: "Dhaka", fr: "Dacca", es: "Daca", pt: "Daca" },
    geo: { lat: 23.843347, lon: 90.397783 },
  },
  {
    // Wikipedia + world-airport-codes.com, cohérents — VVI/SLVR. Passerelle internationale de
    // Santa Cruz de la Sierra ; PAS La Paz/El Alto (LPB), non concerné par la route Aerolíneas Argentinas.
    id: "airport_vvi", iata: "VVI", country_id: "country_bo",
    name: { en: "Viru Viru International", fr: "Viru Viru international", es: "Viru Viru internacional", pt: "Viru Viru internacional" },
    city: "Santa Cruz de la Sierra", city_i18n: { en: "Santa Cruz de la Sierra", fr: "Santa Cruz de la Sierra", es: "Santa Cruz de la Sierra", pt: "Santa Cruz de la Sierra" },
    geo: { lat: -17.6448, lon: -63.1354 },
  },
  {
    // ourairports.com + Wikipedia. Remplace Phnom Penh Intl (PNH), fermé le 08/09/2025 — tout le
    // trafic (Asiana, Bangkok Airways) est désormais ici. Ne JAMAIS cataloguer PNH comme actuel.
    id: "airport_kti", iata: "KTI", country_id: "country_kh",
    name: { en: "Techo International", fr: "Techo international", es: "Techo internacional", pt: "Techo internacional" },
    city: "Phnom Penh", city_i18n: { en: "Phnom Penh", fr: "Phnom Penh", es: "Phnom Penh", pt: "Phnom Penh" },
    geo: { lat: 11.359987, lon: 104.921272 },
  },
  {
    // ourairports.com + Wikipedia. Remplace Siem Reap Intl (REP), fermé depuis le 16/10/2023.
    id: "airport_sai", iata: "SAI", country_id: "country_kh",
    name: { en: "Siem Reap–Angkor International", fr: "Siem Reap-Angkor international", es: "Siem Reap-Angkor internacional", pt: "Siem Reap-Angkor internacional" },
    city: "Siem Reap", city_i18n: { en: "Siem Reap", fr: "Siem Reap", es: "Siem Reap", pt: "Siem Reap" },
    geo: { lat: 13.369740, lon: 104.223831 },
  },
  {
    // Wikipedia — BGW/ORBI.
    id: "airport_bgw", iata: "BGW", country_id: "country_iq",
    name: { en: "Baghdad International", fr: "Bagdad international", es: "Bagdad internacional", pt: "Bagdá internacional" },
    city: "Baghdad", city_i18n: { en: "Baghdad", fr: "Bagdad", es: "Bagdad", pt: "Bagdá" },
    geo: { lat: 33.26250, lon: 44.23444 },
  },
  {
    // skyvector.com (recoupé travelmath.com, écart <0.003°) — NJF/ORNI.
    id: "airport_njf", iata: "NJF", country_id: "country_iq",
    name: { en: "Al Najaf International", fr: "Al-Najaf international", es: "Al Najaf internacional", pt: "Al Najaf internacional" },
    city: "Najaf", city_i18n: { en: "Najaf", fr: "Najaf", es: "Najaf", pt: "Najaf" },
    geo: { lat: 31.9897, lon: 44.4042 },
  },
  {
    // Wikipedia — ALA/UAAA. Hub principal d'Air Astana, sa propre compagnie nationale.
    id: "airport_ala", iata: "ALA", country_id: "country_kz",
    name: { en: "Almaty International", fr: "Almaty international", es: "Almaty internacional", pt: "Almaty internacional" },
    city: "Almaty", city_i18n: { en: "Almaty", fr: "Almaty", es: "Almaty", pt: "Almaty" },
    geo: { lat: 43.3553, lon: 77.0447 },
  },
  {
    // Wikipedia — NQZ/UACC. Second hub d'Air Astana (capitale). Nom officiel encore
    // "Nursultan Nazarbayev" sur Wikipedia au 08/08/2026 malgré le retour de la ville au nom
    // "Astana" en 2022 — à revérifier si l'aéroport est officiellement rebaptisé depuis.
    id: "airport_nqz", iata: "NQZ", country_id: "country_kz",
    name: { en: "Nursultan Nazarbayev International", fr: "Nursultan-Nazarbayev international", es: "Nursultan Nazarbayev internacional", pt: "Nursultan Nazarbayev internacional" },
    city: "Astana", city_i18n: { en: "Astana", fr: "Astana", es: "Astaná", pt: "Astana" },
    geo: { lat: 51.0219, lon: 71.4669 },
  },
  {
    // Wikipedia (FQMA) recoupé ourairports.com + world-airport-codes.com, coordonnées identiques.
    id: "airport_mpm", iata: "MPM", country_id: "country_mz",
    name: { en: "Maputo International", fr: "Maputo international", es: "Maputo internacional", pt: "Maputo internacional" },
    city: "Maputo", city_i18n: { en: "Maputo", fr: "Maputo", es: "Maputo", pt: "Maputo" },
    geo: { lat: -25.920799, lon: 32.572601 },
  },
  {
    // Wikipedia — KHI/OPKC. Gulf Air dessert aussi Lahore et Islamabad (hors périmètre ici).
    id: "airport_khi", iata: "KHI", country_id: "country_pk",
    name: { en: "Jinnah International", fr: "Jinnah international", es: "Jinnah internacional", pt: "Jinnah internacional" },
    city: "Karachi", city_i18n: { en: "Karachi", fr: "Karachi", es: "Karachi", pt: "Carachi" },
    geo: { lat: 24.90667, lon: 67.16083 },
  },
  {
    // Wikipedia (SGAS) recoupé ourairports.com. Aéroport physiquement à Luque, dessert Asunción.
    id: "airport_asu", iata: "ASU", country_id: "country_py",
    name: { en: "Silvio Pettirossi International", fr: "Silvio-Pettirossi international", es: "Silvio Pettirossi internacional", pt: "Silvio Pettirossi internacional" },
    city: "Asunción", city_i18n: { en: "Asunción", fr: "Asunción", es: "Asunción", pt: "Assunção" },
    geo: { lat: -25.240156, lon: -57.519227 },
    info: { address: "Luque, Paraguay (banlieue d'Asunción)" },
  },
  {
    // ourairports.com (HRYR) recoupé Wikipedia + world-airport-codes.com.
    id: "airport_kgl", iata: "KGL", country_id: "country_rw",
    name: { en: "Kigali International", fr: "Kigali international", es: "Kigali internacional", pt: "Kigali internacional" },
    city: "Kigali", city_i18n: { en: "Kigali", fr: "Kigali", es: "Kigali", pt: "Kigali" },
    geo: { lat: -1.96863, lon: 30.1395 },
  },
  {
    // Wikipedia recoupé world-airport-codes.com. Kenya Airways dessert aussi Kilimandjaro (JRO)
    // et Zanzibar (ZNZ) — hors périmètre ici, Dar es Salaam est la porte d'entrée principale.
    id: "airport_dar", iata: "DAR", country_id: "country_tz",
    name: { en: "Julius Nyerere International", fr: "Julius-Nyerere international", es: "Julius Nyerere internacional", pt: "Julius Nyerere internacional" },
    city: "Dar es Salaam", city_i18n: { en: "Dar es Salaam", fr: "Dar es Salaam", es: "Dar es Salam", pt: "Dar es Salaam" },
    geo: { lat: -6.8781099, lon: 39.2025986 },
  },
  {
    // Wikipedia (HUEN) recoupé world-airport-codes.com + latitude.to, écart <0.01°.
    id: "airport_ebb", iata: "EBB", country_id: "country_ug",
    name: { en: "Entebbe International", fr: "Entebbe international", es: "Entebbe internacional", pt: "Entebbe internacional" },
    city: "Entebbe", city_i18n: { en: "Entebbe", fr: "Entebbe", es: "Entebbe", pt: "Entebbe" },
    geo: { lat: 0.0400, lon: 32.4388 },
  },
];

/* Compagnie existante (hub déjà au référentiel) → nouvel aéroport : liaisons confirmées sur le
 * site officiel de CHAQUE compagnie (voir sources dans l'en-tête). Clé triée alphabétiquement,
 * comme partout ailleurs dans le référentiel. */
const ROUTES = [
  { airline: "airline_air_astana", from: "airport_ala", to: "airport_gyd" }, // Almaty→Bakou, repris mars 2026
  { airline: "airline_gulf_air", from: "airport_bah", to: "airport_dac" },
  { airline: "airline_gulf_air", from: "airport_bah", to: "airport_khi" },
  { airline: "airline_gulf_air", from: "airport_bah", to: "airport_bgw" },
  { airline: "airline_gulf_air", from: "airport_bah", to: "airport_njf" },
  { airline: "airline_aerolineas_argentinas", from: "airport_aep", to: "airport_vvi" },
  { airline: "airline_aerolineas_argentinas", from: "airport_aep", to: "airport_asu" },
  { airline: "airline_asiana", from: "airport_icn", to: "airport_ala" },
  { airline: "airline_asiana", from: "airport_icn", to: "airport_kti" },
  { airline: "airline_bangkok_airways", from: "airport_bkk", to: "airport_kti" },
  { airline: "airline_bangkok_airways", from: "airport_bkk", to: "airport_sai" },
  { airline: "airline_royal_jordanian", from: "airport_amm", to: "airport_bgw" },
  { airline: "airline_royal_jordanian", from: "airport_amm", to: "airport_njf" },
  { airline: "airline_kenya_airways", from: "airport_nbo", to: "airport_mpm" },
  { airline: "airline_kenya_airways", from: "airport_nbo", to: "airport_kgl" },
  { airline: "airline_kenya_airways", from: "airport_nbo", to: "airport_dar" },
  { airline: "airline_kenya_airways", from: "airport_nbo", to: "airport_ebb" },
  { airline: "airline_south_african_airways", from: "airport_jnb", to: "airport_mpm" },
];

// Les deux desserte fausses : la compagnie ne vole plus vers ce pays (voir en-tête).
const REMOVE_SERVES = [
  { airline: "airline_south_african_airways", country: "country_ao" }, // JNB→Luanda terminé
  { airline: "airline_bangkok_airways", country: "country_mm" },       // BKK→Yangon arrêté 26/10/2024
];

const data = JSON.parse(readFileSync(OBJ, "utf8"));
const countryIds = new Set(data.countries.map((c) => c.id));

let addedAirports = 0, skippedAirports = 0;
for (const a of AIRPORTS) {
  if (!countryIds.has(a.country_id)) {
    console.error(`✗ ${a.country_id} absent du référentiel : ${a.id} non ajouté.`);
    continue;
  }
  if (data.airports.some((x) => x.id === a.id || x.iata === a.iata)) { skippedAirports++; continue; }
  data.airports.push(a);
  addedAirports++;
}
data.airports.sort((x, y) => x.id.localeCompare(y.id));
const known = new Set(data.airports.map((a) => a.id));

let addedRoutes = 0, skippedRoutes = 0;
for (const r of ROUTES) {
  const airline = data.airlines.find((a) => a.id === r.airline);
  if (!airline) { console.warn(`⚠ ${r.airline} introuvable : route ${r.from}→${r.to} ignorée.`); continue; }
  if (!known.has(r.from) || !known.has(r.to)) { console.warn(`⚠ aéroport manquant pour ${r.airline} ${r.from}→${r.to}.`); continue; }
  airline.served_airport_ids = [...new Set([...(airline.served_airport_ids ?? []), r.from, r.to])].sort();
  const key = [r.from, r.to].sort().join("|");
  const before = new Set(airline.direct_routes ?? []);
  if (!before.has(key)) { airline.direct_routes = [...before, key].sort(); addedRoutes++; }
  else skippedRoutes++;
}

// Air Astana : hub kazakh, absent faute d'aéroport catalogué jusqu'ici.
const astana = data.airlines.find((a) => a.id === "airline_air_astana");
if (astana) {
  astana.hub_airport_ids = [...new Set([...(astana.hub_airport_ids ?? []), "airport_ala", "airport_nqz"])].sort();
  astana.served_airport_ids = [...new Set([...(astana.served_airport_ids ?? []), "airport_ala", "airport_nqz"])].sort();
}

let removedServes = 0;
for (const r of REMOVE_SERVES) {
  const airline = data.airlines.find((a) => a.id === r.airline);
  if (!airline) continue;
  const before = new Set(airline.serves_country_ids ?? []);
  if (before.has(r.country)) {
    airline.serves_country_ids = airline.serves_country_ids.filter((c) => c !== r.country);
    removedServes++;
  }
}

if (!dry) writeFileSync(OBJ, JSON.stringify(data, null, 2) + "\n");

console.log(
  `${addedAirports} aéroport(s) ajouté(s), ${skippedAirports} déjà présent(s) — total ${data.airports.length}` +
  ` · ${addedRoutes} route(s) directe(s) ajoutée(s) (${skippedRoutes} déjà là)` +
  ` · ${removedServes} desserte(s) fausse(s) retirée(s) de serves_country_ids` +
  `${dry ? "  (essai à blanc)" : ""}`,
);
