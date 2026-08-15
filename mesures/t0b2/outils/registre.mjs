/**
 * T0-B2 — registre des couples (compagnie, placement) et preuves de bijection.
 *
 *   node mesures/t0b2/outils/registre.mjs <racine> <sortie.json>
 *
 * LECTURE SEULE sur le dépôt. Reproduit à l'identique la dérivation actuelle
 * (`catOf` + `cls`, ingest-airlines.mjs) pour établir l'état AVANT sans le modifier, puis
 * recalcule les 74 empreintes du manifeste contre les fiches VIVANTES.
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join } from "node:path";
import YAML from "yaml";

const ROOT = process.argv[2];
const OUT = process.argv[3];
if (!ROOT || !OUT) { console.error("usage : registre.mjs <racine> <sortie.json>"); process.exit(2); }

const SRC = join(ROOT, "content", "airlines");
const OBJECTS = join(ROOT, "packages", "knowledge", "raw", "objects.json");
const MANIFEST = join(ROOT, "test-baselines", "t0b-migration-matrice.json");

/** Copie CONFORME de la dérivation courante — c'est la source du problème que T0-B2 supprime. */
const catOf = (name) => {
  const n = (name || "").toLowerCase();
  if (/cargo|fret/.test(n)) return "cargo";
  if (/hold|soute|checked/.test(n)) return "hold";
  if (/cabin|cabine/.test(n)) return "cabin";
  return null;
};
const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");
/** Empreinte du manifeste : sha256 du JSON canonique (clés triées, séparateurs compacts). */
const canonJSON = (v) => {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(canonJSON).join(",") + "]";
  return "{" + Object.keys(v).sort().map((k) => JSON.stringify(k) + ":" + canonJSON(v[k])).join(",") + "}";
};

// ---- 1. Tous les canaux des fiches, reconnus ou non ----
const files = readdirSync(SRC).filter((f) => f.endsWith(".yml")).sort();
const reconnus = [], nonReconnus = [];
for (const f of files) {
  const fiche = YAML.parse(readFileSync(join(SRC, f), "utf8"));
  (fiche.channels || []).forEach((c, i) => {
    const row = {
      airline_id: fiche.id, file: `content/airlines/${f}`, locator: `channels[${i}]`,
      name_en: c.name?.en ?? null, cls: c.cls, statusLabel_en: c.statusLabel?.en ?? null,
      placement_derive: catOf(c.name?.en),
    };
    (row.placement_derive ? reconnus : nonReconnus).push(row);
  });
}

// ---- 2. Doublons de placement dans une même fiche ----
const doublons = [], vus = new Map();
for (const r of reconnus) {
  const k = `${r.airline_id}.${r.placement_derive}`;
  if (vus.has(k)) doublons.push({ key: k, premier: vus.get(k).locator, second: r.locator });
  else vus.set(k, r);
}

// ---- 3. État AVANT tel que `derivePolicy` le produit ----
for (const r of reconnus) {
  r.avant_allowed = r.cls === "no" ? false : (r.cls === "ok" || r.cls === "warn") ? true : undefined;
  r.avant_conditional = r.cls === "warn" ? true : undefined;
}

// ---- 4. Manifeste + re-vérification cryptographique sur les fiches vivantes ----
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const manByKey = new Map();
for (const row of manifest.rows) {
  const k = `${row.identity.airline_id}.${row.identity.placement}`;
  if (manByKey.has(k)) throw new Error(`manifeste : couple dupliqué ${k}`);
  manByKey.set(k, row);
}
const empreintesDivergentes = [], locatorsDivergents = [];
for (const row of manifest.rows) {
  const { file, locator, block, fingerprint, fingerprint_fields } = row.yaml_observation;
  const idx = parseInt(locator.match(/\[(\d+)\]/)[1], 10);
  const live = YAML.parse(readFileSync(join(ROOT, file), "utf8")).channels[idx];
  const pick = (o) => Object.fromEntries(fingerprint_fields.filter((f) => o?.[f] !== undefined).map((f) => [f, o[f]]));
  if (sha(canonJSON(pick(live))) !== fingerprint) empreintesDivergentes.push({ file, locator });
  if (canonJSON(pick(live)) !== canonJSON(pick(block))) empreintesDivergentes.push({ file, locator, note: "bloc ≠ fiche vivante" });
  const attendu = reconnus.find((r) => `${r.airline_id}.${r.placement_derive}` === `${row.identity.airline_id}.${row.identity.placement}`);
  if (attendu && (attendu.file !== file || attendu.locator !== locator)) locatorsDivergents.push({ file, locator, yaml: `${attendu.file}#${attendu.locator}` });
}

