// Ingest hand-authored Hub guides (Markdown + frontmatter) into guides.json.
// Resolves {{fait: entity_id | description}} markers against the knowledge base,
// localizes standard section headers, converts the body to HTML.
//
//   node packages/knowledge/scripts/ingest-guides.mjs
//
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");                       // repo root
const DRAFTS = join(ROOT, "content", "hub", "drafts");
const OBJECTS = join(HERE, "..", "raw", "objects.json");
const OUT = join(HERE, "..", "raw", "guides.json");

const objects = JSON.parse(readFileSync(OBJECTS, "utf8"));
const airlineById = Object.fromEntries(objects.airlines.map((a) => [a.id, a]));
const rulesArr = JSON.parse(readFileSync(join(HERE, "..", "raw", "rules.json"), "utf8"));

// Derive placement facts from the rules (fallback when an airline has no premium.policy).
function findWeight(pred) {
  let out = null;
  (function walk(p) {
    if (!p || typeof p !== "object") return;
    if (p.all) p.all.forEach(walk); if (p.any) p.any.forEach(walk); if (p.not) walk(p.not);
    if (p.fact === "dog.weight_kg" && (p.op === "gt" || p.op === "gte")) out = p.value;
  })(pred);
  return out;
}
function ruleFacts(id) {
  const rs = rulesArr.filter((r) => (r.scope.type === "airline" && r.scope.id === id) || r.scope.type === "global");
  let cabinAllowed = true, cabinMax = null, holdAllowed = true, holdMax = null, cargoAllowed = true;
  for (const r of rs) {
    if (r.effect?.action !== "deny") continue;
    const pl = r.effect.placement || [];
    const w = findWeight(r.applies_when);
    const conditional = /dog\.weight_kg|dog\.brachycephalic|weather/.test(JSON.stringify(r.applies_when));
    if (pl.includes("cabin")) { if (w != null) cabinMax = Math.min(cabinMax ?? Infinity, w); else if (!conditional) cabinAllowed = false; }
    if (pl.includes("hold")) { if (w != null) holdMax = Math.min(holdMax ?? Infinity, w); else if (!conditional) holdAllowed = false; }
    if (pl.includes("cargo") && !conditional && w == null) cargoAllowed = false;
  }
  return { cabinAllowed, cabinMax: cabinMax === Infinity ? null : cabinMax, holdAllowed, holdMax: holdMax === Infinity ? null : holdMax, cargoAllowed };
}

// ============================================================================
//  V3 — MyDogCanFly identity card: rating, travel difficulty, summaries.
//  Everything is DERIVED from the KB (rules + airline object). No hardcoded
//  per-airline values. Templates only display {{fait:}} markers.
// ============================================================================
const airportById = Object.fromEntries((objects.airports || []).map((a) => [a.id, a]));

// Airlines whose home country enforces heavy import/quarantine procedures.
const EXPERT_AIRLINES = new Set(["airline_qantas", "airline_virgin_australia", "airline_ana", "airline_jal", "airline_air_tahiti_nui"]);

// Unified placement facts, working for premium.policy airlines and rule-derived ones.
function facts(id) {
  const a = airlineById[id];
  const aRules = rulesArr.filter((r) => r.scope?.id === id);
  const hasCategoryBan = aRules.some((r) => r.category === "breed_ban" && !/brachy/i.test(r.id));
  const brachyRule = aRules.some((r) => /brachy/i.test(r.id)) || rulesArr.some((r) => r.scope?.type === "global" && /brachy/i.test(r.id));
  if (a && a.premium && a.premium.policy) {
    const p = a.premium.policy;
    return {
      cabinAllowed: !!p.cabin?.allowed, cabinMax: p.cabin?.max_weight_kg ?? null,
      holdAllowed: !!p.hold?.allowed, holdMax: p.hold?.max_weight_kg ?? null,
      cargoAllowed: !!p.cargo?.allowed, brachyRule, hasCategoryBan,
    };
  }
  const rf = ruleFacts(id);
  return { ...rf, brachyRule, hasCategoryBan };
}

const serveCount = (id) => (airlineById[id]?.serves_country_ids || []).length;

// ---- rating out of 100 (spec V3 §3) ----------------------------------------
function ratingBreakdown(id) {
  const a = airlineById[id];
  const f = facts(id);
  const anyPet = f.cabinAllowed || f.holdAllowed || f.cargoAllowed;
  // Cabin /20
  let cabin = 0;
  if (f.cabinAllowed) cabin = f.cabinMax == null ? 16 : f.cabinMax >= 8 ? 20 : f.cabinMax >= 6 ? 16 : 12;
  // Hold /20
  let hold = f.holdAllowed ? 20 : (f.cargoAllowed ? 10 : 0);
  // Large dogs /15
  let large = 0;
  if (f.holdAllowed) large = f.holdMax == null ? 13 : f.holdMax >= 40 ? 15 : f.holdMax >= 20 ? 10 : 8;
  else if (f.cargoAllowed) large = 8;
  // Rule simplicity /10
  let simplicity = (f.cabinAllowed && f.holdAllowed) ? 10 : (f.cabinAllowed || f.holdAllowed) ? 6 : (f.cargoAllowed ? 3 : 2);
  // Documentation quality /10
  let doc = (a?.premium?.policy) ? 10 : Math.max(2, Math.min(10, (a?.source?.confidence ?? 3) * 2));
  // Network coverage /10
  const n = serveCount(id);
  let network = n >= 60 ? 10 : n >= 40 ? 8 : n >= 20 ? 6 : n >= 8 ? 4 : 2;
  // Breed policy /10 (snub-nosed hold restriction is industry-wide; extra category bans cost more)
  let breed;
  if (!f.holdAllowed && !f.cargoAllowed) breed = f.cabinAllowed ? 9 : 5; // cabin-only: brachy fine in cabin
  else breed = f.hasCategoryBan ? 4 : 7;
  // Assistance dogs /5
  let assistance = anyPet ? 5 : 5; // recognised assistance dogs accepted on every carrier
  const parts = { cabin, hold, large, simplicity, doc, network, breed, assistance };
  const points = Math.max(0, Math.min(100, Object.values(parts).reduce((s, v) => s + v, 0)));
  const score = Math.round((points / 20) * 10) / 10;
  return { points, score, parts };
}
function ratingFor(id) { return ratingBreakdown(id); }

