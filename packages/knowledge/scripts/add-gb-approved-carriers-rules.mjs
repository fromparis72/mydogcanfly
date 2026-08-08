#!/usr/bin/env node
/* REPRISE.md APRÈS §3 (source : A-REPRENDRE-FINDER-2.md §7) — « Royaume-Uni : "vols directs
 * probables" — confirmé ». Paris → Londres, Bouledogue français : le Finder affichait "5 likely
 * direct flights" en comptant des liaisons PASSAGERS, alors qu'un animal n'entre en Grande-Bretagne
 * qu'en soute, et seulement via une compagnie et un aéroport approuvés par l'APHA (Animal and Plant
 * Health Agency). Ce script comble le trou de règles ; le comptage lui-même est corrigé séparément
 * dans FlightFinder.astro (ne compter que les compagnies qui acceptent RÉELLEMENT le chien).
 *
 * MESURE DU PROBLÈME (08/08/2026) — vérifié directement sur gov.uk, jamais supposé :
 *   https://www.gov.uk/bring-pet-to-great-britain/travel-routes-pets — « Pets have to travel as
 *     cargo [dans la soute] unless you're flying on a chartered private plane or travelling with
 *     a guide/assistance dog. » Donc : JAMAIS de cabine pour un animal ordinaire (pet/soutien
 *     émotionnel), quelle que soit la compagnie — un chien d'assistance (service_dog) reste exempté.
 *   https://www.gov.uk/government/publications/pet-travel-approved-air-sea-and-rail-carriers-and-routes/approved-air-routes-for-pet-travel
 *     — liste, compagnie par compagnie, celles autorisées par l'APHA à transporter des animaux en
 *     soute, et vers quel(s) aéroport(s) britanniques. Sur nos 102 compagnies, 50 y figurent
 *     (Air France, British Airways, Lufthansa, Turkish Airlines... vérifiées une à une contre la
 *     table), 52 n'y figurent PAS (TAP Air Portugal, Vueling, Ryanair, easyJet, Wizz Air, Neos,
 *     Pegasus, Croatia Airlines... vérifiées une à une, absence confirmée, pas une supposition
 *     faute de mention). Sans règle, ces 52 ressortaient "Hold OK" sur une destination Royaume-Uni
 *     — une compagnie non agréée n'a simplement pas le droit d'embarquer l'animal, quoi qu'elle
 *     propose par ailleurs sur d'autres routes.
 *   Bonus trouvé en creusant : Londres-Stansted (STN, dans notre référentiel) n'apparaît QUE dans
 *     la table des vols CHARTER (jets privés) — aucune compagnie commerciale classique n'y est
 *     agréée pour un animal. Toute demande vers STN doit donc être refusée en cabine ET en soute,
 *     indépendamment de la compagnie.
 *
 * CE QUE CE SCRIPT ÉCRIT (3 formes de règles, jamais un cas particulier codé en dur ailleurs) :
 *   1. Une règle GLOBALE : cabine refusée vers le Royaume-Uni pour pet/emotional_support (jamais
 *      pour service_dog — l'exemption "guide/assistance dog" est explicite dans la source).
 *   2. Une règle GLOBALE : cabine ET soute refusées vers Stansted spécifiquement, même motif.
 *   3. Une règle PAR COMPAGNIE, seulement pour les 52 compagnies absentes de la table APHA : soute
 *      refusée vers le Royaume-Uni. Les 50 compagnies approuvées n'ont besoin d'AUCUNE règle
 *      nouvelle — leur soute reste autorisée par défaut, ce qui est exact.
 *
 * CE QU'IL N'ÉCRIT PAS. Le fret (cargo) n'est pas touché : la table APHA documente uniquement le
 * transport en soute accompagnée par les compagnies aériennes commerciales, pas les circuits fret/
 * transitaire, qui suivent une autre procédure d'agrément non vérifiée ici — l'affirmer serait
 * inventer. Pas de granularité par aéroport britannique au-delà de Stansted (une compagnie agréée
 * seulement à Édimbourg mais recherchée vers Heathrow resterait donc autorisée à tort) — nos règles
 * n'ont pas de fait `airline_id`, seule une règle par compagnie scope déjà correctement le bon
 * niveau ; la granularité par aéroport demanderait une refonte plus large, à part.
 *
 * Idempotent (id de règle stable, une passe ne duplique rien) :
 *   node packages/knowledge/scripts/add-gb-approved-carriers-rules.mjs [--dry]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const RULES = resolve(HERE, "../raw/rules.json");
const OBJ = resolve(HERE, "../raw/objects.json");
const dry = process.argv.includes("--dry");

const VERIFIED = "2026-08-08";
const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const SOURCE_ROUTES = "https://www.gov.uk/government/publications/pet-travel-approved-air-sea-and-rail-carriers-and-routes/approved-air-routes-for-pet-travel";
const SOURCE_CARGO = "https://www.gov.uk/bring-pet-to-great-britain/travel-routes-pets";

function baseSource(url, domain) {
  return {
    url, source_type: "government", verified_date: VERIFIED, review_due: addDays(VERIFIED, domain === "airline" ? 90 : 180),
    confidence: 5, reviewer: "MyDogCanFly Data Team",
    history: [{ date: VERIFIED, reviewer: "MyDogCanFly Data Team", note: "Vérifié ligne à ligne contre la table APHA (compagnies commerciales) — voir add-gb-approved-carriers-rules.mjs pour la méthode." }],
  };
}

const petTravelTypes = ["pet", "emotional_support"]; // jamais service_dog : exemption "guide/assistance dog" explicite sur gov.uk

const GLOBAL_RULES = [
  {
    id: "rule_gb_no_cabin_pets", scope: { type: "global" }, category: "placement", criticality: "high",
    applies_when: { all: [
      { fact: "route.dest_country_id", op: "eq", value: "country_gb" },
      { fact: "placement", op: "eq", value: "cabin" },
      { fact: "travel_type", op: "in", value: petTravelTypes },
    ] },
    effect: { action: "deny", placement: ["cabin"] }, params: {},
    rationale: "Pets entering Great Britain must travel as manifest cargo in the hold — no commercial airline offers in-cabin travel for an ordinary pet (assistance dogs are exempted, and travel separately in this database).",
    rationale_i18n: { fr: "Un animal entrant en Grande-Bretagne doit voyager en soute, comme du fret manifesté — aucune compagnie commerciale ne propose la cabine pour un animal ordinaire (les chiens d'assistance sont exemptés, et suivent une autre règle dans ce référentiel)." },
    source: baseSource(SOURCE_CARGO, "global"),
  },
  {
    id: "rule_gb_stn_not_approved", scope: { type: "global" }, category: "placement", criticality: "high",
    applies_when: { all: [
      { fact: "route.dest_airport_id", op: "eq", value: "airport_stn" },
      { fact: "placement", op: "in", value: ["cabin", "hold"] },
      { fact: "travel_type", op: "in", value: petTravelTypes },
    ] },
    effect: { action: "deny", placement: ["cabin", "hold"] }, params: {},
    rationale: "London Stansted is not an APHA-approved airport for pets on any scheduled commercial airline — only charter (private jet) operators are approved there.",
    rationale_i18n: { fr: "Londres-Stansted n'est agréé par l'APHA pour aucune compagnie commerciale classique — seuls des vols charter (jets privés) y sont autorisés à transporter un animal." },
    source: baseSource(SOURCE_ROUTES, "global"),
  },
];

// Les 50 compagnies vérifiées comme AGRÉÉES par l'APHA (table "commercial airlines" de la source
// ci-dessus) — présentes ici pour la trace, pas pour écrire une règle (leur soute reste autorisée
// par défaut, ce qui est exact).
const APPROVED_NAMES = [
  "Aeromexico", "Aegean Airlines", "Aer Lingus", "Air Astana", "airBaltic", "Air Canada",
  "Air Europa", "Air France", "Air India", "Air Mauritius", "Air Transat", "Alaska Airlines",
  "ANA (All Nippon Airways)", "American Airlines", "British Airways", "Cathay Pacific",
  "China Airlines", "Delta Air Lines", "EgyptAir", "Emirates", "Ethiopian Airlines",
  "Etihad Airways", "EVA Air", "Gulf Air", "Iberia", "Iberia Express", "IndiGo",
  "Japan Airlines (JAL)", "KLM Royal Dutch Airlines", "Kenya Airways", "Korean Air",
  "LOT Polish Airlines", "Lufthansa", "Malaysia Airlines", "Philippine Airlines", "Qantas",
  "Qatar Airways", "Royal Jordanian", "SAS Scandinavian", "SWISS", "Singapore Airlines",
  "Smartwings", "South African Airways", "TAROM", "TUI Airways", "Thai Airways",
  "Turkish Airlines", "WestJet", "Austrian Airlines", "Avianca",
];

// Les 52 compagnies vérifiées ABSENTES de la table APHA (recherchées une à une, pas une déduction
// par défaut) → soute refusée vers le Royaume-Uni.
const NOT_APPROVED_NAMES = [
  "Icelandair", "ITA Airways", "JetBlue", "KM Malta Airlines", "LATAM", "La Compagnie", "Luxair",
  "Neos", "Norwegian", "Pegasus Airlines", "Royal Air Maroc", "Ryanair", "Saudia", "Sky Express",
  "SunExpress", "TAP Air Portugal", "Transavia", "Tunisair", "United Airlines", "Vietnam Airlines",
  "Virgin Atlantic", "Virgin Australia", "Volotea", "Vueling", "Wizz Air", "easyJet", "Air Serbia",
  "Aircalin", "Air Austral", "Air Algérie", "Air Caraïbes", "Air China", "Air Tahiti Nui",
  "Aerolíneas Argentinas", "Asiana Airlines", "Bangkok Airways", "Batik Air Indonesia",
  "Batik Air Malaysia", "Brussels Airlines", "China Eastern Airlines", "China Southern Airlines",
  "Corsair", "Croatia Airlines", "EL AL Israel Airlines", "Edelweiss Air", "Eurowings", "Finnair",
  "French Bee", "Garuda Indonesia", "Air New Zealand", "Condor", "Copa Airlines",
];

const objData = JSON.parse(readFileSync(OBJ, "utf8"));
const byName = new Map(objData.airlines.map((a) => [a.name, a.id]));

// Garde-fou : les deux listes doivent couvrir EXACTEMENT le référentiel, sans trou ni doublon —
// sinon une compagnie glisserait entre les mailles (ni agréée ni refusée) sans qu'on le sache.
const allListed = new Set([...APPROVED_NAMES, ...NOT_APPROVED_NAMES]);
const missing = objData.airlines.map((a) => a.name).filter((n) => !allListed.has(n));
if (missing.length) {
  console.error(`✗ ${missing.length} compagnie(s) du référentiel absente(s) des deux listes (ni vérifiée agréée, ni vérifiée refusée) : ${missing.join(", ")}`);
  process.exit(1);
}
const unresolved = NOT_APPROVED_NAMES.filter((n) => !byName.has(n));
if (unresolved.length) {
  console.error(`✗ Nom(s) introuvable(s) dans objects.json (faute de frappe probable) : ${unresolved.join(", ")}`);
  process.exit(1);
}

const perAirlineRules = NOT_APPROVED_NAMES.map((name) => {
  const airlineId = byName.get(name);
  const slug = airlineId.replace(/^airline_/, "");
  return {
    id: `rule_${slug}_gb_not_approved`, scope: { type: "airline", id: airlineId }, category: "placement", criticality: "high",
    applies_when: { all: [
      { fact: "route.dest_country_id", op: "eq", value: "country_gb" },
      { fact: "placement", op: "eq", value: "hold" },
      { fact: "travel_type", op: "in", value: petTravelTypes },
    ] },
    effect: { action: "deny", placement: ["hold"] }, params: {},
    rationale: `${name} is not on the APHA-approved list of commercial airlines for pet travel into Great Britain — it cannot legally carry a pet on this route, even if it offers pet transport elsewhere.`,
    rationale_i18n: { fr: `${name} ne figure pas sur la liste APHA des compagnies commerciales agréées pour transporter un animal vers la Grande-Bretagne — elle ne peut pas légalement l'embarquer sur ce trajet, même si elle propose le transport d'animaux ailleurs.` },
    source: baseSource(SOURCE_ROUTES, "airline"),
  };
});

const NEW_RULES = [...GLOBAL_RULES, ...perAirlineRules];
const rulesData = JSON.parse(readFileSync(RULES, "utf8"));
const existingIds = new Set(rulesData.map((r) => r.id));
let added = 0, skipped = 0;
for (const r of NEW_RULES) {
  if (existingIds.has(r.id)) { skipped++; continue; }
  rulesData.push(r);
  added++;
}
rulesData.sort((a, b) => a.id.localeCompare(b.id));

if (!dry) writeFileSync(RULES, JSON.stringify(rulesData, null, 2) + "\n");

console.log(
  `${added} règle(s) ajoutée(s) (${GLOBAL_RULES.length} globales + ${perAirlineRules.length} par compagnie), ` +
  `${skipped} déjà là — total ${rulesData.length} règles${dry ? "  (essai à blanc)" : ""}`,
);
