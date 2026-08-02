#!/usr/bin/env node
/* Seed airline.contact for witness airlines with real, sourced phone numbers (ADR-0006). Idempotent. */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const OBJ = resolve(dirname(fileURLToPath(import.meta.url)), "../raw/objects.json");
const TODAY = "2026-07-10";
const plus = (iso, d) => { const x = new Date(iso + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
const L = (en, fr) => ({ en, fr });
const src = (url, confidence) => ({ url, source_type: "official_website", verified_date: TODAY, review_due: plus(TODAY, 365), confidence, reviewer: "research", history: [] });

const CONTACT = {
  airline_air_france: {
    phones: [
      { region: L("France", "France"), number: "3654" },
      { region: L("United States", "États-Unis"), number: "+1 800 237 2747" },
    ],
    source: src("https://wwws.airfrance.fr/en/contact", 4),
  },
};

const data = JSON.parse(readFileSync(OBJ, "utf8"));
let n = 0;
for (const a of data.airlines) if (CONTACT[a.id]) { a.contact = CONTACT[a.id]; n++; }
writeFileSync(OBJ, JSON.stringify(data, null, 2) + "\n");
console.log(`airline.contact rempli pour ${n} compagnie(s):`, Object.keys(CONTACT).join(", "));
