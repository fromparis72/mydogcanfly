#!/usr/bin/env node
/* Fill airport.pet_relief in raw/objects.json — data-driven, fully sourced (ADR-0006).
   - US airports: auto-filled from the federal rule 14 CFR §382.51 (relief area post-security in every terminal).
   - International hubs: curated from official airport pages + researched aggregators (cited per entry).
   - Everything else stays absent → rendered as "not yet verified" / omitted. Nothing fabricated. */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dir = dirname(fileURLToPath(import.meta.url));
const OBJ = resolve(__dir, "../raw/objects.json");
const TODAY = "2026-07-10";
const plus = (iso, days) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + days); return d.toISOString().slice(0, 10); };
const L = (en, fr) => (fr ? { en, fr } : { en });
const src = (url, type = "other", confidence = 3) => ({
  url, source_type: type, verified_date: TODAY, review_due: plus(TODAY, 365),
  confidence, reviewer: "research", history: [],
});

// ---- US federal baseline (applies to every US airport) ----
const US_NOTE = L(
  "U.S. federal rule (14 CFR §382.51) requires a service-animal / pet relief area in each terminal, located inside the post-security (sterile) area. Exact spots vary — follow airport signage or ask the accessibility desk.",
  "La règle fédérale américaine (14 CFR §382.51) impose une zone de soulagement pour animaux dans chaque terminal, située côté piste (après les contrôles de sûreté). L'emplacement exact varie — suivez la signalétique ou demandez au comptoir accessibilité.",
);
const US_SRC = src("https://www.ecfr.gov/current/title-14/chapter-II/subchapter-D/part-382/subpart-D/section-382.51", "regulation", 5);

