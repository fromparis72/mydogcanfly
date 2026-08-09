#!/usr/bin/env node
/* BUG SYSTÉMIQUE découvert le 08/08/2026 en creusant le trou Lisbonne→Cap-Vert (TAP) :
 * `served_airport_ids` (le champ qui décide si une compagnie est CANDIDATE sur un trajet dans
 * evaluate.ts) et `direct_routes`/`seasonal_routes` (le graphe réel des routes, sourcé) sont
 * désynchronisés sur 86 compagnies / 102. 1023 aéroports apparaissent dans des routes documentées
 * sans figurer dans served_airport_ids. 17 compagnies ont même un served_airport_ids VIDE alors
 * qu'elles ont de vraies routes sourcées.
 *
 * Conséquence concrète : le Finder ignore silencieusement des routes réelles et sourcées.
 *   - Compagnie à served_airport_ids non-vide mais incomplet → filtre strict origine+destination
 *     dans evaluate.ts, la route documentée ne passe jamais.
 *   - Compagnie à served_airport_ids VIDE → fallback grossier sur serves_country_ids, qui ignore
 *     l'aéroport d'origine (moins pire, mais toujours faux : la finesse de la donnée est perdue).
 *
 * CAUSE PROBABLE : served_airport_ids a été peuplé par un processus antérieur/différent de
 * merge-routes.mjs (fusion collecte-2026-07 du 08/08/2026), qui n'a jamais mis à jour que
 * direct_routes/seasonal_routes, jamais served_airport_ids.
 *
 * CORRECTIF — additif uniquement, rien retiré, rien inventé :
 *   served_airport_ids := union(served_airport_ids existant, tous les aéroports apparaissant
 *   dans direct_routes ∪ seasonal_routes de cette compagnie)
 * On ne touche ni direct_routes, ni seasonal_routes, ni serves_country_ids : seule la liste des
 * aéroports desservis est resynchronisée sur des routes déjà présentes et déjà sourcées ailleurs
 * dans le référentiel.
 *
 * Idempotent :
 *   node packages/knowledge/scripts/sync-served-airports.mjs [--dry]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OBJ = resolve(HERE, "../raw/objects.json");
const dry = process.argv.includes("--dry");

const data = JSON.parse(readFileSync(OBJ, "utf8"));
const knownAirports = new Set(data.airports.map((a) => a.id));

let airlinesChanged = 0;
let entriesAdded = 0;
const perAirline = [];

for (const a of data.airlines) {
  const before = new Set(a.served_airport_ids ?? []);
  const routeAirports = new Set();
  for (const key of [...(a.direct_routes ?? []), ...(a.seasonal_routes ?? [])]) {
    for (const apId of key.split("|")) {
      if (knownAirports.has(apId)) routeAirports.add(apId);
    }
  }
  const merged = new Set([...before, ...routeAirports]);
  const added = merged.size - before.size;
  if (added > 0) {
    a.served_airport_ids = [...merged].sort();
    airlinesChanged++;
    entriesAdded += added;
    perAirline.push(`  - ${a.id} : +${added} (${before.size} → ${merged.size})`);
  }
}

if (!dry) writeFileSync(OBJ, JSON.stringify(data, null, 2) + "\n");

console.log(
  `${airlinesChanged} compagnie(s) resynchronisée(s), ${entriesAdded} entrée(s) served_airport_ids ajoutée(s)` +
  `${dry ? "  (essai à blanc)" : ""}`,
);
console.log(perAirline.join("\n"));
