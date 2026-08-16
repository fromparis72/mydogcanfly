/**
 * T0-B3-a · la COMMANDE UNIQUE de reproduction.
 *
 *   npm run mesure:t0b3a
 *
 * Elle fait les quatre choses qu'exige la contre-revue, dans cet ordre, et échoue franchement à la
 * première qui ne tient pas :
 *
 *   0. l'arbre Git est-il propre AVANT de commencer, et la détection de saleté fonctionne-t-elle ?
 *   1. les fichiers bruts correspondent-ils à la base de mesure figée `e2cf302` ?
 *   2. régénérer l'artefact d'arbitrage ;
 *   3. vérifier `SHA256SUMS` — les artefacts doivent être identiques au bit près ;
 *   4. exiger un arbre Git PROPRE à la fin : régénérer ne doit rien changer.
 *
 * Le point 4 est celui qui manquait au départ. La première version scellait `git rev-parse HEAD` :
 * les artefacts devenaient irreproductibles dès leur propre commit, puisque régénérer changeait le
 * sceau, donc le fichier, donc son empreinte. Un dossier de mesure qui ne se reproduit pas depuis
 * son propre commit ne prouve rien — il documente une exécution, il n'établit pas un fait.
 *
 * ─── POURQUOI L'ARBRE EST CONTRÔLÉ EN ENTIER, ET POURQUOI LA DÉTECTION EST ELLE-MÊME TESTÉE ────
 *
 * Deuxième contre-revue du 16/08/2026 : un fichier non suivi déposé à la RACINE passait au vert.
 * Le contrôle ne regardait que `mesures/t0b3-…` et `packages/` — il annonçait « arbre propre »
 * pendant que `git status` montrait le contraire. Un contrôle qui ne peut pas échouer ne prouve
 * rien, et celui-là mentait par cadrage.
 *
 * Deux corrections, indissociables : le contrôle porte désormais sur TOUT l'arbre, et il est
 * lui-même mis à l'épreuve à chaque exécution — on dépose un fichier parasite à la racine, on
 * exige que la détection le voie, puis on l'efface. Sans cette contre-épreuve, un futur cadrage
 * trop étroit repasserait au vert sans que personne ne s'en aperçoive.
 *
 *   --ecrire   recalcule SHA256SUMS au lieu de le vérifier (à n'utiliser que si l'on a
 *              DÉLIBÉRÉMENT changé la mesure, et alors la contre-revue doit revoir le diff).
 *              Ce mode SEUL tolère un arbre sale au départ : les outils viennent d'être modifiés.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";
import { MESURE_BASE_SHA } from "./lib-arbitrage.mjs";

const DOSSIER = "mesures/t0b3a-arbitrage-brachy";
const ECRIRE = process.argv.includes("--ecrire");
const OUTILS = ["arbitrer"];
const ARTEFACTS = ["README.md", "arbitrage-p0-brachy.json"];
const SOURCES = OUTILS.map((o) => `outils/${o}.mjs`).concat("outils/lib-arbitrage.mjs", "outils/reproduire.mjs");

const sha256 = (b) => createHash("sha256").update(b).digest("hex");
const echouer = (m) => { process.stderr.write(`[mesure:t0b3a] ÉCHEC — ${m}\n`); process.exit(1); };
const dire = (m) => process.stdout.write(`[mesure:t0b3a] ${m}\n`);

/** L'état de TOUT l'arbre — suivi et non suivi, à la racine comme ailleurs. Pas de chemin en
 *  argument : c'est le cadrage qui avait rendu ce contrôle complaisant. */
const arbreSale = () =>
  execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { encoding: "utf8" }).trim();

/* ---- 0. le contrôle de propreté doit d'abord prouver qu'il sait échouer ------------------------ */
{
  const parasite = `.mesure-t0b3-contre-epreuve-${process.pid}`;
  writeFileSync(parasite, "contre-épreuve : ce fichier doit rendre l'arbre sale\n");
  let vu;
  try {
    vu = arbreSale().split("\n").some((l) => l.includes(parasite));
  } finally {
    if (existsSync(parasite)) unlinkSync(parasite);
  }
  if (!vu) {
    echouer("la détection d'arbre sale ne voit pas un fichier parasite déposé à la racine — " +
      "le contrôle de propreté est inopérant, tout « arbre propre » qu'il annoncerait serait faux");
  }
  dire("0/4 contre-épreuve : un fichier parasite à la racine EST détecté");
}

