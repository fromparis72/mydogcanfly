#!/usr/bin/env node
/**
 * P0 — Une politique cabine sans plafond chiffré ne peut pas autoriser implicitement un grand
 * chien. Le seuil de 10 kg est une garde interne MyDogCanFly, jamais un chiffre attribué à la
 * compagnie. L'exception ITA reste strictement domestique et soumise à confirmation.
 */
import { readFileSync } from "node:fs";
import { loadKB } from "./packages/knowledge/src/index.ts";
import { evaluate, CABIN_CONSERVATIVE_MAX_WEIGHT_KG } from "./packages/engine/src/evaluate.ts";
import { FinderRequest } from "./packages/engine/src/contracts.ts";

let pass = 0;
let fail = 0;
const check = (label, condition, detail = "") => {
  console.log(`${condition ? "  OK  " : "  FAIL"} ${label}${condition || !detail ? "" : `\n       ${detail}`}`);
  condition ? pass++ : fail++;
};

const kb = loadKB();
const raw = JSON.parse(readFileSync("packages/knowledge/raw/objects.json", "utf8"));
const date = "2027-03-15";
const dog = (weight_kg, breed_id = "breed_cavalier_king_charles") => ({ breed_id, weight_kg });
const decide = (origin, destination, weight_kg, breed_id) => evaluate(kb, FinderRequest.parse({
  origin, destination, dog: dog(weight_kg, breed_id), date,
}));
const airline = (decision, id) => decision.airlines.find((a) => a.airline_id === id);
const placement = (decision, id, channel) => airline(decision, id)?.placements.find((p) => p.placement === channel);

check("la borne conservatrice du moteur est explicitement 10 kg", CABIN_CONSERVATIVE_MAX_WEIGHT_KG === 10);

console.log("\n=== Cas signalé : Canada → France ===");
for (const id of ["airline_air_canada", "airline_westjet"]) {
  const large = decide("airport_yul", "airport_cdg", 38, "breed_alaskan_malamute");
  const small = decide("airport_yul", "airport_cdg", 6);
  const largeCabin = placement(large, id, "cabin");
  const smallCabin = placement(small, id, "cabin");
  check(`${id}: 38 kg est refusé en cabine`, largeCabin?.status === "denied", JSON.stringify(largeCabin));
  check(`${id}: le refus interne n'invente aucun plafond compagnie`, largeCabin?.weight_limit_kg === undefined, JSON.stringify(largeCabin));
  check(`${id}: 6 kg reste sous conditions, sans plafond inventé`,
    smallCabin?.status === "accepted_with_conditions" && smallCabin?.weight_limit_kg === undefined,
    JSON.stringify(smallCabin));
}

{
  const large = decide("airport_yul", "airport_cdg", 38, "breed_alaskan_malamute");
  const small = decide("airport_yul", "airport_cdg", 6);
  check("Air Transat : 38 kg est refusé par son plafond officiel de 8 kg",
    placement(large, "airline_air_transat", "cabin")?.status === "denied");
  check("Air Transat : 6 kg reste sous conditions et transporte son plafond officiel de 8 kg",
    placement(small, "airline_air_transat", "cabin")?.status === "accepted_with_conditions"
      && placement(small, "airline_air_transat", "cabin")?.weight_limit_kg === 8);
}

console.log("\n=== Toutes les cabines offertes sans plafond structuré ===");
const sansPlafond = raw.airlines.filter((a) => a.id !== "airline_ita_airways"
  && a.premium?.policy?.cabin?.availability === "offered"
  && !(typeof a.premium.policy.cabin.max_weight_kg === "number"
    && typeof a.premium.policy.cabin.weight_includes_carrier === "boolean"));

for (const a of sansPlafond) {
  const route = a.direct_routes?.[0];
  if (!route) {
    check(`${a.id}: possède une route directe témoin`, false, "aucune route directe dans la donnée");
    continue;
  }
  const [origin, destination] = route.split("|");
  const decision = decide(origin, destination, 10.1);
  const cabin = placement(decision, a.id, "cabin");
  check(`${a.id}: 10,1 kg ne produit jamais de réponse cabine positive`,
    cabin?.status === "denied" && cabin.weight_limit_kg === undefined,
    JSON.stringify({ route, cabin }));
}

console.log("\n=== Exception ITA bornée ===");
{
  const domestic = decide("airport_fco", "airport_lin", 20, "breed_golden_retriever");
  const international = decide("airport_fco", "airport_cdg", 20, "breed_golden_retriever");
  const itaDomestic = placement(domestic, "airline_ita_airways", "cabin");
  const itaInternational = placement(international, "airline_ita_airways", "cabin");
  check("ITA 20 kg domestique : confirmation obligatoire du service Large Dog",
    itaDomestic?.status === "confirmation_required"
      && itaDomestic.confirmation_causes?.some((c) => c.rule_id === "rule_ita_airways_large_dog_domestic_confirmation"),
    JSON.stringify(itaDomestic));
  check("ITA 20 kg international : refus", itaInternational?.status === "denied", JSON.stringify(itaInternational));
}

console.log(`\n=== SUMMARY ===\n${fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`}`);
process.exit(fail ? 1 : 0);
