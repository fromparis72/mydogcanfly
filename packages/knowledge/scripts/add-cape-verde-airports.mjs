#!/usr/bin/env node
/* Les quatre aéroports internationaux du Cap-Vert, ajoutés au référentiel.
 *
 * POURQUOI CE SCRIPT EXISTE. Le site affirmait deux choses contradictoires sur la même
 * destination. La fiche pays `cv` annonçait « TUI Airways dessert ce pays » — c'est vrai,
 * et c'est lu depuis `serves_country_ids`, une liste de PAYS qui n'a besoin d'aucun aéroport
 * pour s'afficher. Le Finder, lui, construit sa liste de destinations en parcourant
 * `kb.airports` : sans aéroport rattaché à `country_cv`, une recherche CDG → Cap-Vert ne
 * proposait AUCUNE destination. Le lecteur voyait donc une compagnie desservir un pays où le
 * site déclarait ne pouvoir aller nulle part.
 *
 * QUEL CÔTÉ ÉTAIT FAUX. Pas `serves_country_ids`. Vérifié le 8 août 2026 sur le site de la
 * compagnie : TUI Airways publie ses propres pages « Flights to Sal » (code SID, direct depuis
 * London Gatwick et Manchester) et « Flights to Boa Vista » (code BVC, direct depuis Gatwick,
 * Manchester, Birmingham et East Midlands). La compagnie dessert bien le Cap-Vert ; c'était le
 * référentiel d'aéroports qui était vide. On comble donc, on ne rabote pas la liste des pays.
 *
 * SOURCES DE CHAQUE CHAMP — aucune coordonnée ni aucun code n'est saisi de mémoire :
 *   — codes IATA : moteur officiel de l'IATA (iata.org/en/publications/directories/code-search).
 *     SID = Sal Island / Amilcar Cabral Intl · RAI = Praia / Praia Intl. ·
 *     BVC = Boa Vista Island / Rabil · VXE = Sao Vicente Island / Sao Pedro.
 *   — coordonnées : point de référence d'aérodrome (ARP) publié dans l'AIP du Cabo Verde,
 *     édité par l'ASA (autorité aéronautique nationale), AIRAC du 22/02/2024, section AD 2.2 —
 *     eaip.asa.cv, fiches GVAC, GVNP, GVBA, GVSV. Les sexagésimales de l'AIP sont converties
 *     en décimales ci-dessous, la conversion est écrite en clair pour être relisible.
 *   — distance à la ville et nom d'exploitation : même AIP (rubrique « Direction and distance
 *     from city ») et site de l'exploitant caboverde-airports.cv (concession ASA / VINCI).
 *
 * PIÈGE : LA VILLE AFFICHÉE. Le Finder étiquette une destination « IATA · ville · pays ». Au
 * Cap-Vert la ville administrative la plus proche n'est presque jamais le nom que le voyageur
 * tape : personne ne cherche « Espargos » ni « Rabil », on cherche « Sal » et « Boa Vista ».
 * On retient donc le nom d'ÎLE tel que l'IATA le publie (Sal Island, Boa Vista Island), et la
 * ville administrative reste dans `info.access`, où elle sert à s'orienter une fois sur place.
 *
 * CE QU'IL N'ÉCRIT PAS. Aucun bloc `pet_relief`. Rien n'est publié sur des aires de
 * soulagement dans ces quatre aéroports ; 107 des 249 aéroports du référentiel n'ont déjà
 * aucun bloc et la fiche se rend très bien sans. Inventer un « available: no » serait une
 * affirmation, pas une absence.
 *
 * IL MET AUSSI À JOUR TUI AIRWAYS : `served_airport_ids` et `direct_routes` vers SID et BVC,
 * lus sur les pages de la compagnie. Sans ça la fiche pays continuerait d'afficher « 0 aéroport »
 * en face de TUI alors que les aéroports existent désormais. Birmingham et East Midlands ne
 * sont pas dans le référentiel : leurs routes sont volontairement omises plutôt qu'inventées.
 *
 * Idempotent : relancer ne duplique rien, ne réécrit rien qui existe déjà.
 *   node packages/knowledge/scripts/add-cape-verde-airports.mjs [--dry]
 */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OBJ = resolve(HERE, "../raw/objects.json");
