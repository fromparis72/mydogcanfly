/**
 * T0-B3 · la COMMANDE UNIQUE de reproduction.
 *
 *   npm run mesure:t0b3
 *
 * Elle fait les quatre choses qu'exige la contre-revue, dans cet ordre, et échoue franchement à la
 * première qui ne tient pas :
 *
 *   1. les fichiers bruts correspondent-ils à la base de mesure figée `ca254bf…` ?
 *   2. régénérer les six artefacts ;
 *   3. vérifier `SHA256SUMS` — les artefacts doivent être identiques au bit près ;
 *   4. exiger un arbre Git PROPRE à la fin : régénérer ne doit rien changer.
 *
 * Le point 4 est celui qui manquait. La première version scellait `git rev-parse HEAD` : les
 * artefacts devenaient irreproductibles dès leur propre commit, puisque régénérer changeait le
 * sceau, donc le fichier, donc son empreinte. Un dossier de mesure qui ne se reproduit pas depuis
 * son propre commit ne prouve rien — il documente une exécution, il n'établit pas un fait.
 *
 *   --ecrire   recalcule SHA256SUMS au lieu de le vérifier (à n'utiliser que si l'on a
 *              DÉLIBÉRÉMENT changé la mesure, et alors la contre-revue doit revoir le diff).
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { MESURE_BASE_SHA } from "./lib-regles.mjs";

const DOSSIER = "mesures/t0b3-regles-autosourcees";
const ECRIRE = process.argv.includes("--ecrire");
const OUTILS = ["inventaire", "classer", "simuler-retrait", "retrait-groupe", "sous-lot"];
const ARTEFACTS = [
  "README.md", "baseline-ca254bf.json", "classification.json", "impact-retrait.json",
  "inventaire-171.json", "retrait-groupe.json", "sous-lot-propose.json",
];
const SOURCES = OUTILS.map((o) => `outils/${o}.mjs`).concat("outils/lib-regles.mjs", "outils/reproduire.mjs");

const sha256 = (b) => createHash("sha256").update(b).digest("hex");
const echouer = (m) => { process.stderr.write(`[mesure:t0b3] ÉCHEC — ${m}\n`); process.exit(1); };
const dire = (m) => process.stdout.write(`[mesure:t0b3] ${m}\n`);

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
for (const o of OUTILS) {
  const args = o === "simuler-retrait" ? ["--ecrire-baseline"] : [];
  const r = spawnSync("npx", ["tsx", `${DOSSIER}/outils/${o}.mjs`, ...args], { encoding: "utf8" });
  if (r.status !== 0) echouer(`outil « ${o} » sorti en ${r.status}\n${(r.stderr || "").slice(-1500)}`);
}
dire(`2/4 les ${ARTEFACTS.length - 1} artefacts JSON régénérés`);

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

/* ---- 4. l'arbre doit être propre ------------------------------------------------------------------ */
const sale = execFileSync("git", ["status", "--porcelain", "--", DOSSIER, "packages"], { encoding: "utf8" }).trim();
if (sale && !ECRIRE) {
  echouer(`régénérer a MODIFIÉ des fichiers — le dossier n'est pas reproductible :\n${sale}`);
}
dire(sale ? "4/4 arbre modifié (attendu avec --ecrire)" : "4/4 arbre propre : régénérer ne change rien");
dire("dossier T0-B3 reproductible.");
