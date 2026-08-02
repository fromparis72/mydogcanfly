// Ingest per-airline pet-policy fiches (YAML, source of truth) into a generated JSON
// that the UI consumes. Validates every fiche against a Zod schema so a typo or a
// missing EN/FR field fails the build instead of shipping.
//
//   node packages/knowledge/scripts/ingest-airlines.mjs
//
// Source:  content/airlines/<slug>.yml   (one bilingual fiche per airline)
// Output:  packages/ui/src/data/airlines.generated.json   (Record<airline_id, Fiche>)
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { z } from "zod";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const SRC = join(ROOT, "content", "airlines");
const OUT = join(ROOT, "packages", "ui", "src", "data", "airlines.generated.json");
const OBJECTS = join(ROOT, "packages", "knowledge", "raw", "objects.json");

// ---- Schema (source of truth for the fiche contract) ----------------------
// Zod, en mode « strip » par défaut, efface en silence toute clé non déclarée : une langue
// absente d'ici disparaîtrait des données sans qu'aucune erreur ne le signale (c'est ce qui
// était arrivé à `brachy_allowed`). Toute langue ajoutée doit donc être déclarée ici.
const LT = z.object({
  en: z.string().min(1),
  fr: z.string().min(1),
  es: z.string().min(1).optional(),
  pt: z.string().min(1).optional(),
});
const CLS = z.enum(["ok", "no", "warn", "neutral"]);
const Chip = z.object({ icon: z.string(), label: LT, cls: CLS.optional() });
const Pill = z.object({ cls: CLS, label: LT });
const Channel = z.object({ icon: z.string(), name: LT, cls: CLS, statusLabel: LT, detail: LT, fee: LT });
const LadderSeg = z.object({ flex: z.number(), color: z.string(), label: LT, sub: z.union([z.string(), LT]) });
const Restriction = z.object({ icon: z.string(), title: LT, pills: z.array(Pill), note: LT });
const InfoRow = z.object({ icon: z.string(), label: LT, value: LT });
const FareRow = z.object({ zone: LT, cabin: z.string(), hold: z.string() });
const FareItem = z.object({ label: LT, value: LT });

const Fiche = z.object({
  id: z.string().regex(/^airline_[a-z0-9_]+$/),
  mono: z.string().min(1).max(3),
  name: z.string().min(1),
  titleH1: LT,
  metaDesc: LT,
  chips: z.array(Chip).min(1),
  verdict: Pill,
  verdictNote: LT,
  ladder: z.array(LadderSeg).min(1),
  channels: z.array(Channel).min(1),
  fareGrid: z.object({ headCabin: LT, headHold: LT, rows: z.array(FareRow).min(1), note: LT }).optional(),
  fareList: z.object({ rows: z.array(FareItem).min(1), note: LT }).optional(),
  restrictions: z.array(Restriction),
  crate: z.array(LT).optional(),
  temperature: z.object({ pills: z.array(Pill), note: LT }),
  assistance: z.array(InfoRow).min(1),
  goodToKnow: z.array(InfoRow).min(1),
  book: z.object({ host: z.string().min(1), url: z.string().url() }),
  sources: LT,
  verified_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "verified_date must be YYYY-MM-DD"),
}).strict();

// ---- Ingest ---------------------------------------------------------------
const files = readdirSync(SRC)
  .filter((f) => (f.endsWith(".yml") || f.endsWith(".yaml")) && !f.startsWith("_") && !f.startsWith("."))
  .sort();
const out = {};
const errors = [];

for (const file of files) {
  const raw = YAML.parse(readFileSync(join(SRC, file), "utf8"));
  const res = Fiche.safeParse(raw);
  if (!res.success) {
    errors.push(`${file}: ${res.error.issues.map((i) => `${i.path.join(".")} — ${i.message}`).join("; ")}`);
    continue;
  }
  const fiche = res.data;
  if (out[fiche.id]) errors.push(`${file}: duplicate id ${fiche.id}`);
  out[fiche.id] = fiche;
}

if (errors.length) {
  console.error(`✖ airline fiche validation failed (${errors.length}):`);
  for (const e of errors) console.error("  - " + e);
  process.exit(1);
}

const sorted = Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]));
writeFileSync(OUT, JSON.stringify(sorted, null, 2) + "\n");
console.log(`✓ ingested ${Object.keys(sorted).length} airline fiches → ${OUT.replace(ROOT + "/", "")}`);