// ---- travel difficulty (spec V3 §4) ----------------------------------------
function difficultyLevel(id) {
  const f = facts(id);
  const anyPet = f.cabinAllowed || f.holdAllowed || f.cargoAllowed;
  if (!anyPet) return "none";
  if (EXPERT_AIRLINES.has(id)) return "expert";
  if (!f.cabinAllowed) return "complex";                    // hold/cargo only for companion dogs
  if (f.cabinAllowed && !f.holdAllowed) return "easy";      // small dog in cabin, simplest
  return "moderate";
}
const DIFFICULTY = {
  none:     { emoji: "🚫", en: "Not available", fr: "Non disponible" },
  easy:     { emoji: "🟢", en: "Easy", fr: "Facile" },
  moderate: { emoji: "🟡", en: "Moderate", fr: "Modéré" },
  complex:  { emoji: "🟠", en: "Complex", fr: "Complexe" },
  expert:   { emoji: "🔴", en: "Expert", fr: "Expert" },
};
function difficultyLabel(id, locale) {
  const d = DIFFICULTY[difficultyLevel(id)];
  return `${d.emoji} ${locale === "fr" ? d.fr : d.en}`;
}
function difficultyExplanation(id, locale) {
  const lvl = difficultyLevel(id);
  const fr = locale === "fr";
  const map = {
    none: fr ? "Cette compagnie ne transporte pas les chiens de compagnie (chiens d'assistance exceptés). Il faudra choisir une autre compagnie." : "This airline does not carry companion dogs (assistance dogs excepted). You will need to choose another airline.",
    easy: fr ? "Voyage simple : petit chien en cabine, très peu de contraintes. Réservation conseillée et passeport européen à jour." : "Simple journey: a small dog in the cabin with very few constraints. Book ahead and keep an up-to-date EU pet passport.",
    moderate: fr ? "Voyage généralement simple, mais réservation obligatoire, capacité limitée et formalités du pays de destination à vérifier." : "Generally straightforward, but reservation is required, pet capacity is limited and destination-country paperwork must be checked.",
    complex: fr ? "Plusieurs contraintes opérationnelles : les chiens voyagent en soute ou en fret spécialisé, avec davantage de documents et de préparation." : "Several operational constraints: dogs travel in the hold or as specialised cargo, with more documentation and preparation.",
    expert: fr ? "Préparation administrative longue : permis d'importation, validation officielle et quarantaine possible selon l'origine (Australie, Japon, Polynésie…)." : "Long administrative preparation: import permits, official approval and possible quarantine depending on origin (Australia, Japan, French Polynesia…).",
  };
  return map[lvl];
}

// ---- metadata cells --------------------------------------------------------
const ALLIANCE_LABEL = { star_alliance: "Star Alliance", oneworld: "oneworld", skyteam: "SkyTeam", none: "—" };
function allianceLabel(id) { return ALLIANCE_LABEL[airlineById[id]?.alliance || "none"] || "—"; }
function networkLabel(id, locale) {
  const n = serveCount(id);
  const fr = locale === "fr";
  if (n >= 60) return fr ? "Mondial" : "Worldwide";
  if (n >= 30) return fr ? "Intercontinental" : "Intercontinental";
  if (n >= 12) return fr ? "Continental" : "Continental";
  if (n >= 2) return fr ? "Régional" : "Regional";
  return fr ? "Domestique" : "Domestic";
}
function priceLevel(id) {
  const fees = airlineById[id]?.fees || {};
  const nums = [];
  for (const v of Object.values(fees)) { const m = String(v).match(/(\d[\d\s.,]*)/g); if (m) m.forEach((x) => nums.push(parseInt(x.replace(/[^\d]/g, ""), 10))); }
  const max = nums.length ? Math.max(...nums.filter((x) => !isNaN(x))) : null;
  if (max == null) { // fall back on model: LCC cheap, premium/expert dearer
    const lvl = difficultyLevel(id);
    return lvl === "easy" ? "$" : (lvl === "expert" || lvl === "complex") ? "$$$" : "$$";
  }
  return max >= 300 ? "$$$" : max >= 100 ? "$$" : "$";
}
function mainHub(id, locale) {
  const hubs = airlineById[id]?.hub_airport_ids || [];
  const names = hubs.slice(0, 3).map((h) => {
    const ap = airportById[h]; if (!ap) return null;
    const nm = ap.city || (ap.name && (ap.name[locale] || ap.name.en)) || ap.iata;
    return ap.iata ? `${nm} (${ap.iata})` : nm;
  }).filter(Boolean);
  return names.length ? names.join(" · ") : "—";
}

