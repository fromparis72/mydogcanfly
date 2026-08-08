#!/usr/bin/env node
/* Les quatorze compagnies du relevé du 8 août 2026, ajoutées au graphe de connaissances.
 *
 * POURQUOI CE SCRIPT EXISTE. Une fiche `content/airlines/<slug>.yml` ne suffit pas à faire
 * exister une compagnie sur le site : la route `[...loc]/airlines/[slug].astro` construit ses
 * pages en parcourant `kb.airlines`, c'est-à-dire `raw/objects.json`. Une fiche sans objet est
 * une fiche que personne ne verra jamais. Ce script pose l'objet ; `ingest-airlines.mjs` se
 * charge ensuite d'en dériver la politique structurée depuis la fiche vérifiée.
 *
 * CE QU'IL N'ÉCRIT PAS. Aucune règle dans `rules.json`. La politique (cabine/soute/fret, poids,
 * interdiction brachycéphale en soute) est DÉJÀ dérivée des fiches par `ingest-airlines.mjs`,
 * qui lit les seuls champs vérifiés. Écrire ici une seconde source pour la même information,
 * c'est se garantir deux vérités divergentes à la première mise à jour.
 *
 * SUR `serves_country_ids`. C'est une liste éditoriale de pays desservis en propre, volontairement
 * CONSERVATRICE : mieux vaut une destination manquante qu'une destination fausse. Deux règles :
 *   — aucun partage de code. La leçon Aegean (ATH–EWR vendu en A3 mais opéré par Emirates) vaut
 *     ici : la politique animaux qui s'applique est celle du transporteur qui opère. Une ligne
 *     en partage de code dans ce graphe enverrait le lecteur vers la mauvaise fiche.
 *   — un pays desservi n'est PAS un pays où l'animal peut voyager. Air Astana dessert le
 *     Royaume-Uni mais n'y transporte les animaux qu'en fret ; Luxair dessert le R.-U. et n'y
 *     transporte aucun animal. Cette nuance vit dans la fiche, pas dans le réseau.
 *
 * LA RÉUNION ET LA NOUVELLE-CALÉDONIE ne sont pas des pays du référentiel — ce sont des
 * territoires français. Air Austral et Aircalin sont donc rattachées à `country_fr`, ce qui est
 * exact juridiquement (immatriculation française) même si c'est contre-intuitif géographiquement.
 *
 * Idempotent : relancer ne duplique rien.
 *   node packages/knowledge/scripts/add-lot2-airlines.mjs [--dry]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OBJ = resolve(HERE, "../raw/objects.json");
const TODAY = "2026-08-08";
const dry = process.argv.includes("--dry");
const plus = (iso, d) => { const x = new Date(iso + "T00:00:00Z"); x.setUTCDate(x.getUTCDate() + d); return x.toISOString().slice(0, 10); };

const AIRLINES = [
  { id: "airline_aerolineas_argentinas", name: "Aerolíneas Argentinas", iata: "AR", country: "country_ar", alliance: "skyteam",
    web: "https://www.aerolineas.com.ar", hubs: ["airport_eze", "airport_aep"],
    serves: ["Argentina","Brazil","Chile","Uruguay","Paraguay","Bolivia","Peru","Colombia","United States","Mexico","Dominican Republic","Spain","Italy"] },

  { id: "airline_royal_jordanian", name: "Royal Jordanian", iata: "RJ", country: "country_jo", alliance: "oneworld",
    web: "https://www.rj.com", hubs: ["airport_amm"],
    serves: ["Jordan","United Arab Emirates","Saudi Arabia","Kuwait","Qatar","Bahrain","Egypt","Lebanon","Iraq","Turkey","Greece","Cyprus","France","United Kingdom","Germany","Spain","Italy","Netherlands","Austria","Sweden","Denmark","United States","Canada","India","Thailand","Morocco","Tunisia"] },

  { id: "airline_luxair", name: "Luxair", iata: "LG", country: "country_lu", alliance: "none",
    web: "https://www.luxair.lu", hubs: ["airport_lux"],
    serves: ["Luxembourg","France","Germany","United Kingdom","Ireland","Spain","Portugal","Italy","Greece","Austria","Switzerland","Denmark","Sweden","Netherlands","Poland","Czechia","Hungary","Croatia","Malta","Turkey","Morocco","Tunisia","Egypt","Cyprus"] },

  { id: "airline_tarom", name: "TAROM", iata: "RO", country: "country_ro", alliance: "skyteam",
    web: "https://www.tarom.ro", hubs: ["airport_otp"],
    serves: ["Romania","France","Germany","Italy","Spain","United Kingdom","Belgium","Netherlands","Austria","Greece","Cyprus","Turkey","Israel","Egypt","Hungary","Czechia","Poland","Bulgaria","Serbia"] },

  { id: "airline_asiana", name: "Asiana Airlines", iata: "OZ", country: "country_kr", alliance: "star_alliance",
    web: "https://flyasiana.com", hubs: ["airport_icn"],
    serves: ["South Korea","Japan","China","Taiwan","Hong Kong","Vietnam","Thailand","Singapore","Malaysia","Philippines","Indonesia","Cambodia","India","United States","Canada","Australia","Germany","France","United Kingdom","Italy","Spain","Turkey","Kazakhstan","Uzbekistan"] },

  /* Hubs d'Almaty et d'Astana absents du référentiel aéroports : champ omis plutôt que faux. */
  { id: "airline_air_astana", name: "Air Astana", iata: "KC", country: "country_kz", alliance: "none",
    web: "https://airastana.com", hubs: [],
    serves: ["Kazakhstan","Turkey","United Arab Emirates","Germany","United Kingdom","Netherlands","Georgia","Azerbaijan","Uzbekistan","Kyrgyzstan","China","South Korea","Thailand","India","Malaysia","Maldives","Egypt","Sri Lanka"] },

  { id: "airline_la_compagnie", name: "La Compagnie", iata: "B0", country: "country_fr", alliance: "none",
    web: "https://www.lacompagnie.com", hubs: ["airport_ory"],
    serves: ["France","United States","Italy"] },

  /* Compagnie réunionnaise, immatriculée en France (La Réunion n'est pas un pays du référentiel). */
  { id: "airline_air_austral", name: "Air Austral", iata: "UU", country: "country_fr", alliance: "none",
    web: "https://www.air-austral.com", hubs: ["airport_run"],
    serves: ["France","Mauritius","Madagascar","South Africa","Seychelles","Comoros","Thailand","India"] },

  { id: "airline_bangkok_airways", name: "Bangkok Airways", iata: "PG", country: "country_th", alliance: "none",
    web: "https://www.bangkokair.com", hubs: ["airport_bkk"],
    serves: ["Thailand","Cambodia","Laos","Myanmar","Maldives","Singapore","Malaysia","Vietnam","Hong Kong","India"] },

  { id: "airline_south_african_airways", name: "South African Airways", iata: "SA", country: "country_za", alliance: "star_alliance",
    web: "https://www.flysaa.com", hubs: ["airport_jnb"],
    serves: ["South Africa","Zimbabwe","Zambia","Mozambique","Namibia","Mauritius","Kenya","Ghana","Nigeria","Brazil","Angola"] },

  { id: "airline_kenya_airways", name: "Kenya Airways", iata: "KQ", country: "country_ke", alliance: "skyteam",
    web: "https://www.kenya-airways.com", hubs: ["airport_nbo"],
    serves: ["Kenya","Tanzania","Uganda","Rwanda","Ethiopia","South Africa","Nigeria","Ghana","Senegal","Zimbabwe","Zambia","Mozambique","Mauritius","United Kingdom","France","Netherlands","United Arab Emirates","India","Thailand","China"] },

  { id: "airline_gulf_air", name: "Gulf Air", iata: "GF", country: "country_bh", alliance: "none",
    web: "https://www.gulfair.com", hubs: ["airport_bah"],
    serves: ["Bahrain","Saudi Arabia","United Arab Emirates","Kuwait","Qatar","Oman","Egypt","Jordan","Lebanon","Iraq","Turkey","United Kingdom","France","Germany","Greece","Spain","India","Pakistan","Bangladesh","Sri Lanka","Nepal","Philippines","Thailand","Malaysia","Singapore","Maldives"] },

  /* Compagnie calédonienne, immatriculée en France (la Nouvelle-Calédonie n'est pas un pays du référentiel). */
  { id: "airline_aircalin", name: "Aircalin", iata: "SB", country: "country_fr", alliance: "none",
    web: "https://us.aircalin.com", hubs: ["airport_nou"],
    serves: ["France","Australia","New Zealand","Japan","Fiji","Vanuatu","Singapore"] },

  { id: "airline_tui_airways", name: "TUI Airways", iata: "BY", country: "country_gb", alliance: "none",
    web: "https://www.tui.co.uk", hubs: ["airport_lgw"],
    serves: ["United Kingdom","Spain","Portugal","Greece","Italy","Turkey","Egypt","Tunisia","Morocco","Cyprus","Mexico","Dominican Republic","Jamaica","Cuba","Cape Verde","Thailand","Maldives","United States","Barbados","Costa Rica"] },
];

