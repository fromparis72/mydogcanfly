#!/usr/bin/env node
/**
 * Preuve d'exécution : chaque plafond ET plancher de poids publié doit produire une transition
 * réelle dans le Worker, sur un trajet direct documenté de la compagnie. On ne se contente pas
 * de retrouver le nombre dans `objects.json` : un plafond dépassé refuse le canal ; sous un
 * plancher, la phrase ne couvre plus le scénario et impose une confirmation explicite.
 */
import { readFileSync } from "node:fs";
import worker from "./packages/workers/src/index.ts";

const objects = JSON.parse(readFileSync(new URL("./packages/knowledge/raw/objects.json", import.meta.url), "utf8"));
const placements = ["cabin", "hold", "cargo"];
const cache = new Map();
let requestSequence = 0;
let pass = 0;
let fail = 0;

const query = async (origin, destination, weight) => {
  const key = `${origin}|${destination}|${weight}`;
  if (cache.has(key)) return cache.get(key);
  const params = new URLSearchParams({ origin, destination, weight_kg: String(weight), placement: "any", locale: "en" });
  /* Le Worker limite volontairement chaque client à 60 requêtes/minute. Cette matrice en joue
     davantage : une IP de test déterministe par requête mesure le moteur sans désarmer ni
     modifier la protection de production. */
  const sequence = requestSequence++;
  const response = await worker.fetch(new Request(`https://x/v1/finder?${params}`, {
    headers: { "cf-connecting-ip": `10.77.${Math.floor(sequence / 250)}.${(sequence % 250) + 1}` },
  }), {});
  const body = await response.json();
  const result = { status: response.status, body };
  cache.set(key, result);
  return result;
};

const statusOf = (airline, placement) =>
  airline?.placement_decisions?.find((decision) => decision.placement === placement)?.status;

const decisionOf = (airline, placement) =>
  airline?.placement_decisions?.find((decision) => decision.placement === placement);

console.log("=== Finder : tous les plafonds de poids sont exécutables ===");
for (const airline of objects.airlines ?? []) {
  for (const placement of placements) {
    const policy = airline.premium?.policy?.[placement];
    if (typeof policy?.max_weight_kg !== "number") continue;

    const max = policy.max_weight_kg;
    const strict = policy.weight_limit_bound === "lt";
    const below = strict ? Math.max(0.1, max - 0.1) : max;
    const above = strict ? max : max + 0.1;
    let witness;
    let lastDetail = "aucun trajet essayé";

    for (const edge of (airline.direct_routes ?? []).slice(0, 12)) {
      const [origin, destination] = edge.split("|");
      const [low, high] = await Promise.all([query(origin, destination, below), query(origin, destination, above)]);
      const lowAirline = low.body?.airlines?.find((candidate) => candidate.airline_id === airline.id);
      const highAirline = high.body?.airlines?.find((candidate) => candidate.airline_id === airline.id);
      const lowStatus = statusOf(lowAirline, placement);
      const highStatus = statusOf(highAirline, placement);
      lastDetail = `${edge}: ${below} kg=${lowStatus ?? `HTTP ${low.status}`}, ${above} kg=${highStatus ?? `HTTP ${high.status}`}`;
      if (lowStatus && lowStatus !== "denied" && highStatus === "denied") {
        witness = lastDetail;
        break;
      }
    }

    if (witness) {
      pass++;
      console.log(`  OK   ${airline.id}.${placement} ≤ ${max} kg — ${witness}`);
    } else {
      fail++;
      console.log(`  FAIL ${airline.id}.${placement} ≤ ${max} kg — ${lastDetail}`);
    }
  }
}

console.log(`\n${pass} plafonds exécutés, ${fail} raccordement(s) en échec`);

console.log("\n=== Finder : tous les planchers de poids bornent la portée de la source ===");
let minPass = 0;
let minFail = 0;
for (const airline of objects.airlines ?? []) {
  for (const placement of placements) {
    const policy = airline.premium?.policy?.[placement];
    if (typeof policy?.min_weight_kg !== "number") continue;

    const min = policy.min_weight_kg;
    const strict = policy.weight_min_bound === "gt";
    const below = strict ? min : Math.max(0.1, min - 0.1);
    const above = strict ? min + 0.1 : min;
    let witness;
    let lastDetail = "aucun trajet essayé";

    for (const edge of (airline.direct_routes ?? []).slice(0, 12)) {
      const [origin, destination] = edge.split("|");
      const [low, high] = await Promise.all([query(origin, destination, below), query(origin, destination, above)]);
      const lowAirline = low.body?.airlines?.find((candidate) => candidate.airline_id === airline.id);
      const highAirline = high.body?.airlines?.find((candidate) => candidate.airline_id === airline.id);
      const lowDecision = decisionOf(lowAirline, placement);
      const highStatus = statusOf(highAirline, placement);
      const hasScopeCause = lowDecision?.status === "confirmation_required"
        && lowDecision.confirmation_causes?.some((cause) =>
          cause.code === "weight_scope_unmet" && cause.policy_ref === `${airline.id}#${placement}`);
      lastDetail = `${edge}: ${below} kg=${lowDecision?.status ?? `HTTP ${low.status}`}, ${above} kg=${highStatus ?? `HTTP ${high.status}`}`;
      if (hasScopeCause && (highStatus === "allowed" || highStatus === "accepted_with_conditions")) {
        witness = lastDetail;
        break;
      }
    }

    if (witness) {
      minPass++;
      console.log(`  OK   ${airline.id}.${placement} ${strict ? ">" : "≥"} ${min} kg — ${witness}`);
    } else {
      minFail++;
      console.log(`  FAIL ${airline.id}.${placement} ${strict ? ">" : "≥"} ${min} kg — ${lastDetail}`);
    }
  }
}

pass += minPass;
fail += minFail;
console.log(`\n${minPass} planchers exécutés, ${minFail} raccordement(s) en échec`);
if (fail) process.exit(1);
