#!/usr/bin/env node
/* Contre-épreuve T0-B — vérifie le bloc STOCKÉ autant que le YAML relu (contre-revue v5 :
 * un bloc falsifié dans la matrice, une ligne supprimée ou dupliquée passaient inaperçus).
 *   node t0b-verifie-empreintes.mjs <racine-du-depot> <t0b-matrice-74-v5.json>
 * Par ligne : hash(YAML relu) === fingerprint === hash(obs.block) ET canon(obs.block) ===
 * canon(YAML relu). Globalement : 74 lignes exactement, unicité (airline_id, placement),
 * BIJECTION avec les 74 politiques conditional:true d'objects.json, locator ^channels\[\d+\]$,
 * algorithme/champs constants, chemin de fiche cohérent avec airline_id. */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";
const [repoArg, matrixPath] = process.argv.slice(2);
const repo = resolve(repoArg);
const YAML = createRequire(join(repo, "package.json"))("yaml");
const ALGO = "sha256-canonical-json-v1";
const FIELDS = ["name", "statusLabel", "detail", "fee", "value", "cls"];
const canon = (v) => Array.isArray(v) ? v.map(canon)
  : v && typeof v === "object" ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, canon(v[k])]))
  : v;
const cjson = (v) => JSON.stringify(canon(v));
const hash = (v) => createHash("sha256").update(Buffer.from(cjson(v), "utf8")).digest("hex");
let bad = 0;
const err = (m) => { bad++; console.log("  ÉCART " + m); };
const matrix = JSON.parse(readFileSync(matrixPath, "utf8"));
const rows = matrix.rows;
if (rows.length !== 74) err(`nombre de lignes: ${rows.length} ≠ 74`);
const ids = rows.map((r) => `${r.identity.airline_id}|${r.identity.placement}`);
if (new Set(ids).size !== rows.length) err("doublon (airline_id, placement)");
/* Bijection avec les 74 conditional:true des données brutes. */
const objects = JSON.parse(readFileSync(join(repo, "packages/knowledge/raw/objects.json"), "utf8"));
const legacy = new Set();
for (const a of objects.airlines) {
  const pol = a.premium?.policy ?? {};
  for (const ch of ["cabin", "hold", "cargo"]) if (pol[ch]?.conditional === true) legacy.add(`${a.id}|${ch}`);
}
for (const k of ids) if (!legacy.has(k)) err(`intrus vs conditional:true: ${k}`);
for (const k of legacy) if (!ids.includes(k)) err(`absent de la matrice: ${k}`);
for (const r of rows) {
  const who = `${r.identity.airline_id}/${r.identity.placement}`;
  const obs = r.yaml_observation;
  if (obs.fingerprint_algorithm !== ALGO) err(`${who}: algorithme ≠ ${ALGO}`);
  if (JSON.stringify(obs.fingerprint_fields) !== JSON.stringify(FIELDS)) err(`${who}: fingerprint_fields inattendus`);
  const m = /^channels\[(\d+)\]$/.exec(obs.locator);
  if (!m) { err(`${who}: locator invalide ${obs.locator}`); continue; }
  const slug = r.identity.airline_id.replace(/^airline_/, "").replace(/_/g, "-");
  if (obs.file !== `content/airlines/${slug}.yml` && obs.file !== `content/airlines/${r.identity.airline_id.replace(/^airline_/, "")}.yml`)
    err(`${who}: chemin de fiche incohérent ${obs.file}`);
  const doc = YAML.parse(readFileSync(join(repo, obs.file), "utf8"));
  const ch = (doc.channels || [])[parseInt(m[1], 10)];
  const fromYaml = {};
  for (const k of FIELDS) if (k in ch) fromYaml[k] = ch[k];
  if (hash(fromYaml) !== obs.fingerprint) err(`${who}: empreinte ≠ YAML relu`);
  if (hash(obs.block) !== obs.fingerprint) err(`${who}: empreinte ≠ bloc STOCKÉ (bloc falsifié ?)`);
  if (cjson(obs.block) !== cjson(fromYaml)) err(`${who}: bloc stocké ≠ YAML relu`);
}
console.log(`${rows.length} lignes vérifiées, ${bad} écart(s)`);
process.exit(bad ? 1 : 0);
