#!/usr/bin/env node
/* Round-trip expansion, batch 1: set regime = "eu" for every EU / EEA + Switzerland country
   (EU pet-passport area — no export procedure to leave, so no `exit` block). Idempotent:
   skips any file that already has a top-level `regime:`. Membership is public fact, no sourcing needed. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "content/countries");

// EU-27 (minus fr/es/de already done) + EEA (Norway, Liechtenstein) + Switzerland.
// Iceland (is) is intentionally excluded — strict import quarantine makes it island_strict, handled separately.
const EU = ["at", "be", "bg", "cy", "cz", "dk", "ee", "fi", "gr", "hr", "hu", "ie", "it",
  "lt", "lu", "lv", "mt", "nl", "pl", "pt", "ro", "se", "si", "sk", "li", "no", "ch"];

let done = 0; const missing = [];
for (const iso of EU) {
  const file = resolve(DIR, iso + ".yml");
  let t;
  try { t = readFileSync(file, "utf8"); } catch { missing.push(iso); continue; }
  if (/^regime:/m.test(t)) { continue; }
  const idx = t.indexOf("\nhero:");
  if (idx < 0) { missing.push(iso + "(no hero)"); continue; }
  writeFileSync(file, t.slice(0, idx) + "\n\nregime: eu\n" + t.slice(idx));
  done++;
}
console.log(`regime: eu ajouté à ${done} pays UE/EEE.`);
if (missing.length) console.log("fichiers absents / ignorés :", missing.join(", "));
