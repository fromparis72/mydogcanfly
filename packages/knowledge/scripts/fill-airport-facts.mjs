#!/usr/bin/env node
/* Seed airport.info factual fields (address, terminals, website) from airport-facts.json.
   Non-destructive: never overwrites an already-set field (preserves curated witnesses like CDG). Idempotent. */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OBJ = resolve(HERE, "../raw/objects.json");
const FACTS = JSON.parse(readFileSync(resolve(HERE, "airport-facts.json"), "utf8"));

const data = JSON.parse(readFileSync(OBJ, "utf8"));
let n = 0;
for (const ap of data.airports) {
  const f = FACTS[ap.iata];
  if (!f) continue;
  ap.info = ap.info || {};
  let touched = false;
  for (const key of ["address", "terminals", "website"]) {
    if (f[key] && ap.info[key] == null) { ap.info[key] = f[key]; touched = true; }
  }
  if (touched) n++;
}
writeFileSync(OBJ, JSON.stringify(data, null, 2) + "\n");
const withAddr = data.airports.filter((a) => a.info?.address).length;
console.log(`airport.info facts : ${n} aéroports enrichis · ${withAddr}/${data.airports.length} avec adresse`);
