#!/usr/bin/env node
/* Fusionne un baseline de routes (format « lots ») dans raw/objects.json.
 *
 *   node packages/knowledge/scripts/merge-routes.mjs <baseline.json> [--dry] [--include-as]
 *
 * Pourquoi ce script existe : 72 des 78 compagnies n'avaient AUCUNE route, si bien que le
 * « vol direct » affiché au visiteur était déduit de la seule présence d'un hub — une
 * heuristique, pas un fait. Ce baseline apporte les arêtes réelles.
 *
 * Règles de fusion, volontairement prudentes :
 *  • une compagnie absente du baseline garde ses routes existantes (rien n'est effacé) ;
 *  • **union, jamais remplacement** : le baseline vient s'AJOUTER à l'existant, il ne
 *    l'écrase pas. Un cas réel l'a démontré le 8 août : la collecte 2026-07 classe TUI
 *    (BY) entièrement en saisonnier (fenêtre d'échantillonnage d'une semaine, trop courte
 *    pour un charter) et son `direct_routes` y est vide — un remplacement brut aurait
 *    effacé les 4 routes Cap-Vert (BVC-LGW, BVC-MAN, LGW-SID, MAN-SID) confirmées ailleurs ;
 *  • le direct l'emporte sur le saisonnier : une arête déjà confirmée « directe » ne
 *    redescend jamais en saisonnier faute d'une observation plus faible dans un nouveau
 *    baseline ; en revanche une arête vue « saisonnière » qui devient « directe » dans le
 *    nouveau baseline est promue (c'est un renforcement de preuve, pas une régression) ;
 *  • toute arête dont un aéroport est inconnu est rejetée et signalée ;
 *  • les paires sont renormalisées (triées, dédoublonnées) quoi qu'il arrive ;
 *  • **Alaska (AS) est isolée par défaut.** Depuis le rachat de Hawaiian, la source
 *    (AeroDataBox) fond les vols Hawaiian dans Alaska : ingérer AS tel quel ferait dire à
 *    Alaska qu'elle opère des routes qui étaient hawaïennes. Passer --include-as pour
 *    forcer l'ingestion malgré tout (à ne faire qu'après avoir vérifié route par route).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const OBJ = resolve(ROOT, "packages/knowledge/raw/objects.json");

const src = process.argv[2];
const dry = process.argv.includes("--dry");
const includeAS = process.argv.includes("--include-as");
if (!src) { console.error("usage: merge-routes.mjs <baseline.json> [--dry] [--include-as]"); process.exit(2); }

const ISOLATED = includeAS ? new Set() : new Set(["AS"]);

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
  return out;
}

const rejected = [];
const report = [];
let touched = 0, newD = 0, newS = 0, promoted = 0, isolatedCount = 0;

for (const [iata, entry] of Object.entries(base)) {
  if (ISOLATED.has(iata)) {
    isolatedCount++;
    report.push(`  ⊘  ${iata} — isolée (contamination Hawaiian/Alaska), non fusionnée`);
    continue;
  }
  const air = byIata.get(iata);
  if (!air) { report.push(`  ?  ${iata} — code inconnu du catalogue, ignoré`); continue; }

  const existingD = new Set(air.direct_routes ?? []);
  const existingS = new Set(air.seasonal_routes ?? []);
  const beforeD = existingD.size, beforeS = existingS.size;

  const candD = clean(entry.direct_routes, rejected);
  const candS = clean(entry.seasonal_routes, rejected);

  const mergedD = new Set([...existingD, ...candD]);
  // le saisonnier ne contient jamais une arête déjà confirmée directe (union puis exclusion)
  const mergedS = new Set([...existingS, ...candS].filter((e) => !mergedD.has(e)));

  const addedD = [...mergedD].filter((e) => !existingD.has(e)).length;
  const addedS = [...mergedS].filter((e) => !existingS.has(e)).length;
  const promotedHere = [...existingS].filter((e) => mergedD.has(e) && !existingD.has(e)).length;

  if (!addedD && !addedS) { report.push(`  ·  ${iata} — rien de neuf, inchangé`); continue; }

  air.direct_routes = [...mergedD].sort();
  air.seasonal_routes = [...mergedS].sort();
  touched++; newD += addedD; newS += addedS; promoted += promotedHere;
  report.push(`  ✓  ${iata.padEnd(3)} ${String(mergedD.size).padStart(4)} directes` +
    (mergedS.size ? ` + ${String(mergedS.size).padStart(3)} saison.` : "".padStart(13)) +
    `   (était ${beforeD}+${beforeS}, +${addedD} directes` +
    (promotedHere ? ` dont ${promotedHere} promue(s)` : "") +
    (addedS ? `, +${addedS} saison.` : "") + ")");
}

// Compagnies laissées intactes : absentes du baseline ou isolées, elles gardent leurs routes.
const untouched = obj.airlines.filter((a) => a.iata && !base[a.iata] && (a.direct_routes ?? []).length);
for (const a of untouched) report.push(`  =  ${a.iata.padEnd(3)} ${String(a.direct_routes.length).padStart(4)} directes   (conservé, hors baseline)`);

// Champ présent partout, pour un schéma homogène.
for (const a of obj.airlines) if (!Array.isArray(a.seasonal_routes)) a.seasonal_routes = [];

console.log(report.sort().join("\n"));
console.log("\n" + "─".repeat(58));
console.log(`compagnies mises à jour : ${touched}   ·   conservées : ${untouched.length}   ·   isolées : ${isolatedCount}`);
console.log(`arêtes directes NEUVES : ${newD} (dont ${promoted} promues depuis le saisonnier)   ·   saisonnières neuves : ${newS}`);
const withRoutes = obj.airlines.filter((a) => (a.direct_routes ?? []).length).length;
console.log(`couverture finale : ${withRoutes} / ${obj.airlines.length} compagnies`);
if (rejected.length) {
  console.log(`\n⚠ ${rejected.length} arête(s) rejetée(s) (aéroport inconnu ou format) :`);
  console.log("   " + [...new Set(rejected)].slice(0, 8).join("\n   "));
}
if (dry) { console.log("\n(--dry : rien n'a été écrit)"); process.exit(0); }
writeFileSync(OBJ, JSON.stringify(obj, null, 2) + "\n");
console.log("\nobjects.json mis à jour.");
