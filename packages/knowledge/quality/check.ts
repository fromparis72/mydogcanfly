import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { normalize } from "../src/normalize";

/* Quality gates (ADR-0015): schema-check · rule-check · coverage · (link-check offline-skipped). */

const here = dirname(fileURLToPath(import.meta.url));
const raw = {
  ...JSON.parse(readFileSync(join(here, "../raw/objects.json"), "utf8")),
  rules: JSON.parse(readFileSync(join(here, "../raw/rules.json"), "utf8")),
};

let failed = 0;
function ok(name: string, cond: boolean, detail = ""): void {
  console.log(`${cond ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
  if (!cond) failed++;
}

// schema-check (throws on invalid data)
let kb;
try {
  kb = normalize(raw);
  ok("schema-check", true, `${kb.airlines.size} airlines · ${kb.countries.size} countries · ${kb.rules.length} rules · ${kb.graph.length} graph edges`);
} catch (e) {
  ok("schema-check", false, String(e));
  process.exit(1);
}

// rule-check
ok("rule-check: every rule has a source URL", kb.rules.every((r) => !!r.source?.url));
ok("rule-check: review_due after verified_date", kb.rules.every((r) => r.source.review_due > r.source.verified_date));
ok("rule-check: predicate facts are declared", kb.rules.every((r) => !!r.applies_when));

// coverage: every airline referenced by at least one rule
const airlinesWithRules = new Set(kb.rules.filter((r) => r.scope.type === "airline").map((r) => r.scope.id));
ok("coverage: airlines have at least one rule", [...kb.airlines.keys()].every((id) => airlinesWithRules.has(id)));

// link-check: network-gated, runs in CI only
console.log("ℹ️  link-check: skipped (network-gated; runs in CI)");

console.log(failed ? `\n${failed} check(s) failed` : "\nAll quality checks passed ✨");
process.exit(failed ? 1 : 0);