const dry = process.argv.includes("--dry");

/* Sexagésimal AIP → décimal. Écrit ici plutôt que collé en dur pour que la coordonnée
   reste vérifiable ligne à ligne face à la fiche AD 2.2 correspondante. */
const dms = (d, m, s, hemi) => {
  const v = d + m / 60 + s / 3600;
  return Math.round((hemi === "S" || hemi === "W" ? -v : v) * 10000) / 10000;
};

const OPERATOR = "https://www.caboverde-airports.cv";

const AIRPORTS = [
  {
    // AIP GVAC AD 2.2 : ARP 164415N 0225656W — « 3 KM S of Espargos »
    id: "airport_sid", iata: "SID",
    name: {
      en: "Amílcar Cabral International", fr: "Amílcar-Cabral international",
      es: "Amílcar Cabral internacional", pt: "Amílcar Cabral internacional",
    },
    city: "Sal",
    geo: { lat: dms(16, 44, 15, "N"), lon: dms(22, 56, 56, "W") },
    info: {
      address: "Ilha do Sal, Cabo Verde",
      website: `${OPERATOR}/aeroportos/aeroporto-internacional-amilcar-cabral/`,
      access: {
        en: "On the island of Sal, 3 km south of Espargos; taxis and shared 'aluguer' minibuses run to Espargos and Santa Maria.",
        fr: "Sur l'île de Sal, à 3 km au sud d'Espargos ; taxis et minibus collectifs « aluguer » desservent Espargos et Santa Maria.",
        es: "En la isla de Sal, a 3 km al sur de Espargos; taxis y minibuses compartidos «aluguer» llegan a Espargos y Santa Maria.",
        pt: "Na ilha do Sal, a 3 km a sul dos Espargos; táxis e aluguers ligam aos Espargos e a Santa Maria.",
      },
    },
  },
  {
    // AIP GVNP AD 2.2 : ARP 145631N 0232903W — exploitant : « a cerca de 3 km a nordeste do centro da cidade da Praia »
    id: "airport_rai", iata: "RAI",
    name: {
      en: "Praia Nelson Mandela International", fr: "Praia Nelson-Mandela international",
      es: "Praia Nelson Mandela internacional", pt: "Praia Nelson Mandela internacional",
    },
    city: "Praia",
    geo: { lat: dms(14, 56, 31, "N"), lon: dms(23, 29, 3, "W") },
    info: {
      address: "Praia, Ilha de Santiago, Cabo Verde",
      website: `${OPERATOR}/aeroportos/aeroporto-internacional-nelson-mandela/`,
      access: {
        en: "On the island of Santiago, about 3 km north-east of the centre of Praia, the capital.",
        fr: "Sur l'île de Santiago, à environ 3 km au nord-est du centre de Praia, la capitale.",
        es: "En la isla de Santiago, a unos 3 km al noreste del centro de Praia, la capital.",
        pt: "Na ilha de Santiago, a cerca de 3 km a nordeste do centro da Praia, a capital.",
      },
    },
  },
  {
    // AIP GVBA AD 2.2 : ARP 160814N 0225318W — « 5 KM SE of Sal Rei »
    id: "airport_bvc", iata: "BVC",
    name: {
      en: "Aristides Pereira International", fr: "Aristides-Pereira international",
      es: "Aristides Pereira internacional", pt: "Aristides Pereira internacional",
    },
    city: "Boa Vista",
    geo: { lat: dms(16, 8, 14, "N"), lon: dms(22, 53, 18, "W") },
    info: {
      address: "Rabil, Ilha da Boa Vista, Cabo Verde",
      website: `${OPERATOR}/aeroportos/aeroporto-internacional-aristides-pereira/`,
      access: {
        en: "On the island of Boa Vista, 5 km south-east of Sal Rei, the island's main town.",
        fr: "Sur l'île de Boa Vista, à 5 km au sud-est de Sal Rei, la ville principale de l'île.",
        es: "En la isla de Boa Vista, a 5 km al sureste de Sal Rei, la localidad principal de la isla.",
        pt: "Na ilha da Boa Vista, a 5 km a sudeste de Sal Rei, a principal povoação da ilha.",
      },
    },
  },
  {
    // AIP GVSV AD 2.2 : ARP 165001N 0250316W — « 12 KM SW of Mindelo »
    id: "airport_vxe", iata: "VXE",
    name: {
      en: "Cesária Évora International", fr: "Cesária-Évora international",
      es: "Cesária Évora internacional", pt: "Cesária Évora internacional",
    },
    city: "São Vicente",
    geo: { lat: dms(16, 50, 1, "N"), lon: dms(25, 3, 16, "W") },
    info: {
      address: "São Pedro, Ilha de São Vicente, Cabo Verde",
      website: `${OPERATOR}/aeroportos/aeroporto-internacional-cesaria-evora/`,
      access: {
        en: "On the island of São Vicente, at São Pedro, 12 km south-west of Mindelo.",
        fr: "Sur l'île de São Vicente, à São Pedro, à 12 km au sud-ouest de Mindelo.",
        es: "En la isla de São Vicente, en São Pedro, a 12 km al suroeste de Mindelo.",
        pt: "Na ilha de São Vicente, em São Pedro, a 12 km a sudoeste do Mindelo.",
      },
    },
  },
];

