import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { normalize } from "@mydogcanfly/knowledge";
import { FinderRequest, evaluate, explain } from "../src/index";

/* End-to-end demo of the CTO's example: Golden Retriever · 11 kg · 34 °C · destination Japan.
   Knowledge → Normalization → Decision Engine → Explanation Engine → Decision Report. */

const kroot = join(dirname(fileURLToPath(import.meta.url)), "../../knowledge");
const raw = {
  ...JSON.parse(readFileSync(join(kroot, "raw/objects.json"), "utf8")),
  rules: JSON.parse(readFileSync(join(kroot, "raw/rules.json"), "utf8")),
};

const kb = normalize(raw);

const req = FinderRequest.parse({
  origin: "airport_cdg",
  destination: "airport_hnd",
  dog: { breed_id: "breed_golden_retriever", weight_kg: 11, brachycephalic: false },
  weather: { temperature_c: 34 },
  locale: "en",
});

const decision = evaluate(kb, req);
const report = explain(decision);

console.log("── Graph edges (sample) ──");
for (const e of kb.graph) console.log(`  ${e.from}  --${e.type}-->  ${e.to}`);
console.log("\n── Decision Report ──");
console.log(JSON.stringify(report, null, 2));
