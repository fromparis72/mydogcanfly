#!/usr/bin/env node
/**
 * Service ITA « Large Dog On Board » : l'exception ne doit jamais devenir une règle générale.
 * La fiche et le Finder peuvent la raconter ; le moteur doit conserver trois frontières :
 * jusqu'à 30 kg sur un trajet intérieur italien = à confirmer, au-dessus = refusé, et un chien
 * lourd sur un trajet international reste refusé au plafond standard de 8 kg.
 */
import { readFileSync } from "node:fs";
import { loadKB } from "./packages/knowledge/src/index.ts";
import { evaluate } from "./packages/engine/src/evaluate.ts";
import { FinderRequest } from "./packages/engine/src/contracts.ts";

let failures = 0;
const check = (label, ok, detail = "") => {
  console.log(`${ok ? "  OK  " : "  FAIL"} ${label}${ok || !detail ? "" : `\n       ${detail}`}`);
  if (!ok) failures++;
};

const generated = JSON.parse(readFileSync("packages/ui/src/data/airlines.generated.json", "utf8"));
const service = generated.airline_ita_airways?.specialServices?.find((s) => s.id === "special_ita_large_dog_on_board");
check("la fiche porte un service spécial sourcé, chien seulement, Italie → Italie, >10 à ≤30 kg",
  service?.species === "dog" && service?.placement === "cabin"
    && service?.route?.origin_iso === "IT" && service?.route?.destination_iso === "IT"
    && service?.weight?.min_kg === 10 && service?.weight?.min_bound === "gt"
    && service?.weight?.max_kg === 30 && service?.weight?.max_bound === "lte"
    && service?.source?.source_type === "official_website" && service?.source?.quote_language === "it",
  JSON.stringify(service));
check("le résumé est présent dans les quatre langues et dit la confirmation préalable",
  ["en", "fr", "es", "pt"].every((l) => typeof service?.summary?.[l] === "string" && service.summary[l].length > 50)
    && /confirmation préalable obligatoire/i.test(service?.summary?.fr ?? ""));

const kb = loadKB();
const decide = (origin, destination, weight) => evaluate(kb, FinderRequest.parse({
  origin, destination, dog: { breed_id: "breed_golden_retriever", weight_kg: weight },
  placement: "cabin", locale: "fr",
})).airlines.find((a) => a.airline_id === "airline_ita_airways");
const cabin = (a) => a?.placements.find((p) => p.placement === "cabin");

const domestic30 = decide("airport_fco", "airport_lin", 30);
check("FCO → LIN, 30 kg : jamais refusé ; la confirmation reste obligatoire",
  cabin(domestic30)?.status === "confirmation_required", JSON.stringify(cabin(domestic30)));
check("FCO → LIN, 30 kg : le plafond international de 8 kg ne se déclenche pas",
  !(domestic30?.fired ?? []).some((f) => f.rule_id === "rule_ita_airways_cabin_weight"));

const domesticOver = decide("airport_fco", "airport_lin", 30.1);
check("FCO → LIN, 30,1 kg : refusé par le plafond propre au service spécial",
  cabin(domesticOver)?.status === "denied"
    && (domesticOver?.fired ?? []).some((f) => f.rule_id === "rule_ita_airways_large_dog_domestic_max_weight" && f.decisive),
  JSON.stringify({ cabin: cabin(domesticOver), fired: domesticOver?.fired }));

const international = decide("airport_fco", "airport_cdg", 20);
check("FCO → CDG, 20 kg : refusé au plafond standard international de 8 kg",
  cabin(international)?.status === "denied"
    && (international?.fired ?? []).some((f) => f.rule_id === "rule_ita_airways_cabin_weight" && f.decisive),
  JSON.stringify({ cabin: cabin(international), fired: international?.fired }));

console.log(`\n=== ITA LARGE DOG — ${failures ? `${failures} échec(s)` : "TOUT EST VERT"} ===`);
process.exit(failures ? 1 : 0);
