/**
 * T0-B2-UI — l'équation des politiques migrées, comparée à des RÉFÉRENCES INDÉPENDANTES.
 *
 *   node mesures/t0b2-ui/outils/equation-84.cjs
 *
 * POURQUOI CETTE VERSION (contre-revue du 15/08/2026)
 *
 * La première rangeait chaque politique dans l'un de trois tableaux, puis vérifiait que leur
 * somme valait le total. C'était une TAUTOLOGIE : une partition se referme toujours, quels que
 * soient les nombres. Elle aurait affiché « TENUE » sur 12 = 5 + 3 + 4.
 *
 * Trois durcissements :
 *   1. les valeurs exactes 84 / 78 / 0 / 6 sont EXIGÉES, pas constatées ;
 *   2. l'ensemble des 84 migrées est comparé, PAR IDENTITÉ, à une référence extérieure — le
 *      manifeste approuvé (74 lignes) uni aux 10 anciens POLICY_STALE scellés dans l'ingestion ;
 *   3. les 6 sans canal visible sont comparés à la liste scellée `POLITIQUES_SANS_CANAL_VISIBLE`,
 *      relue DANS le script d'ingestion — jamais recopiée ici, sinon les deux divergeraient.
 *
 * La mesure de la surface rendue n'est PAS faite ici : multiplier 78 par 4 ne prouve rien sur ce
 * que les fichiers contiennent. C'est `test-entity-pages-harness.cjs` qui lit les 284 pages.
 */
const fs = require("node:fs");
const path = require("node:path");
const YAML = require("yaml");

const ROOT = path.join(__dirname, "..", "..", "..");
const SRC = path.join(ROOT, "content", "airlines");

const ATTENDU = { migrees: 84, contradictions: 78, concordantes: 0, sansCanal: 6 };

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};
const memeEnsemble = (a, b) => {
  const A = [...a].sort(), B = [...b].sort();
  return JSON.stringify(A) === JSON.stringify(B);
};

// ---- Références INDÉPENDANTES, relues à leur source unique -----------------------------------
const manifeste = JSON.parse(fs.readFileSync(path.join(ROOT, "test-baselines", "t0b-migration-matrice.json"), "utf8"));
const duManifeste = manifeste.rows.map((r) => `${r.identity.airline_id}.${r.identity.placement}`);