// ---- Derive a STRUCTURED policy from each fiche and propagate it to the KB -------------------
// Single source of truth: the verified fiche fields (channels = allowed status per mode, fareList =
// cabin weight, restrictions = snub-nosed hold ban). The crate calculator + finder read the KB, so we
// inject the derived policy into raw/objects.json. Existing hand-authored policy (richer, with cabin
// dimensions) is preserved — the derivation only fills gaps. A missing signal stays "unknown" (omitted),
// never a fabricated refusal.
const catOf = (name) => { const n = (name || "").toLowerCase(); if (/cargo|fret/.test(n)) return "cargo"; if (/hold|soute|checked/.test(n)) return "hold"; if (/cabin|cabine/.test(n)) return "cabin"; return null; };
const kgOf = (s) => { const m = (s || "").match(/(?:≤|<=|up to|jusqu'?à)?\s*(\d{1,3})\s*kg/i); return m ? parseInt(m[1], 10) : null; };

function derivePolicy(fiche) {
  const p = { cabin: {}, hold: {}, cargo: {} };
  for (const c of (fiche.channels || [])) {
    const cat = catOf(c.name?.en); if (!cat) continue;
    if (c.cls === "no") p[cat].allowed = false;
    else if (c.cls === "ok" || c.cls === "warn") p[cat].allowed = true;   // warn = conditional/on-request
    if (c.cls === "warn") p[cat].conditional = true;
  }
  for (const r of (fiche.fareList?.rows || [])) {
    const cat = catOf(r.label?.en); if (cat !== "cabin") continue;         // only cabin weight is an unambiguous max
    const kg = kgOf(r.label?.en) ?? kgOf(r.value?.en); if (kg && p.cabin.max_weight_kg == null) p.cabin.max_weight_kg = kg;
  }
  for (const r of (fiche.restrictions || [])) {
    if (!/flat-faced|brachy|snub|nose|nez|museau/i.test(r.title?.en || "")) continue;
    for (const pill of (r.pills || [])) {
      if (pill.cls === "no" && /hold|soute|cargo/i.test(pill.label?.en || "")) p.hold.brachy_allowed = false;
    }
  }
  // Drop empty modes (no signal at all → unknown).
  for (const k of ["cabin", "hold", "cargo"]) if (p[k].allowed === undefined) delete p[k];
  return p;
}

const addDays = (iso, n) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

const objects = JSON.parse(readFileSync(OBJECTS, "utf8"));
let patched = 0, filledModes = 0;
for (const a of (objects.airlines || [])) {
  const fiche = sorted[a.id]; if (!fiche) continue;
  const derived = derivePolicy(fiche);
  a.premium = a.premium || {};
  a.premium.policy = a.premium.policy || {};
  const pol = a.premium.policy;
  // Provenance: the fiche is verified from the airline's official site; keep that as the structured source.
  const source = {
    url: a.website || fiche.book?.url,
    source_type: "official_website",
    verified_date: fiche.verified_date,
    review_due: addDays(fiche.verified_date, 90),
    confidence: 3,
    reviewer: "MyDogCanFly Data Team (derived from fiche)",
    history: [],
  };
  let touched = false;
  for (const mode of ["cabin", "hold", "cargo"]) {
    const d = derived[mode]; if (!d) continue;
    const cur = pol[mode];
    // Preserve richer hand-authored policy (has a real source, not derived). Overwrite/refresh derived ones.
    if (cur && cur.allowed !== undefined && cur.source && !cur.derived_from_fiche) continue;
    pol[mode] = {
      allowed: d.allowed,
      ...(d.max_weight_kg != null ? { max_weight_kg: d.max_weight_kg } : {}),
      ...(d.brachy_allowed === false ? { brachy_allowed: false } : {}),
      ...(d.conditional ? { conditional: true } : {}),
      source,
      derived_from_fiche: true,
    };
    touched = true; filledModes++;
  }
  if (touched) patched++;
}
writeFileSync(OBJECTS, JSON.stringify(objects, null, 2) + "\n");
console.log(`✓ derived structured policy → patched ${patched} airlines (${filledModes} modes filled) in ${OBJECTS.replace(ROOT + "/", "")}`);
