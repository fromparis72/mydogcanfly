#!/usr/bin/env node
/**
 * Preuve d'exécution des 306 politiques cabine/soute/fret. Chaque décision de la fiche doit
 * atteindre le Worker sur un trajet direct réel : refus partout pour `not_offered`, témoin
 * ouvert pour `offered`, témoin à confirmer pour `case_by_case`/`legacy_unreviewed`.
 *
 * Une compagnie peut ne publier que des routes sur lesquelles une règle géographique plus
 * précise ferme le canal (Icelandair soute : réseau direct connu international uniquement).
 * Cette exception n'est admise que si toutes les routes testées sont refusées ET qu'une règle
 * de la compagnie, citée et explicitement scopée par `route.*`, porte ce refus.
 */
import { readFileSync } from "node:fs";
import worker from "./packages/workers/src/index.ts";

const objects = JSON.parse(readFileSync(new URL("./packages/knowledge/raw/objects.json", import.meta.url), "utf8"));
const rules = JSON.parse(readFileSync(new URL("./packages/knowledge/raw/rules.json", import.meta.url), "utf8"));
const placements = ["cabin", "hold", "cargo"];
const cache = new Map();
let requestSequence = 0;
let pass = 0;
let fail = 0;

const predicateFacts = (predicate) => {
  if (!predicate || typeof predicate !== "object") return [];
  if (typeof predicate.fact === "string") return [predicate.fact];
  return [...(predicate.all ?? []), ...(predicate.any ?? [])].flatMap(predicateFacts)
    .concat(predicate.not ? predicateFacts(predicate.not) : []);
};
const completeSource = (source) => Boolean(source?.url && source?.quote && source?.quote_language && source?.locator);
const routeOverrideExists = (airlineId, placement) => rules.some((rule) =>
  rule.scope?.type === "airline" && rule.scope.id === airlineId &&
  rule.effect?.action === "deny" && rule.effect?.placement?.includes(placement) &&
  predicateFacts(rule.applies_when).some((fact) => fact.startsWith("route.")) &&
  completeSource(rule.source));

const safeWeight = (policy) => {
  let weight = 1;
  if (typeof policy.max_weight_kg === "number") {
    weight = policy.weight_limit_bound === "lt"
      ? Math.max(0.1, policy.max_weight_kg - 0.1)
      : policy.max_weight_kg;
  }
  if (typeof policy.min_weight_kg === "number") {
    weight = Math.max(weight, policy.min_weight_kg + (policy.weight_min_bound === "gte" ? 0 : 0.1));
  }
  return weight;
};
const expectedStatus = (policy) => policy.availability === "not_offered"
  ? "denied"
  : policy.availability === "offered"
    ? "accepted_with_conditions"
    : "confirmation_required";

const query = async (origin, destination, weight) => {
  const key = `${origin}|${destination}|${weight}`;
  if (cache.has(key)) return cache.get(key);
  const params = new URLSearchParams({ origin, destination, weight_kg: String(weight), placement: "any", locale: "en" });
  const sequence = requestSequence++;
  const response = await worker.fetch(new Request(`https://x/v1/finder?${params}`, {
    headers: { "cf-connecting-ip": `10.78.${Math.floor(sequence / 250)}.${(sequence % 250) + 1}` },
  }), {});
  const body = await response.json();
  const result = { status: response.status, body };
  cache.set(key, result);
  return result;
};
const statusOf = (airline, placement) =>
  airline?.placement_decisions?.find((decision) => decision.placement === placement)?.status;

console.log("=== Finder : les 306 décisions de canal atteignent le Worker ===");
for (const airline of objects.airlines ?? []) {
  for (const placement of placements) {
    const policy = airline.premium?.policy?.[placement];
    const wanted = expectedStatus(policy ?? {});
    const weight = safeWeight(policy ?? {});
    const statuses = [];

    for (const edge of (airline.direct_routes ?? []).slice(0, 25)) {
      const [origin, destination] = edge.split("|");
      const response = await query(origin, destination, weight);
      const candidate = response.body?.airlines?.find((item) => item.airline_id === airline.id);
      const status = statusOf(candidate, placement);
      if (status) statuses.push({ edge, status });
    }

    const hasWitness = statuses.some(({ status }) => status === wanted);
    const deniedByScopedRoute = !hasWitness && statuses.length > 0 &&
      statuses.every(({ status }) => status === "denied") && routeOverrideExists(airline.id, placement);
    const valid = policy !== undefined && statuses.length > 0 &&
      (policy.availability === "not_offered"
        ? statuses.every(({ status }) => status === "denied")
        : hasWitness || deniedByScopedRoute);

    if (valid) {
      pass++;
      if (deniedByScopedRoute) {
        console.log(`  OK   ${airline.id}.${placement} — ${wanted} remplacé par un refus de trajet cité sur ${statuses.length} routes`);
      }
    } else {
      fail++;
      const sample = statuses.slice(0, 4).map(({ edge, status }) => `${edge}:${status}`).join(", ") || "aucune route/réponse";
      console.log(`  FAIL ${airline.id}.${placement} — attendu ${wanted}; ${sample}`);
    }
  }
}

console.log(`\n${pass} décisions exécutées, ${fail} raccordement(s) en échec`);
if (fail) process.exit(1);
