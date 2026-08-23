#!/usr/bin/env node
/**
 * LA MIGRATION DES RUBRIQUES EST ATOMIQUE, ET REFUSE CE QU'ELLE NE COMPREND PAS.
 *
 *   node test-migration-categories.mjs
 *
 * POURQUOI CE HARNAIS EXISTE. `migrer-categories.mjs` validait et écrivait dans la MÊME boucle.
 * Codex a placé une rubrique inconnue dans le dernier fichier portugais puis lancé le script :
 * sortie 1, comme annoncé — mais 288 fichiers modifiés. Les 287 précédents étaient déjà écrits.
 * Un dépôt à moitié migré, sous un code de sortie qui dit « échec » : l'état le plus difficile à
 * rattraper, parce qu'on ne sait plus ce qui a été fait.
 *
 * Le défaut n'était pas visible dans la preuve de migration : celle-ci constate un état FINAL
 * réussi, et un état final réussi ne dit rien de ce qui se serait passé en cas d'échec. Il fallait
 * donc éprouver le COMPORTEMENT, sur un jeu d'essai qu'on peut casser exprès — ce qu'on ne peut
 * pas faire aux 288 fichiers réels.
 *
 * SIX CAS, chacun sur un jeu d'essai neuf, monté et détruit par le harnais lui-même :
 *
 *   1. NOMINAL          — quatre langues cohérentes : tout est migré, la signature est commune.
 *   2. ATOMICITÉ        — un seul fichier fautif, et AUCUN des autres n'est écrit. C'est le cas
 *                         qui a manqué. On compare les empreintes de TOUS les fichiers avant et
 *                         après : une seule différence suffit à mettre en défaut.
 *   3. IDEMPOTENCE      — rejouer sur un jeu déjà migré n'écrit rien, et le dit.
 *   4. SECONDE INCONNUE — une seconde rubrique non déclarée abandonnée arrête tout.
 *   5. SECONDE ADMISE   — une seconde rubrique déclarée abandonnée est acceptée ET NOMMÉE.
 *   6. CHAMP ABSENT     — un fichier sans rubrique du tout arrête tout, au lieu d'en inventer une.
 *
 * Les cas 2, 4 et 6 exigent DEUX choses à la fois : le code de sortie 1, et l'arbre intact. Un
 * script qui échoue bruyamment après avoir écrit reste un script qui a écrit.
 */
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SCRIPT = "packages/knowledge/scripts/migrer-categories.mjs";
const LANGUES = ["en", "fr", "es", "pt"];

const defauts = [];
const echec = (cas, m) => defauts.push(`${cas} — ${m}`);

/** Un guide minimal mais réaliste : le champ de rubrique au milieu d'autres lignes. */
const guide = (cle, champ) =>
  `---\nkey: "${cle}"\ntitle: "Titre ${cle}"\ndate: "2026-01-01T00:00:00+01:00"\n` +
  `${champ}\ntags: ["chien"]\n---\n\nCorps du guide ${cle}.\n`;

/** Monte un jeu d'essai : `contenu[langue] = { nomFichier: ligneDeChamp }`. */
function jeu(contenu) {
  const base = mkdtempSync(join(tmpdir(), "migr-"));
  for (const langue of LANGUES) {
    mkdirSync(join(base, langue), { recursive: true });
    for (const [nom, champ] of Object.entries(contenu[langue] ?? {})) {
      writeFileSync(join(base, langue, `${nom}.md`), guide(nom, champ));
    }
  }
  return base;
}

/** L'empreinte de TOUT le jeu d'essai — c'est elle qui prouve qu'aucune écriture n'a eu lieu. */
function empreinte(base) {
  const h = createHash("sha256");
  for (const langue of LANGUES.slice().sort()) {
    for (const nom of readdirSync(join(base, langue)).sort()) {
      h.update(langue + "/" + nom + "\0" + readFileSync(join(base, langue, nom), "utf-8") + "\0");
    }
  }
  return h.digest("hex");
}

const lancer = (base, ...flags) =>
  spawnSync("node", [SCRIPT, `--racine=${base}`, ...flags], { encoding: "utf-8" });

/* Quatre langues identiques, quatre rubriques : le cas sain dont tous les autres dérivent. */
const SAIN = Object.fromEntries(LANGUES.map((l) => [l, {
  a: 'categories: ["Gear"]', b: 'categories: ["Travel"]',
  c: 'categories: ["Health"]', d: 'categories: ["Destinations"]',
}]));
const copie = (o) => JSON.parse(JSON.stringify(o));

/* ---- 1. nominal ----------------------------------------------------------------------------- */
{
  const base = jeu(SAIN);
  const r = lancer(base);
  if (r.status !== 0) echec("1 nominal", `sortie ${r.status} au lieu de 0 :\n      ${(r.stderr || "").trim()}`);
  const restants = LANGUES.flatMap((l) => readdirSync(join(base, l))
    .filter((n) => readFileSync(join(base, l, n), "utf-8").includes("categories:")));
  if (restants.length) echec("1 nominal", `${restants.length} fichier(s) portent encore « categories: »`);
  if (!/gear:1 travel:1 health:1 destinations:1/.test(r.stdout)) {
    echec("1 nominal", "la signature commune n'est pas annoncée");
  }
  rmSync(base, { recursive: true, force: true });
}