const data = JSON.parse(readFileSync(OBJ, "utf8"));
const cIndex = {}; for (const c of data.countries) cIndex[String(c.name?.en ?? c.name).toLowerCase()] = c.id;
const cIds = new Set(data.countries.map((c) => c.id));
const aIds = new Set(data.airports.map((a) => a.id));

let added = 0, skipped = 0;
const inconnus = [];

for (const a of AIRLINES) {
  if (!cIds.has(a.country)) { console.error(`✗ ${a.iata} : pays d'immatriculation inconnu (${a.country})`); process.exit(1); }
  if (data.airlines.some((x) => x.id === a.id)) { skipped++; continue; }

  const serves = [];
  for (const nom of a.serves) {
    const id = cIndex[nom.toLowerCase()];
    if (id) serves.push(id); else inconnus.push(`${a.iata} → ${nom}`);
  }
  const hubs = a.hubs.filter((h) => aIds.has(h));

  const obj = {
    id: a.id, iata: a.iata, name: a.name, country_id: a.country, alliance: a.alliance,
    website: a.web,
    serves_country_ids: [...new Set(serves)].sort(),
    source: {
      url: a.web, source_type: "official_website", verified_date: TODAY, review_due: plus(TODAY, 90),
      confidence: 3, reviewer: "MyDogCanFly Data Team",
      history: [{ date: TODAY, reviewer: "MyDogCanFly Data Team",
        note: "Relevé du 8 août 2026 : politique animaux lue sur le site officiel de la compagnie. Réseau saisi hors partage de code." }],
    },
  };
  if (hubs.length) obj.hub_airport_ids = hubs;

  data.airlines.push(obj);
  added++;
}

data.airlines.sort((x, y) => x.id.localeCompare(y.id));
if (!dry) writeFileSync(OBJ, JSON.stringify(data, null, 2) + "\n");

console.log(`${added} compagnie(s) ajoutée(s), ${skipped} déjà présente(s) — total ${data.airlines.length}${dry ? " (essai à blanc)" : ""}`);
if (inconnus.length) {
  console.log(`\n${inconnus.length} destination(s) sans pays correspondant, ignorée(s) :`);
  for (const u of inconnus) console.log("  · " + u);
}