// ---- 5. objects.json ----
const objects = JSON.parse(readFileSync(OBJECTS, "utf8"));
const objByKey = new Map();
for (const a of objects.airlines || []) {
  const pol = a.premium?.policy || {};
  for (const mode of ["cabin", "hold", "cargo"]) if (pol[mode]) objByKey.set(`${a.id}.${mode}`, pol[mode]);
}
const conditionnels = [...objByKey.entries()].filter(([, p]) => p.conditional === true).map(([k]) => k).sort();
const manifesteSansConditional = [...manByKey.keys()].filter((k) => !conditionnels.includes(k));
const conditionalSansManifeste = conditionnels.filter((k) => !manByKey.has(k));

// ---- 6. Dérive cls → allowed (les conversions « mécaniques » le sont-elles vraiment ?) ----
const deriveAllowed = [];
for (const r of reconnus) {
  const p = objByKey.get(`${r.airline_id}.${r.placement_derive}`);
  if (!p) { deriveAllowed.push({ key: `${r.airline_id}.${r.placement_derive}`, probleme: "canal sans politique" }); continue; }
  if (r.avant_allowed !== undefined && p.allowed !== r.avant_allowed) {
    deriveAllowed.push({ key: `${r.airline_id}.${r.placement_derive}`, cls: r.cls, yaml: r.avant_allowed, objects: p.allowed });
  }
}

// ---- 7. Bijection YAML ↔ objects.json ----
const clesYaml = new Set(vus.keys()), clesObj = new Set(objByKey.keys());
const yamlSansPolitique = [...clesYaml].filter((k) => !clesObj.has(k)).sort();
const politiqueSansYaml = [...clesObj].filter((k) => !clesYaml.has(k)).sort();

const warnReconnus = reconnus.filter((r) => r.cls === "warn").length;
const warnNonReconnus = nonReconnus.filter((r) => r.cls === "warn").length;

const rapport = {
  perimetre: "T0-B2 — registre et bijections, état AVANT (lecture seule)",
  totaux: {
    fiches: files.length,
    canaux_visibles: reconnus.length + nonReconnus.length,
    canaux_reconnus_par_catOf: reconnus.length,
    canaux_non_reconnus: nonReconnus.length,
    couples_yaml_uniques: clesYaml.size,
    politiques_objects_json: clesObj.size,
    lignes_manifeste: manifest.rows.length,
    warn_total: warnReconnus + warnNonReconnus,
    warn_reconnus: warnReconnus,
    warn_non_reconnus: warnNonReconnus,
    conditional_dans_objects_json: conditionnels.length,
  },
  bijection: {
    doublons_placement: doublons,
    manifeste_sans_conditional: manifesteSansConditional,
    conditional_sans_manifeste: conditionalSansManifeste,
    manifeste_empreintes_divergentes: empreintesDivergentes,
    manifeste_locators_divergents: locatorsDivergents,
    derive_cls_vers_allowed: deriveAllowed,
    yaml_sans_politique: yamlSansPolitique,
    politique_sans_canal_yaml: politiqueSansYaml,
  },
  canaux_non_reconnus: nonReconnus,
  registre: reconnus.map((r) => ({
    airline_id: r.airline_id, placement: r.placement_derive, file: r.file, locator: r.locator,
    name_en: r.name_en, cls: r.cls,
    avant: { allowed: r.avant_allowed, ...(r.avant_conditional ? { conditional: true } : {}) },
    manifeste: manByKey.has(`${r.airline_id}.${r.placement_derive}`)
      ? manByKey.get(`${r.airline_id}.${r.placement_derive}`).decision.state : null,
  })),
};
writeFileSync(OUT, JSON.stringify(rapport, null, 1) + "\n");

console.log("totaux :", rapport.totaux);
console.log("\n=== BIJECTION ===");
let ecarts = 0;
for (const [k, v] of Object.entries(rapport.bijection)) {
  console.log(`${v.length === 0 ? "OK   " : "ECART"}  ${k} : ${v.length}`);
  ecarts += v.length;
}
console.log(ecarts === 0 ? "\nAucun écart de bijection." : `\n${ecarts} écart(s) — tous NOMMÉS dans ${OUT}.`);
