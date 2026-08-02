#!/usr/bin/env node
/* Round-trip expansion, batch 2: classify every remaining (non-EU) country by regime, from the
   OFFICIAL EU list — Commission Delegated Regulation (EU) 2026/131 (in force since April 2026):
     - Part (a) / Part 2 "listed third countries" → no rabies titer to return to the EU  → "listed"
     - Iceland → listed for return BUT strict import (permit/quarantine)                → "island_strict"
     - anything NOT on the list → titer required to return to the EU                    → "non_listed"
   Source: https://food.ec.europa.eu/animals/live-animal-movements/dogs-cats-and-ferrets/listing-territories-and-non-eu-countries_en
   Idempotent: skips any file that already has a `regime:` (EU/EEA + the 10 pilots stay untouched). */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "content/countries");

// Part 2 "listed third countries" (Annex II to Reg (EU) 2026/636) — ISO2, lowercase.
const LISTED = new Set(["ac", "ae", "ag", "ar", "au", "aw", "ba", "bb", "bh", "bm", "bq", "ca", "cl",
  "cw", "fj", "fk", "gb", "gg", "hk", "im", "jm", "jp", "je", "kn", "ky", "lc", "me", "ms", "mk",
  "mu", "mx", "my", "nc", "nz", "pf", "pm", "rs", "sg", "sh", "sx", "tt", "tw", "us", "vc", "vg", "vu", "wf"]);
// Strict-import islands (listed for return, but permit + quarantine to enter).
const ISLAND_STRICT = new Set(["is"]);

let listed = 0, nonListed = 0, island = 0;
for (const f of readdirSync(DIR)) {
  if (!f.endsWith(".yml")) continue;
  const path = join(DIR, f);
  const t = readFileSync(path, "utf8");
  if (/^regime:/m.test(t)) continue;                          // already classified (EU/EEA + pilots)
  const iso = (t.match(/^iso2:\s*"?([A-Za-z]{2})"?/m)?.[1] || "").toLowerCase();
  if (!iso) continue;
  const regime = ISLAND_STRICT.has(iso) ? "island_strict" : LISTED.has(iso) ? "listed" : "non_listed";
  const idx = t.indexOf("\nhero:");
  if (idx < 0) continue;
  writeFileSync(path, t.slice(0, idx) + "\n\nregime: " + regime + "\n" + t.slice(idx));
  if (regime === "listed") listed++; else if (regime === "island_strict") island++; else nonListed++;
}
console.log(`Classés : ${listed} listed, ${island} island_strict, ${nonListed} non_listed.`);
