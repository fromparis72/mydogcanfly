#!/usr/bin/env node
/**
 * L'ANNEXE DE MESURE REFUSE LES DATES QUI N'EXISTENT PAS, ET LE DOSSIER ALTÉRÉ SORT EN 1.
 *
 *   node test-mesure-achevement.mjs
 *
 * POURQUOI. Deux P0 de contre-revue, le 24/08/2026 :
 *
 *   · « les 19 contrôles de concordance n'existent pas » — la concordance dossier/relevé était
 *     vérifiée dans un shell, à côté des livrables, et annoncée comme si elle vivait dedans.
 *     Modifier un chiffre du Markdown laissait tout sortir en 0.
 *   · « --as-of accepte des dates inexistantes » — `Date.parse` NORMALISE « 2026-02-31 » en
 *     3 mars au lieu de refuser, et le relevé sortait daté du 31 février.
 *
 * Ce harnais éprouve les deux fermetures. Il ne suffit pas que `--verifier-dossier` existe : il
 * faut montrer qu'il MORD — qu'une valeur documentaire altérée produit la sortie 1 avec un
 * diagnostic qui nomme le contrôle en écart. Un vérificateur qu'on n'a jamais vu rougir est un
 * ornement.
 *
 * SIX CAS :
 *   1-3. DATES IMPOSSIBLES — « 2026-02-31 », « 2026-13-01 », « 2027-02-29 » (année non
 *        bissextile) : sortie 2, et le diagnostic nomme la date refusée.
 *   4.   DATE BISSEXTILE VALIDE — « 2028-02-29 » : sortie 0. Sans ce cas, les trois premiers
 *        seraient satisfaits par un validateur qui refuse tout.
 *   5.   DOSSIER CONFORME — `--verifier-dossier` sur le dossier réel : sortie 0.
 *   6.   DOSSIER ALTÉRÉ — une copie où UN chiffre est changé (le total des sources datées) :
 *        sortie 1, ET le diagnostic nomme le contrôle « total des sources datées ». C'est la
 *        contre-épreuve demandée mot pour mot par la contre-revue.
 */
import { readFileSync, writeFileSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const AS_OF = "2026-08-23";
const defauts = [];
const echec = (cas, m) => defauts.push(`${cas} — ${m}`);
const lancer = (...a) => spawnSync("node", ["mesurer-achevement.mjs", ...a], { encoding: "utf-8" });

/* ---- 1-3. dates impossibles ------------------------------------------------------------------ */
for (const d of ["2026-02-31", "2026-13-01", "2027-02-29"]) {
  const r = lancer(`--as-of=${d}`, "--json");
  if (r.status !== 2) echec(`date ${d}`, `sortie ${r.status} au lieu de 2 — la date impossible est acceptée`);
  if (!r.stderr.includes(d)) echec(`date ${d}`, "le diagnostic ne nomme pas la date refusée");
}

/* ---- 4. date bissextile valide --------------------------------------------------------------- */
{
  const r = lancer("--as-of=2028-02-29", "--json");
  if (r.status !== 0) echec("date 2028-02-29", `sortie ${r.status} — un 29 février bissextile est refusé à tort`);
}

/* ---- 5. dossier conforme --------------------------------------------------------------------- */
{
  const r = lancer(`--as-of=${AS_OF}`, "--verifier-dossier");
  if (r.status !== 0) {
    echec("dossier conforme", `sortie ${r.status} — la vérification échoue sur le dossier réel :\n      ${r.stderr.trim().split("\n").slice(0, 3).join("\n      ")}`);
  }
}

/* ---- 6. dossier altéré : LA contre-épreuve --------------------------------------------------- */
{
  const base = mkdtempSync(join(tmpdir(), "dossier-altere-"));
  const copie = join(base, "DOSSIER.md");
  /* On altère le TOTAL — le chiffre le plus visible du dossier. « 1 505 » devient « 1 506 » :
   * une faute d'un seul caractère, du genre qui survit à toutes les relectures humaines. */
  const texte = readFileSync("DOSSIER-ACHEVEMENT-PROJET.md", "utf-8");
  const altere = texte.replace("**1 505 sources datées**", "**1 506 sources datées**");
  if (altere === texte) {
    echec("dossier altéré", "l'ancre à altérer est introuvable — le harnais ne peut pas éprouver ce qu'il prétend");
  } else {
    writeFileSync(copie, altere);
    const r = lancer(`--as-of=${AS_OF}`, "--verifier-dossier", `--dossier=${copie}`);
    if (r.status !== 1) echec("dossier altéré", `sortie ${r.status} au lieu de 1 — un chiffre altéré passe la vérification`);
    if (!r.stderr.includes("total des sources datées")) {
      echec("dossier altéré", "le diagnostic ne nomme pas le contrôle en écart (« total des sources datées »)");
    }
  }
  rmSync(base, { recursive: true, force: true });
}

/* ---- verdict --------------------------------------------------------------------------------- */
if (defauts.length === 0) {
  process.stdout.write("6 cas éprouvés : trois dates impossibles refusées en nommant la date, un 29 février\n");
  process.stdout.write("bissextile accepté, le dossier réel conforme, et un chiffre altéré d'un caractère\n");
  process.stdout.write("sort en 1 avec le contrôle nommé.\n\n");
  process.stdout.write("[mesure-achevement] la vérification mord, dans les deux sens.\n");
  process.exit(0);
}
process.stderr.write(`\n[mesure-achevement] ÉCHEC — ${defauts.length} défaut(s) :\n`);
for (const d of defauts) process.stderr.write(`  ${d}\n`);
process.exit(1);
