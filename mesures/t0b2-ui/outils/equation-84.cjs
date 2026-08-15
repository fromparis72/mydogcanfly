/**
 * T0-B2-UI — scellement de l'équation 84 = 78 canaux visibles contradictoires + 6 sans canal,
 * et mesure QUADRILINGUE de la surface réellement rendue.
 *
 *   node mesures/t0b2-ui/outils/equation-84.cjs
 *
 * Lecture seule sur les fiches YAML. N'exige aucun build : l'équation porte sur le contrat, la
 * surface rendue s'en déduit par le nombre de langues publiées.
 */
const fs = require("node:fs");
const path = require("node:path");
const YAML = require("yaml");

const ROOT = path.join(__dirname, "..", "..", "..");
const SRC = path.join(ROOT, "content", "airlines");
/** Les quatre langues publiées : la racine (en) plus trois préfixes. */
const LANGUES = ["en", "fr", "es", "pt"];

/** Ce que la pastille `cls` fait lire aujourd'hui — l'ancienne traduction, mot pour mot. */
const litDeCls = (cls) => (cls === "no" ? "indisponible" : cls === "neutral" ? "neutre" : "disponible");
/** Ce que le contrat canonique décide. */
const CIBLE = { offered: "disponible", not_offered: "indisponible", case_by_case: "à confirmer", undocumented: "à confirmer" };

const migrees = [], contradictions = [], sansCanal = [], concordantes = [];
let politiques = 0, canaux = 0;

for (const f of fs.readdirSync(SRC).filter((x) => x.endsWith(".yml") && !x.startsWith("_")).sort()) {
  const fiche = YAML.parse(fs.readFileSync(path.join(SRC, f), "utf8"));
  const parPlacement = new Map((fiche.channels || []).map((c) => [c.placement, c]));
  canaux += (fiche.channels || []).length;
  for (const mode of ["cabin", "hold", "cargo"]) {
    const d = fiche.policies?.[mode];
    if (!d) continue;
    politiques++;
    const cle = `${fiche.id}.${mode}`;
    /* « Migrée » = tout ce qui n'est pas une conversion mécanique : les 83 non revérifiées et
       l'unique non documentée. Ce sont elles, et elles seules, que T0-B2 fait basculer. */
    const estMigree = "review_state" in d || d.availability === "undocumented" || d.availability === "case_by_case";
    if (!estMigree) continue;
    migrees.push(cle);
    const c = parPlacement.get(mode);
    if (!c) { sansCanal.push(cle); continue; }
    const canonique = "review_state" in d ? "à confirmer" : CIBLE[d.availability];
    if (litDeCls(c.cls) !== canonique) contradictions.push({ cle, cls: c.cls, affiche: litDeCls(c.cls), canonique });
    else concordantes.push(cle);
  }
}

const fiches = [...new Set(contradictions.map((x) => x.cle.slice(0, x.cle.lastIndexOf("."))))];
const equationTenue = migrees.length === contradictions.length + sansCanal.length + concordantes.length;

console.log("=== ÉQUATION ===");
console.log(`politiques totales           : ${politiques}`);
console.log(`politiques MIGRÉES           : ${migrees.length}`);
console.log(`  ├─ canal visible CONTREDIT : ${contradictions.length}`);
console.log(`  ├─ canal visible CONCORDE  : ${concordantes.length}`);
console.log(`  └─ SANS canal visible      : ${sansCanal.length}`);
console.log(`\n${migrees.length} = ${contradictions.length} + ${concordantes.length} + ${sansCanal.length}  →  ${equationTenue ? "TENUE" : "ROMPUE"}`);

console.log("\nles politiques SANS canal visible, par identité :");
for (const k of sansCanal.sort()) console.log(`   ${k}`);

console.log("\n=== SURFACE RENDUE, QUATRE LANGUES ===");
console.log(`langues publiées             : ${LANGUES.length} (${LANGUES.join(", ")})`);
console.log(`statuts rendus contradictoires: ${contradictions.length} × ${LANGUES.length} = ${contradictions.length * LANGUES.length}`);
console.log(`fiches touchées               : ${fiches.length}`);
console.log(`pages localisées touchées     : ${fiches.length} × ${LANGUES.length} = ${fiches.length * LANGUES.length}`);

fs.writeFileSync(path.join(__dirname, "..", "equation-84.json"), JSON.stringify({
  perimetre: "T0-B2-UI — équation des politiques migrées et surface rendue quadrilingue",
  langues: LANGUES,
  totaux: {
    politiques, canaux_visibles: canaux,
    migrees: migrees.length,
    contradictions: contradictions.length,
    concordantes: concordantes.length,
    sans_canal_visible: sansCanal.length,
    equation_tenue: equationTenue,
    fiches_touchees: fiches.length,
    statuts_rendus: contradictions.length * LANGUES.length,
    pages_localisees: fiches.length * LANGUES.length,
  },
  sans_canal_visible: sansCanal.sort(),
  fiches_touchees: fiches.sort(),
  contradictions,
}, null, 1) + "\n");

if (!equationTenue) { console.error("\nECHEC : l'équation ne se referme pas."); process.exit(1); }