/** Les deux listes scellées vivent dans l'ingestion : on les relit là-bas, on ne les recopie pas. */
const ingestion = fs.readFileSync(path.join(ROOT, "packages", "knowledge", "scripts", "ingest-airlines.mjs"), "utf8");
const listeScellee = (nom) => {
  const m = new RegExp(`const ${nom} = \\[([^\\]]*)\\]`, "m").exec(ingestion);
  if (!m) throw new Error(`liste scellée introuvable dans l'ingestion : ${nom}`);
  return [...m[1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
};
const staleVerses = listeScellee("KNOWN_PROVENANCE_CURATED");
const sansCanalScellees = listeScellee("POLITIQUES_SANS_CANAL_VISIBLE");

/** L'ensemble des identités approuvées, versionné à part par T0-B2. */
const identitesApprouvees = JSON.parse(
  fs.readFileSync(path.join(ROOT, "test-baselines", "t0b2-policy-identities.json"), "utf8"),
).identities;

// ---- Observation sur les fiches ---------------------------------------------------------------
const litDeCls = (cls) => (cls === "no" ? "indisponible" : cls === "neutral" ? "neutre" : "disponible");
const CIBLE = { offered: "disponible", not_offered: "indisponible", case_by_case: "à confirmer", undocumented: "à confirmer" };

const toutes = [], migrees = [], contradictions = [], sansCanal = [], concordantes = [];
for (const f of fs.readdirSync(SRC).filter((x) => x.endsWith(".yml") && !x.startsWith("_")).sort()) {
  const fiche = YAML.parse(fs.readFileSync(path.join(SRC, f), "utf8"));
  const parPlacement = new Map((fiche.channels || []).map((c) => [c.placement, c]));
  for (const mode of ["cabin", "hold", "cargo"]) {
    const d = fiche.policies?.[mode];
    if (!d) continue;
    const cle = `${fiche.id}.${mode}`;
    toutes.push(cle);
    const estMigree = "review_state" in d || d.availability === "undocumented" || d.availability === "case_by_case";
    if (!estMigree) continue;
    migrees.push(cle);
    const c = parPlacement.get(mode);
    if (!c) { sansCanal.push(cle); continue; }
    const canonique = "review_state" in d ? "à confirmer" : CIBLE[d.availability];
    (litDeCls(c.cls) !== canonique ? contradictions : concordantes).push(cle);
  }
}

console.log("=== 1. Les identités, contre leurs références indépendantes ===");
check("les 302 politiques observées = l'ensemble APPROUVÉ versionné",
  memeEnsemble(toutes, identitesApprouvees), `observées ${toutes.length} · approuvées ${identitesApprouvees.length}`);
/* La référence du lot migré ne vient PAS des fiches : manifeste approuvé ∪ POLICY_STALE versés. */
const referenceMigrees = [...new Set([...duManifeste, ...staleVerses])];
check("les politiques migrées = manifeste (74) ∪ POLICY_STALE versés (10), par identité",
  memeEnsemble(migrees, referenceMigrees), `observées ${migrees.length} · référence ${referenceMigrees.length}`);
check("les politiques sans canal visible = la liste scellée de l'ingestion, par identité",
  memeEnsemble(sansCanal, sansCanalScellees), `observées ${sansCanal.length} · scellées ${sansCanalScellees.length}`);

console.log("\n=== 2. Les valeurs EXIGÉES, pas constatées ===");
check(`politiques migrées = ${ATTENDU.migrees}`, migrees.length === ATTENDU.migrees, String(migrees.length));
check(`canal visible qui CONTREDIT = ${ATTENDU.contradictions}`, contradictions.length === ATTENDU.contradictions, String(contradictions.length));
check(`canal visible qui CONCORDE = ${ATTENDU.concordantes}`, concordantes.length === ATTENDU.concordantes, String(concordantes.length));
check(`SANS canal visible = ${ATTENDU.sansCanal}`, sansCanal.length === ATTENDU.sansCanal, String(sansCanal.length));
/* La partition se refermerait sur n'importe quels nombres : elle n'est vérifiée qu'APRÈS les
   valeurs exactes, comme cohérence interne, jamais comme preuve. */
check("cohérence interne de la partition (après les valeurs exactes)",
  migrees.length === contradictions.length + concordantes.length + sansCanal.length);

console.log("\n=== 3. Contre-épreuve du contrôle lui-même ===");
/* Un contrôle par identité doit refuser une substitution à effectif constant : on en fabrique
   une, et on exige qu'elle échoue. Sans cela, rien ne prouve que la comparaison mord. */
const substitue = [...sansCanal.slice(0, -1), "airline_air_france.cargo"];
check("une substitution à effectif constant est REFUSÉE par la comparaison d'identités",
  !memeEnsemble(substitue, sansCanalScellees) && substitue.length === sansCanalScellees.length);

console.log("\nles 6 politiques sans canal visible :");
for (const k of [...sansCanal].sort()) console.log(`   ${k}`);

fs.writeFileSync(path.join(__dirname, "..", "equation-84.json"), JSON.stringify({
  perimetre: "T0-B2-UI — équation des politiques migrées, comparée à des références indépendantes",
  references: {
    manifeste: "test-baselines/t0b-migration-matrice.json (74 lignes)",
    stale_verses: "KNOWN_PROVENANCE_CURATED, relue dans ingest-airlines.mjs (10)",
    sans_canal: "POLITIQUES_SANS_CANAL_VISIBLE, relue dans ingest-airlines.mjs (6)",
    identites: "test-baselines/t0b2-policy-identities.json (302)",
  },
  attendu: ATTENDU,
  observe: {
    politiques: toutes.length, migrees: migrees.length,
    contradictions: contradictions.length, concordantes: concordantes.length, sans_canal: sansCanal.length,
  },
  migrees: [...migrees].sort(),
  contradictions: [...contradictions].sort(),
  sans_canal_visible: [...sansCanal].sort(),
}, null, 1) + "\n");

console.log(`\n${pass} OK, ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
