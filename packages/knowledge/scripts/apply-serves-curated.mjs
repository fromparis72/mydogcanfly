#!/usr/bin/env node
/* Apply curated dessertes (serves-curated.json) to the base: set served_airport_ids for each listed
   airline (route-aware candidacy) and UNION the served countries (never removes hand-curated ones).
   Idempotent. No network — the research is baked into serves-curated.json. */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OBJ = resolve(HERE, "../raw/objects.json");
const CUR = resolve(HERE, "serves-curated.json");

const data = JSON.parse(readFileSync(OBJ, "utf8"));
const curated = JSON.parse(readFileSync(CUR, "utf8"));
const airportByIata = new Map();
for (const a of data.airports) if (a.iata) airportByIata.set(a.iata.toUpperCase(), a.id);
const countryOfAirport = new Map(data.airports.map((a) => [a.id, a.country_id]));
const airlineByIata = new Map();
for (const a of data.airlines) if (a.iata) airlineByIata.set(a.iata.toUpperCase(), a);

let touched = 0, countriesAdded = 0; const misses = [];
for (const entry of curated.airlines) {
  const a = airlineByIata.get((entry.iata || "").toUpperCase());
  if (!a) { console.warn(`Compagnie inconnue: ${entry.iata} (${entry.name})`); continue; }
  const ids = new Set();
  for (const iata of entry.served_iata) {
    const id = airportByIata.get(iata.toUpperCase());
    if (id) ids.add(id); else misses.push(`${entry.iata}:${iata}`);
  }
  if (ids.size === 0) continue;
  a.served_airport_ids = [...ids].sort();
  // Derive served countries FROM the curated airports (replace, not union) so airline pages and the finder
  // stay consistent — this also purges any stale country left over from earlier imports.
  const countries = new Set();
  for (const apt of ids) { const c = countryOfAirport.get(apt); if (c) countries.add(c); }
  countriesAdded += countries.size;
  a.serves_country_ids = [...countries].sort();
  touched++;
  console.log(`  ${entry.iata} ${a.name}: ${ids.size} aéroports desservis`);
}

writeFileSync(OBJ, JSON.stringify(data, null, 2) + "\n");
console.log(`\nCuration appliquée : ${touched} compagnies, +${countriesAdded} dessertes pays.`);
if (misses.length) console.log("IATA non trouvés (ignorés):", misses.join(", "));
