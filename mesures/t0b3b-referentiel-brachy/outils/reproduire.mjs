#!/usr/bin/env node
/**
 * Reproduction du dossier T0-B3-b — une seule commande.
 *
 *   npm run mesure:t0b3b
 *
 * Ce dossier ne se rejoue PAS dans un worktree, contrairement à T0-B3 et T0-B3-a : il ne décrit
 * pas un état passé, il décrit le PASSAGE d'un état à un autre. Son « avant » est lu par `git show`
 * au commit figé, son « après » est l'arbre de travail. Il reste donc reproductible tant que le
 * moteur ne change pas — et le jour où il changera, ce contrôle-ci devra être refait, pas hérité.
 *
 *   --ecrire   recalcule SHA256SUMS au lieu de le vérifier (la contre-revue doit revoir le diff).
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { createHash } from "node:crypto";

const DOSSIER = "mesures/t0b3b-referentiel-brachy";
const ECRIRE = process.argv.includes("--ecrire");
const ARTEFACTS = ["README.md", "diff-referentiel.json"];
const SOURCES = ["outils/mesurer.mjs", "outils/reproduire.mjs"];

const sha256 = (b) => createHash("sha256").update(b).digest("hex");
const echouer = (m) => { process.stderr.write(`[mesure:t0b3b] ÉCHEC — ${m}\n`); process.exit(1); };
const dire = (m) => process.stdout.write(`[mesure:t0b3b] ${m}\n`);
const arbreSale = () =>
  execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { encoding: "utf8" }).trim();

/* ---- 0. le contrôle de propreté doit d'abord prouver qu'il sait échouer ------------------------ */
{
  const parasite = `.mesure-t0b3b-contre-epreuve-${process.pid}`;
  writeFileSync(parasite, "contre-épreuve : ce fichier doit rendre l'arbre sale\n");
  let vu;
  try { vu = arbreSale().split("\n").some((l) => l.includes(parasite)); }
  finally { if (existsSync(parasite)) unlinkSync(parasite); }
  if (!vu) echouer("la détection d'arbre sale ne voit pas un fichier parasite — le contrôle est inopérant");
  dire("0/4 contre-épreuve : un fichier parasite à la racine EST détecté");
}
{
  const sale = arbreSale();
  if (sale && !ECRIRE) echouer(`l'arbre est sale AVANT de commencer :\n${sale}`);
  dire(sale ? "0bis/4 arbre sale au départ, toléré par --ecrire" : "0bis/4 arbre propre au départ");
}

/* ---- 1. la mesure doit savoir ÉCHOUER --------------------------------------------------------- */
/* Une mesure dont aucune exigence ne peut tomber ne mesure rien. On lui fait donc croire, le temps
   d'une exécution, que le référentiel n'a pas bougé : ses huit exigences doivent alors s'effondrer.
   `--sans-ecrire` garantit qu'une contre-épreuve ne publie jamais l'artefact. */
{
  const r = spawnSync(process.execPath, ["--import", "tsx", `${DOSSIER}/outils/mesurer.mjs`,
    "--sans-ecrire", "--contre-epreuve=sans-changement"], { encoding: "utf8" });
  if (r.status !== 1) {
    echouer(`la contre-épreuve « sans-changement » sort en ${r.status}, attendu 1 — la mesure ne sait pas échouer`);
  }
  if (!`${r.stdout}${r.stderr}`.includes("exactement 42 règles retirées")) {
    echouer("la contre-épreuve « sans-changement » échoue, mais sans le diagnostic attendu");
  }
  dire("1/4 la mesure sait échouer : sur un référentiel inchangé, ses exigences tombent");
}

/* ---- 2. régénérer ----------------------------------------------------------------------------- */
{
  const r = spawnSync(process.execPath, ["--import", "tsx", `${DOSSIER}/outils/mesurer.mjs`], { encoding: "utf8" });
  if (r.status !== 0) echouer(`la mesure sort en ${r.status}\n${(r.stdout || "").slice(-2000)}${(r.stderr || "").slice(-800)}`);
  process.stdout.write(r.stdout);
  dire("2/4 artefact régénéré, toutes les exigences tenues");
}

/* ---- 3. SHA256SUMS ---------------------------------------------------------------------------- */
const lignes = [...ARTEFACTS, ...SOURCES].sort()
  .map((f) => `${sha256(readFileSync(`${DOSSIER}/${f}`))}  ${f}`);
if (ECRIRE) {
  writeFileSync(`${DOSSIER}/SHA256SUMS`, lignes.join("\n") + "\n");
  dire(`3/4 SHA256SUMS RÉÉCRIT (${lignes.length} entrées) — le diff doit passer en contre-revue`);
} else {
  const parFichier = new Map(readFileSync(`${DOSSIER}/SHA256SUMS`, "utf8").trim().split("\n")
    .map((l) => [l.slice(66).trim(), l.slice(0, 64)]));
  const ecarts = [];
  for (const l of lignes) {
    const f = l.slice(66).trim(), h = l.slice(0, 64);
    if (!parFichier.has(f)) ecarts.push(`${f} : absent de SHA256SUMS`);
    else if (parFichier.get(f) !== h) ecarts.push(`${f} : ${h.slice(0, 12)} ≠ ${parFichier.get(f).slice(0, 12)}`);
  }
  for (const f of parFichier.keys()) if (!lignes.some((l) => l.slice(66).trim() === f)) ecarts.push(`${f} : listé mais absent`);
  if (ecarts.length) echouer(`SHA256SUMS ne correspond pas :\n  ${ecarts.join("\n  ")}`);
  dire(`3/4 SHA256SUMS vérifié — ${lignes.length} fichiers identiques au bit près`);
}

/* ---- 4. l'arbre entier doit être propre à la fin ----------------------------------------------- */
const sale = arbreSale();
if (sale && !ECRIRE) echouer(`régénérer a MODIFIÉ l'arbre — le dossier n'est pas reproductible :\n${sale}`);
dire(sale ? "4/4 arbre modifié (attendu avec --ecrire)" : "4/4 arbre entier propre : régénérer ne change rien");
dire("dossier T0-B3-b reproductible.");
