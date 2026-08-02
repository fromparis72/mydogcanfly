#!/usr/bin/env node
/* Set hub_airport_ids for airlines (main operating bases, among OUR airports). Drives the "direct flight"
   heuristic: a route is flagged direct when one endpoint is a hub of the airline. Idempotent; only IATA in
   our airport set are kept. Extend as needed. */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const OBJ = resolve(HERE, "../raw/objects.json");

// airline IATA -> main hub/base airport IATA codes
const HUBS = {
  AF: ["CDG", "ORY"], KL: ["AMS"], LH: ["FRA", "MUC"], SN: ["BRU"],
  U2: ["LGW", "STN", "MAN", "EDI", "CDG", "ORY", "GVA", "BSL", "MXP", "LIN", "BCN", "LIS", "BER", "AMS", "PMI", "NAP"],
  TO: ["ORY", "AMS", "NTE", "LYS", "MRS", "EIN"], BA: ["LHR", "LGW"],
  DL: ["ATL", "DTW", "MSP", "JFK", "SLC", "SEA", "LAX", "BOS"],
  UA: ["ORD", "EWR", "IAD", "DEN", "SFO", "IAH", "LAX"],
  AA: ["DFW", "CLT", "ORD", "MIA", "PHX", "PHL", "LAX", "JFK"],
  AC: ["YYZ", "YUL", "YVR", "YYC"], IB: ["MAD"], TK: ["IST"], A3: ["ATH", "SKG"],
  AM: ["MEX", "MTY"], AH: ["ALG", "ORN", "CZL"], TX: ["ORY"], UX: ["MAD"], AI: ["DEL", "BOM"],
  MK: ["MRU"], TN: ["PPT"], TS: ["YYZ", "YUL", "YVR", "YYC"], AS: ["SEA", "PDX", "SFO", "LAX", "PHX"],
  NH: ["HND", "NRT"], OS: ["VIE"], AV: ["BOG"], CX: ["HKG"], CI: ["TPE", "KHH"], CM: ["PTY"],
  SS: ["ORY"], MS: ["CAI"], EK: ["DXB"], ET: ["ADD"], EY: ["AUH"], EW: ["DUS", "CGN", "HAM", "STR", "BER"],
  BR: ["TPE"], AY: ["HEL"], BF: ["ORY"], I2: ["MAD"], AZ: ["FCO", "LIN"], JL: ["HND", "NRT"],
  B6: ["JFK", "BOS", "EWR"], KE: ["ICN", "GMP"], LA: ["SCL", "LIM", "GRU", "BOG"], LO: ["WAW"],
  DY: ["OSL", "CPH", "ARN", "BGO"], PR: ["MNL", "CEB"], QR: ["DOH"], AT: ["CMN"],
  FR: ["STN", "DUB", "BGY", "CRL", "BCN", "CGN", "BER", "OPO", "MAN", "EDI", "PMI"],
  SK: ["CPH", "OSL", "ARN"], SV: ["JED", "RUH", "DMM"], SQ: ["SIN"], LX: ["ZRH", "GVA"], TP: ["LIS", "OPO"],
  TG: ["BKK"], TU: ["TUN", "DJE"], VN: ["HAN", "SGN", "DAD"],
  V7: ["NTE", "VCE", "BOD", "MRS", "LYS", "PMI", "ATH"], VY: ["BCN", "ORY", "CDG", "MAD", "FCO"],
  WS: ["YYC", "YYZ", "YVR", "YEG"], W6: ["BUD", "OTP", "WAW", "KRK", "GDN", "TIA", "SOF", "BEG"],
  DE: ["FRA"], QS: ["PRG"], VS: ["LHR", "MAN"], VA: ["SYD", "MEL", "BNE", "PER"],
  QF: ["SYD", "MEL", "BNE", "PER"], LY: ["TLV"], CA: ["PEK", "PKX"], CZ: ["CAN"], MU: ["PVG"],
  "6E": ["DEL", "BOM", "BLR", "HYD", "MAA", "CCU"], NZ: ["AKL", "CHC"], EI: ["DUB", "ORK"], MH: ["KUL"], GA: ["CGK", "DPS"],
};

const data = JSON.parse(readFileSync(OBJ, "utf8"));
const airportByIata = new Map();
for (const a of data.airports) if (a.iata) airportByIata.set(a.iata.toUpperCase(), a.id);
const countryOfAirport = new Map(data.airports.map((a) => [a.id, a.country_id]));

let touched = 0; const misses = [];
for (const a of data.airlines) {
  const hubs = HUBS[(a.iata || "").toUpperCase()];
  if (!hubs) continue;
  const ids = [];
  for (const iata of hubs) { const id = airportByIata.get(iata.toUpperCase()); if (id) ids.push(id); else misses.push(`${a.iata}:${iata}`); }
  if (ids.length) {
    a.hub_airport_ids = [...new Set(ids)];
    // A hub is, by definition, served: keep served airports + countries consistent with the hubs.
    const served = new Set(a.served_airport_ids || []);
    const countries = new Set(a.serves_country_ids || []);
    for (const id of ids) { served.add(id); const c = countryOfAirport.get(id); if (c) countries.add(c); }
    a.served_airport_ids = [...served].sort();
    a.serves_country_ids = [...countries].sort();
    touched++;
  }
}
writeFileSync(OBJ, JSON.stringify(data, null, 2) + "\n");
console.log(`Hubs renseignés sur ${touched} compagnies.`);
if (misses.length) console.log("IATA hub non trouvés (ignorés):", misses.join(", "));
