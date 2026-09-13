#!/usr/bin/env node
/**
 * Importe uniquement les lignes dont l'extrait consolidé porte lui-même le prix ou un mécanisme
 * tarifaire explicite. Les anciens `fee`/`fareList` ne sont jamais lus.
 *
 * Usage :
 *   node mesures/politiques-veracite/importer-tarifs-verifies.mjs \
 *     /chemin/vers/consolidation-102-compagnies.json
 *
 * La collecte est verrouillée par son empreinte : changer une phrase, une URL ou un montant exige
 * un nouveau lot nommé, pas un rejeu silencieux sur un autre fichier.
 */
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { resolve, join } from "node:path";
import YAML from "yaml";

const EXPECTED_SHA256 = "c5efcd57c175a3735bf5c87896e6f3e03900aea88f7a9a32db43184fce31c52b";
const auditPath = process.argv[2];
if (!auditPath) throw new Error("chemin du fichier consolidation-102-compagnies.json requis");
const bytes = readFileSync(resolve(auditPath));
const sha = createHash("sha256").update(bytes).digest("hex");
if (sha !== EXPECTED_SHA256) throw new Error(`collecte inattendue : sha256 ${sha}, attendu ${EXPECTED_SHA256}`);
const audit = JSON.parse(bytes.toString("utf8"));
if (!Array.isArray(audit.records) || audit.records.length !== 306) throw new Error("collecte incomplète : 306 lignes attendues");

const ROOT = resolve(import.meta.dirname, "../..");
const AIRLINES = join(ROOT, "content/airlines");
const files = readdirSync(AIRLINES).filter((f) => /\.ya?ml$/.test(f));
const bySlug = new Map();
for (const file of files) {
  const path = join(AIRLINES, file);
  const raw = YAML.parse(readFileSync(path, "utf8"));
  const id = String(raw?.id ?? "").replace(/^airline_/, "");
  if (id) bySlug.set(id, { path, raw });
}

const CURRENCIES = ["USD", "EUR", "CAD", "CHF", "JPY", "XPF", "AUD", "NZD", "DKK", "NOK", "SEK", "GBP", "CZK", "PLN", "HUF", "AED", "TRY", "PHP", "MAD", "THB", "INR", "RMB", "VND", "TND", "CNY", "KRW", "ZAR"];
const codeRe = CURRENCIES.join("|");