// ---- one-line summaries for the identity-card table ------------------------
function cabinSummary(id, locale) {
  const f = facts(id); const fr = locale === "fr";
  if (!f.cabinAllowed) return fr ? "❌ non acceptée" : "❌ not accepted";
  const w = f.cabinMax ?? 8;
  return fr ? `✅ jusqu'à ${w} kg` : `✅ up to ${w} kg`;
}
function holdSummary(id, locale) {
  const f = facts(id); const fr = locale === "fr";
  if (f.holdAllowed) { const w = f.holdMax ? (fr ? ` jusqu'à ${f.holdMax} kg` : ` up to ${f.holdMax} kg`) : ""; return (fr ? "✅ soute" : "✅ hold") + w; }
  if (f.cargoAllowed) return fr ? "🔶 fret uniquement" : "🔶 cargo only";
  return fr ? "❌ non disponible" : "❌ not available";
}
function cargoSummary(id, locale) {
  const f = facts(id); const fr = locale === "fr";
  return f.cargoAllowed ? (fr ? "✅ disponible" : "✅ available") : (fr ? "—" : "—");
}
function assistanceSummary(id, locale) {
  return locale === "fr" ? "✅ cabine (sur justificatifs)" : "✅ cabin (with documents)";
}
function breedSummary(id, locale) {
  const f = facts(id); const fr = locale === "fr";
  if (!f.holdAllowed && !f.cargoAllowed) return fr ? "✅ minimes (cabine)" : "✅ minimal (cabin)";
  if (f.hasCategoryBan) return fr ? "⚠️ museau écrasé + catégories" : "⚠️ snub-nosed + category dogs";
  return fr ? "⚠️ museau écrasé (soute)" : "⚠️ snub-nosed (hold)";
}

// ---- recommended_for / drawbacks / strengths / limitations -----------------
function positives(id, locale) {
  const f = facts(id); const fr = locale === "fr"; const n = serveCount(id); const out = [];
  if (f.cabinAllowed) out.push(fr ? `Petits chiens acceptés en cabine (jusqu'à ${f.cabinMax ?? 8} kg)` : `Small dogs travel in the cabin (up to ${f.cabinMax ?? 8} kg)`);
  if (f.holdAllowed) out.push(fr ? "Chiens moyens et grands acceptés en soute" : "Medium and large dogs accepted in the hold");
  if (!f.holdAllowed && f.cargoAllowed) out.push(fr ? "Grands chiens possibles via un service cargo dédié" : "Large dogs possible via a dedicated cargo service");
  if (n >= 40) out.push(fr ? "Vaste réseau international" : "Extensive international network");
  if (allianceLabel(id) !== "—") out.push(fr ? `Correspondances ${allianceLabel(id)}` : `${allianceLabel(id)} connectivity`);
  if (airlineById[id]?.premium?.policy || (airlineById[id]?.source?.confidence ?? 0) >= 4) out.push(fr ? "Politique animaux claire et bien documentée" : "Clear, well-documented pet policy");
  return out;
}
function negatives(id, locale) {
  const f = facts(id); const fr = locale === "fr"; const n = serveCount(id); const out = [];
  const anyPet = f.cabinAllowed || f.holdAllowed || f.cargoAllowed;
  if (!anyPet) { out.push(fr ? "Chiens de compagnie non transportés (chiens d'assistance uniquement)" : "Companion dogs not carried (assistance dogs only)"); return out; }
  if (!f.cabinAllowed && (f.holdAllowed || f.cargoAllowed)) out.push(fr ? "Pas de transport en cabine pour les chiens de compagnie" : "No cabin travel for companion dogs");
  if (!f.cabinAllowed && !f.holdAllowed && f.cargoAllowed) out.push(fr ? "Transporteur animalier spécialisé requis" : "Specialist pet shipper required");
  if (!f.holdAllowed && !f.cargoAllowed && f.cabinAllowed) out.push(fr ? "Grands chiens non acceptés" : "Large dogs cannot travel");
  if (f.hasCategoryBan) out.push(fr ? "Races de catégorie soumises à restrictions" : "Category/fighting breeds restricted");
  if (f.holdAllowed || f.cargoAllowed) out.push(fr ? "Races au museau écrasé exclues de la soute" : "Snub-nosed breeds excluded from the hold");
  if (difficultyLevel(id) === "expert") out.push(fr ? "Formalités d'importation strictes selon la destination" : "Strict destination import rules");
  if (n < 12) out.push(fr ? "Réseau limité" : "Limited route network");
  return out;
}
function padList(arr, k, filler) { const out = arr.slice(0, k); while (out.length < k) out.push(filler); return out; }
// Pad to k items using DISTINCT generic-but-true fillers (never repeat a bullet).
const STRENGTH_FILL = {
  en: ["Recognised assistance dogs travel in the cabin", "Clear, documented booking process", "Pets handled to the airline's welfare standards"],
  fr: ["Chiens d'assistance acceptés en cabine", "Processus de réservation clair et documenté", "Animaux pris en charge selon les standards de bien-être"],
};
const LIMIT_FILL = {
  en: ["Reservation required and limited pet capacity", "Destination-country import paperwork required", "Advance booking strongly recommended"],
  fr: ["Réservation obligatoire et capacité limitée", "Formalités d'importation du pays de destination à prévoir", "Réservation anticipée fortement recommandée"],
};
function padUnique(arr, k, pool) {
  const out = [...new Set(arr)];
  for (const f of pool) { if (out.length >= k) break; if (!out.includes(f)) out.push(f); }
  return out.slice(0, k);
}
function recommendedFor(id, locale) {
  const f = facts(id); const fr = locale === "fr"; const bits = [];
  if (f.cabinAllowed && (f.cabinMax ?? 8) <= 10) bits.push(fr ? "petits chiens" : "small dogs");
  if (f.holdAllowed) bits.push(fr ? "chiens moyens et grands" : "medium & large dogs");
  if (!f.cabinAllowed && !f.holdAllowed && f.cargoAllowed) bits.push(fr ? "déménagements internationaux" : "international relocations");
  if (f.holdAllowed && serveCount(id) >= 40) bits.push(fr ? "trajets long-courriers" : "long-haul travel");
  if (!bits.length) return fr ? "chiens d'assistance" : "assistance dogs";
  return bits.slice(0, 2).join(", ");
}
function drawbacks(id, locale) {
  const neg = negatives(id, locale);
  return neg.slice(0, 2).join(locale === "fr" ? " ; " : "; ") || (locale === "fr" ? "aucun majeur" : "none major");
}

