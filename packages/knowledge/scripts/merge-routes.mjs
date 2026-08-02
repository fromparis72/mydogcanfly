#!/usr/bin/env node
/* Fusionne un baseline de routes (format « lots ») dans raw/objects.json.
 *
 *   node packages/knowledge/scripts/merge-routes.mjs <baseline.json> [--dry]
 *
 * Pourquoi ce script existe : 72 des 78 compagnies n'avaient AUCUNE route, si bien que le
 * « vol direct » affiché au visiteur était déduit de la seule présence d'un hub — une
 * heuristique, pas un fait. Ce baseline apporte les arêtes réelles.
 *
 * Règles de fusion, volontairement prudentes :
 *  • une compagnie absente du baseline garde ses routes existantes (rien n'est effacé) ;
 *  • les routes saisonnières restent dans un champ à part : annoncer en février un
 *    nonstop qui n'existe qu'en juillet serait une régression, pas un progrès ;
 *  • toute arête dont un aéroport est inconnu est rejetée et signalée ;
 *  • les paires sont renormalisées (triées, dédoublonnées) quoi qu'il arrive.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const OBJ = resolve(ROOT, "packages/knowledge/raw/objects.json");

const src = process.argv[2];
const dry = process.argv.includes("--dry");
if (!src) { console.error("usage: merge-routes.mjs <baseline.json> [--dry]"); process.exit(2); }

const base = JSON.parse(readFileSync(resolve(src), "utf8"));
const obj = JSON.parse(readFileSync(OBJ, "utf8"));
const airports = new Set(obj.airports.map((a) => a.id));
const byIata = new Map(obj.airlines.filter((a) => a.iata).map((a) => [a.iata, a]));

/** Trie, dédoublonne et écarte les arêtes dont un aéroport nous est inconnu. */
function clean(edges, rejected) {
  const out = new Set();
  for (const e of edges ?? []) {
    const p = String(e).split("|");
    if (p.length !== 2 || !airports.has(p[0]) || !airports.has(p[1]) || p[0] === p[1]) {
      rejected.push(e); continue;
    }
    out.add(p.slice().sort().join("|"));
  }
  return [...out].sort();
}

const rejected = [];
const report = [];
let touched = 0, addedD = 0, addedS = 0;

for (const [iata, entry] of Object.entries(base)) {
  const air = byIata.get(iata);
  if (!air) { report.push(`  ?  ${iata} — code inconnu du catalogue, ignoré`); continue; }
  const before = (air.direct_routes ?? []).length;
  const d = clean(entry.direct_routes, rejected);
  const s = clean(entry.seasonal_routes, rejected);
  if (!d.length && !s.length) { report.push(`  ·  ${iata} — baseline vide, inchangé`); continue; }
  air.direct_routes = d;
  air.seasonal_routes = s;
  touched++; addedD += d.length; addedS += s.length;
  const delta = d.length - before;
  report.push(`  ✓  ${iata.padEnd(3)} ${String(d.length).padStart(4)} directes` +
    (s.length ? ` + ${String(s.length).padStart(3)} saison.` : "".padStart(13)) +
    (before ? `   (était ${before}, ${delta >= 0 ? "+" : ""}${delta})` : "   (nouveau)"));
}

// Compagnies laissées intactes : elles avaient déjà des routes d'une autre source.
const untouched = obj.airlines.filter((a) => a.iata && !base[a.iata] && (a.direct_routes ?? []).length);
for (const a of untouched) report.push(`  =  ${a.iata.padEnd(3)} ${String(a.direct_routes.length).padStart(4)} directes   (conservé, hors baseline)`);

// Champ présent partout, pour un schéma homogène.
for (const a of obj.airlines) if (!Array.isArray(a.seasonal_routes)) a.seasonal_routes = [];

console.log(report.sort().join("\n"));
console.log("\n" + "─".repeat(58));
console.log(`compagnies mises à jour : ${touched}   ·   conservées : ${untouched.length}`);
console.log(`arêtes directes ajoutées : ${addedD}   ·   saisonnières : ${addedS}`);
const withRoutes = obj.airlines.filter((a) => (a.direct_routes ?? []).length).length;
console.log(`couverture finale : ${withRoutes} / ${obj.airlines.length} compagnies`);
if (rejected.length) {
  console.log(`\n⚠ ${rejected.length} arête(s) rejetée(s) (aéroport inconnu ou format) :`);
  console.log("   " + [...new Set(rejected)].slice(0, 8).join("\n   "));
}
if (dry) { console.log("\n(--dry : rien n'a été écrit)"); process.exit(0); }
writeFileSync(OBJ, JSON.stringify(obj, null, 2) + "\n");
console.log("\nobjects.json mis à jour.");
