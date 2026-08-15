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
/* ---- Bijection : le manifeste a-t-il été CONSOMMÉ, exactement ? (T0-B2) --------------------
 *
 * Jusqu'à la migration, la cible était l'ensemble des 74 `conditional: true` d'objects.json : le
 * vérificateur gardait l'état AVANT et refusait de migrer une donnée qui n'était plus celle qui
 * avait été auditée. Cette cible a disparu avec la migration — c'était son but.
 *
 * La cible devient ce que le cadrage exige ensuite : « entrée du manifeste non consommée ou
 * couple supplémentaire → échec ». Chaque ligne doit avoir produit sa décision, à sa valeur, et
 * aucune politique migrée ne doit exister hors du manifeste — à l'exception des dix anciens
 * POLICY_STALE, versés en `legacy_unreviewed` par décision de contre-revue et scellés ici par
 * IDENTITÉ, jamais par cardinal.
 *
 * Le cœur cryptographique, lui, est INCHANGÉ : les empreintes portent sur `name`, `statusLabel`,
 * `detail`, `fee`, `value`, `cls` — la migration n'a fait qu'AJOUTER `placement` aux canaux, sans
 * toucher un seul de ces champs. Les 74 empreintes se revérifient donc à l'identique sur les
 * fiches migrées, ce qui prouve qu'aucun bloc audité n'a bougé pendant la migration. */
const objects = JSON.parse(readFileSync(join(repo, "packages/knowledge/raw/objects.json"), "utf8"));
const STALE_VERSES = new Set([
  "airline_asiana|cargo", "airline_condor|cargo", "airline_eva_air|cargo",
  "airline_french_bee|cargo", "airline_korean_air|cargo", "airline_malaysia_airlines|cargo",
  "airline_norwegian|cargo", "airline_qantas|cargo", "airline_qantas|hold",
  "airline_virgin_australia|hold",
]);
/** Décision runtime visée par une ligne du manifeste, sous forme d'auteur. */
const attenduPour = (r) => r.decision.state === "legacy_unreviewed"
  ? { review_state: "legacy_unreviewed" }
  : { availability: r.decision.target_availability };
const migrees = new Set(), formeHeritee = [];
for (const a of objects.airlines) {
  const pol = a.premium?.policy ?? {};
  for (const ch of ["cabin", "hold", "cargo"]) {
    const p = pol[ch]; if (!p) continue;
    if ("allowed" in p || "conditional" in p) formeHeritee.push(`${a.id}|${ch}`);
    if ("review_state" in p || p.availability === "undocumented" || p.availability === "case_by_case") migrees.add(`${a.id}|${ch}`);
  }
}
for (const k of formeHeritee) err(`forme d'auteur héritée réintroduite: ${k}`);
for (const k of migrees) {
  if (ids.includes(k) || STALE_VERSES.has(k)) continue;
  err(`politique migrée hors manifeste et hors dette scellée: ${k}`);
}
for (const k of STALE_VERSES) if (!migrees.has(k)) err(`POLICY_STALE versé non migré: ${k}`);
for (const r of rows) {
  const k = `${r.identity.airline_id}|${r.identity.placement}`;
  const a = objects.airlines.find((x) => x.id === r.identity.airline_id);
  const p = a?.premium?.policy?.[r.identity.placement];
  if (!p) { err(`ligne de manifeste NON consommée (politique absente): ${k}`); continue; }
  const attendu = attenduPour(r);
  const cle = Object.keys(attendu)[0];
  if (p[cle] !== attendu[cle]) err(`ligne de manifeste non consommée à sa valeur: ${k} → ${cle}=${p[cle]} ≠ ${attendu[cle]}`);
}
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
