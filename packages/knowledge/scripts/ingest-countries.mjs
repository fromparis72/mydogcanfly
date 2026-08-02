// Ingest country entry guides: content/countries/*.yml -> packages/ui/src/data/countries.generated.json
//
//   node packages/knowledge/scripts/ingest-countries.mjs
//
// Validates every guide against a Zod schema (bilingual, official-source discipline)
// and exits non-zero on any error so it can gate the deploy chain. Files starting with
// "_" (e.g. _template.yml) or "." are skipped.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { z } from "zod";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "..", "..", "content", "countries");
const OUT = join(HERE, "..", "..", "ui", "src", "data", "countries.generated.json");

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
const SummaryRow = z.object({ requirement: LT, status: LT, cls: CLS });
const Factor = z.object({ stars: z.number().int().min(1).max(5), label: LT, text: LT });
const ReqRow = z.object({ item: LT, required: LT, when: LT, exceptions: LT, ref: LT });
// `tag` : libellé de colonne propre à la fiche. Le gabarit UE / listé / non listé ne convient
// qu'aux régimes européens ; ailleurs (groupes australiens, UEEA, chien accompagné vs fret…)
// la fiche doit pouvoir nommer elle-même ses cas.
const OriginBlock = z.object({ title: LT, body: LT, cls: CLS.optional(), tag: LT.optional() });
const SourceLink = z.object({ label: LT, url: z.string().url() });
// Round-trip layer (ADR: return-journey awareness). Both optional — populated progressively,
// so existing guides stay valid. `regime` = the country's pet-movement classification;
// `exit` = the sourced formalities to LEAVE this country with a dog (the often-forgotten step ③).
const Regime = z.enum(["eu", "listed", "non_listed", "island_controlled", "island_strict"]);
const ExitStep = z.object({ text: LT, timing: z.enum(["before", "window", "longlead"]).default("window") });
const ExitBlock = z.object({
  authority: z.string().min(1),          // local authority name (e.g. "SENASICA"), language-neutral
  authorityUrl: z.string().url(),
  intro: LT,                              // one-line summary of the exit/export procedure
  steps: z.array(ExitStep).min(1),
  onSiteNote: LT.optional(),              // the "trap" caveat: arrange during the stay, airport time
});

/** Domestic travel (same country at both ends): no border, so no import rules — what actually applies instead. */
const DomesticTerritory = z.object({
  name: LT,                               // e.g. "Guyane", "Hawaii" — a same-country special sanitary regime
  note: LT,                               // what applies there, sourced
  url: z.string().url().optional(),       // official source for that territory
});
const DomesticBlock = z.object({
  intro: LT,                              // "no import formality on a domestic flight" headline
  points: z.array(LT).min(1),             // what DOES apply (identification, state rules, airline policy…)
  territories: z.array(DomesticTerritory).optional(),
});

const Guide = z
  .object({
    id: z.string().regex(/^country_[a-z0-9_]+$/),
    iso2: z.string().length(2),
    name: LT,
    region: LT,
    hero: z.object({ h1: LT, intro: LT }),
    difficulty: z.object({ level: z.enum(["easy", "moderate", "difficult"]), label: LT }),
    prepTime: z.object({ eu: LT, listed: LT, nonListed: LT }),
    summary: z.array(SummaryRow).min(1),
    notice: z.array(LT).min(1),
    noticeClose: LT,
    factors: z.object({ title: LT, intro: LT, items: z.array(Factor).min(1), note: LT }),
    requirements: z.array(ReqRow).min(1),
    origin: z.object({ eu: OriginBlock, listed: OriginBlock, nonListed: OriginBlock }),
    arrival: z.object({ intro: LT, points: z.array(LT).min(1) }),
    regime: Regime.optional(),
    exit: ExitBlock.optional(),
    domestic: DomesticBlock.optional(),
    travellerExperience: LT.nullable(),
    restrictedDogs: z.object({ intro: LT, cat1: LT, cat2: LT, note: LT }),
    checklist: z.array(LT).min(1),
    sources: z.array(SourceLink).min(1),
    seo: z.object({ title: LT, metaTitle: LT, metaDesc: LT, slug: z.string().min(1), shortDesc: LT }),
    verified_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    reviewer: z.string().min(1),
    confidence: z.number().int().min(1).max(5),
  })
  .strict();

const files = readdirSync(SRC).filter(
  (f) => (f.endsWith(".yml") || f.endsWith(".yaml")) && !f.startsWith("_") && !f.startsWith("."),
);

const out = {};
let errors = 0;
for (const f of files) {
  const parsed = YAML.parse(readFileSync(join(SRC, f), "utf8"));
  const r = Guide.safeParse(parsed);
  if (!r.success) {
    errors++;
    console.error(`\n✖ ${f}`);
    for (const issue of r.error.issues) console.error(`   ${issue.path.join(".")}: ${issue.message}`);
    continue;
  }
  if (out[r.data.id]) {
    errors++;
    console.error(`\n✖ ${f}: duplicate id ${r.data.id}`);
    continue;
  }
  out[r.data.id] = r.data;
}

if (errors) {
  console.error(`\n${errors} file(s) failed validation. Nothing written.`);
  process.exit(1);
}

const sorted = {};
for (const k of Object.keys(out).sort()) sorted[k] = out[k];
writeFileSync(OUT, JSON.stringify(sorted, null, 2) + "\n");
console.log(`✓ ${files.length} country guide(s) ingested -> ${OUT}`);
