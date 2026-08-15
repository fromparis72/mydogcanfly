/**
 * T0-B2-UI — GÉNÉRATEUR du diff approuvé « sources » entre deux baselines FIGÉES.
 *
 *   node mesures/t0b2-ui/outils/diff-sources.cjs            → affiche seulement
 *   node mesures/t0b2-ui/outils/diff-sources.cjs --write    → écrit test-baselines/t0b2ui-approved-diff.json
 *
 * CE QU'IL COMPARE, et pourquoi ces deux fichiers-là :
 *   AVANT : test-baselines/t0b2-finder-baseline-apres.json — l'état figé à la fin de T0-B2 ;
 *   APRÈS : test-baselines/t0b2ui-finder-baseline-apres.json — l'état figé à la fin de ce lot.
 *
 * Deux fichiers FIGÉS, jamais l'état vivant : la preuve qui en découle (dans test-t0a-baseline.mjs)
 * ne peut donc ni rougir sous l'effet d'un lot futur, ni s'effacer.
 *
 * CE QUE LE LOT A LE DROIT DE CHANGER : le champ `sources` du rapport, et lui seul. Toute autre
 * différence — verdict, score, statut, décision, libellé, classement — est un écart métier que ce
 * lot n'a pas le droit de produire : le générateur REFUSE d'écrire si elle existe.
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.join(__dirname, "..", "..", "..");
const AVANT = path.join(ROOT, "test-baselines", "t0b2-finder-baseline-apres.json");
const APRES = path.join(ROOT, "test-baselines", "t0b2ui-finder-baseline-apres.json");
const SORTIE = path.join(ROOT, "test-baselines", "t0b2ui-approved-diff.json");
const WRITE = process.argv.includes("--write");

const avant = JSON.parse(fs.readFileSync(AVANT, "utf8"));
const apres = JSON.parse(fs.readFileSync(APRES, "utf8"));

const cles = Object.keys(avant);
if (JSON.stringify(cles.sort()) !== JSON.stringify(Object.keys(apres).sort())) {
  console.error("ÉCHEC : les deux baselines ne portent pas les mêmes scénarios.");
  process.exit(1);
}

const parScenario = {};
const retirees = new Map(), ajoutees = new Map();
const horsSources = [];
for (const k of cles) {
  const A = avant[k], B = apres[k];
  for (const f of Object.keys(B)) {
    if (JSON.stringify(A[f]) === JSON.stringify(B[f])) continue;
    if (f !== "sources") { horsSources.push(`${k}.${f}`); continue; }
    const out = A.sources.filter((u) => !B.sources.includes(u));
    const inn = B.sources.filter((u) => !A.sources.includes(u));
    parScenario[k] = { retirees: out, ajoutees: inn };
    for (const u of out) retirees.set(u, (retirees.get(u) || 0) + 1);
    for (const u of inn) ajoutees.set(u, (ajoutees.get(u) || 0) + 1);
  }
}

const estAuto = (u) => /(^|\.)mydogcanfly\.com$/i.test(new URL(u).hostname);
const retireesNonAuto = [...retirees.keys()].filter((u) => !estAuto(u));
const ajouteesAuto = [...ajoutees.keys()].filter((u) => estAuto(u));

console.log(`scénarios comparés            : ${cles.length}`);
console.log(`scénarios dont sources bouge  : ${Object.keys(parScenario).length}`);
console.log(`écarts HORS sources           : ${horsSources.length}${horsSources.length ? " — " + horsSources.slice(0, 5).join(", ") : ""}`);
console.log(`URL retirées (distinctes)     : ${retirees.size}, dont non auto-citations : ${retireesNonAuto.length}`);
console.log(`URL ajoutées (distinctes)     : ${ajoutees.size}, dont auto-citations : ${ajouteesAuto.length}`);

if (horsSources.length || retireesNonAuto.length || ajouteesAuto.length) {
  console.error("\nÉCHEC : ce lot ne s'autorise QUE le retrait d'auto-citations et l'ajout de sources de canal.");
  process.exit(1);
}

const diff = {
  perimetre: "T0-B2-UI — les auto-citations MyDogCanFly cessent de justifier une décision",
  avant: "test-baselines/t0b2-finder-baseline-apres.json",
  apres: "test-baselines/t0b2ui-finder-baseline-apres.json",
  champs_autorises: ["sources"],
  totaux: {
    scenarios: cles.length,
    scenarios_touches: Object.keys(parScenario).length,
    retirees_distinctes: retirees.size,
    ajoutees_distinctes: ajoutees.size,
  },
  auto_citations_retirees: [...retirees].sort().map(([url, scenarios]) => ({ url, scenarios })),
  sources_de_canal_ajoutees: [...ajoutees].sort().map(([url, scenarios]) => ({ url, scenarios })),
  par_scenario: Object.fromEntries(Object.keys(parScenario).sort().map((k) => [k, {
    retirees: [...parScenario[k].retirees].sort(),
    ajoutees: [...parScenario[k].ajoutees].sort(),
  }])),
};
if (WRITE) {
  fs.writeFileSync(SORTIE, JSON.stringify(diff, null, 1) + "\n");
  console.log(`\ndiff approuvé écrit : ${path.relative(ROOT, SORTIE)}`);
} else {
  console.log("\n(lecture seule — relancer avec --write pour figer)");
}
