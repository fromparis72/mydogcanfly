#!/usr/bin/env node
/**
 * TÉMOIN DE LA PORTE DE DÉPLOIEMENT.
 *
 * Une garde qu'on n'a jamais vue échouer ne prouve rien : elle peut avoir été neutralisée par une
 * refonte, un renommage ou un `catch` trop large sans que rien ne le signale. Ce témoin rejoue donc
 * les cinq situations que `porte-deploiement.mjs` doit distinguer, sur un dépôt fabriqué pour
 * l'occasion — jamais sur celui du projet, dont l'état varie d'une machine à l'autre et d'une heure
 * à l'autre, ce qui rendrait le résultat dépendant de l'humeur du clone.
 *
 * Le dépôt de fixture porte son propre « origin » local (un dépôt nu dans le même répertoire
 * temporaire), de sorte que le `git fetch` de la porte s'exécute réellement, hors réseau et sans
 * identifiants. C'est le seul moyen d'éprouver la troisième condition — HEAD contre origin/main —
 * autrement qu'en la lisant.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const PORTE = resolve(import.meta.dirname, "porte-deploiement.mjs");
const echecs = [];
const atelier = mkdtempSync(join(tmpdir(), "porte-deploiement-"));
const origine = join(atelier, "origine.git");
const clone = join(atelier, "clone");

const git = (cwd, ...args) => execFileSync("git", args, { cwd, encoding: "utf8" }).trim();

/** Exécute la porte dans le clone et rend { code, sortie } sans jamais lever. */
const jouer = (env = {}) => {
  try {
    const sortie = execFileSync(process.execPath, [PORTE], {
      cwd: clone, encoding: "utf8", env: { ...process.env, ...env },
    });
    return { code: 0, sortie };
  } catch (erreur) {
    return { code: erreur.status ?? 1, sortie: `${erreur.stdout ?? ""}${erreur.stderr ?? ""}` };
  }
};

const attendre = (cas, condition, detail) => {
  if (condition) return;
  echecs.push(`${cas} — ${detail}`);
};

try {
  execFileSync("git", ["init", "--quiet", "--bare", "--initial-branch=main", origine]);
  execFileSync("git", ["clone", "--quiet", origine, clone], { stdio: "ignore" });
  const config = (cle, valeur) => git(clone, "config", cle, valeur);
  config("user.name", "Témoin");
  config("user.email", "temoin@example.invalid");
  config("commit.gpgsign", "false");
  writeFileSync(join(clone, "fichier.txt"), "état initial\n");
  git(clone, "add", "fichier.txt");
  git(clone, "commit", "--quiet", "-m", "état initial");
  git(clone, "branch", "-M", "main");
  git(clone, "push", "--quiet", "-u", "origin", "main");

  /* 1. L'état nominal : branche main, arbre propre, HEAD = origin/main. */
  const nominal = jouer();
  attendre("nominal", nominal.code === 0, `code ${nominal.code}, attendu 0`);
  attendre("nominal", nominal.sortie.includes("porte de déploiement"), "le message de succès manque");

  /* 2. Arbre sale : un fichier modifié non commité est invisible dans l'historique. */
  writeFileSync(join(clone, "fichier.txt"), "modification non commitée\n");
  const sale = jouer();
  attendre("arbre sale", sale.code === 1, `code ${sale.code}, attendu 1`);
  attendre("arbre sale", sale.sortie.includes("non commitées"), "l'écart n'est pas nommé");
  git(clone, "checkout", "--", "fichier.txt");

  /* 3. Branche de travail : elle n'a été ni relue en CI ni fusionnée. */
  git(clone, "checkout", "--quiet", "-b", "travail-en-cours");
  const horsMain = jouer();
  attendre("hors main", horsMain.code === 1, `code ${horsMain.code}, attendu 1`);
  attendre("hors main", horsMain.sortie.includes("travail-en-cours"), "la branche fautive n'est pas nommée");

  /* 4. La dérogation laisse passer le même état, en imprimant sa raison. */
  const derogation = jouer({ DEPLOIEMENT_HORS_MAIN: "témoin automatisé, aucun déploiement" });
  attendre("dérogation", derogation.code === 0, `code ${derogation.code}, attendu 0`);
  attendre("dérogation", derogation.sortie.includes("témoin automatisé, aucun déploiement"),
    "la raison n'est pas imprimée — la trace serait muette");
  /* La trace doit survivre à la fermeture du terminal : la porte la consigne dans le dépôt. */
  const journal = join(clone, "mesures/deploiements-hors-main.log");
  attendre("dérogation", existsSync(journal) && readFileSync(journal, "utf8").includes("témoin automatisé"),
    "la dérogation n'a pas été consignée dans mesures/deploiements-hors-main.log");

  /* 5. En avance sur origin/main : on publierait des commits que personne n'a vus. */
  git(clone, "checkout", "--quiet", "main");
  writeFileSync(join(clone, "fichier.txt"), "commit local non poussé\n");
  git(clone, "commit", "--quiet", "-am", "commit local non poussé");
  const avance = jouer();
  attendre("avance sur origin", avance.code === 1, `code ${avance.code}, attendu 1`);
  attendre("avance sur origin", avance.sortie.includes("origin/main"), "l'écart avec origin n'est pas nommé");
} finally {
  rmSync(atelier, { recursive: true, force: true });
}

if (echecs.length) {
  console.error(`✗ porte de déploiement : ${echecs.length} comportement(s) inattendu(s)`);
  for (const echec of echecs) console.error(`  ${echec}`);
  process.exit(1);
}
console.log("✓ porte de déploiement : refus nommé sur arbre sale, branche de travail et avance sur origin ; dérogation tracée ; état nominal accepté");
