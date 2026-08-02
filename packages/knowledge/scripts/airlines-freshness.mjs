// Freshness report for airline fiches: lists each fiche by `verified_date`, oldest
// first, and flags those whose official sources haven't been re-checked within the
// staleness window. Feeds the quarterly re-verification cycle.
//
//   node packages/knowledge/scripts/airlines-freshness.mjs [staleDays]
//
// Exit code 0 always (report only). Prints stale fiches so a scheduled task can act.
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "..", "..", "content", "airlines");
const STALE_DAYS = Number(process.argv[2] || 90);
const now = new Date();

const rows = readdirSync(SRC)
  .filter((f) => (f.endsWith(".yml") || f.endsWith(".yaml")) && !f.startsWith("_") && !f.startsWith("."))
  .map((f) => {
    const d = YAML.parse(readFileSync(join(SRC, f), "utf8"));
    const verified = d.verified_date ? new Date(d.verified_date) : null;
    const ageDays = verified ? Math.floor((now - verified) / 86400000) : Infinity;
    return { name: d.name ?? f, host: d.book?.host ?? "", verified_date: d.verified_date ?? "—", ageDays };
  })
  .sort((a, b) => b.ageDays - a.ageDays);

const stale = rows.filter((r) => r.ageDays > STALE_DAYS);

console.log(`Airline fiche freshness — ${rows.length} fiches · staleness window ${STALE_DAYS} days\n`);
for (const r of rows) {
  const flag = r.ageDays > STALE_DAYS ? "⚠ STALE" : "ok";
  console.log(`  ${String(r.ageDays).padStart(4)}d  ${r.verified_date}  ${flag.padEnd(7)}  ${r.name} (${r.host})`);
}
console.log(`\n${stale.length} fiche(s) past the ${STALE_DAYS}-day window` + (stale.length ? " — re-verify official sources:" : "."));
for (const r of stale) console.log("  - " + r.name);
