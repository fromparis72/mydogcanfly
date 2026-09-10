import fs from "node:fs";
import path from "node:path";

const DIR = path.dirname(new URL(import.meta.url).pathname);
const INPUTS = ["cohorte-a.tsv", "cohorte-b.tsv", "cohorte-c.tsv"];
const OUTPUT = path.join(DIR, "consolidation-102-compagnies.tsv");
const OUTPUT_JSON = path.join(DIR, "consolidation-102-compagnies.json");
const EXPECTED_DATE = "2026-09-10";
const OUTPUT_HEADER = [
  "airline_id", "channel", "service_class", "service_status_raw", "fare_class", "fare_nature_raw", "amount", "currency",
  "scope_raw", "billing_basis_raw", "booking_deadline", "official_url", "locator",
  "evidence_excerpt", "citation_check", "page_date", "verified_date", "legacy_fee", "legacy_farelist",
  "repo_linkage", "assessment",
];

const fail = (message) => {
  console.error(`ERREUR — ${message}`);
  process.exitCode = 1;
};

const get = (row, ...keys) => keys.map((key) => row[key]).find((value) => value !== undefined) ?? "";
const join = (...values) => values.filter((value) => value && value !== "—").join(" → ") || "—";
const normalizeChannel = (value) => ({ cabine: "cabin", soute: "hold", fret: "cargo" })[value] ?? value;
const serviceClass = (value) => {
  if (["OFFERED", "ACCEPTE"].includes(value)) return "OFFERED";
  if (["CONDITIONAL", "CONDITIONNEL", "OFFERED_CONDITIONAL"].includes(value)) return "CONDITIONAL";
  if (["NOT_OFFERED", "NON_PROPOSE", "NOT_OFFERED_AS_CHECKED_PET", "NOT_OFFERED_AS_PASSENGER_BAGGAGE"].includes(value)) return "NOT_OFFERED";
  if (["NON_ESTABLISHED", "NON_ETABLI"].includes(value)) return "NOT_ESTABLISHED";
  if (["RESTRICTED", "LIMITED_DOMESTIC", "LIMITED_MILITARY_ONLY", "OFFERED_DOMESTIC", "OFFERED_INTERNATIONAL", "OFFERED_LIMITED_ROUTES", "OFFERED_SEPARATELY"].includes(value)) return "LIMITED";
  return "OTHER";
};
const fareClass = (value) => {
  if (["EXACT"].includes(value)) return "EXACT";
  if (["RANGE", "RANGE_EXACT"].includes(value)) return "RANGE";
  if (["GRILLE", "MATRIX", "EXACT_GRID", "FROM_GRID", "OFFICIAL_GRID", "DYNAMIC_GRID_NOT_CAPTURED", "EXACT_OR_GRID"].includes(value)) return "MATRIX";
  if (["FORMULA", "FORMULE", "FORMULA_OR_ROUTE_EXACT"].includes(value)) return "FORMULA";
  if (["CALCULATOR"].includes(value)) return "CALCULATOR";
  if (["STARTING_AT", "MINIMUM"].includes(value)) return "MINIMUM";
  if (["DEVIS", "SUR_DEVIS", "QUOTE", "SUR_DEVIS_COMPOSITE"].includes(value)) return "QUOTE";
  if (["QUOTE_OR_NOT_FOUND", "QUOTE_OR_RATE_CALCULATOR"].includes(value)) return "QUOTE_OR_NOT_FOUND";
  if (["NON_TROUVE", "NOT_FOUND"].includes(value)) return "NOT_FOUND";
  if (["BOOKING_ONLY"].includes(value)) return "BOOKING_ONLY";
  if (["SANS_OBJET", "NOT_APPLICABLE"].includes(value)) return "NOT_APPLICABLE";
  if (["CONFLICT", "CONFLIT"].includes(value)) return "CONFLICT";
  return "OTHER";
};

const citationCheck = (kind, excerpt, assessment) => {
  if (kind === "CONFLICT") return "CONFLICT_DO_NOT_IMPORT";
  if (kind === "NOT_FOUND") return "NO_CURRENT_FARE_FOUND";
  if (kind === "NOT_APPLICABLE") return "NO_FARE_APPLICABLE";
  if (/\bNEEDS_QUOTE\b/.test(`${excerpt} ${assessment}`)) return "LOCATOR_ONLY_REVIEW_BEFORE_IMPORT";
  const provesNumber = /\d|€|\$|£|¥|EUR|USD|CAD|JPY|CNY|RMB|THB|ZAR|KRW|INR|AUD|NZD|CHF|GBP/i.test(excerpt);
  if (["EXACT", "RANGE", "MATRIX", "MINIMUM"].includes(kind)) {
    return provesNumber ? "PRICE_EXCERPT_PRESENT" : "LOCATOR_ONLY_REVIEW_BEFORE_IMPORT";
  }
  if (["FORMULA", "CALCULATOR", "BOOKING_ONLY", "QUOTE", "QUOTE_OR_NOT_FOUND"].includes(kind)) {
    return excerpt && excerpt !== "—" ? "MECHANISM_EXCERPT_PRESENT" : "LOCATOR_ONLY_REVIEW_BEFORE_IMPORT";
  }
  return "REVIEW_BEFORE_IMPORT";
};

