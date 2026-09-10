#!/usr/bin/env node
/**
 * BANGKOK AIRWAYS FRET — TROIS RÈGLES GÉOGRAPHIQUES CITÉES (10/09/2026, annexe 37).
 *
 *   node packages/knowledge/scripts/add-bangkok-cargo-geo-rules.mjs [--dry]
 *
 * Source officielle relue par Codex le 10/09/2026 : https://www.bangkokair.com/cargo-service/pet_carriage.
 *   R1  « International Routes: All station: Not Accept »            → refus du fret sur tout segment international
 *   R2  « Accept all domestic route Except Bangkok – Krabi v.v. … »   → refus BKK/DMK ↔ KBV
 *   R3  « … and Chiang Mai – Krabi v.v. »                             → refus CNX ↔ KBV
 *
 * Décision de Philippe (10/09) : Krabi (airport_kbv) et Chiang Mai (airport_cnx) ne sont PAS ajoutés au
 * référentiel. R2 et R3 sont donc DORMANTES — aucune recherche ne peut viser ces aéroports — mais elles
 * existent, citées, le jour où l'un des deux entrerait (garde : test-bangkok-fret-geographie.mjs).
 * « Bangkok » est lu comme BKK ET DMK : un refus plus large est le sens sûr (un seuil élimine, ne confirme
 * pas) ; Bangkok Airways n'opère que BKK, DMK ne peut donc rien ouvrir à tort. Nommé pour arbitrage.
 *
 * Idempotent : une règle déjà présente n'est pas réécrite.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const RULES = resolve(here, "../raw/rules.json");
const dry = process.argv.includes("--dry");

const SOURCE_BASE = {
  url: "https://www.bangkokair.com/cargo-service/pet_carriage",
  source_type: "official_website",
  verified_date: "2026-09-10",
  review_due: "2026-12-09",   // reviewDueFrom("2026-09-10", "airline") — 90 jours
  confidence: 4,
  reviewer: "Codex — direct reading of official airline page",
  quote_language: "en",
  history: [{ date: "2026-09-10", reviewer: "Codex — direct reading of official airline page", note: "Relecture en ligne, phrases verbatim livrées à Claude via Philippe (annexe 37)." }],
};
const CARGO = { fact: "placement", op: "eq", value: "cargo" };
const PET = { fact: "travel_type", op: "in", value: ["pet", "emotional_support"] };
const BANGKOK = ["airport_bkk", "airport_dmk"];
const paire = (a, b) => ({ any: [
  { all: [{ fact: "route.origin_airport_id", op: "in", value: a }, { fact: "route.dest_airport_id", op: "in", value: b }] },
  { all: [{ fact: "route.origin_airport_id", op: "in", value: b }, { fact: "route.dest_airport_id", op: "in", value: a }] },
] });

const REGLES = [
  {
    id: "rule_bangkok_airways_cargo_international_denied",
    scope: { type: "airline", id: "airline_bangkok_airways" },
    category: "placement", criticality: "high",
    applies_when: { all: [CARGO, PET, { any: [
      { fact: "route.origin_country_id", op: "neq", value: "country_th" },
      { fact: "route.dest_country_id", op: "neq", value: "country_th" },
    ] }] },
    effect: { action: "deny", placement: ["cargo"] },
    params: {},
    rationale: "Bangkok Airways does not accept live animals as cargo on any international station: pet cargo is available on its domestic network only.",
    rationale_i18n: {
      fr: "Bangkok Airways n'accepte pas d'animal vivant en fret sur les escales internationales : le fret animalier n'existe que sur son réseau intérieur.",
      es: "Bangkok Airways no acepta animales vivos como carga en ninguna estación internacional: la carga de mascotas solo existe en su red nacional.",
      pt: "A Bangkok Airways não aceita animais vivos como carga em nenhuma estação internacional: a carga de animais existe apenas na sua rede doméstica.",
    },
    source: { ...SOURCE_BASE, quote: "International Routes: All station: Not Accept",
      locator: "Cargo Service → Pet Carriage Service → bloc des routes disponibles → International Routes" },
  },
  {
    id: "rule_bangkok_airways_cargo_bkk_kbv_excluded",
    scope: { type: "airline", id: "airline_bangkok_airways" },
    category: "placement", criticality: "high",
    applies_when: { all: [CARGO, PET, paire(BANGKOK, ["airport_kbv"])] },
    effect: { action: "deny", placement: ["cargo"] },
    params: {},
    rationale: "Bangkok Airways excludes the Bangkok–Krabi route, in both directions, from its domestic pet cargo service.",
    rationale_i18n: {
      fr: "Bangkok Airways exclut la liaison Bangkok–Krabi, dans les deux sens, de son fret animalier intérieur.",
      es: "Bangkok Airways excluye la ruta Bangkok–Krabi, en ambos sentidos, de su servicio nacional de carga de mascotas.",
      pt: "A Bangkok Airways exclui a rota Banguecoque–Krabi, nos dois sentidos, do seu serviço doméstico de carga de animais.",
    },
    source: { ...SOURCE_BASE, quote: "Accept all domestic route Except Bangkok – Krabi v.v. and Chiang Mai – Krabi v.v.",
      locator: "Cargo Service → Pet Carriage Service → bloc des routes disponibles → Domestic Routes" },
  },
  {
    id: "rule_bangkok_airways_cargo_cnx_kbv_excluded",
    scope: { type: "airline", id: "airline_bangkok_airways" },
    category: "placement", criticality: "high",
    applies_when: { all: [CARGO, PET, paire(["airport_cnx"], ["airport_kbv"])] },
    effect: { action: "deny", placement: ["cargo"] },
    params: {},
    rationale: "Bangkok Airways excludes the Chiang Mai–Krabi route, in both directions, from its domestic pet cargo service.",
    rationale_i18n: {
      fr: "Bangkok Airways exclut la liaison Chiang Mai–Krabi, dans les deux sens, de son fret animalier intérieur.",
      es: "Bangkok Airways excluye la ruta Chiang Mai–Krabi, en ambos sentidos, de su servicio nacional de carga de mascotas.",
      pt: "A Bangkok Airways exclui a rota Chiang Mai–Krabi, nos dois sentidos, do seu serviço doméstico de carga de animais.",
    },
    source: { ...SOURCE_BASE, quote: "Accept all domestic route Except Bangkok – Krabi v.v. and Chiang Mai – Krabi v.v.",
      locator: "Cargo Service → Pet Carriage Service → bloc des routes disponibles → Domestic Routes" },
  },
];

const rules = JSON.parse(readFileSync(RULES, "utf8"));
const existants = new Set(rules.map((r) => r.id));
const ajoutees = REGLES.filter((r) => !existants.has(r.id));
for (const r of ajoutees) rules.push(r);
console.log(`[bangkok-fret] ${rules.length - ajoutees.length} → ${rules.length} règles ; ajoutées : ${ajoutees.map((r) => r.id).join(", ") || "aucune"}${dry ? " (dry)" : ""}`);
if (!dry && ajoutees.length) writeFileSync(RULES, JSON.stringify(rules, null, 2) + "\n");