/* ---- 0 bis. et l'arbre doit être propre AVANT de commencer ------------------------------------- */
{
  const sale = arbreSale();
  if (sale && !ECRIRE) {
    echouer(`l'arbre est sale AVANT de commencer — une reproduction partant d'un état modifié ne ` +
      `prouve rien :\n${sale}\n(« --ecrire » est le seul mode qui tolère un arbre sale au départ)`);
  }
  dire(sale ? "0bis/4 arbre sale au départ, toléré par --ecrire" : "0bis/4 arbre propre au départ");
}

/* ---- 1. la base de mesure ---------------------------------------------------------------------- */
for (const f of ["packages/knowledge/raw/rules.json", "packages/knowledge/raw/objects.json"]) {
  let auCommit;
  try {
    auCommit = execFileSync("git", ["show", `${MESURE_BASE_SHA}:${f}`], { maxBuffer: 256 * 1024 * 1024 });
  } catch {
    echouer(`la base de mesure ${MESURE_BASE_SHA.slice(0, 7)} est absente du dépôt local — « git fetch origin main » puis relancer`);
  }
  if (sha256(readFileSync(f)) !== sha256(auCommit)) {
    echouer(`${f} diffère de la base ${MESURE_BASE_SHA.slice(0, 7)} — le dossier ne peut pas se régénérer sur un autre état`);
  }
}
dire(`1/4 référentiel conforme à la base ${MESURE_BASE_SHA.slice(0, 7)}`);

/* ---- 2. régénérer -------------------------------------------------------------------------------- */
/* `process.execPath` et non `npx` : `npx` résout dans l'environnement et peut TÉLÉCHARGER un paquet
   absent du lockfile — c'est-à-dire exécuter un autre code que celui qu'on a verrouillé, en
   silence. Le risque avait déjà été écarté ailleurs dans le dépôt ; il était revenu ici. On lance
   donc le Node courant, avec le tsx installé localement. */
for (const o of OUTILS) {
  const args = [];
  const r = spawnSync(process.execPath, ["--import", "tsx", `${DOSSIER}/outils/${o}.mjs`, ...args],
    { encoding: "utf8" });
  if (r.status !== 0) echouer(`outil « ${o} » sorti en ${r.status}\n${(r.stderr || "").slice(-1500)}`);
}
dire(`2/4 artefact régénéré`);

/* ---- 3. SHA256SUMS ------------------------------------------------------------------------------- */
const lignes = [...ARTEFACTS, ...SOURCES].sort()
  .map((f) => `${sha256(readFileSync(`${DOSSIER}/${f}`))}  ${f}`);
if (ECRIRE) {
  writeFileSync(`${DOSSIER}/SHA256SUMS`, lignes.join("\n") + "\n");
  dire(`3/4 SHA256SUMS RÉÉCRIT (${lignes.length} entrées) — le diff doit passer en contre-revue`);
} else {
  const attendu = readFileSync(`${DOSSIER}/SHA256SUMS`, "utf8").trim().split("\n");
  const ecarts = [];
  const parFichier = new Map(attendu.map((l) => [l.slice(66).trim(), l.slice(0, 64)]));
  for (const l of lignes) {
    const f = l.slice(66).trim(), h = l.slice(0, 64);
    if (!parFichier.has(f)) ecarts.push(`${f} : absent de SHA256SUMS`);
    else if (parFichier.get(f) !== h) ecarts.push(`${f} : ${h.slice(0, 12)} ≠ ${parFichier.get(f).slice(0, 12)}`);
  }
  for (const f of parFichier.keys()) if (!lignes.some((l) => l.slice(66).trim() === f)) ecarts.push(`${f} : listé mais absent du dossier`);
  if (ecarts.length) echouer(`SHA256SUMS ne correspond pas :\n  ${ecarts.join("\n  ")}`);
  dire(`3/4 SHA256SUMS vérifié — ${lignes.length} fichiers identiques au bit près`);
}

/* ---- 4. l'arbre entier doit être propre à la fin -------------------------------------------------- */
const sale = arbreSale();
if (sale && !ECRIRE) {
  echouer(`régénérer a MODIFIÉ l'arbre — le dossier n'est pas reproductible :\n${sale}`);
}
dire(sale ? "4/4 arbre modifié (attendu avec --ecrire)" : "4/4 arbre entier propre : régénérer ne change rien");
dire("dossier T0-B3-a reproductible.");