// ---- V3 block builders (Markdown, using {{fait:}} markers) ------------------
function v3CardBlock(id, locale) {
  const fr = locale === "fr";
  const L = fr
    ? { h: "En un coup d'œil", cat: "Catégorie", info: "Information", score: "⭐ Note MyDogCanFly", pts: "📊 Score", diff: "🟡 Difficulté du voyage", alli: "✈️ Alliance", net: "🌍 Réseau", price: "💰 Niveau tarifaire", hub: "🏠 Hub principal", cab: "✈️ Cabine", hold: "🧳 Soute", cargo: "📦 Fret", asst: "🦮 Chiens d'assistance", breed: "⚠️ Restrictions de races", best: "👍 Idéal pour", lim: "👎 Points faibles" }
    : { h: "At a glance", cat: "Category", info: "Information", score: "⭐ MyDogCanFly Score", pts: "📊 Score", diff: "🟡 Travel Difficulty", alli: "✈️ Alliance", net: "🌍 Network", price: "💰 Price Level", hub: "🏠 Main Hub", cab: "✈️ Cabin", hold: "🧳 Hold", cargo: "📦 Cargo", asst: "🦮 Assistance Dogs", breed: "⚠️ Breed Restrictions", best: "👍 Best suited for", lim: "👎 Main limitations" };
  const M = (k) => `{{fait: ${id} \\| ${k}}}`;
  return [
    `# ${L.h}`, "",
    `| ${L.cat} | ${L.info} |`,
    "|---|---|",
    `| ${L.score} | ${M("rating_score")} /5 |`,
    `| ${L.pts} | ${M("rating_points")} /100 |`,
    `| ${L.diff} | ${M("travel_difficulty")} |`,
    `| ${L.alli} | ${M("alliance")} |`,
    `| ${L.net} | ${M("network_coverage")} |`,
    `| ${L.price} | ${M("price_level")} |`,
    `| ${L.hub} | ${M("main_hub")} |`,
    `| ${L.cab} | ${M("cabin_summary")} |`,
    `| ${L.hold} | ${M("hold_summary")} |`,
    `| ${L.cargo} | ${M("cargo_summary")} |`,
    `| ${L.asst} | ${M("assistance_summary")} |`,
    `| ${L.breed} | ${M("breed_summary")} |`,
    `| ${L.best} | ${M("recommended_for")} |`,
    `| ${L.lim} | ${M("drawbacks")} |`,
  ];
}
function v3WhyBlock(id, name, locale) {
  const fr = locale === "fr";
  const title = fr ? `Pourquoi MyDogCanFly attribue ${name} {{fait: ${id} | rating_score}}/5` : `Why MyDogCanFly gives ${name} {{fait: ${id} | rating_score}}/5`;
  return [
    `# ${title}`, "",
    `## ${fr ? "Points forts" : "Strengths"}`, "",
    `- {{fait: ${id} | strength_1}}`, `- {{fait: ${id} | strength_2}}`, `- {{fait: ${id} | strength_3}}`, "",
    `## ${fr ? "Limites" : "Limitations"}`, "",
    `- {{fait: ${id} | limitation_1}}`, `- {{fait: ${id} | limitation_2}}`, `- {{fait: ${id} | limitation_3}}`,
  ];
}
function v3DiffBlock(id, locale) {
  const fr = locale === "fr";
  return [
    `# ${fr ? "Difficulté du voyage" : "Travel Difficulty"}`, "",
    `**{{fait: ${id} | travel_difficulty}}**`, "",
    `{{fait: ${id} | travel_difficulty_explanation}}`,
  ];
}
function upgradeToV3(body, id, title, locale) {
  if (/rating_score|MyDogCanFly Score|Note MyDogCanFly/.test(body)) return body; // already V3-authored
  const fr = locale === "fr";
  const name = airlineById[id]?.name || (title || "").replace(/^Flying with a Dog on\s+/i, "").replace(/^Voyager avec son chien sur\s+/i, "").trim();
  const lines = body.split(/\r?\n/);
  const isH = (l) => /^#{1,6}\s+/.test(l);
  const card = v3CardBlock(id, locale);
  const why = v3WhyBlock(id, name, locale);
  const diff = v3DiffBlock(id, locale);
  // 1) replace the At-a-glance section with the V3 card + Why section
  const glanceRe = fr ? /^#{1,6}\s+En un coup/i : /^#{1,6}\s+At a glance/i;
  let gStart = lines.findIndex((l) => glanceRe.test(l));
  let out;
  if (gStart >= 0) {
    let gEnd = gStart + 1; while (gEnd < lines.length && !isH(lines[gEnd])) gEnd++;
    out = [...lines.slice(0, gStart), ...card, "", ...why, "", ...lines.slice(gEnd)];
  } else {
    out = [...lines, "", ...card, "", ...why];
  }
  // 2) insert the Travel Difficulty section after Cabin/Hold/Cargo (before Before-booking / Common-mistakes / FAQ)
  const anchors = fr
    ? [/^#{1,6}\s+Avant de r[ée]server/i, /^#{1,6}\s+Erreurs fr[ée]quentes/i, /^#{1,6}\s+FAQ/i]
    : [/^#{1,6}\s+Before (booking|you book)/i, /^#{1,6}\s+Common mistakes/i, /^#{1,6}\s+FAQ/i];
  let ins = -1;
  for (const re of anchors) { ins = out.findIndex((l) => re.test(l)); if (ins >= 0) break; }
  out = ins >= 0 ? [...out.slice(0, ins), ...diff, "", ...out.slice(ins)] : [...out, "", ...diff];
  return out.join("\n");
}

// Correct common entity_id mistakes so guides attach to the right page and facts resolve.
const ID_ALIAS = { airline_american_airlines: "airline_american", airline_turkish_airlines: "airline_turkish", airline_tap_air_portugal: "airline_tap", airline_lot_polish: "airline_lot", airline_japan_airlines: "airline_jal", airline_philippine_airlines: "airline_philippine" };
const badIds = new Set();
function fixEntityId(id) {
  if (!id) return id;
  if (airlineById[id]) return id;
  if (ID_ALIAS[id]) return ID_ALIAS[id];
  const alt = id.replace(/_airlines$/, "");
  if (airlineById[alt]) return alt;
  badIds.add(id);
  return id;
}

// ---- frontmatter + body parser (tailored to our fixed format) --------------
function parse(md) {
  const m = md.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) throw new Error("no frontmatter");
  const fm = { sources: [] };
  let mode = null, cur = null;
  for (const line of m[1].split(/\r?\n/)) {
    if (/^sources:/.test(line)) { mode = "sources"; continue; }
    if (mode === "sources") {
      const idm = line.match(/^\s*-\s*id:\s*(.+)$/);
      if (idm) { cur = { id: idm[1].trim() }; fm.sources.push(cur); continue; }
      const kv = line.match(/^\s*(url|publisher|accessed):\s*(.+)$/);
      if (kv && cur) { cur[kv[1]] = kv[2].trim().replace(/^"|"$/g, ""); continue; }
    }
    const kv = line.match(/^([a-z_]+):\s*(.*)$/);
    if (kv) { mode = null; fm[kv[1]] = kv[2].trim().replace(/^"|"$/g, ""); }
  }
  return { fm, body: m[2] };
}

// ---- fact resolver: marker description -> localized string from the KB ------
const unresolved = [];
function resolveFact(entityId, desc, locale) {
  const d = desc.toLowerCase();
  const a = airlineById[entityId];
  // ---- V3 identity-card markers (exact keys) -------------------------------
  if (a) {
    const key = d.replace(/[^a-z0-9_]/g, "");
    switch (key) {
      case "rating_score":   return String(ratingFor(entityId).score.toFixed(1));
      case "rating_points":  return String(ratingFor(entityId).points);
      case "travel_difficulty":             return difficultyLabel(entityId, locale);
      case "travel_difficulty_explanation": return difficultyExplanation(entityId, locale);
      case "alliance":         return allianceLabel(entityId);
      case "network_coverage": return networkLabel(entityId, locale);
      case "price_level":      return priceLevel(entityId);
      case "main_hub":         return mainHub(entityId, locale);
      case "cabin_summary":      return cabinSummary(entityId, locale);
      case "hold_summary":       return holdSummary(entityId, locale);
      case "cargo_summary":      return cargoSummary(entityId, locale);
      case "assistance_summary": return assistanceSummary(entityId, locale);
      case "breed_summary":      return breedSummary(entityId, locale);
      case "recommended_for":  return recommendedFor(entityId, locale);
      case "drawbacks":        return drawbacks(entityId, locale);
      case "strength_1": case "strength_2": case "strength_3": {
        const i = Number(key.slice(-1)) - 1; return padUnique(positives(entityId, locale), 3, STRENGTH_FILL[locale === "fr" ? "fr" : "en"])[i] || "";
      }
      case "limitation_1": case "limitation_2": case "limitation_3": {
        const i = Number(key.slice(-1)) - 1; return padUnique(negatives(entityId, locale), 3, LIMIT_FILL[locale === "fr" ? "fr" : "en"])[i] || "";
      }
    }
  }
  if (/assistance/.test(d)) {
    return locale === "fr"
      ? "Les chiens d'assistance officiellement reconnus sont acceptés en cabine, sous réserve des documents requis et d'une déclaration préalable."
      : "Recognised assistance dogs are accepted in the cabin, subject to the required documentation and advance notification.";
  }
  if (a && a.premium && a.premium.policy) {
    const pol = a.premium.policy;
    const cond = (p) => p && p.conditions ? (p.conditions[locale] || p.conditions.en) : null;
    const wantsWeight = /poids|kg|max|weight/.test(d);
    if (/restriction|spécifiq|specifiq|brachy|breed/.test(d)) {   // breed/heat restrictions, derived (check first)
      const txt = [cond(pol.cabin), cond(pol.hold)].filter(Boolean).join(" ").toLowerCase();
      const snub = /snub-nosed|brachy|museau/.test(txt);
      const heat = /heat|chaleur/.test(txt);
      const bits = [];
      if (snub) bits.push(locale === "fr" ? "les races au museau écrasé sont soumises à des restrictions" : "snub-nosed breeds face additional restrictions");
      if (heat) bits.push(locale === "fr" ? "des embargos chaleur peuvent s'appliquer en soute" : "heat embargoes may apply in the hold");
      if (bits.length) return bits.join(locale === "fr" ? " ; " : "; ");
      return locale === "fr" ? "des restrictions peuvent s'appliquer selon la race, la saison et la destination" : "restrictions may apply by breed, season and destination";
    }
    if (/soute|hold/.test(d)) {                         // hold
      return cond(pol.hold) || (pol.hold?.allowed ? (locale === "fr" ? "accepté en soute" : "accepted in the hold") : (locale === "fr" ? "non accepté en soute" : "not accepted in the hold"));
    }
    if (/cargo|fret/.test(d)) return cond(pol.cargo) || (locale === "fr" ? "via un transporteur cargo agréé" : "via an approved cargo transporter");
    if (/cabine|cabin/.test(d)) {                           // cabin
      if (wantsWeight) {
        const w = pol.cabin?.max_weight_kg;
        if (pol.cabin?.allowed) return w ? (locale === "fr" ? `jusqu'à ${w} kg, caisse comprise` : `up to ${w} kg including the carrier`) : (locale === "fr" ? "accepté en cabine (pas de poids publié)" : "accepted in the cabin (no published weight)");
        return locale === "fr" ? "non accepté en cabine" : "not accepted in the cabin";
      }
      return cond(pol.cabin) || (pol.cabin?.allowed ? (locale === "fr" ? "accepté en cabine" : "accepted in the cabin") : (locale === "fr" ? "non accepté en cabine" : "not accepted in the cabin"));
    }
    if (/restriction|spécifiq|specifiq|brachy/.test(d)) {   // breed/heat restrictions, derived
      const txt = [cond(pol.cabin), cond(pol.hold)].filter(Boolean).join(" ").toLowerCase();
      const snub = /snub-nosed|brachy|museau/.test(txt);
      const heat = /heat|chaleur/.test(txt);
      const bits = [];
      if (snub) bits.push(locale === "fr" ? "les races au museau écrasé sont soumises à des restrictions" : "snub-nosed breeds face additional restrictions");
      if (heat) bits.push(locale === "fr" ? "des embargos chaleur peuvent s'appliquer en soute" : "heat embargoes may apply in the hold");
      if (bits.length) return bits.join(locale === "fr" ? " ; " : "; ");
      return locale === "fr" ? "des restrictions peuvent s'appliquer selon la race, la saison et la destination" : "restrictions may apply by breed, season and destination";
    }
    // generic "transport policy" -> one-line overview from the booleans
    const w = pol.cabin?.max_weight_kg;
    const cabinTxt = pol.cabin?.allowed
      ? (locale === "fr" ? `chien en cabine ${w ? `jusqu'à ${w} kg` : ""} accepté` : `in-cabin dogs ${w ? `up to ${w} kg` : ""} accepted`)
      : (locale === "fr" ? "pas de transport en cabine" : "no in-cabin travel");
    const holdTxt = pol.hold?.allowed
      ? (locale === "fr" ? "transport en soute disponible" : "hold transport available")
      : (locale === "fr" ? "pas de soute en bagage accompagné" : "no checked-hold travel");
    const cargoTxt = pol.cargo?.allowed ? (locale === "fr" ? "fret disponible" : "cargo available") : "";
    return [cabinTxt, holdTxt, cargoTxt].filter(Boolean).join(locale === "fr" ? " ; " : "; ");
  }
  // Fallback: derive from the KB rules + published fees (for airlines without a premium.policy).
  if (a) {
    const rf = ruleFacts(entityId);
    const fees = a.fees || {};
    const d2 = desc.toLowerCase();
    const priceEN = (f) => (f ? `; from ${f}` : "");
    const priceFR = (f) => (f ? ` ; à partir de ${f}` : "");
    if (/restriction|spécifiq|specifiq|brachy|breed/.test(d2)) {
      return locale === "fr"
        ? "Les races au museau écrasé (brachycéphales) ne sont pas acceptées en soute ni en fret en raison du risque respiratoire ; en cabine, elles restent soumises à la limite de poids."
        : "Snub-nosed (brachycephalic) breeds are not accepted in the hold or cargo because of the breathing risk; in the cabin they remain subject to the weight limit.";
    }
    if (/soute|hold/.test(d2)) {
      if (!rf.holdAllowed) return locale === "fr" ? "Pas de transport en soute en bagage accompagné sur cette compagnie." : "Not offered as checked baggage in the hold on this airline.";
      const mx = rf.holdMax ? (locale === "fr" ? ` jusqu'à ${rf.holdMax} kg (animal + caisse)` : ` up to ${rf.holdMax} kg (pet + crate)`) : "";
      return locale === "fr" ? `Chiens plus grands en soute, dans une caisse conforme IATA${mx}${priceFR(fees.hold)}.` : `Larger dogs travel in the hold in an IATA-compliant crate${mx}${priceEN(fees.hold)}.`;
    }
    if (/cargo|fret/.test(d2)) {
      return rf.cargoAllowed
        ? (locale === "fr" ? `Fret possible via le service cargo de la compagnie${priceFR(fees.cargo)}.` : `Cargo transport is available via the airline's cargo service${priceEN(fees.cargo)}.`)
        : (locale === "fr" ? "Pas de transport en fret pour cette compagnie." : "No cargo transport on this airline.");
    }
    if (/cabine|cabin/.test(d2)) {
      if (!rf.cabinAllowed) return locale === "fr" ? "Les chiens ne sont pas acceptés en cabine (chiens d'assistance exceptés)." : "Dogs are not accepted in the cabin (assistance dogs excepted).";
      const mx = rf.cabinMax ?? 8;
      return locale === "fr" ? `Petits chiens jusqu'à ${mx} kg, caisse comprise, dans un sac souple sous le siège${priceFR(fees.cabin)}.` : `Small dogs up to ${mx} kg including the carrier, in a soft carrier under the seat${priceEN(fees.cabin)}.`;
    }
    // generic overview
    const cab = rf.cabinAllowed ? (locale === "fr" ? `cabine jusqu'à ${rf.cabinMax ?? 8} kg` : `cabin up to ${rf.cabinMax ?? 8} kg`) : (locale === "fr" ? "pas de cabine" : "no cabin");
    const hold = rf.holdAllowed ? (locale === "fr" ? "soute disponible" : "hold available") : (locale === "fr" ? "pas de soute" : "no hold");
    return `${cab}; ${hold}`;
  }
  unresolved.push(`${entityId} | ${desc}`);
  return locale === "fr" ? "voir la politique en vigueur de la compagnie" : "see the airline's current policy";
}

// the most specific policy source URL for an airline (upgrades weak homepage cites)
function policySource(entityId) {
  const a = airlineById[entityId];
  const pol = a?.premium?.policy;
  const s = pol?.cabin?.source || pol?.hold?.source || pol?.cargo?.source;
  return s?.url || null;
}

// ---- localize the standard English section headers for FR ------------------
const HEADERS_FR = {
  "Overview": "Aperçu",
  "At a glance": "En bref",
  "Cabin, hold or cargo": "Cabine, soute ou cargo",
  "How to book": "Comment réserver",
  "Booking advice": "Conseils de réservation",
  "Before you book": "Avant de réserver",
  "At the airport": "À l'aéroport",
  "Good to know": "Bon à savoir",
  "Entry requirements": "Conditions d'entrée",
  "Step by step": "Étape par étape",
  "Common mistakes": "Erreurs fréquentes",
  "Traveling with a dog": "Voyager avec un chien",
  "Size & placement": "Taille et placement",
  "Heat & breathing": "Chaleur et respiration",
  "Tips": "Conseils",
  "The short answer": "En bref",
  "FAQ": "FAQ",
};
// Patterns for headers that embed an entity name (e.g. an airline).
const HEADER_PATTERNS_FR = [
  [/^Can my dog fly with (.+?)\??$/i, (m) => `Mon chien peut-il voyager avec ${m[1]} ?`],
  [/^Is (.+?) a good choice\??$/i, (m) => `${m[1]} est-elle un bon choix ?`],
  [/^Flying with a dog on (.+)$/i, (m) => `Voyager avec un chien sur ${m[1]}`],
  [/^Does (.+?) (accept|transport) dogs\??$/i, (m) => `${m[1]} accepte-t-elle les chiens ?`],
];
function localizeHeader(text, locale) {
  if (locale !== "fr") return text;
  if (HEADERS_FR[text]) return HEADERS_FR[text];
  for (const [re, fn] of HEADER_PATTERNS_FR) { const m = text.match(re); if (m) return fn(m); }
  return text;
}

// ---- minimal, safe Markdown -> HTML for our controlled subset --------------
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
function inline(s) {
  s = s.replace(/\s*\[oai_citation:[^\]]*\]\([^)]*\)/g, ""); // strip ChatGPT citation artifacts
  s = esc(s);
  s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\[s(\d+)\]/g, (_, n) => `<sup class="g-cite"><a href="#g-src-s${n}">${n}</a></sup>`);
  s = s.replace(/\[([^\]]+)\]\((https?:[^)]+)\)/g, '<a href="$2" rel="nofollow noopener" target="_blank">$1</a>'); // markdown links
  return s;
}
function toHtml(body, locale, title) {
  let html = "", inList = false, para = [], firstHeading = false, skip = false, tbl = null;
  const flushPara = () => { if (para.length) { html += `<p>${inline(para.join(" "))}</p>`; para = []; } };
  const flushList = () => { if (inList) { html += "</ul>"; inList = false; } };
  const flushTable = () => {
    if (!tbl) return;
    const cells = (row) => row.replace(/^\||\|$/g, "").split(/\|/).map((c) => c.trim());
    const isSep = (row) => /^\s*\|?[\s:|-]+\|?\s*$/.test(row) && /-/.test(row);
    const rows = tbl.filter((r) => !isSep(r));
    let out = '<table class="g-card"><tbody>';
    rows.forEach((r) => { out += "<tr>" + cells(r).map((c) => `<td>${inline(c)}</td>`).join("") + "</tr>"; });
    out += "</tbody></table>";
    html += out; tbl = null;
  };
  const titleNorm = (title || "").trim().toLowerCase();
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trim();
    if (/^\|.*\|\s*$/.test(line)) { flushPara(); flushList(); (tbl = tbl || []).push(line); continue; } // markdown table row
    if (tbl) flushTable();
    if (!line) { flushPara(); flushList(); continue; }
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(line)) { flushPara(); flushList(); continue; } // horizontal rule
    const h = line.match(/^(#{1,6})\s+(.*)$/);
    if (h) {
      flushPara(); flushList();
      const text = h[2].trim(); const low = text.toLowerCase();
      if (low === "sources") { skip = true; firstHeading = true; continue; }      // sources rendered separately
      skip = false;
      if (!firstHeading && low === titleNorm) { firstHeading = true; continue; }   // drop a redundant title heading
      firstHeading = true;
      html += h[1].length >= 3
        ? `<h4 class="g-q">${inline(localizeHeader(text, locale))}</h4>`
        : `<h3 class="g-h">${inline(localizeHeader(text, locale))}</h3>`;
      continue;
    }
    if (skip) continue;
    if (/^>\s?/.test(line)) { flushPara(); flushList(); html += `<blockquote>${inline(line.replace(/^>\s?/, ""))}</blockquote>`; continue; }
    const li = line.match(/^([-•*])\s+(.*)$/);
    if (li) { flushPara(); if (!inList) { html += "<ul>"; inList = true; } html += `<li>${inline(li[2])}</li>`; continue; }
    para.push(line);
  }
  flushPara(); flushList(); flushTable();
  return html;
}

