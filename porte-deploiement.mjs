#!/usr/bin/env node
/**
 * PORTE DE DÉPLOIEMENT — ce qui part en production est `main`, ou rien.
 *
 * POURQUOI CE FICHIER EXISTE (16/09/2026). Deux clones du dépôt cohabitent sur la machine :
 * `~/Documents/GitHub/mydogcanfly`, où travaille Codex, et `~/mydogcanfly`, d'où partent les
 * `npm run release`. Ce jour-là, le second se trouvait sur une branche de travail, trois commits
 * devant `main` et non fusionnée. Rien n'était cassé ; il ne manquait qu'un `npm run release`
 * lancé par habitude pour publier une branche que personne n'avait relue.
 *
 * Le danger n'est pas le second clone — c'est qu'AUCUNE VÉRIFICATION ne séparait « ce que je
 * crois déployer » de « ce que la commande déploie réellement ». `wrangler pages deploy` publie
 * le contenu de `dist`, sans rien savoir de la branche qui l'a produit, et `--commit-dirty=true`
 * lui interdit même de s'en émouvoir. La garde rétablit ce lien, une fois, avant le build.
 *
 * TROIS CONDITIONS, ET LA RAISON DE CHACUNE.
 *   · La branche courante est `main`. Une branche de travail n'a pas été relue en CI ni fusionnée.
 *   · L'arbre est propre. Un fichier modifié non commité est invisible dans l'historique : le jour
 *     où il faudra comprendre ce qui est en ligne, personne ne pourra le reconstituer.
 *   · `HEAD` vaut `origin/main` après `git fetch`. En retard, on déploierait une version antérieure
 *     à ce que les autres ont fusionné ; en avance, on publierait des commits que personne d'autre
 *     n'a vus. Les deux sont des divergences silencieuses entre le site et le dépôt.
 *
 * L'ÉCHAPPATOIRE EXISTE, ET ELLE EST BRUYANTE. `DEPLOIEMENT_HORS_MAIN="<raison>"` laisse passer,
 * en imprimant la raison. Une garde sans issue finit contournée par un appel direct à wrangler,
 * c'est-à-dire sans trace ; une issue qui exige une phrase écrite laisse une trace. La variable
 * n'est pas déclarée au contrat de provenance, et ce fichier vit à la racine pour cette raison :
 * il ne construit aucune page, il s'exécute avant le build et ne change rien à ce qui est produit.
 */
import { execFileSync } from "node:child_process";
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const git = (...args) => execFileSync("git", args, { encoding: "utf8" }).trim();
const dire = (s) => process.stdout.write(s + "\n");
const derogation = (process.env.DEPLOIEMENT_HORS_MAIN ?? "").trim();

const refus = [];
let branche = "?";
let tete = "?";
let reference = "?";

try {
  branche = git("rev-parse", "--abbrev-ref", "HEAD");
  if (branche !== "main") refus.push(`la branche courante est « ${branche} », pas « main »`);
  if (git("status", "--porcelain")) refus.push("l'arbre de travail contient des modifications non commitées");
  try {
    execFileSync("git", ["fetch", "--quiet", "origin", "main"], { stdio: "ignore" });
  } catch {
    refus.push("impossible de contacter origin — l'état de `main` n'a pas pu être vérifié");
  }
  tete = git("rev-parse", "--short", "HEAD");
  reference = git("rev-parse", "--short", "origin/main");
  if (tete !== reference) {
    const avance = git("rev-list", "--count", "origin/main..HEAD");
    const retard = git("rev-list", "--count", "HEAD..origin/main");
    refus.push(`HEAD (${tete}) diffère d'origin/main (${reference}) — ${avance} commit(s) d'avance, ${retard} de retard`);
  }
} catch (erreur) {
  refus.push(`inspection du dépôt impossible : ${erreur.message}`);
}

if (!refus.length) {
  dire(`✓ porte de déploiement : branche main, arbre propre, HEAD = origin/main (${tete}).`);
  process.exit(0);
}

dire("");
dire("✗ DÉPLOIEMENT REFUSÉ — ce qui partirait n'est pas `main`.");
dire("");
for (const raison of refus) dire(`  · ${raison}`);
dire("");

if (derogation) {
  /* Une trace qui n'existe que dans un terminal disparaît avec la fenêtre. Celle-ci est écrite
     dans le dépôt, à l'endroit où vivent déjà les mesures, pour que la décision puisse être
     commitée et retrouvée le jour où il faudra comprendre ce qui est parti en production. */
  /* Le journal appartient au dépôt INSPECTÉ, pas au répertoire du script : c'est ce qui permet
     au témoin de l'éprouver sur un dépôt de fixture sans salir celui du projet. */
  const journal = resolve(git("rev-parse", "--show-toplevel"), "mesures/deploiements-hors-main.log");
  const ligne = `${new Date().toISOString()}\tbranche=${branche}\tHEAD=${tete}\torigin/main=${reference}\t${derogation}\n`;
  let ecrit = true;
  try {
    mkdirSync(dirname(journal), { recursive: true });
    appendFileSync(journal, ligne, "utf8");
  } catch {
    ecrit = false;
  }
  dire(`  DÉROGATION ACCEPTÉE : « ${derogation} »`);
  dire(ecrit
    ? "  Consignée dans mesures/deploiements-hors-main.log — à commiter avec le reste."
    : "  ⚠ le journal n'a pas pu être écrit : cette sortie de terminal est la seule trace.");
  dire("");
  process.exit(0);
}

dire("  Remettre le clone en état, puis relancer :");
dire("");
dire("    git checkout main && git pull --ff-only");
dire("");
dire("  Si le travail en cours doit partir, il passe d'abord par une PR et par la CI.");
dire("  Pour déployer malgré tout, en assumant la trace :");
dire("");
dire('    DEPLOIEMENT_HORS_MAIN="<raison en une phrase>" npm run release');
dire("");
process.exit(1);
