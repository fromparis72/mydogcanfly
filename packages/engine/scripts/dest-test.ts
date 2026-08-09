import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { normalize } from "@mydogcanfly/knowledge";
import { DestinationsRequest, rankDestinations } from "../src/index";

const kroot = join(dirname(fileURLToPath(import.meta.url)), "../../knowledge");
const raw = {
  ...JSON.parse(readFileSync(join(kroot, "raw/objects.json"), "utf8")),
  rules: JSON.parse(readFileSync(join(kroot, "raw/rules.json"), "utf8")),
};
const kb = normalize(raw);

const req = DestinationsRequest.parse({
  origin: "airport_cdg",
  dog: { breed_id: "breed_golden_retriever", weight_kg: 30, brachycephalic: false },
  placement: "any",
  date: "2026-08-15", // northern-hemisphere peak summer
  locale: "fr",
});

const { matches } = rankDestinations(kb, req);
console.log("total reachable cities (direct):", matches.length);
console.log("France present (should be FALSE — origin country):", matches.some((m) => m.iso2 === "FR"));
console.log("all direct with >=1 airline:", matches.every((m) => m.airlines_total >= 1));

const show = (m: typeof matches[0]) => `${m.city} (${m.iata}, ${m.country_name}) ${m.temperature_c}°C ≈${m.flight_hours}h`;
const hot = matches.filter((m) => m.heat_embargo).map(show);
const cool = matches.filter((m) => !m.heat_embargo && !m.heat_risk).map(show);
console.log("\nHOT (embargo) sample:", hot.slice(0, 8));
console.log("\nCOOL sample:", cool.slice(0, 8));
// Same-country cities to check intra-country climate differentiation by latitude.
for (const iso of ["US", "BR", "ES", "ZA"]) {
  const c = matches.filter((m) => m.iso2 === iso).map(show);
  if (c.length) console.log(`\n${iso} cities:`, c);
}
