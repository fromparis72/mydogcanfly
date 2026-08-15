// T0-B2 v2 — candidat selon les décisions P0 de Codex (15/08/2026).
//   - 73 couples du manifeste            → review_state: legacy_unreviewed
//   - 10 POLICY_STALE (lot M1-v3)        → review_state: legacy_unreviewed  [DÉCISION P0]
//   - airline_thai_airways.cargo         → availability: undocumented
//   - 218 restants (mécaniques)          → offered / not_offered selon allowed
// Total 218 + 83 + 1 = 302.
import { readFileSync, writeFileSync } from "node:fs";

const SIM = process.argv[2];
const OUT_REG = process.argv[3];
const OBJECTS = SIM + "/packages/knowledge/raw/objects.json";
const MANIFEST = SIM + "/test-baselines/t0b-migration-matrice.json";

/* Ensemble SCELLÉ, copié depuis KNOWN_POLICY_STALE (ingest-airlines.mjs). Ces politiques ne sont
   plus rattachables à leur fiche : l'artefact survivant n'est pas une vérité canonique, il est
   précisément le côté identifié comme périmé. Les convertir mécaniquement consacrerait cette
   péremption (cas French Bee : le YAML dit `warn/Via freight`, l'artefact dit `allowed:false`). */
const POLICY_STALE = new Set([
  "airline_asiana.cargo", "airline_condor.cargo", "airline_eva_air.cargo",
  "airline_french_bee.cargo", "airline_korean_air.cargo", "airline_malaysia_airlines.cargo",
  "airline_norwegian.cargo", "airline_qantas.cargo", "airline_qantas.hold",
  "airline_virgin_australia.hold",
]);

const objects = JSON.parse(readFileSync(OBJECTS, "utf8"));
const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
const manByKey = new Map(manifest.rows.map((r) => [r.identity.airline_id + "." + r.identity.placement, r]));

const stats = { legacy_manifeste: 0, legacy_stale: 0, undocumented: 0, offered: 0, not_offered: 0 };
const registre = [];
let conditionalVus = 0, staleVus = 0;

for (const a of objects.airlines || []) {
  const pol = a.premium?.policy;
  if (!pol) continue;
  for (const mode of ["cabin", "hold", "cargo"]) {
    const p = pol[mode];
    if (p === undefined) continue;
    if (!("allowed" in p)) throw new Error(`forme inattendue : ${a.id}.${mode}`);
    const key = a.id + "." + mode;
    const man = manByKey.get(key);
    const stale = POLICY_STALE.has(key);
    if (p.conditional === true) conditionalVus++;
    if (stale) staleVus++;
    if (man && p.conditional !== true) throw new Error(`ligne de manifeste sans conditional : ${key}`);
    const { allowed, conditional, ...rest } = p;
    let neuf, cible, lot;
    if (man && man.decision.state === "legacy_unreviewed") {
      neuf = { review_state: "legacy_unreviewed", ...rest };
      cible = "review_state:legacy_unreviewed"; lot = "73_manifeste"; stats.legacy_manifeste++;
    } else if (man && man.decision.state === "reviewed") {
      if (man.decision.target_availability !== "undocumented") throw new Error(`reviewed inattendu : ${key}`);
      neuf = { availability: "undocumented", ...rest };
      cible = "availability:undocumented"; lot = "1_thai_cargo"; stats.undocumented++;
    } else if (stale) {
      neuf = { review_state: "legacy_unreviewed", ...rest };
      cible = "review_state:legacy_unreviewed"; lot = "10_policy_stale"; stats.legacy_stale++;
    } else {
      const av = allowed ? "offered" : "not_offered";
      neuf = { availability: av, ...rest };
      cible = "availability:" + av; lot = "218_mecanique"; stats[av]++;
    }
    pol[mode] = neuf;
    registre.push({ key, avant: { allowed, ...(conditional ? { conditional } : {}) }, cible, lot });
  }
}

const legacyTotal = stats.legacy_manifeste + stats.legacy_stale;
const mecaniques = stats.offered + stats.not_offered;
const total = legacyTotal + stats.undocumented + mecaniques;
console.log("total migré        :", total);
console.log("mécaniques (218)   :", mecaniques, `(offered ${stats.offered} / not_offered ${stats.not_offered})`);
console.log("legacy_unreviewed  :", legacyTotal, `(manifeste ${stats.legacy_manifeste} + stale ${stats.legacy_stale})`);
console.log("undocumented (1)   :", stats.undocumented);
console.log("conditional vus    :", conditionalVus, "| POLICY_STALE vus :", staleVus);
if (total !== 302) throw new Error("total ≠ 302");
if (mecaniques !== 218) throw new Error(`mécaniques ≠ 218 (${mecaniques})`);
if (legacyTotal !== 83) throw new Error(`legacy ≠ 83 (${legacyTotal})`);
if (stats.undocumented !== 1) throw new Error("undocumented ≠ 1");
if (conditionalVus !== 74) throw new Error("conditional ≠ 74");
if (staleVus !== 10) throw new Error(`POLICY_STALE ≠ 10 (${staleVus})`);
if (/"conditional"/.test(JSON.stringify(objects))) throw new Error("conditional résiduel");

writeFileSync(OBJECTS, JSON.stringify(objects, null, 2) + "\n");
if (OUT_REG) writeFileSync(OUT_REG, JSON.stringify({ stats, registre }, null, 1) + "\n");
console.log("candidat v2 écrit.");
