#!/usr/bin/env node
/**
 * Reproduction du dossier T0-B3-e — une seule commande.
 *
 *   npm run mesure:t0b3e
 *
 * Ce dossier lit les OCTETS du site construit : il exige un site complet sous `packages/ui/dist`.
 * S'il manque, la reproduction le construit — c'est long, et c'est le prix de la preuve.
 * `--sans-build` refuse de construire et échoue plutôt que de mesurer à moitié.
 *
 *   --ecrire   recalcule SHA256SUMS au lieu de le vérifier (le diff doit passer en contre-revue).
 */
import { execFileSync, spawnSync } from "node:child_process";
import { readFileSync, writeFileSync, unlinkSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";

const DOSSIER = "mesures/t0b3e-ce-que-le-site-montre";
const SITE = "packages/ui/dist";
const ECRIRE = process.argv.includes("--ecrire");
const SANS_BUILD = process.argv.includes("--sans-build");
const ARTEFACTS = ["README.md", "ce-que-le-site-montre.json"];
const SOURCES = ["outils/mesurer.mjs", "outils/reproduire.mjs"];

const sha256 = (b) => createHash("sha256").update(b).digest("hex");
const echouer = (m) => { process.stderr.write(`[mesure:t0b3e] ÉCHEC — ${m}\n`); process.exit(1); };
const dire = (m) => process.stdout.write(`[mesure:t0b3e] ${m}\n`);
const arbreSale = () =>
  execFileSync("git", ["status", "--porcelain", "--untracked-files=all"], { encoding: "utf8" }).trim();
const pagesHtml = (d) => {
  if (!existsSync(d)) return 0;
  let n = 0;
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) n += pagesHtml(p); else if (e.endsWith(".html")) n++;
  }
  return n;
};

/* ---- 0. le contrôle de propreté doit d'abord prouver qu'il sait échouer ------------------------ */
{
  const parasite = `.mesure-t0b3e-contre-epreuve-${process.pid}`;
  writeFileSync(parasite, "contre-épreuve : ce fichier doit rendre l'arbre sale\n");
  let vu;
  try { vu = arbreSale().split("\n").some((l) => l.includes(parasite)); }
  finally { if (existsSync(parasite)) unlinkSync(parasite); }
  if (!vu) echouer("la détection d'arbre sale ne voit pas un fichier parasite — le contrôle est inopérant");
  dire("0/5 contre-épreuve : un fichier parasite à la racine EST détecté");
}
{
  const sale = arbreSale();
  if (sale && !ECRIRE) echouer(`l'arbre est sale AVANT de commencer :\n${sale}`);
  dire(sale ? "0bis/5 arbre sale au départ, toléré par --ecrire" : "0bis/5 arbre propre au départ");
}

/* ---- 1. le site complet ------------------------------------------------------------------------ */
{
  const n = pagesHtml(SITE);
  if (n < 2000) {
    if (SANS_BUILD) echouer(`site absent ou partiel (${n} pages) et --sans-build interdit de le construire`);
    dire(`1/5 site partiel (${n} pages) — construction complète en cours, comptez une douzaine de minutes`);
    const b = spawnSync("npm", ["run", "build"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
    if (b.status !== 0) echouer(`le build complet a échoué :\n${(b.stdout || "").slice(-1500)}${(b.stderr || "").slice(-800)}`);
    const m = pagesHtml(SITE);
    if (m < 2000) echouer(`build terminé mais seulement ${m} pages HTML — la preuve serait partielle`);
    dire(`1/5 site complet construit : ${m} pages HTML`);
  } else dire(`1/5 site complet déjà présent : ${n} pages HTML`);
}

/* ---- 2. la mesure doit savoir ÉCHOUER ----------------------------------------------------------
   Trois invariants distincts, trois contre-épreuves, chacune sortant en 1 avec SON diagnostic. */
const CONTRE_EPREUVES = [
  { code: "chemin", attendu: "148 des 407 règles atteignent un lecteur" },
  { code: "traduction", attendu: "le portugais est servi EN ANGLAIS pour la totalité" },
  { code: "repli", attendu: "aucune compagnie ne prend le repli" },
];
for (const ce of CONTRE_EPREUVES) {
  const r = spawnSync(process.execPath, ["--import", "tsx", `${DOSSIER}/outils/mesurer.mjs`,
    `--contre-epreuve=${ce.code}`], { encoding: "utf8" });
  const sortie = `${r.stdout ?? ""}${r.stderr ?? ""}`;
  if (r.signal) echouer(`contre-épreuve « ${ce.code} » : processus tué par ${r.signal}`);
  if (r.status !== 1) echouer(`contre-épreuve « ${ce.code} » : code ${r.status}, attendu 1 — la mesure ne sait pas échouer`);
  if (!sortie.includes(ce.attendu)) {
    echouer(`contre-épreuve « ${ce.code} » : échec SANS le diagnostic attendu « ${ce.attendu} » — `
      + "mise en défaut pour une autre raison");
  }
}
dire(`2/5 les ${CONTRE_EPREUVES.length} contre-épreuves sortent en 1 avec leur diagnostic propre`);

/* ---- 3. régénérer ------------------------------------------------------------------------------ */
{
  const r = spawnSync(process.execPath, ["--import", "tsx", `${DOSSIER}/outils/mesurer.mjs`], { encoding: "utf8" });
  if (r.status !== 0) echouer(`la mesure sort en ${r.status}\n${(r.stdout || "").slice(-2500)}${(r.stderr || "").slice(-800)}`);
  process.stdout.write(r.stdout);
  dire("3/5 artefact régénéré, toutes les exigences tenues");
}

/* ---- 4. SHA256SUMS ----------------------------------------------------------------------------- */
const lignes = [...ARTEFACTS, ...SOURCES].sort()
  .map((f) => `${sha256(readFileSync(`${DOSSIER}/${f}`))}  ${f}`);
if (ECRIRE) {
  writeFileSync(`${DOSSIER}/SHA256SUMS`, lignes.join("\n") + "\n");
  dire(`4/5 SHA256SUMS RÉÉCRIT (${lignes.length} entrées) — le diff doit passer en contre-revue`);
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
  dire(`4/5 SHA256SUMS vérifié — ${lignes.length} fichiers identiques au bit près`);
}

/* ---- 5. l'arbre entier doit être propre à la fin ------------------------------------------------ */
const sale = arbreSale();
if (sale && !ECRIRE) echouer(`régénérer a MODIFIÉ l'arbre — le dossier n'est pas reproductible :\n${sale}`);
dire(sale ? "5/5 arbre modifié (attendu avec --ecrire)" : "5/5 arbre entier propre : régénérer ne change rien");
dire("dossier T0-B3-e reproductible.");
