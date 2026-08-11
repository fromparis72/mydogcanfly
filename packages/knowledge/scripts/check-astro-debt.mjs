#!/usr/bin/env node
/**
 * check-astro-debt.mjs — plafond de dette `astro check`.
 *
 * CE N'EST PAS UN `astro check` QUI RÉUSSIT. C'est une dette connue, chiffrée, empêchée de croître.
 * Le distinguo est de Codex (11/08/2026) et il compte : présenter 175 erreurs comme un contrôle
 * vert reviendrait à normaliser leur présence.
 *
 * Un total figé ne suffit pas : à 175 constant, une erreur nouvelle pourrait remplacer une
 * ancienne sans que rien ne le signale. La référence enregistre donc AUSSI la répartition par code
 * TypeScript et par fichier, et toute hausse sur l'une de ces lignes échoue — même si le total
 * n'a pas bougé.
 *
 * Le script échoue également quand le compte DESCEND sous la référence : il faut alors resserrer
 * la référence. Un plafond qu'on oublie d'abaisser cesse d'être un plafond.
 *
 *   node packages/knowledge/scripts/check-astro-debt.mjs            # contrôle
 *   node packages/knowledge/scripts/check-astro-debt.mjs --update   # réécrit la référence
 */
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const REPO_ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..", "..");
const BASELINE = join(REPO_ROOT, "docs/astro-check-baseline.json");
const UPDATE = process.argv.includes("--update");

const log = (m) => process.stderr.write(`[astro-debt] ${m}\n`);

/* Binaire LOCAL, jamais `npx` (K-bis, 11/08/2026) : `npx` résout selon l'environnement — dans
 * un shell `npx -p node@22` il échoue, et hors lockfile il peut télécharger une version
 * arbitraire d'astro. Le binaire de node_modules est celui que le lockfile a installé. */
const res = spawnSync(join(REPO_ROOT, "node_modules/.bin/astro"), ["check", "--root", "packages/ui"], {
  cwd: REPO_ROOT,
  encoding: "utf8",
  env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1" },
});
// `astro check` sort en code non nul dès qu'il reste une erreur : c'est attendu ici, on lit la sortie.
const out = (res.stdout + res.stderr).replace(/\[[0-9;]*m/g, "");

const byCode = {};
const byFile = {};
let total = 0;
for (const line of out.split("\n")) {
  const m = line.match(/^(\S+?):\d+:\d+ - error (ts\(\d+\)|\w+):/);
  if (!m) continue;
  total++;
  byFile[m[1]] = (byFile[m[1]] ?? 0) + 1;
  byCode[m[2]] = (byCode[m[2]] ?? 0) + 1;
}

if (total === 0 && !/Result \(/.test(out)) {
  log("ÉCHEC : sortie d'`astro check` illisible — aucune ligne d'erreur reconnue et aucun résumé.");
  process.stderr.write(out.slice(-1500) + "\n");
  process.exit(1);
}

const current = { total, byCode, byFile };

if (UPDATE) {
  writeFileSync(BASELINE, JSON.stringify(current, null, 2) + "\n");
  log(`Référence réécrite : ${relative(REPO_ROOT, BASELINE)} — ${total} erreur(s).`);
  process.exit(0);
}

if (!existsSync(BASELINE)) {
  log(`ÉCHEC : référence absente (${relative(REPO_ROOT, BASELINE)}). La créer avec --update.`);
  process.exit(1);
}
const base = JSON.parse(readFileSync(BASELINE, "utf8"));

const hausses = [];
for (const [k, v] of Object.entries(current.byCode)) {
  const b = base.byCode[k] ?? 0;
  if (v > b) hausses.push(`code ${k} : ${b} → ${v}`);
}
for (const [k, v] of Object.entries(current.byFile)) {
  const b = base.byFile[k] ?? 0;
  if (v > b) hausses.push(`${k} : ${b} → ${v}`);
}

if (hausses.length > 0) {
  log(`ÉCHEC : dette en hausse (total ${base.total} → ${total}).`);
  for (const h of hausses) log(`    ${h}`);
  log("");
  log("Une hausse par code ou par fichier échoue même à total constant : sans ça, une erreur");
  log("nouvelle pourrait prendre la place d'une ancienne sans que personne ne le voie.");
  process.exit(1);
}

if (total < base.total) {
  log(`Dette en BAISSE : ${base.total} → ${total}. C'est une bonne nouvelle, et la référence doit suivre :`);
  log("    node packages/knowledge/scripts/check-astro-debt.mjs --update");
  log("Sans ça, les erreurs résorbées pourraient revenir sans déclencher d'échec.");
  process.exit(1);
}

log(`OK — dette stable à ${total} erreur(s), aucune hausse par code ni par fichier.`);
log("Rappel : ce n'est pas un `astro check` réussi, c'est une dette contenue.");
const top = Object.entries(base.byFile).sort((a, b) => b[1] - a[1]).slice(0, 3);
log(`Plus gros contributeurs : ${top.map(([f, n]) => `${f.split("/").pop()} (${n})`).join(", ")}.`);