// ---- walk drafts, ingest ---------------------------------------------------
function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (name.endsWith(".md")) out.push(p);
  }
  return out;
}

const guides = [];
let files = [];
try { files = walk(DRAFTS); } catch { console.log("No drafts dir yet:", DRAFTS); }
for (const f of files) {
  const { fm, body } = parse(readFileSync(f, "utf8"));
  const locale = fm.locale;
  const entityId = fm.entity_id ? fixEntityId(fm.entity_id) : null;
  // V2 -> V3: inject the identity-card table + rating + difficulty blocks
  const v3Body = entityId ? upgradeToV3(body, entityId, fm.title || "", locale) : body;
  // resolve markers (entity ids in markers are corrected too)
  const resolvedBody = v3Body.replace(/\{\{fait:\s*([a-z_0-9]+)\s*\\?\|\s*([^}]+)\}\}/g, (_, id, desc) =>
    resolveFact(fixEntityId(id.trim()), desc.trim(), locale));
  const injected = resolvedBody !== body;
  // upgrade a bare-homepage source to the specific KB policy page
  const ps = entityId ? policySource(entityId) : null;
  const sources = fm.sources.map((s) => {
    let url = s.url;
    try { if (ps && new URL(url).pathname.replace(/\/$/, "") === "") url = ps; } catch {}
    return { ...s, url };
  });
  guides.push({
    type: fm.type,
    entity_id: entityId,
    slug: fm.slug,
    locale,
    title: fm.title,
    description: fm.description || "",
    last_reviewed: fm.last_reviewed || null,
    html: toHtml(resolvedBody, locale, fm.title),
    sources,
    policy_source: injected ? ps : null,
  });
}

guides.sort((a, b) => (a.type + a.slug + a.locale).localeCompare(b.type + b.slug + b.locale));
writeFileSync(OUT, JSON.stringify(guides, null, 2) + "\n");
console.log(`Ingested ${guides.length} guide files -> ${OUT}`);
const byType = {};
for (const g of guides) byType[g.type] = (byType[g.type] || 0) + 1;
console.log("By type:", byType);

// Persist computed airline ratings back to the KB so the UI (homepage, index) reads the same score shown on airline pages.
let rated = 0;
for (const a of objects.airlines) { const r = ratingBreakdown(a.id); a.rating = { score: r.score, points: r.points }; rated++; }
writeFileSync(OBJECTS, JSON.stringify(objects, null, 2) + "\n");
console.log(`Wrote ${rated} airline ratings -> ${OBJECTS}`);

if (unresolved.length) {
  console.log(`\n⚠ ${unresolved.length} unresolved markers (left as [desc] — need resolver rule or KB data):`);
  console.log([...new Set(unresolved)].join("\n"));
} else console.log("All {{fait:}} markers resolved.");
if (badIds.size) console.log(`\n⚠ Unknown entity ids (no KB match, left as-is): ${[...badIds].join(", ")}`);