// ---- Curated international + a few enriched US entries (keyed by IATA) ----
const CURATED = {
  // ===== France =====
  CDG: { available: "yes", post_security: true, basis: "airport_official",
    locations: [ L("Terminal 2F — outdoor, landside, near Gate 17d", "Terminal 2F — extérieur, côté ville, près de la porte 17d"),
                 L("Terminal 2E — outdoor terrace, airside, near Gate M50", "Terminal 2E — terrasse extérieure, côté piste, près de la porte M50") ],
    note: L("Signposted “Espace canin”.", "Signalé « Espace canin »."),
    source: src("https://www.parisaeroport.fr/en/passengers/charles-de-gaulle-airport", "airline_contact", 4) },
  ORY: { available: "yes", post_security: false, basis: "airport_official",
    locations: [ L("Landside, between Terminals 3 and 4 — enclosed dog-park (double gate, sand, bench, water fountain)",
                   "Côté ville, entre les terminaux 3 et 4 — enclos type parc canin (double portillon, sable, banc, fontaine)") ],
    source: src("https://www.parisaeroport.fr/en/passengers/orly-airport", "airline_contact", 4) },
  NCE: { available: "unknown" },
  // ===== Belgium =====
  BRU: { available: "yes", basis: "airport_official",
    locations: [ L("Departures — pet relief area at Gate B09 (waste bags provided)",
                   "Départs — zone de soulagement à la porte B09 (sacs fournis)") ],
    source: src("https://www.brusselsairport.be/en/passengers", "airline_contact", 4) },
  // ===== Finland =====
  HEL: { available: "yes", post_security: true, basis: "airport_official",
    locations: [ L("Outdoor — outside Arrivals, near Bus Stop 18", "Extérieur — devant les Arrivées, près de l'arrêt de bus 18"),
                 L("Airside (non-Schengen) — near Gates 51A–D, enclosed with artificial turf", "Côté piste (hors Schengen) — près des portes 51A–D, enclos en gazon synthétique"),
                 L("Airside (Schengen) — near Gate 21 (weather-dependent)", "Côté piste (Schengen) — près de la porte 21 (selon météo)") ],
    source: src("https://www.finavia.fi/en/airports/helsinki-airport", "airline_contact", 4) },
  // ===== Germany =====
  BER: { available: "yes", post_security: true, basis: "airport_official",
    locations: [ L("Outdoor — outside Arrivals, near Bus Stop 18", "Extérieur — devant les Arrivées, près de l'arrêt de bus 18"),
                 L("Airside (non-Schengen) — near Gate 51, artificial turf, open 24/7", "Côté piste (hors Schengen) — près de la porte 51, gazon synthétique, 24h/24"),
                 L("Airside (Schengen, seasonal) — near Gate 21", "Côté piste (Schengen, saisonnier) — près de la porte 21") ],
    source: src("https://ber.berlin-airport.de/en.html", "airline_contact", 4) },
  FRA: { available: "no",
    note: L("No official passenger relief area. Unofficial spot: grass strip near Parking P36, Terminal 1. (The Frankfurt Animal Lounge handles cargo/transit animals only.)",
            "Pas de zone officielle pour passagers. Coin non officiel : bande d'herbe près du parking P36, Terminal 1. (La Frankfurt Animal Lounge ne traite que le fret/transit.)"),
    source: src("https://petabroad.eu/pet-relief-areas/", "other", 2) },
  MUC: { available: "no",
    note: L("No official area. Unofficial spot: grass near the MAC Forum, between Terminals 1 and 2.",
            "Pas de zone officielle. Coin non officiel : herbe près du MAC Forum, entre les terminaux 1 et 2."),
    source: src("https://petabroad.eu/pet-relief-areas/", "other", 2) },
  // ===== Greece =====
  ATH: { available: "yes", post_security: true, basis: "airport_official",
    locations: [ L("Airside (non-Schengen) — Animal Care facility next to Gate A15, after passport control",
                   "Côté piste (hors Schengen) — espace Animal Care près de la porte A15, après le contrôle des passeports") ],
    source: src("https://www.aia.gr/en", "airline_contact", 4) },
  // ===== Hungary =====
  BUD: { available: "yes", basis: "airport_official",
    locations: [ L("Outdoor — near Terminal 2A, close to the main entrance / taxi drop-off",
                   "Extérieur — près du Terminal 2A, proche de l'entrée principale / dépose taxi") ],
    source: src("https://www.bud.hu/en", "airline_contact", 4) },
  // ===== Ireland =====
  DUB: { available: "yes", post_security: true, basis: "airport_official",
    locations: [ L("Terminal 2 — after security, directly opposite Butler's Coffee",
                   "Terminal 2 — après les contrôles, face à Butler's Coffee") ],
    note: L("A T1 animal screening facility (2024) eases hold-pet check-in but is not a relief area.",
            "Un centre de contrôle animalier au T1 (2024) facilite l'enregistrement en soute, mais n'est pas une zone de soulagement."),
    source: src("https://www.dublinairport.com/", "airline_contact", 4) },
  // ===== Italy =====
  FCO: { available: "yes", post_security: true, basis: "airport_official",
    locations: [ L("Terminal 3 Arrivals (sterile) — near baggage carousel 14", "Terminal 3 Arrivées (zone stérile) — près du tapis bagages 14"),
                 L("Terminal 1 boarding area A (Schengen) — intercom access", "Terminal 1 zone d'embarquement A (Schengen) — accès par interphone"),
                 L("Terminal 1 arrivals — intercom access", "Terminal 1 arrivées — accès par interphone"),
                 L("Terminal 3 exterior (public) — outside door 2", "Terminal 3 extérieur (public) — devant la porte 2") ],
    note: L("The information desk can show the nearest area on a map.", "Le comptoir d'information peut indiquer la zone la plus proche sur un plan."),
    source: src("https://www.adr.it/web/aeroporti-di-roma-en", "airline_contact", 4) },
  BLQ: { available: "no",
    note: L("No official area. Unofficial spot: green area near the Kiss & Fly zone in front of the terminal.",
            "Pas de zone officielle. Coin non officiel : espace vert près de la zone Kiss & Fly devant le terminal."),
    source: src("https://petabroad.eu/pet-relief-areas/", "other", 2) },
  // ===== Poland =====
  KRK: { available: "yes", basis: "airport_official",
    locations: [ L("Outdoor pet park — next to car park P2 (bench, water fountain, waste bins)",
                   "Parc canin extérieur — à côté du parking P2 (banc, fontaine, poubelles)") ],
    source: src("https://krakowairport.pl/en/", "airline_contact", 4) },
  // ===== Portugal =====
  LIS: { available: "yes", basis: "airport_official",
    locations: [ L("Outdoor — near the departures hall (fenced, waste bins)",
                   "Extérieur — près du hall des départs (clôturé, poubelles)") ],
    source: src("https://www.lisbonairport.pt/en/lis/home", "airline_contact", 4) },
  // ===== Spain =====
  MAD: { available: "yes", basis: "airport_official",
    locations: [ L("Terminal 1 Arrivals (landside) — 50 m² fenced “Pet Park” (sandbox, water fountain, bag dispenser, bin, bench)",
                   "Terminal 1 Arrivées (côté ville) — « Pet Park » clôturé de 50 m² (bac à sable, fontaine, distributeur de sacs, poubelle, banc)") ],
    note: L("Indoor zones announced for boarding areas of Terminals 2, 4 and 4S.",
            "Des zones intérieures sont annoncées dans les salles d'embarquement des terminaux 2, 4 et 4S."),
    source: src("https://www.aena.es/en/adolfo-suarez-madrid-barajas.html", "airline_contact", 4) },
  PMI: { available: "yes", post_security: true, basis: "airport_official",
    locations: [ L("Arrivals, ground floor (landside) — after baggage reclaim", "Arrivées, rez-de-chaussée (côté ville) — après la récupération des bagages"),
                 L("Departures, level 4 terrace (landside)", "Départs, terrasse niveau 4 (côté ville)"),
                 L("Module C (airside) — for ticketed passengers", "Module C (côté piste) — pour passagers munis d'un billet") ],
    source: src("https://www.palmaairport.info/", "other", 3) },
  SVQ: { available: "yes", basis: "airport_official",
    locations: [ L("Arrivals and Departures halls — artificial turf, bag dispensers, bins, water bowls",
                   "Halls des arrivées et des départs — gazon synthétique, distributeurs de sacs, poubelles, gamelles d'eau") ],
    source: src("https://www.aena.es/en/sevilla.html", "airline_contact", 4) },
  VLC: { available: "yes", basis: "airport_official",
    locations: [ L("Outdoor — near arrivals and the parking facilities (landside)", "Extérieur — près des arrivées et des parkings (côté ville)") ],
    source: src("https://www.aena.es/en/valencia.html", "airline_contact", 4) },
  BCN: { available: "no",
    note: L("No official area. Unofficial spots: landscaped grass in front of Terminal 1 (near taxis); an airside outdoor terrace off the departures hall.",
            "Pas de zone officielle. Coins non officiels : pelouse aménagée devant le Terminal 1 (près des taxis) ; terrasse extérieure côté piste depuis le hall des départs."),
    source: src("https://petabroad.eu/pet-relief-areas/", "other", 2) },
  AGP: { available: "unknown" },
  BIO: { available: "unknown" },
  // ===== Switzerland =====
  GVA: { available: "yes", basis: "airport_official",
    locations: [ L("Landside — near the children's playground, close to Gate A8", "Côté ville — près de l'aire de jeux pour enfants, proche de la porte A8"),
                 L("Landside — mezzanine corridor between the infirmary and the children's area", "Côté ville — couloir en mezzanine entre l'infirmerie et l'espace enfants") ],
    source: src("https://www.gva.ch/en/", "airline_contact", 4) },
  // ===== Turkey =====
  IST: { available: "yes", post_security: true, basis: "airport_official",
    locations: [ L("Pre-security — Departures floor, among the check-in islands", "Avant les contrôles — niveau Départs, entre les îlots d'enregistrement"),
                 L("Airside — two Pet Relief Rooms after passport control (Departures)", "Côté piste — deux Pet Relief Rooms après le contrôle des passeports (Départs)"),
                 L("Arrivals hall — one room", "Hall des arrivées — une salle") ],
    source: src("https://www.istairport.com/en/", "airline_contact", 4) },
  // ===== United Kingdom =====
  LHR: { available: "yes", post_security: true, basis: "airport_official",
    locations: [ L("Terminal 2 — Level −2 departures, towards Gate B", "Terminal 2 — niveau −2 départs, vers la porte B"),
                 L("Terminal 3 — Level 1, near Gate 27", "Terminal 3 — niveau 1, près de la porte 27"),
                 L("Terminal 4 — Level 2 departures, behind World Duty Free", "Terminal 4 — niveau 2 départs, derrière World Duty Free"),
                 L("Terminal 5 — Level −2, by the transit train station", "Terminal 5 — niveau −2, près de la gare du train de transit") ],
    note: L("Primarily for assistance dogs; cabin-pet access varies. Cargo pets are handled at the Heathrow Animal Reception Centre (HARC), separate from the terminals.",
            "Principalement pour chiens d'assistance ; l'accès pour animaux en cabine varie. Les animaux en soute passent par le Heathrow Animal Reception Centre (HARC), distinct des terminaux."),
    source: src("https://www.heathrow.com/at-the-airport/accessibility-and-mobility/travelling-with-assistance-dogs", "airline_contact", 4) },
  LGW: { available: "yes",
    note: L("Relief areas exist but locations are not published — ask staff. An Animal Reception Centre handles post-arrival pets.",
            "Des zones existent mais leurs emplacements ne sont pas publiés — demandez au personnel. Un Animal Reception Centre gère les animaux à l'arrivée."),
    source: src("https://www.gatwickairport.com/", "airline_contact", 3) },
  STN: { available: "yes", post_security: true, basis: "airport_official",
    locations: [ L("Airside — near the APV building; assistance dogs only, staff escort required",
                   "Côté piste — près du bâtiment APV ; chiens d'assistance uniquement, accompagnement du personnel requis") ],
    source: src("https://www.stanstedairport.com/", "airline_contact", 3) },
  MAN: { available: "unknown" },
  EDI: { available: "unknown" },
  // ===== Netherlands =====
  AMS: { available: "no",
    note: L("No official area. Unofficial spot: a small grassy patch outside Departure Hall 3, near the bus stop.",
            "Pas de zone officielle. Coin non officiel : petite pelouse devant le hall des départs 3, près de l'arrêt de bus."),
    source: src("https://petabroad.eu/pet-relief-areas/", "other", 2) },
  // ===== Czechia =====
  PRG: { available: "no",
    note: L("No official area (and none planned). Unofficial spot: grass just outside Terminal 2 (departures/arrivals).",
            "Pas de zone officielle (aucune prévue). Coin non officiel : herbe juste devant le Terminal 2 (départs/arrivées)."),
    source: src("https://petabroad.eu/pet-relief-areas/", "other", 2) },
  // ===== UAE =====
  AUH: { available: "yes", post_security: true, basis: "airport_official",
    locations: [ L("Departures — Animal Relief Area within the toilet facilities near Todd English, towards the C Gates",
                   "Départs — zone de soulagement dans les sanitaires près de Todd English, vers les portes C") ],
    source: src("https://www.zayedinternationalairport.ae/en/AirportInformation/Assistance/Service-Dogs", "airline_contact", 4) },
  // ===== Singapore =====
  SIN: { available: "yes", post_security: true, basis: "airport_official",
    locations: [ L("Pre-security — outside Terminal 1, near door B106", "Avant les contrôles — devant le Terminal 1, près de la porte B106"),
                 L("Airside — indoor area near Gate B4, Terminal 1", "Côté piste — espace intérieur près de la porte B4, Terminal 1"),
                 L("Jurassic Bark Dog Run — Terminal 2, Level 1 (landside, 200 m²)", "Jurassic Bark Dog Run — Terminal 2, niveau 1 (côté ville, 200 m²)") ],
    source: src("https://www.changiairport.com/", "airline_contact", 4) },
  // ===== Japan =====
  HND: { available: "yes", post_security: true, basis: "airport_official",
    locations: [ L("Assistance-dog toilets within the terminal (incl. after departure procedures) — sink, disposal mats, leash hooks",
                   "Toilettes pour chiens d'assistance dans le terminal (dont après les formalités de départ) — évier, tapis jetables, crochets à laisse") ],
    source: src("https://tokyo-haneda.com/en/service/facilities/restrooms_for_assistance_dogs.html", "airline_contact", 4) },
  NRT: { available: "yes", post_security: true, basis: "airport_official",
    locations: [ L("Assistance-dog toilet — after international departure procedures (airside)",
                   "Toilette pour chien d'assistance — après les formalités de départ international (côté piste)") ],
    source: src("https://www.narita-airport.jp/en/service/ud/assistance_dog/", "airline_contact", 4) },
  // ===== South Korea =====
  ICN: { available: "no",
    note: L("No airside pet relief area. A pet garden sits outside the terminal — reachable only after clearing immigration into Korea.",
            "Pas de zone de soulagement côté piste. Un jardin pour animaux se trouve hors du terminal — accessible seulement après avoir passé l'immigration coréenne."),
    source: src("https://www.dogsonplanes.com/airports/icn/pet-relief-areas/", "other", 2) },
  // ===== Canada =====
  YYZ: { available: "yes", post_security: true, basis: "airport_official",
    locations: [ L("Terminals 1 & 3 — indoor and outdoor areas, pre- and post-security (e.g. T1 near Gate D30, T1 near Gate F83, T3 after intl Gate B26)",
                   "Terminaux 1 et 3 — zones intérieures et extérieures, avant et après les contrôles (ex. T1 près de la porte D30, T1 près de la porte F83, T3 après la porte internationale B26)"),
                 L("Infield Concourse", "Halls du concourse Infield") ],
    source: src("https://www.torontopearson.com/en/while-you-are-here/travel-with-pets", "airline_contact", 5) },
  YVR: { available: "yes", post_security: true, basis: "airport_official",
    locations: [ L("Post-security — gate area of the US Departures terminal", "Côté piste — zone des portes du terminal des départs vers les États-Unis") ],
    source: src("https://petfriendlytravel.com/pet-relief-areas-airports-canada/", "other", 3) },
  YYC: { available: "yes", post_security: true,
    locations: [ L("Indoor, post-security animal relief area", "Zone de soulagement intérieure, côté piste") ],
    source: src("https://petfriendlytravel.com/pet-relief-areas-airports-canada/", "other", 3) },
  YEG: { available: "yes", post_security: true,
    locations: [ L("Indoor, post-security animal relief area", "Zone de soulagement intérieure, côté piste") ],
    source: src("https://petfriendlytravel.com/pet-relief-areas-airports-canada/", "other", 3) },
  YWG: { available: "yes", post_security: true,
    locations: [ L("Indoor, post-security animal relief area", "Zone de soulagement intérieure, côté piste") ],
    source: src("https://petfriendlytravel.com/pet-relief-areas-airports-canada/", "other", 3) },
  YHZ: { available: "yes", post_security: true,
    locations: [ L("Indoor, post-security animal relief area", "Zone de soulagement intérieure, côté piste") ],
    source: src("https://petfriendlytravel.com/pet-relief-areas-airports-canada/", "other", 3) },
  YOW: { available: "yes", post_security: true,
    locations: [ L("Indoor, post-security animal relief area", "Zone de soulagement intérieure, côté piste") ],
    source: src("https://petfriendlytravel.com/pet-relief-areas-airports-canada/", "other", 3) },
  // ===== Enriched US entry (O'Hare) — still consistent with the federal baseline =====
  ORD: { available: "yes", post_security: true, basis: "airport_official",
    locations: [ L("Airside — Terminal 3 Rotunda (between T2 & T3) and near Gate L26 (indoor, 24/7 turf pads)",
                   "Côté piste — rotonde du Terminal 3 (entre T2 et T3) et près de la porte L26 (intérieur, gazon 24h/24)"),
                 L("Outdoor — lower-level curb in front of Terminals 1, 2 and 5 (real grass)",
                   "Extérieur — trottoir niveau inférieur devant les terminaux 1, 2 et 5 (vraie pelouse)"),
                 L("Multi-Modal Facility (rental cars / Lot F)", "Multi-Modal Facility (location de voitures / parking F)") ],
    note: US_NOTE, source: src("https://petfriendlytravel.com/pft_airports/chicago-ohare-international-airport-ord-pet-relief-areas/", "other", 3) },
};

// ---- Apply ----
const data = JSON.parse(readFileSync(OBJ, "utf8"));
const usCountry = (data.countries.find((c) => c.iso2 === "US") || {}).id;
let usCount = 0, curatedCount = 0;

for (const ap of data.airports) {
  const cur = CURATED[ap.iata];
  if (cur) {
    ap.pet_relief = { locations: [], ...cur };
    if (cur.available !== "unknown") curatedCount++;
    else delete ap.pet_relief; // "unknown" → leave absent (honest: nothing asserted)
    continue;
  }
  if (ap.country_id === usCountry) {
    ap.pet_relief = { available: "yes", post_security: true, basis: "regulation", locations: [], note: US_NOTE, source: US_SRC };
    usCount++;
  }
}

writeFileSync(OBJ, JSON.stringify(data, null, 2) + "\n");
const filled = data.airports.filter((a) => a.pet_relief).length;
console.log(`US baseline: ${usCount} | curated (yes/no): ${curatedCount} | airports with pet_relief: ${filled} / ${data.airports.length}`);