const normalize = (row) => {
  const normalizedFareClass = fareClass(get(row, "fare_nature", "tariff_nature"));
  const excerpt = get(row, "evidence_excerpt", "quote_verbatim", "quote_le_25_mots");
  const assessment = get(row, "notes", "note", "assessment");
  return {
    airline_id: row.airline_id,
    channel: normalizeChannel(row.channel),
    service_class: serviceClass(row.service_status),
    service_status_raw: row.service_status,
    fare_class: normalizedFareClass,
    fare_nature_raw: get(row, "fare_nature", "tariff_nature"),
    amount: get(row, "amount", "tariff_value"),
    currency: row.currency,
    scope_raw: get(row, "geography_route", "structured_scope_origin_destination_region")
      || join(row.scope_origin, row.scope_destination),
    billing_basis_raw: get(row, "billing_subject_and_journey_basis")
      || join(row.billing_subject, row.journey_basis),
    booking_deadline: get(row, "reservation_lead", "booking_deadline"),
    official_url: row.official_url || "NON_TROUVE",
    locator: row.locator,
    evidence_excerpt: excerpt,
    citation_check: citationCheck(normalizedFareClass, excerpt, assessment),
    page_date: get(row, "page_date", "page_date_visible"),
    verified_date: row.verified_date,
    legacy_fee: get(row, "legacy_fee", "old_yaml_fee", "yaml_legacy"),
    legacy_farelist: get(row, "legacy_farelist", "old_farelist_rows"),
    repo_linkage: get(row, "repo_linkage", "policies_finder_wiring")
      || join(row.policy_tariff_source, row.finder_price_link),
    assessment,
  };
};

const parsed = [];
for (const input of INPUTS) {
  const file = path.join(DIR, input);
  if (!fs.existsSync(file)) {
    fail(`${input} absent`);
    continue;
  }
  const lines = fs.readFileSync(file, "utf8").replace(/\r/g, "").trimEnd().split("\n");
  const header = lines.shift()?.split("\t") ?? [];
  if (lines.length !== 102) fail(`${input} : ${lines.length} lignes, 102 attendues`);
  for (const [index, line] of lines.entries()) {
    const cells = line.split("\t");
    if (cells.length !== header.length) {
      fail(`${input}:${index + 2} : ${cells.length} champs, ${header.length} attendus`);
      continue;
    }
    const raw = Object.fromEntries(header.map((key, i) => [key, cells[i]]));
    parsed.push(normalize(raw));
  }
}

const seen = new Set();
const byAirline = new Map();
for (const row of parsed) {
  const key = `${row.airline_id}:${row.channel}`;
  if (seen.has(key)) fail(`doublon ${key}`);
  seen.add(key);
  if (!["cabin", "hold", "cargo"].includes(row.channel)) fail(`${key} : canal inconnu`);
  if (row.verified_date !== EXPECTED_DATE) fail(`${key} : verified_date=${row.verified_date}`);
  if (!/^https:\/\//.test(row.official_url)) {
    const absenceExpliquee = row.official_url === "NON_TROUVE"
      && /NON_(?:ETABLI|TROUVE)|NOT_(?:ESTABLISHED|FOUND)/.test(`${row.service_status_raw} ${row.fare_nature_raw}`)
      && row.assessment.length > 0;
    if (!absenceExpliquee) fail(`${key} : URL officielle absente ou non HTTPS sans état d'absence explicite`);
  }
  const channels = byAirline.get(row.airline_id) ?? new Set();
  channels.add(row.channel);
  byAirline.set(row.airline_id, channels);
}

if (parsed.length !== 306) fail(`${parsed.length} lignes au total, 306 attendues`);
if (byAirline.size !== 102) fail(`${byAirline.size} compagnies, 102 attendues`);
for (const [airline, channels] of byAirline) {
  if (channels.size !== 3) fail(`${airline} : canaux présents ${[...channels].sort().join(", ")}`);
}

if (!process.exitCode) {
  const sorted = parsed
    .sort((a, b) => a.airline_id.localeCompare(b.airline_id) || a.channel.localeCompare(b.channel));
  const rows = sorted
    .map((row) => OUTPUT_HEADER.map((key) => row[key]).join("\t"));
  fs.writeFileSync(OUTPUT, `${OUTPUT_HEADER.join("\t")}\n${rows.join("\n")}\n`);
  const countBy = (key) => Object.fromEntries(
    [...sorted.reduce((counts, row) => {
      counts.set(row[key], (counts.get(row[key]) ?? 0) + 1);
      return counts;
    }, new Map())].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
  );
  const payload = {
    schema_version: 1,
    generated_at: EXPECTED_DATE,
    source_files: INPUTS,
    invariants: {
      airlines: byAirline.size,
      channels: parsed.length,
      channels_per_airline: 3,
      duplicates: 0,
      verified_date: EXPECTED_DATE,
    },
    counts: {
      by_channel: countBy("channel"),
      by_fare_class: countBy("fare_class"),
      by_service_class: countBy("service_class"),
      by_service_status_raw: countBy("service_status_raw"),
      by_citation_check: countBy("citation_check"),
    },
    records: sorted,
  };
  fs.writeFileSync(OUTPUT_JSON, `${JSON.stringify(payload, null, 2)}\n`);
  console.log(`OK — ${byAirline.size} compagnies, ${parsed.length} lignes, aucun doublon, trois canaux chacune`);
  console.log(OUTPUT);
  console.log(OUTPUT_JSON);
}
