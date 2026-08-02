// Freshness report for country entry guides: lists each guide by `verified_date`,
// oldest first, flagging those past the staleness window. Feeds the quarterly
// re-verification cycle (official sources change).
//
//   node packages/knowledge/scripts/countries-freshness.mjs [staleDays]
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "..", "..", "content", "countries");
const STALE_DAYS = Number(process.argv[2] || 90);
const now = new Date();

const rows = readdirSync(SRC)
  .filter((f) => (f.endsWith(".yml") || f.endsWith(".yaml")) && !f.startsWith("_") && !f.startsWith("."))
  .map((f) => {
    const d = YAML.parse(readFileSync(join(SRC, f), "utf8"));
    const verified = d.verified_date ? new Date(d.verified_date) : null;
    const ageDays = verified ? Math.floor((now - verified) / 86400000) : Infinity;
    return { name: d.name?.en ?? f, verified_date: d.verified_date ?? "—", confidence: d.confidence ?? "—", ageDays };
  })
  .sort((a, b) => b.ageDays - a.ageDays);

const stale = rows.filter((r) => r.ageDays > STALE_DAYS);
console.log(`Country guide freshness — ${rows.length} guides · staleness window ${STALE_DAYS} days\n`);
for (const r of rows) {
  const flag = r.ageDays > STALE_DAYS ? "⚠ STALE" : "ok";
  console.log(`  ${String(r.ageDays).padStart(4)}d  ${r.verified_date}  conf ${r.confidence}  ${flag.padEnd(7)}  ${r.name}`);
}
console.log(`\n${stale.length} guide(s) past the ${STALE_DAYS}-day window` + (stale.length ? " — re-verify official sources:" : "."));
for (const r of stale) console.log("  - " + r.name);
