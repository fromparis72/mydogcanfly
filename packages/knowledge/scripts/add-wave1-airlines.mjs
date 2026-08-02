#!/usr/bin/env node
/* Add "wave 1" missing major airlines (objects + sourced pet rules). Idempotent.
   Brachycephalic hold/cargo restriction is already covered by the GLOBAL rule — not duplicated per airline. */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OBJ = resolve(HERE, "../raw/objects.json");
const RULES = resolve(HERE, "../raw/rules.json");
const TODAY = "2026-07-10";
const plus = (iso, d) => { const x = new Date(iso + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };
const src = (url) => ({ url, source_type: "official_website", verified_date: TODAY, review_due: plus(TODAY, 90), confidence: 3, reviewer: "research", history: [{ date: TODAY, reviewer: "research", note: "Wave-1 airline import — verified from the airline's official pet policy." }] });

// id, name, iata, country, alliance, website, hubs, serves (country names), policy {cabin, cabinKg, hold, holdKg, cargo}, policySrc
const AIRLINES = [
  { id: "airline_el_al", name: "EL AL Israel Airlines", iata: "LY", country: "country_il", alliance: "none", web: "https://www.elal.com",
    hubs: ["airport_tlv"], policy: { cabin: true, cabinKg: 9, hold: true, holdKg: 100, cargo: true },
    psrc: "https://www.elal.com/en/PassengersInfo/Baggage/Pages/Pets.aspx",
    serves: ["Israel","United States","Canada","United Kingdom","France","Germany","Italy","Spain","Netherlands","Belgium","Switzerland","Austria","Greece","Poland","Hungary","Czechia","India","Thailand","Japan","South Africa","United Arab Emirates"] },
  { id: "airline_air_china", name: "Air China", iata: "CA", country: "country_cn", alliance: "star_alliance", web: "https://www.airchina.com",
    hubs: ["airport_pek","airport_pkx"], policy: { cabin: false, hold: true, holdKg: 32, cargo: true },
    psrc: "https://www.airchina.us/US/GB/info/assistance/pets.html",
    serves: ["China","United States","Canada","United Kingdom","France","Germany","Italy","Spain","Switzerland","Austria","Greece","Hungary","Denmark","Sweden","Japan","South Korea","Singapore","Malaysia","Thailand","Vietnam","Indonesia","Philippines","India","Australia","New Zealand","United Arab Emirates"] },
  { id: "airline_china_southern", name: "China Southern Airlines", iata: "CZ", country: "country_cn", alliance: "none", web: "https://www.csair.com",
    hubs: ["airport_can"], policy: { cabin: false, hold: true, holdKg: 32, cargo: true },
    psrc: "https://www.csair.com/en/tourguide/faq/baggage/dongwu.shtml",
    serves: ["China","United States","Canada","United Kingdom","France","Germany","Netherlands","Italy","Russia","Japan","South Korea","Thailand","Vietnam","Singapore","Malaysia","Indonesia","Philippines","Cambodia","India","Australia","New Zealand","United Arab Emirates","Turkey","Kenya","Pakistan"] },
  { id: "airline_china_eastern", name: "China Eastern Airlines", iata: "MU", country: "country_cn", alliance: "skyteam", web: "https://www.ceair.com",
    hubs: ["airport_pvg"], policy: { cabin: false, hold: true, holdKg: 32, cargo: true },
    psrc: "https://www.ceair.com/global/en_static/Announcement/TravelTips/SpecialPassengerServiceNotice/LittleAnimal/",
    serves: ["China","Japan","South Korea","Thailand","Singapore","Vietnam","Malaysia","Indonesia","Philippines","Cambodia","India","Australia","New Zealand","United States","Canada","United Kingdom","France","Netherlands","Italy","Germany","Spain","Russia","United Arab Emirates"] },
  { id: "airline_indigo", name: "IndiGo", iata: "6E", country: "country_in", alliance: "none", web: "https://www.goindigo.in",
    hubs: ["airport_del"], policy: { cabin: false, hold: false, cargo: false },
    psrc: "https://www.goindigo.in/information/conditions-of-carriage.html",
    serves: ["India","United Arab Emirates","Qatar","Oman","Bahrain","Kuwait","Saudi Arabia","Thailand","Singapore","Malaysia","Indonesia","Vietnam","Nepal","Sri Lanka","Bangladesh","Maldives","Turkey","United Kingdom","Kenya","Kazakhstan"] },
  { id: "airline_air_new_zealand", name: "Air New Zealand", iata: "NZ", country: "country_nz", alliance: "star_alliance", web: "https://www.airnewzealand.com",
    hubs: ["airport_akl"], policy: { cabin: false, hold: true, holdKg: 60, cargo: true },
    psrc: "https://www.airnewzealand.com/pets-in-the-cabin",
    serves: ["New Zealand","Australia","United States","Canada","Fiji","Singapore","Japan","China","South Korea","Taiwan","Indonesia"] },
  { id: "airline_aer_lingus", name: "Aer Lingus", iata: "EI", country: "country_ie", alliance: "none", web: "https://www.aerlingus.com",
    hubs: ["airport_dub"], policy: { cabin: false, hold: false, cargo: true },
    psrc: "https://www.aerlingus.com/support/baggage/special-and-sports-items/",
    serves: ["Ireland","United Kingdom","United States","Canada","France","Germany","Spain","Italy","Portugal","Netherlands","Belgium","Austria","Switzerland","Greece","Czechia","Hungary","Poland","Croatia","Malta","Morocco"] },
  { id: "airline_malaysia_airlines", name: "Malaysia Airlines", iata: "MH", country: "country_my", alliance: "oneworld", web: "https://www.malaysiaairlines.com",
    hubs: ["airport_kul"], policy: { cabin: false, hold: true, holdKg: null, cargo: true },
    psrc: "https://www.malaysiaairlines.com/my/en/plan/baggage/carriage-of-animals.html",
    serves: ["Malaysia","Singapore","Thailand","Indonesia","Brunei","Philippines","Vietnam","Cambodia","Myanmar","China","Taiwan","Japan","South Korea","India","Sri Lanka","Nepal","Bangladesh","Saudi Arabia","Qatar","United Arab Emirates","Australia","New Zealand","United Kingdom","France","Turkey"] },
  { id: "airline_garuda_indonesia", name: "Garuda Indonesia", iata: "GA", country: "country_id", alliance: "skyteam", web: "https://www.garuda-indonesia.com",
    hubs: ["airport_cgk"], policy: { cabin: false, hold: true, holdKg: 32, cargo: true },
    psrc: "https://cargo.garuda-indonesia.com/product/pet-and-animals",
    serves: ["Indonesia","Singapore","Malaysia","Thailand","China","Japan","South Korea","Taiwan","India","Saudi Arabia","Australia","Netherlands","United Kingdom"] },
];

const L = (en, fr) => ({ en, fr });
const data = JSON.parse(readFileSync(OBJ, "utf8"));
const rules = JSON.parse(readFileSync(RULES, "utf8"));
const cIndex = {}; for (const c of data.countries) cIndex[(c.name.en || c.name).toLowerCase()] = c.id;

const rule = (aid, suffix, category, criticality, applies_when, placement, params, rationale, i18n, url) => ({
  id: `rule_${aid.replace(/^airline_/, "")}_${suffix}`, scope: { type: "airline", id: aid },
  category, criticality, applies_when, effect: { action: "deny", placement }, params: params || {},
  rationale, rationale_i18n: { fr: i18n }, source: src(url),
});
const denyPlacement = (p) => ({ any: [{ fact: "placement", op: "eq", value: p }] });
const weightWhen = (p, kg) => ({ all: [{ fact: "placement", op: "eq", value: p }, { fact: "dog.weight_kg", op: "gt", value: kg }] });

let addedA = 0, addedR = 0, missServ = [];
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
  const p = a.policy, R = [];
  if (!p.cabin) R.push(rule(a.id, "no_cabin", "placement", "high", denyPlacement("cabin"), ["cabin"], {},
    "Dogs are not accepted in the passenger cabin (recognised assistance dogs excepted); pets travel in the hold or as cargo.",
    "Les chiens ne sont pas acceptés en cabine (chiens d'assistance exceptés) ; les animaux voyagent en soute ou en fret.", a.psrc));
  else if (p.cabinKg != null) R.push(rule(a.id, "cabin_weight", "cabin_weight", "high", weightWhen("cabin", p.cabinKg), ["cabin"], { max_weight_kg: p.cabinKg },
    `In-cabin carriage is limited to about ${p.cabinKg} kg including the carrier; heavier dogs are not accepted in the cabin.`,
    `Le transport en cabine est limité à environ ${p.cabinKg} kg, sac compris ; les chiens plus lourds ne sont pas acceptés en cabine.`, a.psrc));
  if (!p.hold) R.push(rule(a.id, "no_hold", "placement", "medium", denyPlacement("hold"), ["hold"], {},
    "Dogs are not accepted as accompanied checked baggage in the hold; they travel as manifest cargo.",
    "Les chiens ne sont pas acceptés en bagage accompagné en soute ; ils voyagent en fret.", a.psrc));
  else if (p.holdKg != null) R.push(rule(a.id, "hold_weight", "hold_weight", "medium", weightWhen("hold", p.holdKg), ["hold"], { max_weight_kg: p.holdKg },
    `As accompanied baggage the combined dog + crate must not exceed about ${p.holdKg} kg; heavier dogs travel via cargo.`,
    `En bagage accompagné, l'ensemble chien + caisse ne doit pas dépasser environ ${p.holdKg} kg ; au-delà, transport en fret.`, a.psrc));
  if (!p.cargo) R.push(rule(a.id, "no_cargo", "placement", "medium", denyPlacement("cargo"), ["cargo"], {},
    "Dogs are not carried as cargo on this airline.",
    "Les chiens ne sont pas transportés en fret par cette compagnie.", a.psrc));
  for (const r of R) if (!rules.some((x) => x.id === r.id)) { rules.push(r); addedR++; }
}

writeFileSync(OBJ, JSON.stringify(data, null, 2) + "\n");
writeFileSync(RULES, JSON.stringify(rules, null, 2) + "\n");
console.log(`Ajouté : ${addedA} compagnies, ${addedR} règles.`);
if (missServ.length) console.log("pays desservis non trouvés (ignorés):", missServ.join(", "));