/* Réseau TUI Airways vers le Cap-Vert, lu sur tui.co.uk le 08/08/2026.
   Clé de route : "airport_a|airport_b" trié alphabétiquement, comme partout ailleurs. */
const TUI = {
  id: "airline_tui_airways",
  served: ["airport_sid", "airport_bvc"],
  routes: [
    ["airport_lgw", "airport_sid"],
    ["airport_man", "airport_sid"],
    ["airport_lgw", "airport_bvc"],
    ["airport_man", "airport_bvc"],
  ],
};

const data = JSON.parse(readFileSync(OBJ, "utf8"));
const countryIds = new Set(data.countries.map((c) => c.id));
if (!countryIds.has("country_cv")) {
  console.error("✗ country_cv absent du référentiel : rien à rattacher.");
  process.exit(1);
}

let added = 0, skipped = 0;
for (const a of AIRPORTS) {
  if (data.airports.some((x) => x.id === a.id || x.iata === a.iata)) { skipped++; continue; }
  data.airports.push({ ...a, country_id: "country_cv" });
  added++;
}
data.airports.sort((x, y) => x.id.localeCompare(y.id));

// TUI : on n'ajoute que ce qui manque, et seulement vers des aéroports réellement présents.
const known = new Set(data.airports.map((a) => a.id));
const tui = data.airlines.find((a) => a.id === TUI.id);
let netAdded = 0;
if (tui) {
  tui.served_airport_ids = [...new Set([...(tui.served_airport_ids ?? []), ...TUI.served.filter((i) => known.has(i))])].sort();
  const keys = TUI.routes
    .filter(([a, b]) => known.has(a) && known.has(b))
    .map(([a, b]) => [a, b].sort().join("|"));
  const before = new Set(tui.direct_routes ?? []);
  tui.direct_routes = [...new Set([...before, ...keys])].sort();
  netAdded = tui.direct_routes.length - before.size;
} else {
  console.warn("⚠ airline_tui_airways introuvable : réseau non mis à jour.");
}

if (!dry) writeFileSync(OBJ, JSON.stringify(data, null, 2) + "\n");

console.log(
  `${added} aéroport(s) ajouté(s), ${skipped} déjà présent(s) — total ${data.airports.length}` +
  ` · TUI : ${netAdded} route(s) directe(s) ajoutée(s)${dry ? " (essai à blanc)" : ""}`,
);
