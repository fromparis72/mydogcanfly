/**
 * T0-B2 — contre-épreuve de traçabilité : CHAQUE bascule de décision observée dans le diff doit
 * remonter au registre approuvé, avec la transition et la cause EXACTES.
 *
 *   node mesures/t0b2/outils/verifier-bascules.mjs <diff.json> <registre-migration.json> <manifeste.json> <sortie.json>
 *
 * Sortie non nulle si une seule bascule n'est pas justifiée. Le compte des couples du registre
 * NON exercés par les scénarios est publié : un plafond de couverture silencieux serait un
 * faux vert.
 */
import { readFileSync, writeFileSync } from "node:fs";

const [, , FDIFF, FREG, FMAN, OUT] = process.argv;
if (!FDIFF || !FREG || !FMAN || !OUT) {
  console.error("usage : verifier-bascules.mjs <diff.json> <registre-migration.json> <manifeste.json> <sortie.json>");
  process.exit(2);
}

const diff = JSON.parse(readFileSync(FDIFF, "utf8"));
const registre = JSON.parse(readFileSync(FREG, "utf8"));
const manifeste = JSON.parse(readFileSync(FMAN, "utf8"));

/** Cible attendue par couple, d'après le registre de migration (clé « airline.placement »). */
const cible = new Map(registre.registre.map((r) => [r.key, r]));
/** Les couples MIGRÉS : tout ce qui n'est pas une conversion mécanique. */
const migres = new Set(registre.registre.filter((r) => r.lot !== "218_mecanique").map((r) => r.key));
const manByKey = new Map(manifeste.rows.map((r) => [`${r.identity.airline_id}.${r.identity.placement}`, r]));

/** « cabin:allowed hold:denied » → { cabin: "allowed", hold: "denied" } */
const parPlacement = (txt) => Object.fromEntries(txt.split(" ").map((x) => {
  const i = x.indexOf(":");
  return [x.slice(0, i), x.slice(i + 1)];
}));

const CAUSE_ATTENDUE = { "review_state:legacy_unreviewed": "legacy_unreviewed", "availability:undocumented": "policy_unpublished" };

let bascules = 0;
const couples = new Set(), horsRegistre = [], causeInattendue = [], transitionInattendue = [], transitions = {};

for (const d of diff.details) {
  for (const c of d.compagnies) {
    if (c.probleme) continue;
    for (const s of c.segments || []) {
      if (s.champ !== "decisions") continue;
      const A = parPlacement(s.avant), B = parPlacement(s.apres);
      for (const pl of new Set([...Object.keys(A), ...Object.keys(B)])) {
        if (A[pl] === B[pl]) continue;
        bascules++;
        const key = `${c.airline}.${pl}`;
        couples.add(key);
        const cbl = cible.get(key);
        if (!cbl || !migres.has(key)) { horsRegistre.push({ scenario: d.scenario, key, de: A[pl], vers: B[pl] }); continue; }
        const cause = CAUSE_ATTENDUE[cbl.cible];
        if (!cause) { horsRegistre.push({ scenario: d.scenario, key, note: `cible non migrante : ${cbl.cible}` }); continue; }
        const attendu = `confirmation_required[${cause}:${c.airline}#${pl}]`;
        if (A[pl] !== "allowed") transitionInattendue.push({ scenario: d.scenario, key, de: A[pl] });
        if (B[pl] !== attendu) causeInattendue.push({ scenario: d.scenario, key, obtenu: B[pl], attendu });
        const t = `${A[pl].split("[")[0]} → ${B[pl].split("[")[0]}`;
        transitions[t] = (transitions[t] || 0) + 1;
      }
    }
  }
}

const nonCouverts = [...migres].filter((k) => !couples.has(k)).sort();
const rapport = {
  bascules, couples_distincts: couples.size, couples: [...couples].sort(),
  couples_migres_total: migres.size,
  couples_migres_non_exerces_par_les_scenarios: nonCouverts,
  lignes_manifeste: manByKey.size,
  transitions,
  hors_registre: horsRegistre,
  transition_inattendue: transitionInattendue,
  cause_inattendue: causeInattendue,
};
writeFileSync(OUT, JSON.stringify(rapport, null, 1) + "\n");

console.log("bascules observées            :", bascules, "sur", couples.size, "couples");
console.log("transitions                   :", transitions);
console.log(`${horsRegistre.length === 0 ? "OK   " : "ECHEC"}  bascules hors registre : ${horsRegistre.length}`);
console.log(`${transitionInattendue.length === 0 ? "OK   " : "ECHEC"}  transitions ≠ allowed→confirmation : ${transitionInattendue.length}`);
console.log(`${causeInattendue.length === 0 ? "OK   " : "ECHEC"}  causes/policy_ref inattendues : ${causeInattendue.length}`);
console.log("couples migrés NON exercés par les scénarios :", nonCouverts.length, "/", migres.size,
  "→ couverts directement par couverture-projection.mjs");
if (horsRegistre.length || transitionInattendue.length || causeInattendue.length) process.exit(1);