/* ---- 2. ATOMICITÉ — le cas qui manquait ----------------------------------------------------- */
{
  const c = copie(SAIN);
  c.pt.d = 'categories: ["Rubrique Inventée"]';   // le DERNIER fichier examiné, comme la contre-revue
  const base = jeu(c);
  const avant = empreinte(base);
  const r = lancer(base);
  const apres = empreinte(base);
  if (r.status === 0) echec("2 atomicité", "sortie 0 alors qu'une rubrique est inconnue");
  if (avant !== apres) {
    const ecrits = LANGUES.flatMap((l) => readdirSync(join(base, l))
      .filter((n) => readFileSync(join(base, l, n), "utf-8").includes("category:"))
      .map((n) => `${l}/${n}`));
    echec("2 atomicité", `l'arbre a CHANGÉ malgré l'échec — ${ecrits.length} fichier(s) écrit(s) : ${ecrits.slice(0, 4).join(", ")}`);
  }
  if (!/AUCUN fichier n'a été écrit/.test(r.stderr)) {
    echec("2 atomicité", "le diagnostic ne dit pas qu'aucun fichier n'a été écrit");
  }
  rmSync(base, { recursive: true, force: true });
}

/* ---- 3. idempotence -------------------------------------------------------------------------- */
{
  const base = jeu(SAIN);
  lancer(base);
  const avant = empreinte(base);
  const r = lancer(base);
  const apres = empreinte(base);
  if (r.status !== 0) echec("3 idempotence", `sortie ${r.status} au second passage`);
  if (avant !== apres) echec("3 idempotence", "le second passage a MODIFIÉ l'arbre");
  if (!/0 fichier\(s\) migré\(s\) · 16 déjà au format/.test(r.stdout)) {
    echec("3 idempotence", `le second passage ne dit pas « 0 migré · 16 déjà » — il dit : ${r.stdout.split("\n")[0]}`);
  }
  rmSync(base, { recursive: true, force: true });
}

/* ---- 4. seconde rubrique inconnue ------------------------------------------------------------ */
{
  const c = copie(SAIN);
  c.en.b = 'categories: ["Travel", "Rubrique Fantôme"]';
  const base = jeu(c);
  const avant = empreinte(base);
  const r = lancer(base);
  if (r.status === 0) echec("4 seconde inconnue", "sortie 0 sur une seconde rubrique non déclarée");
  if (empreinte(base) !== avant) echec("4 seconde inconnue", "l'arbre a changé malgré l'échec");
  if (!/ni canonique ni déclarée abandonnée/.test(r.stderr)) {
    echec("4 seconde inconnue", "le diagnostic ne nomme pas la cause");
  }
  rmSync(base, { recursive: true, force: true });
}

/* ---- 5. seconde rubrique déclarée abandonnée ------------------------------------------------- */
{
  const c = copie(SAIN);
  c.en.b = 'categories: ["Travel", "Airlines"]';
  const base = jeu(c);
  const r = lancer(base);
  if (r.status !== 0) echec("5 seconde admise", `sortie ${r.status} sur un abandon pourtant déclaré`);
  if (!/Secondes catégories abandonnées \(1\)/.test(r.stdout)) {
    echec("5 seconde admise", "l'abandon n'est pas NOMMÉ dans le compte rendu");
  }
  if (!readFileSync(join(base, "en", "b.md"), "utf-8").includes('category: "travel"')) {
    echec("5 seconde admise", "la première rubrique n'a pas donné la clé attendue");
  }
  rmSync(base, { recursive: true, force: true });
}

/* ---- 6. champ absent -------------------------------------------------------------------------- */
{
  const c = copie(SAIN);
  c.fr.a = 'author: "Sans rubrique"';
  const base = jeu(c);
  const avant = empreinte(base);
  const r = lancer(base);
  if (r.status === 0) echec("6 champ absent", "sortie 0 sur un fichier sans rubrique");
  if (empreinte(base) !== avant) echec("6 champ absent", "l'arbre a changé malgré l'échec");
  if (!/fichier non reconnu/.test(r.stderr)) echec("6 champ absent", "le diagnostic ne nomme pas la cause");
  rmSync(base, { recursive: true, force: true });
}

/* ---- verdict ---------------------------------------------------------------------------------- */
if (defauts.length === 0) {
  process.stdout.write("6 cas éprouvés sur jeux d'essai jetables : nominal, atomicité, idempotence,\n");
  process.stdout.write("seconde rubrique inconnue, seconde rubrique abandonnée, champ absent.\n\n");
  process.stdout.write("[migration-categories] la migration est atomique et refuse ce qu'elle ne comprend pas.\n");
  process.exit(0);
}
process.stderr.write(`\n[migration-categories] ÉCHEC — ${defauts.length} défaut(s) :\n`);
for (const d of defauts) process.stderr.write(`  ${d}\n`);
process.exit(1);
