#!/usr/bin/env node
/**
 * Contre-épreuves du raccordement fiche → artefact public → politique du Finder.
 * Chaque sabotage travaille sur une copie temporaire complète et ne touche jamais le dépôt.
 */
import { cpSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(ROOT, "packages", "knowledge", "scripts", "audit-raccordement-finder.mjs");
let sandbox;
let pass = 0;
let fail = 0;

const check = (label, condition, detail = "") => {
  console.log(`${condition ? "  OK  " : "  FAIL"} ${label}${condition || !detail ? "" : `\n       ${detail}`}`);
  condition ? pass++ : fail++;
};
const copyFile = (relative) => {
  const target = join(sandbox, relative);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(join(ROOT, relative), target, { recursive: true });
};
const fresh = () => {
  if (sandbox) rmSync(sandbox, { recursive: true, force: true });
  sandbox = mkdtempSync(join(tmpdir(), "mydogcanfly-raccordement-"));
  copyFile(join("content", "airlines"));
  copyFile(join("packages", "ui", "src", "data", "airlines.generated.json"));
  copyFile(join("packages", "knowledge", "raw", "objects.json"));
  copyFile(join("packages", "knowledge", "raw", "rules.json"));
  copyFile(join("packages", "knowledge", "raw", "breed-restrictions.json"));
};
const run = () => {
  const result = spawnSync(process.execPath, [SCRIPT, "--root", sandbox], { encoding: "utf8" });
  return { code: result.status, out: `${result.stdout ?? ""}${result.stderr ?? ""}` };
};
const readJson = (relative) => JSON.parse(readFileSync(join(sandbox, relative), "utf8"));
const writeJson = (relative, value) => writeFileSync(join(sandbox, relative), `${JSON.stringify(value, null, 2)}\n`);

console.log("=== Raccordement Finder : contre-épreuves ===");

fresh();
{
  const result = run();
  check("le dépôt intact passe", result.code === 0, result.out.slice(-500));
}

fresh();
{
  const path = join("packages", "knowledge", "raw", "breed-restrictions.json");
  const restrictions = readJson(path);
  restrictions.push({
    id: "brest_sabotage_universal_brachy_deny", applies_to: { trait: "brachycephalic" },
    action: "deny", placements: ["hold", "cargo"],
    source: { url: "https://www.iata.org/en/programs/cargo/live-animals/pets/", source_type: "official_website", verified_date: "2026-09-15", review_due: "2026-12-14", confidence: 4, reviewer: "test", history: [], quote: "A single carrier applies a restriction.", quote_language: "en", locator: "pets" },
  });
  writeJson(path, restrictions);
  const result = run();
  check("une interdiction brachycéphale non bornée n'est jamais généralisée aux compagnies",
    result.code === 1 && result.out.includes("UNIVERSAL_BREED_RESTRICTION\tglobal\thold,cargo\tbrest_sabotage_universal_brachy_deny"), result.out.slice(-800));
}

fresh();
{
  const path = join(sandbox, "content", "airlines", "neos.yml");
  writeFileSync(path, readFileSync(path, "utf8").replace(
    "      quote: If the weight of the animal, including the cage or carrier, does not exceed 10 kilograms, you are allowed to transport them in the cabin.",
    "      quote: \"\"",
  ));
  const result = run();
  check("une décision catégorique sans sa citation propre est refusée",
    result.code === 1 && result.out.includes("CATEGORICAL_POLICY_SOURCE_INCOMPLETE\tairline_neos\tcabin"), result.out.slice(-800));
}

fresh();
{
  const path = join(sandbox, "content", "airlines", "neos.yml");
  writeFileSync(path, readFileSync(path, "utf8").replace("  - placement: cabin\n    icon: 🐾", "  - placement: cabin\n    icon: 🐾").replace(/(  - placement: cabin[\s\S]*?\n    cls:) ok/, "$1 no"));
  const result = run();
  check("une carte rouge contredisant une politique proposée est refusée",
    result.code === 1 && result.out.includes("CHANNEL_POLICY_STATUS_DRIFT\tairline_neos\tcabin"), result.out.slice(-800));
}

fresh();
{
  const path = join("packages", "knowledge", "raw", "rules.json");
  const rules = readJson(path);
  rules.push({
    id: "sabotage_brachy_without_quote", scope: { type: "airline", id: "airline_neos" }, category: "breed_ban", criticality: "high",
    applies_when: { all: [{ fact: "dog.brachycephalic", op: "eq", value: true }, { fact: "placement", op: "eq", value: "hold" }] },
    effect: { action: "deny", placement: ["hold"] }, params: {}, rationale: "sabotage",
    source: { url: "https://www.neosair.com/us/en/information/traveling-with-pets", source_type: "official_website", verified_date: "2026-09-15", review_due: "2026-12-14", confidence: 4, reviewer: "test", history: [] },
  });
  writeJson(path, rules);
  const result = run();
  check("une interdiction brachycéphale sans citation propre est refusée",
    result.code === 1 && result.out.includes("BRACHY_RULE_SOURCE_INCOMPLETE\tairline_neos\thold\tsabotage_brachy_without_quote"), result.out.slice(-800));
}

fresh();
{
  const path = join("packages", "knowledge", "raw", "objects.json");
  const objects = readJson(path);
  objects.airlines.find((airline) => airline.id === "airline_neos").premium.policy.hold.brachy_allowed = false;
  writeJson(path, objects);
  const result = run();
  check("un booléen brachycéphale sans rattachement structuré est refusé",
    result.code === 1 && result.out.includes("BRACHY_FLAG_WITHOUT_ATTESTATION\tairline_neos\thold"), result.out.slice(-800));
}

fresh();
{
  const path = join(sandbox, "content", "airlines", "transavia.yml");
  const source = readFileSync(path, "utf8");
  writeFileSync(path, source.replace(/\n  - placement: cargo\n[\s\S]*?\nfareList:/, "\nfareList:"));
  const result = run();
  check("la disparition d'une carte cabine/soute/fret est refusée",
    result.code === 1 && result.out.includes("CHANNEL_MISSING\tairline_transavia\tcargo"), result.out.slice(-800));
}

fresh();
{
  const path = join(sandbox, "content", "airlines", "smartwings.yml");
  const source = readFileSync(path, "utf8");
  writeFileSync(path, source.replace("\n  cargo:\n    review_state: legacy_unreviewed\nchannels:", "\nchannels:"));
  const result = run();
  check("la disparition d'une politique explicite est refusée",
    result.code === 1 && result.out.includes("POLICY_MISSING\tairline_smartwings\tcargo"), result.out.slice(-800));
}

fresh();
{
  const path = join("packages", "knowledge", "raw", "rules.json");
  const rules = readJson(path);
  rules.push({
    id: "sabotage_universal_weight", scope: { type: "global" }, category: "weight", criticality: "high",
    applies_when: { all: [{ fact: "placement", op: "eq", value: "cabin" }, { fact: "dog.weight_kg", op: "gt", value: 10 }] },
    effect: { action: "deny", placement: ["cabin"] }, params: {}, rationale: "sabotage",
    source: { url: "https://www.iata.org/en/youandiata/travelers/pets/", source_type: "other", verified_date: "2026-09-15", review_due: "2026-12-14", confidence: 4, reviewer: "test", history: [], quote: "A carrier must fit under the seat.", quote_language: "en", locator: "pets" },
  });
  writeJson(path, rules);
  const result = run();
  check("un plafond de compagnie universalisé est refusé", result.code === 1 && result.out.includes("UNIVERSAL_WEIGHT_RULE\tglobal\tcabin\tsabotage_universal_weight"), result.out.slice(-800));
}

fresh();
{
  const path = join("packages", "knowledge", "raw", "objects.json");
  const objects = readJson(path);
  delete objects.airlines.find((airline) => airline.id === "airline_neos").premium.policy.cabin.max_weight_kg;
  writeJson(path, objects);
  const result = run();
  check("un seuil perdu par le Finder est refusé", result.code === 1 && result.out.includes("FICHE_FINDER_DRIFT\tairline_neos\tcabin"), result.out.slice(-800));
}

fresh();
{
  const path = join("packages", "ui", "src", "data", "airlines.generated.json");
  const generated = readJson(path);
  generated.airline_neos.policies.cabin.max_weight_kg = 11;
  writeJson(path, generated);
  const result = run();
  check("un artefact public périmé est refusé", result.code === 1 && result.out.includes("FICHE_GENERATED_DRIFT\tairline_neos\tcabin"), result.out.slice(-800));
}

fresh();
{
  const path = join(sandbox, "content", "airlines", "neos.yml");
  writeFileSync(path, readFileSync(path, "utf8").replace("sub: ≤ 10 kg", "sub: ≤ 999 kg"));
  const result = run();
  check("un poids éditorial sans politique est refusé", result.code === 1 && result.out.includes("LADDER_WEIGHT_UNLINKED\tairline_neos\tcabin\t999 kg"), result.out.slice(-800));
}

fresh();
{
  const path = join(sandbox, "content", "airlines", "neos.yml");
  writeFileSync(path, readFileSync(path, "utf8").replace("does not exceed 10 kilograms", "does not exceed the published limit"));
  const result = run();
  check("un seuil absent de sa citation propre est refusé", result.code === 1 && result.out.includes("WEIGHT_VALUE_ABSENT_FROM_QUOTE\tairline_neos\tcabin\t10 kg"), result.out.slice(-800));
}

fresh();
{
  const path = join("packages", "knowledge", "raw", "rules.json");
  const rules = readJson(path);
  rules.push({
    id: "sabotage_global_weight", scope: { type: "airline", id: "airline_neos" }, category: "weight", criticality: "high",
    applies_when: { all: [{ fact: "placement", op: "eq", value: "cabin" }, { fact: "dog.weight_kg", op: "gt", value: 1 }] },
    effect: { action: "deny", placement: ["cabin"] }, params: {}, rationale: "sabotage",
    source: { url: "https://www.neosair.com/us/en/information/traveling-with-pets", source_type: "official_website", verified_date: "2026-09-15", review_due: "2026-12-14", confidence: 4, reviewer: "test", history: [], quote: "does not exceed 10 kilograms", quote_language: "en", locator: "weight" },
  });
  writeJson(path, rules);
  const result = run();
  check("une seconde règle globale de poids est refusée", result.code === 1 && result.out.includes("GLOBAL_WEIGHT_RULE_OUTSIDE_POLICY\tairline_neos\tcabin\tsabotage_global_weight"), result.out.slice(-800));
}

fresh();
{
  const path = join("packages", "knowledge", "raw", "rules.json");
  const rules = readJson(path);
  rules.push({
    id: "sabotage_route_without_quote", scope: { type: "airline", id: "airline_neos" }, category: "weight", criticality: "high",
    applies_when: { all: [{ fact: "route.destination_country", op: "eq", value: "FR" }, { fact: "dog.weight_kg", op: "gt", value: 1 }] },
    effect: { action: "deny", placement: ["cabin"] }, params: {}, rationale: "sabotage",
    source: { url: "https://www.neosair.com/us/en/information/traveling-with-pets", source_type: "official_website", verified_date: "2026-09-15", review_due: "2026-12-14", confidence: 4, reviewer: "test", history: [], quote_language: "en", locator: "weight" },
  });
  writeJson(path, rules);
  const result = run();
  check("une exception de trajet sans citation est refusée", result.code === 1 && result.out.includes("WEIGHT_RULE_SOURCE_INCOMPLETE\tairline_neos\tcabin\tsabotage_route_without_quote"), result.out.slice(-800));
}

rmSync(sandbox, { recursive: true, force: true });
console.log(`\n${pass} garanties vertes, ${fail} échec(s)`);
if (fail) process.exit(1);
