#!/usr/bin/env node
/* Merge a batch of curated serves entries into serves-curated.json (upsert by IATA). Usage:
   node merge-serves.mjs <batch.json>   where batch.json is an array of {iata, served_iata, source_url, name?} */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const CUR = resolve(HERE, "serves-curated.json");
const batchPath = process.argv[2];
if (!batchPath) { console.error("Usage: node merge-serves.mjs <batch.json>"); process.exit(1); }

const curated = JSON.parse(readFileSync(CUR, "utf8"));
const batch = JSON.parse(readFileSync(batchPath, "utf8"));
const byIata = new Map(curated.airlines.map((a) => [a.iata.toUpperCase(), a]));
let added = 0, updated = 0;
for (const e of batch) {
  if (!e.iata || !Array.isArray(e.served_iata)) continue;
  const key = e.iata.toUpperCase();
  const entry = { iata: e.iata, name: e.name || byIata.get(key)?.name || e.iata, source: e.source_url || e.source || "", served_iata: e.served_iata };
  if (byIata.has(key)) { Object.assign(byIata.get(key), entry); updated++; }
  else { curated.airlines.push(entry); byIata.set(key, entry); added++; }
}
writeFileSync(CUR, JSON.stringify(curated, null, 2) + "\n");
console.log(`Fusion: ${added} ajoutées, ${updated} mises à jour. Total: ${curated.airlines.length} compagnies.`);