const number = (s) => {
  let v = s.trim().replace(/\s+/g, "");
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(v)) v = v.replace(/[.,]/g, "");
  else if (/^\d+[,.]\d{1,2}$/.test(v)) v = v.replace(",", ".");
  else v = v.replace(/,/g, "");
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const quoteText = (s) => String(s ?? "").replace(/^[“”\"]+|[“”\"]+$/g, "").trim();
const language = (q) => {
  if (/\b(?:Voos|desde|deverá|carga)\b/i.test(q)) return "pt";
  if (/\b(?:Animale|stiva)\b/i.test(q)) return "it";
  if (/\b(?:pro Tier|einfache Strecke|ab )\b/i.test(q)) return "de";
  if (/\b(?:par trajet|transport en fret|démarches|jusqu['’]a|plus que)\b/i.test(q)) return "fr";
  return "en";
};

const addAmount = (out, currency, raw) => {
  const amount = number(raw);
  if (amount == null || amount < 0) return;
  out.push({ amount, currency });
};

const amountsFromQuote = (quote, currencyHint) => {
  const out = [];
  const spans = [];
  let m;
  const NUM = "(?:[0-9]{1,3}(?:[ ,.'’][0-9]{3})+|[0-9]+(?:[.,][0-9]{1,2})?)";
  const overlaps = (start, end) => spans.some(([a, b]) => start < b && end > a);
  const add = (currency, raw, start, end) => {
    if (overlaps(start, end)) return;
    addAmount(out, currency.toUpperCase(), raw);
    spans.push([start, end]);
  };
  const groupIndex = (match, group, last = false) =>
    match.index + (last ? match[0].lastIndexOf(group) : match[0].indexOf(group));

  /* Une même somme peut être publiée dans deux devises équivalentes sans répéter le nombre
     (« $150 USD/CAD »). C'est la seule forme où deux devises consomment le même intervalle. */
  const sharedDollar = new RegExp(`\\$?\\s*(${NUM})\\s*(USD|CAD|AUD|NZD)\\s*\\/\\s*(USD|CAD|AUD|NZD)\\b`, "gi");
  while ((m = sharedDollar.exec(quote))) {
    const i = groupIndex(m, m[1]);
    addAmount(out, m[2].toUpperCase(), m[1]);
    addAmount(out, m[3].toUpperCase(), m[1]);
    spans.push([i, i + m[1].length]);
  }

  /* Une devise peut n'être écrite qu'une fois pour les deux bornes. Ces formes doivent être
     consommées avant les valeurs isolées. */
  const prefixRange = new RegExp(`\\b(${codeRe})\\s*\\$?\\s*(${NUM})\\s*(?:to|[-–—])\\s*(${NUM})`, "gi");
  while ((m = prefixRange.exec(quote))) {
    const a = groupIndex(m, m[2]), b = groupIndex(m, m[3], true);
    add(m[1], m[2], a, a + m[2].length);
    add(m[1], m[3], b, b + m[3].length);
  }
  const suffixRange = new RegExp(`(${NUM})\\s*(?:to|[-–—])\\s*(${NUM})\\s*(${codeRe})\\b`, "gi");
  while ((m = suffixRange.exec(quote))) {
    const a = groupIndex(m, m[1]), b = groupIndex(m, m[2], true);
    add(m[3], m[1], a, a + m[1].length);
    add(m[3], m[2], b, b + m[2].length);
  }

  /* Les formes préfixées ont priorité. La consommation de la position numérique empêche
     « CHF 75 EUR 65 USD 80 » de devenir aussi « 75 EUR » puis « 65 USD ». */
  const before = new RegExp(`\\b(${codeRe})\\s*\\$?\\s*(${NUM})`, "gi");
  while ((m = before.exec(quote))) {
    const i = groupIndex(m, m[2]);
    add(m[1], m[2], i, i + m[2].length);
  }
  const after = new RegExp(`(${NUM})\\s*(${codeRe})\\b`, "gi");
  while ((m = after.exec(quote))) {
    const i = groupIndex(m, m[1]);
    add(m[2], m[1], i, i + m[1].length);
  }
  for (const [symbol, currency] of [["€", "EUR"], ["£", "GBP"]]) {
    const prefix = new RegExp(`${symbol}\\s*(${NUM})`, "g");
    while ((m = prefix.exec(quote))) { const i = groupIndex(m, m[1]); add(currency, m[1], i, i + m[1].length); }
    const suffix = new RegExp(`(${NUM})\\s*${symbol}`, "g");
    while ((m = suffix.exec(quote))) { const i = groupIndex(m, m[1]); add(currency, m[1], i, i + m[1].length); }
  }
  const euroWord = new RegExp(`(${NUM})\\s*euros?\\b`, "gi");
  while ((m = euroWord.exec(quote))) { const i = groupIndex(m, m[1]); add("EUR", m[1], i, i + m[1].length); }
  const hinted = String(currencyHint).match(/\b(?:USD|CAD|AUD|NZD)\b/g) ?? [];
  if (hinted.length === 1) {
    const dollar = new RegExp(`\\$\\s*(${NUM})`, "g");
    while ((m = dollar.exec(quote))) { const i = groupIndex(m, m[1]); add(hinted[0], m[1], i, i + m[1].length); }
    const dollarSuffix = new RegExp(`(${NUM})\\s*\\$`, "g");
    while ((m = dollarSuffix.exec(quote))) { const i = groupIndex(m, m[1]); add(hinted[0], m[1], i, i + m[1].length); }
  }
  return [...new Map(out.map((x) => [`${x.currency}:${x.amount}`, x])).values()];
};

const billingSubject = (raw) => {
  const s = String(raw).toLowerCase();
  if (/per kg|par kg|kilogram|poids\//.test(s)) return "kilogram";
  if (/shipment|envoi|air waybill|awb/.test(s)) return "shipment";
  if (/booking|réservation/.test(s)) return "booking";
  if (/container|carrier|kennel|cage|contenant|crate/.test(s) && /pet\+|animal\+|chien\+/.test(s)) return "pet_or_container";
  if (/container|carrier|kennel|cage|contenant|crate/.test(s)) return "container";
  if (/pet|animal|chien/.test(s)) return "pet";
  return "pet_or_container";
};

const journeyBasis = (raw) => {
  const s = String(raw).toLowerCase();
  if (/round.trip|aller.retour/.test(s)) return "per_round_trip";
  if (/segment|sector|flight|vol|leg|tronçon/.test(s)) return "per_segment";
  if (/one.way|each way|per way|per direction|par direction|par sens|aller simple/.test(s)) return "per_one_way";
  return "per_journey";
};

const strongMechanism = (r, q) => {
  if (["FORMULA", "CALCULATOR", "BOOKING_ONLY"].includes(r.fare_class)) return /baggage|cost|rate|charge|calcul|booking|réservation|kg|unit|fee/i.test(q);
  if (r.fare_class !== "QUOTE") return false;
  return /quote|quoted|devis|contact|freight forwarder|specialised|approved agent|reservations office|booking|sur devis|cargo team|cargo agent|handling/i.test(q);
};

const kindOfMechanism = (r) => ({ FORMULA: "formula", CALCULATOR: "calculator", BOOKING_ONLY: "booking_only", QUOTE: "quote" })[r.fare_class];
const candidates = [];
const skipped = [];
for (const r of audit.records) {
  const quote = quoteText(r.evidence_excerpt);
  if (quote.length < 10) { skipped.push({ ...r, reason: "citation trop courte" }); continue; }
  if (r.citation_check === "PRICE_EXCERPT_PRESENT") {
    const amounts = amountsFromQuote(quote, r.currency);
    if (!amounts.length) { skipped.push({ ...r, reason: "aucun montant non ambigu dans la citation" }); continue; }
    for (const [currency, valuesRaw] of Object.entries(Object.groupBy(amounts, (x) => x.currency))) {
      const values = [...new Set(valuesRaw.map((x) => x.amount))].sort((a, b) => a - b);
      // « ranges from 70 to 500 » porte deux bornes : `from` ne signifie
      // « minimum » que lorsqu'une seule valeur est effectivement publiée.
      const minimum = values.length === 1 && /\b(?:from|desde|ab)\b/i.test(quote);
      const kind = values.length > 1 ? "range" : minimum ? "minimum" : "exact";
      candidates.push({ r, quote, currency, kind, values: kind === "range" ? [values[0], values.at(-1)] : [values[0]] });
    }
  } else if (r.citation_check === "MECHANISM_EXCERPT_PRESENT" && strongMechanism(r, quote)) {
    candidates.push({ r, quote, kind: kindOfMechanism(r), values: [] });
  }
}

const faresByKey = new Map();
for (const c of candidates) {
  const { r, quote } = c;
  const item = bySlug.get(r.airline_id);
  if (!item) throw new Error(`fiche absente pour ${r.airline_id}`);
  if (!item.raw?.policies?.[r.channel]) { skipped.push({ ...r, reason: "politique de canal absente" }); continue; }
  const suffix = c.currency ? `_${c.currency.toLowerCase()}` : "";
  const id = `fare_${r.airline_id}_${r.channel}${suffix}_2026_09_10`;
  const fare = {
    id,
    placement: r.channel,
    price: { kind: c.kind, amounts: c.values.map((amount) => ({ amount, currency: c.currency })) },
    billing_subject: billingSubject(r.billing_basis_raw),
    journey_basis: journeyBasis(r.billing_basis_raw),
    ...(r.scope_raw && r.scope_raw !== "—" && r.scope_raw !== "ND" ? { scope_label: r.scope_raw } : {}),
    source: {
      url: r.official_url,
      source_type: "official_website",
      verified_date: "2026-09-10",
      review_due: "2026-12-09",
      confidence: 4,
      reviewer: "Codex — lecture directe de la source officielle",
      history: [],
      quote,
      quote_language: language(quote),
      locator: r.locator,
    },
  };
  const key = `${r.airline_id}#${r.channel}`;
  faresByKey.set(key, [...(faresByKey.get(key) ?? []), fare]);
}

let changed = 0;
const changedFiles = new Set();
for (const [key, fares] of faresByKey) {
  const [slug, channel] = key.split("#");
  const item = bySlug.get(slug);
  const current = item.raw.policies[channel].fares ?? [];
  if (current.length) {
    const prefix = `fare_${slug}_${channel}`;
    if (current.some((f) => !String(f.id ?? "").startsWith(prefix) || !String(f.id).endsWith("_2026_09_10"))) {
      throw new Error(`${key} porte déjà un inventaire qui n'appartient pas à cet import daté`);
    }
  }
  const text = readFileSync(item.path, "utf8");
  const lines = text.split("\n");
  const policies = lines.findIndex((line) => line === "policies:");
  const channelLine = lines.findIndex((line, i) => i > policies && line === `  ${channel}:`);
  if (channelLine < 0) throw new Error(`bloc policies.${channel} introuvable dans ${item.path}`);
  const block = YAML.stringify({ fares }, { lineWidth: 0 }).trimEnd().split("\n").map((line) => `    ${line}`);
  const generated = ["    # TARIFS OFFICIELS — audit indépendant du 2026-09-10 ; aucune valeur héritée réactivée.", ...block];
  let end = channelLine + 1;
  if (current.length) {
    if (lines[end] !== generated[0]) throw new Error(`${key} porte des tarifs qui ne viennent pas de cet importeur`);
    end++;
    while (end < lines.length && !/^    (?!fares:)[A-Za-z_][A-Za-z0-9_-]*:/.test(lines[end])) end++;
  }
  const previous = lines.slice(channelLine + 1, end);
  if (previous.join("\n") === generated.join("\n")) continue;
  lines.splice(channelLine + 1, end - channelLine - 1, ...generated);
  writeFileSync(item.path, lines.join("\n"));
  changed++;
  changedFiles.add(item.path);
}

const imported = [...faresByKey.values()].flat();
console.log(`✓ ${imported.length} ligne(s) tarifaire(s) prouvée(s), ${faresByKey.size} canal(aux), ${new Set([...faresByKey.keys()].map((k) => k.split("#")[0])).size} compagnie(s)`);
console.log(`✓ ${changed} canal(aux) modifié(s) dans ${changedFiles.size} fiche(s), collecte sha256 ${sha}`);
console.log(`• ${skipped.length} ligne(s) non importée(s), dont ${skipped.filter((x) => x.reason === "citation trop courte").length} citation(s) trop courte(s)`);
