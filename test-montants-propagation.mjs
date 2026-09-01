#!/usr/bin/env node
/**
 * LA CONTRE-ÉPREUVE DE BOUT EN BOUT : UN MONTANT REMIS À LA SOURCE RESSORT, ET LA GARDE LE VOIT.
 *
 *   node test-montants-propagation.mjs --dist=packages/ui/dist
 *
 * CE QU'ELLE PROUVE, ET QUE RIEN D'AUTRE NE PROUVE. `test-montants-sources.mjs` juge les fiches
 * YAML ; `test-montants-publies.mjs` juge le HTML servi. Aucun des deux ne montre que le PREMIER
 * ALIMENTE LE SECOND : on pourrait corriger les sources sans que la page change, ou surveiller la
 * page sans que la source y mène. Ce fichier écrit un montant dans une fiche, relance le VRAI
 * générateur, vérifie que l'artefact le reprend, puis présente la page telle qu'elle porterait la
 * phrase et exige que la garde du DOM rougisse. Il restaure tout et relit pour s'en assurer.
 *
 * DEUX FAUTES DE LA RÉDACTION PRÉCÉDENTE, NOMMÉES.
 *   · Elle portait SA PROPRE définition d'un montant — `/(?:US\$|\$|€|£)\s?\d|\d\s?(?:\$|€|£)/` —
 *     à côté de celle du détecteur partagé. Deux définitions de la même chose finissent toujours
 *     par diverger : celle-ci ne voyait ni « ZAR 300 », ni « CHF 90 », ni « 180 THB ». Elle est
 *     retirée au profit de `test-lib/montants.mjs`, seul juge.
 *   · Elle n'était appelée NULLE PART — ni dans `test:unit`, ni dans la CI. Une contre-épreuve
 *     qu'on n'exécute pas ne garde rien ; celle-ci est désormais jouée sur le site complet.
 *
 * Sa première moitié — « aucun résumé canonique ne porte de montant » — a disparu d'ici : elle
 * est tenue en plus large par `test-montants-sources.mjs`, qui juge TOUS les champs et non le
 * seul `verdictNote`.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { compter } from "./test-lib/montants.mjs";

let defauts = 0;
const echec = (nom, detail) => { defauts++; console.error(`  ✗ ${nom} — ${detail}`); };
const ok = (nom) => console.log(`  ✓ ${nom}`);

const DIST = process.argv.slice(2).find((a) => a.startsWith("--dist="))?.slice(7);
if (!DIST || !existsSync(DIST)) {
  console.error("[montants-propagation] REFUS — `--dist=<chemin>` est obligatoire et doit exister.");
  console.error("                       Une contre-épreuve qui se saute faute d'artefact ne prouve rien.");
  process.exit(1);
}

const FICHIER = "content/airlines/jetblue.yml";
const AVANT = "  en: Only small cats & dogs in the cabin (JetPaws) — no large dogs and no hold or cargo option.";
const APRES = "  en: Only small cats & dogs in the cabin (JetPaws, ZAR 300 each way) — no large dogs and no hold or cargo option.";
const GENERE = "packages/ui/src/data/airlines.generated.json";
const PAGE = join(DIST, "airlines/jetblue/index.html");

const source = readFileSync(FICHIER, "utf8");
const artefact = readFileSync(GENERE, "utf8");

if (!source.includes(AVANT)) {
  echec("propagation", "le résumé attendu est absent de la fiche JetBlue — la mutation ne prouverait rien");
} else if (!existsSync(PAGE)) {
  echec("propagation", `${PAGE} absente du dist`);
} else {
  let vuArtefact = false, vuGarde = false, erreur = null;
  const html = readFileSync(PAGE, "utf8");
  try {
    /* 1. La source est salie, et c'est le VRAI générateur qui produit l'artefact. */
    writeFileSync(FICHIER, source.replace(AVANT, APRES));
    execFileSync("npm", ["run", "ingest"], { stdio: "pipe" });
    const rendu = JSON.parse(readFileSync(GENERE, "utf8")).airline_jetblue?.verdictNote?.en ?? "";
    vuArtefact = compter(rendu) === 1;
    if (!vuArtefact) erreur = `le générateur n'a pas repris le montant : « ${rendu.slice(0, 80)} »`;
    else {
      /* 2. La page est présentée telle qu'elle porterait cette phrase, et la garde doit rougir. */
      const salie = html.replace("(JetPaws)", "(JetPaws, ZAR 300 each way)");
      if (salie === html) erreur = "la page construite ne porte pas le résumé attendu";
      else {
        writeFileSync(PAGE, salie);
        try { execFileSync("node", ["test-montants-publies.mjs", `--dist=${DIST}`], { stdio: "pipe" }); }
        catch { vuGarde = true; }
        writeFileSync(PAGE, html);
      }
    }
  } finally {
    writeFileSync(FICHIER, source);
    writeFileSync(GENERE, artefact);
  }

  if (readFileSync(FICHIER, "utf8") !== source || readFileSync(GENERE, "utf8") !== artefact)
    echec("propagation", "la source ou l'artefact n'a pas été restauré à l'identique");
  else if (readFileSync(PAGE, "utf8") !== html)
    echec("propagation", "la page construite n'a pas été restaurée à l'identique");
  else if (erreur) echec("propagation", erreur);
  else if (!vuGarde) echec("propagation", "un montant remis à la source n'est PAS vu par la garde du DOM");
  else ok("propagation — « ZAR 300 » écrit dans la fiche JetBlue traverse le générateur et fait rougir la garde");
}

if (defauts) { console.error(`\n[montants-propagation] ÉCHEC — ${defauts} contrôle(s) en défaut`); process.exit(1); }
console.log("\n[montants-propagation] la correction vit bien à la source : ce qu'on y écrit ressort, et la garde le voit.");
