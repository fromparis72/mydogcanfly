#!/usr/bin/env node
/* Fix tutoiement conversion artifacts in the FRENCH content (fr: fields) of country + airline guides.
   All targeted tokens are French-only (hyphenated "verbe-tu", "sur tu", "à tu", "tu manque"), so global
   string replacement can't touch the Spanish/English fields. `rends-tu` is context-disambiguated:
   noun "rendez-vous" vs imperative "rends-toi à…". `con-tu` (Spanish URLs) is deliberately untouched. */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "content");
const DIRS = ["countries", "airlines"];

// Unambiguous imperative pronominal verbs: -tu → -toi (some also fix the vous-stem).
const PAIRS = [
  ["présente-tu", "présente-toi"], ["Présente-tu", "Présente-toi"],
  ["attends-tu", "attends-toi"], ["Attends-tu", "Attends-toi"],
  ["concentre-tu", "concentre-toi"], ["Concentre-tu", "Concentre-toi"],
  ["organise-tu", "organise-toi"], ["Organise-tu", "Organise-toi"],
  ["fiez-tu", "fie-toi"], ["Fiez-tu", "Fie-toi"],
  ["inscris-tu", "inscris-toi"], ["Inscris-tu", "Inscris-toi"],
  ["signale-tu", "signale-toi"], ["Signale-tu", "Signale-toi"],
  ["appuyez-tu", "appuie-toi"], ["Appuyez-tu", "Appuie-toi"],
  ["rappelez-tu", "rappelle-toi"], ["Rappelez-tu", "Rappelle-toi"],
  ["déclare-tu", "déclare-toi"], ["Déclare-tu", "Déclare-toi"],
  ["prépare-tu", "prépare-toi"], ["Prépare-tu", "Prépare-toi"],
  ["enregistre-tu", "enregistre-toi"], ["Enregistre-tu", "Enregistre-toi"],
  // Tonic pronoun "toi" mangled to "tu".
  ["sur tu", "sur toi"], ["Sur tu", "Sur toi"], ["à tu", "à toi"],
  // Object pronoun "te" mangled to "tu".
  ["vaccination tu manque", "vaccination te manque"],
];

let total = 0; const perFile = [];
for (const d of DIRS) {
  const dir = join(ROOT, d);
  let files;
  try { files = readdirSync(dir).filter((f) => f.endsWith(".yml")); } catch { continue; }
  for (const f of files) {
    const path = join(dir, f);
    let t = readFileSync(path, "utf8");
    const before = t;
    for (const [a, b] of PAIRS) t = t.split(a).join(b);
    // rends-tu: imperative first (followed by au/aux/à, optionally "directement"), then the rest = noun.
    t = t.replace(/([Rr])ends-tu( (?:directement )?(?:aux?|à))/g, "$1ends-toi$2");
    t = t.split("Rends-tu").join("Rendez-vous").split("rends-tu").join("rendez-vous");
    if (t !== before) {
      writeFileSync(path, t);
      const n = [...before.matchAll(/-tu\b|sur tu|à tu|vaccination tu manque/g)].length;
      perFile.push(`${d}/${f}`); total++;
    }
  }
}
console.log(`Fichiers corrigés : ${total}`);
console.log(perFile.join(", "));
