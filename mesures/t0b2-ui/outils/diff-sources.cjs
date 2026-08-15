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
 *
 * ET DANS `sources`, DEUX RÈGLES D'IDENTITÉ, relues dans `objects.json` :
 *   · toute URL RETIRÉE doit être une source RACINE de compagnie — celles qui ne documentent
 *     aucun canal. La première version de ce contrôle n'acceptait que le retrait des
 *     auto-citations MyDogCanFly ; la contre-revue du 15/08/2026 a montré que le critère était
 *     faux : sur les 50 racines restantes, 35 sont de simples pages d'accueil, qui ne prouvent
 *     pas davantage une politique. Ce qui disqualifie une racine n'est pas son domaine, c'est
 *     qu'elle n'est rattachée à aucun canal ;
 *   · toute URL AJOUTÉE doit être la source d'une POLITIQUE DE CANAL existante. Sans quoi le
 *     rapport citerait une page que rien n'atteste.
 * Les deux ensembles sont comparés par IDENTITÉ, jamais par cardinal.
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

/* Les deux références d'identité, RELUES dans la base — jamais recopiées ici. */
const objets = JSON.parse(fs.readFileSync(path.join(ROOT, "packages", "knowledge", "raw", "objects.json"), "utf8"));
const racines = new Set(), sourcesDeCanal = new Set();
for (const a of objets.airlines) {
  if (a.source?.url) racines.add(a.source.url);
  for (const ch of ["cabin", "hold", "cargo"]) {
    const u = a.premium?.policy?.[ch]?.source?.url;
    if (u) sourcesDeCanal.add(u);
  }
}
const estAuto = (u) => { try { return /(^|\.)mydogcanfly\.com$/i.test(new URL(u).hostname); } catch { return false; } };
const retireesHorsRacines = [...retirees.keys()].filter((u) => !racines.has(u));
const ajouteesHorsCanaux = [...ajoutees.keys()].filter((u) => !sourcesDeCanal.has(u));
const autoCitationsRetirees = [...retirees.keys()].filter(estAuto);
const ajouteesAuto = [...ajoutees.keys()].filter(estAuto);

console.log(`scénarios comparés             : ${cles.length}`);
console.log(`scénarios dont sources bouge   : ${Object.keys(parScenario).length}`);
console.log(`écarts HORS sources            : ${horsSources.length}${horsSources.length ? " — " + horsSources.slice(0, 5).join(", ") : ""}`);
console.log(`URL retirées (distinctes)      : ${retirees.size}, dont ${autoCitationsRetirees.length} auto-citations`);
console.log(`  … non reconnues comme racines: ${retireesHorsRacines.length}`);
console.log(`URL ajoutées (distinctes)      : ${ajoutees.size}, dont auto-citations : ${ajouteesAuto.length}`);
console.log(`  … non sources de canal       : ${ajouteesHorsCanaux.length}`);

if (horsSources.length || retireesHorsRacines.length || ajouteesHorsCanaux.length || ajouteesAuto.length) {
  console.error("\nÉCHEC : ce lot ne s'autorise QUE le retrait de sources RACINES et l'ajout de sources de CANAL.");
  for (const u of retireesHorsRacines.slice(0, 5)) console.error(`  retirée mais pas une racine : ${u}`);
  for (const u of ajouteesHorsCanaux.slice(0, 5)) console.error(`  ajoutée mais pas une source de canal : ${u}`);
  process.exit(1);
}

const diff = {
  perimetre: "T0-B2-UI — la source RACINE d'une compagnie cesse de justifier une décision",
  avant: "test-baselines/t0b2-finder-baseline-apres.json",
  apres: "test-baselines/t0b2ui-finder-baseline-apres.json",
  champs_autorises: ["sources"],
  totaux: {
    scenarios: cles.length,
    scenarios_touches: Object.keys(parScenario).length,
    retirees_distinctes: retirees.size,
    retirees_auto_citations: autoCitationsRetirees.length,
    ajoutees_distinctes: ajoutees.size,
  },
  racines_retirees: [...retirees].sort().map(([url, scenarios]) => ({ url, scenarios, auto_citation: estAuto(url) })),
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
