#!/usr/bin/env node
/* Les dix compagnies orphelines de la collecte élargie (routes_FULL_strict.json), ajoutées au
 * graphe de connaissances le 8 août 2026 — même mécanique que add-lot2-airlines.mjs.
 *
 * POURQUOI CE SCRIPT EXISTE. Une fiche `content/airlines/<slug>.yml` ne suffit pas à faire
 * exister une compagnie sur le site : la route `[...loc]/airlines/[slug].astro` construit ses
 * pages en parcourant `kb.airlines`, c'est-à-dire `raw/objects.json`. Ce script pose l'objet ;
 * `ingest-airlines.mjs` en dérive ensuite la politique structurée depuis la fiche vérifiée.
 *
 * CE QU'IL N'ÉCRIT PAS. Aucune règle dans `rules.json`, aucune route. La politique vient des
 * fiches (ingest-airlines.mjs) ; les routes viennent de merge-routes.mjs sur le même baseline.
 *
 * SUR `serves_country_ids`. Contrairement au lot 2 (liste éditoriale saisie à la main), cette
 * liste est DÉRIVÉE des arêtes de la collecte déjà retenues comme utilisables pour cette
 * compagnie (mêmes 326 arêtes que merge-routes.mjs ajoutera) — c'est strictement le réseau
 * mesuré, jamais une estimation. Deux compagnies (Batik Air Indonésie, Batik Air Malaisie)
 * n'acceptent aucun animal : elles restent dans le graphe (on veut que "vol direct" existe
 * pour la correspondance), la fiche dit clairement qu'aucun mode n'est ouvert.
 *
 * Idempotent : relancer ne duplique rien.
 *   node packages/knowledge/scripts/add-lot3-airlines.mjs [--dry]
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
  { id: "airline_airbaltic", name: "airBaltic", iata: "BT", country: "country_lv", alliance: "none",
    web: "https://www.airbaltic.com", hubs: ["airport_rix"],
    serves: ["country_ae","country_al","country_at","country_be","country_bg","country_ch","country_cy","country_cz","country_de","country_dk","country_ee","country_eg","country_es","country_fi","country_fr","country_gb","country_ge","country_gr","country_hr","country_hu","country_ie","country_il","country_is","country_it","country_lt","country_lv","country_me","country_mt","country_nl","country_no","country_pt","country_ro","country_rs","country_se","country_si","country_tr"] },

  { id: "airline_sky_express", name: "Sky Express", iata: "GQ", country: "country_gr", alliance: "none",
    web: "https://www.skyexpress.gr", hubs: ["airport_ath"],
    serves: ["country_at","country_be","country_cy","country_cz","country_de","country_dk","country_es","country_fr","country_gb","country_ge","country_gr","country_il","country_it","country_nl","country_pl","country_pt","country_tr"] },

  { id: "airline_batik_air_indonesia", name: "Batik Air Indonesia", iata: "ID", country: "country_id", alliance: "none",
    web: "https://www.batikair.com", hubs: ["airport_cgk"],
    serves: ["country_au","country_id","country_my","country_sg","country_th"] },

  { id: "airline_air_serbia", name: "Air Serbia", iata: "JU", country: "country_rs", alliance: "none",
    web: "https://www.airserbia.com", hubs: ["airport_beg"],
    serves: ["country_al","country_at","country_be","country_bg","country_ca","country_ch","country_cn","country_cy","country_cz","country_de","country_dk","country_es","country_fr","country_gb","country_ge","country_gr","country_hr","country_hu","country_it","country_me","country_mt","country_nl","country_no","country_pl","country_pt","country_ro","country_rs","country_ru","country_se","country_si","country_tr","country_us"] },

  { id: "airline_neos", name: "Neos", iata: "NO", country: "country_it", alliance: "none",
    web: "https://www.neosair.com", hubs: ["airport_mxp"],
    serves: ["country_ae","country_bg","country_co","country_cu","country_cv","country_cy","country_cz","country_de","country_dk","country_do","country_eg","country_es","country_fr","country_gr","country_il","country_it","country_jm","country_ke","country_mv","country_mx","country_no","country_om","country_pl","country_pt","country_sn","country_th","country_tn","country_us"] },

  { id: "airline_batik_air_malaysia", name: "Batik Air Malaysia", iata: "OD", country: "country_my", alliance: "none",
    web: "https://www.batikair.com.my", hubs: ["airport_kul"],
    serves: ["country_ae","country_au","country_cn","country_hk","country_id","country_in","country_jp","country_kr","country_lk","country_mv","country_my","country_np","country_sa","country_sg","country_th","country_tw","country_vn"] },

  { id: "airline_croatia_airlines", name: "Croatia Airlines", iata: "OU", country: "country_hr", alliance: "star_alliance",
    web: "https://www.croatiaairlines.com", hubs: ["airport_zag"],
    serves: ["country_at","country_be","country_ch","country_cz","country_de","country_dk","country_es","country_fr","country_gb","country_gr","country_hr","country_ie","country_it","country_nl","country_no","country_se","country_tr"] },

  { id: "airline_pegasus", name: "Pegasus Airlines", iata: "PC", country: "country_tr", alliance: "none",
    web: "https://www.flypgs.com", hubs: ["airport_saw"],
    serves: ["country_ae","country_al","country_at","country_be","country_bg","country_bh","country_ch","country_cz","country_de","country_dk","country_dz","country_ee","country_eg","country_es","country_fi","country_fr","country_gb","country_ge","country_gr","country_hr","country_hu","country_ie","country_it","country_jo","country_kw","country_lb","country_ma","country_me","country_nl","country_no","country_om","country_pl","country_qa","country_ro","country_rs","country_sa","country_se","country_si","country_sk","country_tr"] },

  { id: "airline_edelweiss", name: "Edelweiss Air", iata: "WK", country: "country_ch", alliance: "none",
    web: "https://www.flyedelweiss.com", hubs: ["airport_zrh"],
    serves: ["country_ca","country_ch","country_co","country_cr","country_cv","country_cy","country_do","country_eg","country_es","country_gb","country_ge","country_gr","country_hr","country_ie","country_is","country_it","country_jm","country_lk","country_ma","country_me","country_mu","country_mv","country_mx","country_no","country_pt","country_sc","country_th","country_tn","country_tr","country_us","country_za"] },

  { id: "airline_sunexpress", name: "SunExpress", iata: "XQ", country: "country_tr", alliance: "none",
    web: "https://www.sunexpress.com", hubs: ["airport_ayt"],
    serves: ["country_ae","country_al","country_at","country_be","country_ch","country_cz","country_de","country_dk","country_ee","country_eg","country_fr","country_gb","country_ge","country_hu","country_ie","country_it","country_lb","country_me","country_nl","country_pl","country_ro","country_se","country_sk","country_tr"] },
];

const data = JSON.parse(readFileSync(OBJ, "utf8"));
const cIds = new Set(data.countries.map((c) => c.id));
const aIds = new Set(data.airports.map((a) => a.id));

let added = 0, skipped = 0;

for (const a of AIRLINES) {
  if (!cIds.has(a.country)) { console.error(`✗ ${a.iata} : pays d'immatriculation inconnu (${a.country})`); process.exit(1); }
  if (data.airlines.some((x) => x.id === a.id)) { skipped++; continue; }
  for (const s of a.serves) if (!cIds.has(s)) { console.error(`✗ ${a.iata} : pays desservi inconnu (${s})`); process.exit(1); }

  const hubs = a.hubs.filter((h) => aIds.has(h));

  const obj = {
    id: a.id, iata: a.iata, name: a.name, country_id: a.country, alliance: a.alliance,
    website: a.web,
    serves_country_ids: [...new Set(a.serves)].sort(),
    source: {
      url: a.web, source_type: "official_website", verified_date: TODAY, review_due: plus(TODAY, 90),
      confidence: 3, reviewer: "MyDogCanFly Data Team",
      history: [{ date: TODAY, reviewer: "MyDogCanFly Data Team",
        note: "Relevé du 8 août 2026 : politique animaux lue sur le site officiel de la compagnie. Réseau dérivé des arêtes utilisables de la collecte élargie (routes_FULL_strict.json), hors partage de code." }],
    },
  };
  if (hubs.length) obj.hub_airport_ids = hubs;

  data.airlines.push(obj);
  added++;
}

data.airlines.sort((x, y) => x.id.localeCompare(y.id));
if (!dry) writeFileSync(OBJ, JSON.stringify(data, null, 2) + "\n");

console.log(`${added} compagnie(s) ajoutée(s), ${skipped} déjà présente(s) — total ${data.airlines.length}${dry ? " (essai à blanc)" : ""}`);
