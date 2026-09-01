#!/usr/bin/env node
/**
 * LA CONTRE-ÉPREUVE DU RETRAIT DES MONTANTS DANS LES RÉSUMÉS CANONIQUES.
 *
 *   node test-montants-resumes.mjs --dist=packages/ui/dist
 *
 * Le micro-lot Tarifs interdit de publier un montant que rien ne rattache au trajet demandé. Le
 * moteur n'en produit plus — c'est prouvé ailleurs —, mais TROIS RÉSUMÉS ÉDITORIAUX en servaient
 * encore : « $150 each way » sur JetBlue et United, « $125 intl » sur Copa, dans les quatre
 * langues. La CI les a vus ; moi non, parce que je n'avais jamais joué le contrôle tarifaire
 * avec `--dist` sur cette branche.
 *
 * Ce fichier tient deux choses :
 *   1. AUCUN résumé canonique ne porte de montant — lu dans les SOURCES `content/airlines/*.yml`,
 *      là où la correction doit vivre, jamais dans l'artefact généré ;
 *   2. la garde SAIT ROUGIR : on réintroduit un montant dans un résumé et on exige que le
 *      contrôle du DOM construit le voie.
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

let defauts = 0;
const echec = (nom, detail) => { defauts++; console.error(`  ✗ ${nom} — ${detail}`); };
const ok = (nom) => console.log(`  ✓ ${nom}`);

/* Un montant dans une phrase publique : « $150 », « 150 $ », « US$ 150 », « 125 € ». */
const MONTANT = /(?:US\$|\$|€|£)\s?\d|\d\s?(?:\$|€|£)/;

/* ---- 1. LES RÉSUMÉS CANONIQUES, DANS LES QUATRE LANGUES ------------------------------------ */
{
  const DIR = "content/airlines";
  const fautifs = [];
  let phrases = 0;
  for (const f of readdirSync(DIR).sort().filter((x) => x.endsWith(".yml"))) {
    const lignes = readFileSync(join(DIR, f), "utf8").split("\n");
    let dans = false;
    for (const l of lignes) {
      if (/^verdictNote:/.test(l)) { dans = true; continue; }
      if (dans && /^\S/.test(l)) { dans = false; continue; }
      if (!dans) continue;
      const m = /^\s+(en|fr|es|pt):\s*(.*)$/.exec(l);
      if (!m) continue;
      phrases++;
      if (MONTANT.test(m[2])) fautifs.push(`${f} (${m[1]}) : ${m[2].slice(0, 80)}`);
    }
  }
  if (!phrases) echec("1 résumés canoniques", "aucun résumé lu — le contrôle ne prouverait rien");
  else if (fautifs.length) echec(`1 montant dans un résumé canonique (${fautifs.length})`, fautifs.slice(0, 3).join(" · "));
  else ok(`1 aucun des ${phrases} résumés canoniques ne porte de montant`);
}

let mutationJouee = true;

/* ---- 2. LA GARDE SAIT ROUGIR ---------------------------------------------------------------- */
/* On réintroduit un montant dans un résumé canonique, on régénère l'artefact par SON générateur,
   et on exige que le contrôle tarifaire du DOM le voie. Puis on restaure tout, et on relit pour
   s'en assurer. Sans `--dist`, cette moitié ne peut pas s'exécuter et on le DIT. */
{
  const DIST = process.argv.slice(2).find((a) => a.startsWith("--dist="))?.slice(7);
  if (!DIST || !existsSync(DIST)) {
    console.log("  · 2 mutation non jouée (aucun --dist=) — elle l'est en CI sur le site complet");
    mutationJouee = false;
  } else {
    const FICHIER = "content/airlines/jetblue.yml";
    const AVANT = "  en: Only small cats & dogs in the cabin (JetPaws) — no large dogs and no hold or cargo option.";
    const APRES = "  en: Only small cats & dogs in the cabin (JetPaws, $150 each way) — no large dogs and no hold or cargo option.";
    const source = readFileSync(FICHIER, "utf8");
    const genere = "packages/ui/src/data/airlines.generated.json";
    const artefact = readFileSync(genere, "utf8");
    if (!source.includes(AVANT)) { echec("2 mutation", "le résumé attendu est absent — la mutation ne prouverait rien"); }
    else {
      let vu = false, erreur = null;
      try {
        writeFileSync(FICHIER, source.replace(AVANT, APRES));
        execFileSync("npm", ["run", "ingest"], { stdio: "pipe" });
        const apres = JSON.parse(readFileSync(genere, "utf8")).airline_jetblue?.verdictNote?.en ?? "";
        if (!MONTANT.test(apres)) erreur = "le générateur n'a pas repris le montant : la mutation n'atteint pas l'artefact";
        else {
          /* Le contrôle tarifaire lit le DIST ; on lui présente le montant tel qu'il paraîtrait. */
          const page = join(DIST, "airlines/jetblue/index.html");
          const html = readFileSync(page, "utf8");
          const salie = html.replace("(JetPaws)", "(JetPaws, $150 each way)");
          if (salie === html) erreur = "la page construite ne porte pas le résumé attendu";
          else {
            writeFileSync(page, salie);
            try { execFileSync("node", ["--import", "tsx", "test-tarifs.mjs", `--dist=${DIST}`], { stdio: "pipe" }); }
            catch { vu = true; }
            writeFileSync(page, html);
          }
        }
      } finally {
        writeFileSync(FICHIER, source);
        writeFileSync(genere, artefact);
      }
      if (readFileSync(FICHIER, "utf8") !== source || readFileSync(genere, "utf8") !== artefact) {
        echec("2 mutation", "la source ou l'artefact n'a pas été restauré à l'identique");
      } else if (erreur) echec("2 mutation", erreur);
      else if (!vu) echec("2 mutation", "un montant réintroduit dans un résumé n'est PAS vu par le contrôle du DOM");
      else ok("2 un montant réintroduit dans un résumé canonique fait rougir le contrôle du DOM");
    }
  }
}

if (defauts) { console.error(`\n[montants-résumés] ÉCHEC — ${defauts} contrôle(s) en défaut`); process.exit(1); }
/* On ne conclut QUE ce qu'on a joué : affirmer que la mutation rougit alors qu'elle a été sautée
   serait exactement la fausse affirmation que ce lot passe son temps à retirer. */
console.log(mutationJouee
  ? "\n[montants-résumés] aucun résumé canonique ne publie de prix, et en réintroduire un rougit."
  : "\n[montants-résumés] aucun résumé canonique ne publie de prix ; la mutation, elle, n'a pas été jouée faute de dist.");
