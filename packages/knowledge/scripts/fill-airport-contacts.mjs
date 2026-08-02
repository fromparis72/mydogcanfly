#!/usr/bin/env node
/* Seed airport.info.contacts with the airport's official information phone line (ADR-0006, sourced).
   Numbers live in airport-phones.json (IATA → {phone, url}), each researched from an official/reliable
   source. Idempotent · merges into existing info · only verified numbers — never invents one. */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OBJ = resolve(HERE, "../raw/objects.json");
const PHONES = JSON.parse(readFileSync(resolve(HERE, "airport-phones.json"), "utf8"));
const TODAY = "2026-07-10";
const plus = (iso, d) => { const x = new Date(iso + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
const LABEL = { en: "Airport information", fr: "Information aéroport" };
const src = (url) => ({ url, source_type: "official_website", verified_date: TODAY, review_due: plus(TODAY, 365), confidence: 3, reviewer: "research", history: [] });

const data = JSON.parse(readFileSync(OBJ, "utf8"));
let n = 0;
for (const ap of data.airports) {
  const p = PHONES[ap.iata];
  if (!p) continue;
  ap.info = ap.info || {};
  const existing = ap.info.contacts ?? [];
  if (!existing.some((c) => c.value === p.phone)) {
    ap.info.contacts = [...existing, { label: LABEL, value: p.phone, source: src(p.url) }];
    n++;
  }
}
writeFileSync(OBJ, JSON.stringify(data, null, 2) + "\n");
const withContacts = data.airports.filter((a) => a.info?.contacts?.length).length;
console.log(`airport.info.contacts : +${n} ajoutés · ${withContacts}/${data.airports.length} aéroports avec contact`);
