#!/usr/bin/env node
/* Trou de couverture repéré EN DIRECT par l'utilisateur (08/08/2026) : une recherche Lisbonne →
 * Sal (Cap-Vert) ne retournait AUCUNE compagnie, alors que TAP Air Portugal — déjà dans le
 * référentiel — dessert réellement le Cap-Vert depuis Lisbonne. Les trois compagnies déjà
 * rattachées au Cap-Vert (TUI depuis Londres, Neos depuis l'Italie, Edelweiss via Zurich) ne
 * couvrent aucun itinéraire plausible au départ du Portugal ; Edelweiss est d'ailleurs écartée par
 * le filtre anti-détour absurde (Zurich n'est pas sur la route Lisbonne→Cap-Vert). Résultat : le
 * Finder affichait "Not as requested" et 0/20 sans une seule carte compagnie, pour une destination
 * pourtant réellement joignable.
 *
 * SOURCES (08/08/2026) — TAP dessert deux aéroports capverdiens depuis Lisbonne :
 *   — Lisbonne → Sal (SID) : nonstop confirmé sur flytap.com/en_us/flights-from-lisbon-to-sal
 *     (route LIS→SID listée) et sur flightconnections.com/flights-from-lis-to-sid (TAP citée
 *     parmi les 3 compagnies opérant le vol direct, 4h10, ~8 fréquences/semaine).
 *   — Lisbonne → Praia (RAI) : Praia listée explicitement sur la propre page « non-stop flights »
 *     de TAP (flytap.com/en_us/non-stop-flights) et confirmée nonstop sur flightconnections.com/
 *     flights-from-lis-to-rai (TAP citée, 4h25, ~17 fréquences/semaine).
 *
 * CE QU'IL N'AJOUTE PAS. La nouvelle route Porto (OPO) → Praia, annoncée par la presse
 * aéronautique début juillet 2026, n'est pas ajoutée ici : la seule source trouvée était
 * inaccessible (robots.txt), et aucune autre n'a pu la corroborer dans cette passe — à ajouter
 * plus tard avec une vraie source, pas maintenant sur la foi d'un titre d'article.
 *
 * Idempotent :
 *   node packages/knowledge/scripts/add-tap-cape-verde-routes.mjs [--dry]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OBJ = resolve(HERE, "../raw/objects.json");
const dry = process.argv.includes("--dry");

const TAP_ID = "airline_tap";
const NEW_SERVED = ["airport_sid", "airport_rai"];
const NEW_ROUTES = [["airport_lis", "airport_sid"], ["airport_lis", "airport_rai"]];

const data = JSON.parse(readFileSync(OBJ, "utf8"));
const known = new Set(data.airports.map((a) => a.id));
for (const id of NEW_SERVED) {
  if (!known.has(id)) { console.error(`✗ ${id} absent du référentiel : rien à faire.`); process.exit(1); }
}

const tap = data.airlines.find((a) => a.id === TAP_ID);
if (!tap) { console.error(`✗ ${TAP_ID} introuvable.`); process.exit(1); }

const beforeServed = new Set(tap.served_airport_ids ?? []);
tap.served_airport_ids = [...new Set([...beforeServed, ...NEW_SERVED])].sort();
const addedServed = tap.served_airport_ids.length - beforeServed.size;

const beforeRoutes = new Set(tap.direct_routes ?? []);
const routeKeys = NEW_ROUTES.map(([a, b]) => [a, b].sort().join("|"));
tap.direct_routes = [...new Set([...beforeRoutes, ...routeKeys])].sort();
const addedRoutes = tap.direct_routes.length - beforeRoutes.size;

let addedCountry = 0;
if (!(tap.serves_country_ids ?? []).includes("country_cv")) {
  tap.serves_country_ids = [...(tap.serves_country_ids ?? []), "country_cv"].sort();
  addedCountry = 1;
}

if (!dry) writeFileSync(OBJ, JSON.stringify(data, null, 2) + "\n");

console.log(
  `TAP : ${addedServed} aéroport(s) desservi(s) ajouté(s), ${addedRoutes} route(s) directe(s) ajoutée(s), ` +
  `country_cv ${addedCountry ? "ajouté à" : "déjà dans"} serves_country_ids${dry ? "  (essai à blanc)" : ""}`,
);
