#!/usr/bin/env node
/* Add KM Malta Airlines + Icelandair (objects + sourced pet rules). Idempotent.
   Sources verified from each airline's official pet page (July 2026):
   - KM Malta:   https://kmmaltairlines.com/en/travelling-with-pets
       PETC cabin ≤ 10 kg (incl. carrier); AVIH checked baggage ≤ 32 kg; cargo available.
   - Icelandair: https://www.icelandair.com/support/special-assistance/animal-transportation/
       No cabin pets (service dogs excepted); NO hold on international flights since 1 Nov 2024
       (domestic Iceland routes excepted); passenger service offers no pet cargo internationally.
   Brachycephalic hold/cargo risk is covered by the GLOBAL rule — not duplicated here. */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OBJ = resolve(HERE, "../raw/objects.json");
const RULES = resolve(HERE, "../raw/rules.json");
const TODAY = "2026-07-18";
const plus = (iso, d) => { const x = new Date(iso + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
const src = (url) => ({ url, source_type: "official_website", verified_date: TODAY, review_due: plus(TODAY, 90), confidence: 3, reviewer: "research", history: [{ date: TODAY, reviewer: "research", note: "Airline import — verified from the airline's official pet policy." }] });

const AIRLINES = [
  { id: "airline_km_malta", name: "KM Malta Airlines", iata: "KM", country: "country_mt", alliance: "none", web: "https://kmmaltairlines.com",
    hubs: ["airport_mla"], psrc: "https://kmmaltairlines.com/en/travelling-with-pets",
    serves: ["Malta", "Austria", "Belgium", "Czechia", "France", "Germany", "Italy", "Netherlands", "Spain", "Switzerland", "Turkey", "United Kingdom"] },
  { id: "airline_icelandair", name: "Icelandair", iata: "FI", country: "country_is", alliance: "none", web: "https://www.icelandair.com",
    hubs: ["airport_kef"], psrc: "https://www.icelandair.com/support/special-assistance/animal-transportation/",
    serves: ["Iceland", "United States", "Canada", "United Kingdom", "Ireland", "France", "Germany", "Denmark", "Norway", "Sweden", "Finland", "Netherlands", "Spain", "Switzerland", "Italy"] },
];

// Per-airline rules with tailored, sourced rationales (EN + FR).
const RULESET = {
  airline_km_malta: [
    { suffix: "cabin_weight", category: "cabin_weight", criticality: "high",
      applies_when: { all: [{ fact: "placement", op: "eq", value: "cabin" }, { fact: "dog.weight_kg", op: "gt", value: 10 }] },
      placement: ["cabin"], params: { max_weight_kg: 10 },
      en: "In-cabin carriage (PETC) is limited to 10 kg including the carrier; heavier dogs travel as accompanied checked baggage (AVIH, up to 32 kg) or as cargo.",
      fr: "Le transport en cabine (PETC) est limité à 10 kg, sac compris ; les chiens plus lourds voyagent en bagage accompagné (AVIH, jusqu'à 32 kg) ou en fret." },
    { suffix: "hold_weight", category: "hold_weight", criticality: "medium",
      applies_when: { all: [{ fact: "placement", op: "eq", value: "hold" }, { fact: "dog.weight_kg", op: "gt", value: 32 }] },
      placement: ["hold"], params: { max_weight_kg: 32 },
      en: "As accompanied checked baggage (AVIH) the dog plus crate must not exceed 32 kg; heavier dogs travel as cargo.",
      fr: "En bagage accompagné (AVIH), le chien et sa caisse ne doivent pas dépasser 32 kg ; au-delà, transport en fret." },
  ],
  airline_icelandair: [
    { suffix: "no_cabin", category: "placement", criticality: "high",
      applies_when: { any: [{ fact: "placement", op: "eq", value: "cabin" }] }, placement: ["cabin"], params: {},
      en: "Icelandair does not accept pets in the passenger cabin; only recognised service dogs travel in the cabin, free of charge.",
      fr: "Icelandair n'accepte pas les animaux en cabine ; seuls les chiens d'assistance reconnus voyagent en cabine, gratuitement." },
    { suffix: "no_hold", category: "placement", criticality: "high",
      applies_when: { any: [{ fact: "placement", op: "eq", value: "hold" }] }, placement: ["hold"], params: {},
      en: "Since 1 November 2024, following fleet changes, Icelandair no longer transports animals in the hold on international flights (domestic Iceland routes excepted).",
      fr: "Depuis le 1er novembre 2024, à la suite de changements de flotte, Icelandair ne transporte plus d'animaux en soute sur les vols internationaux (routes intérieures islandaises exceptées)." },
    { suffix: "no_cargo", category: "placement", criticality: "medium",
      applies_when: { any: [{ fact: "placement", op: "eq", value: "cargo" }] }, placement: ["cargo"], params: {},
      en: "Icelandair's passenger service offers no pet transport as cargo on international routes; only service dogs are carried, in the cabin.",
      fr: "Le service passagers d'Icelandair ne propose pas de transport d'animaux en fret sur les routes internationales ; seuls les chiens d'assistance sont acceptés, en cabine." },
  ],
};

const data = JSON.parse(readFileSync(OBJ, "utf8"));
const rules = JSON.parse(readFileSync(RULES, "utf8"));
const cIndex = {}; for (const c of data.countries) cIndex[(c.name.en || c.name).toLowerCase()] = c.id;

let addedA = 0, addedR = 0; const missServ = [];
for (const a of AIRLINES) {
  if (!data.airlines.some((x) => x.id === a.id)) {
    const serves = [...new Set(a.serves.map((n) => cIndex[n.toLowerCase()]).filter(Boolean))];
    a.serves.forEach((n) => { if (!cIndex[n.toLowerCase()]) missServ.push(a.iata + ":" + n); });
    data.airlines.push({
      id: a.id, iata: a.iata, name: a.name, country_id: a.country, alliance: a.alliance,
      website: a.web, serves_country_ids: serves, hub_airport_ids: a.hubs,
      source: { url: a.web, source_type: "official_website", verified_date: TODAY, review_due: plus(TODAY, 90), confidence: 3, reviewer: "research", history: [] },
    });
    addedA++;
  }
  for (const r of RULESET[a.id]) {
    const id = `rule_${a.id.replace(/^airline_/, "")}_${r.suffix}`;
    if (rules.some((x) => x.id === id)) continue;
    rules.push({
      id, scope: { type: "airline", id: a.id },
      category: r.category, criticality: r.criticality, applies_when: r.applies_when,
      effect: { action: "deny", placement: r.placement }, params: r.params,
      rationale: r.en, rationale_i18n: { fr: r.fr }, source: src(a.psrc),
    });
    addedR++;
  }
}

writeFileSync(OBJ, JSON.stringify(data, null, 2) + "\n");
writeFileSync(RULES, JSON.stringify(rules, null, 2) + "\n");
console.log(`Added: ${addedA} airlines, ${addedR} rules.`);
if (missServ.length) console.log("served countries not found (ignored):", missServ.join(", "));
