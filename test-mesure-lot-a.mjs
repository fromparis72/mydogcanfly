#!/usr/bin/env node
/**
 * LE SCELLÉ DU LOT A EST EXACT, ET LE SCELLEUR NE CONSACRE PAS LES DÉRIVES.
 *
 *   node test-mesure-lot-a.mjs
 *
 * POURQUOI. Deux vagues de contre-revue, le 24/08/2026 :
 *   · v1 — trois faux verts : URL remplacée par une URL valide, lien retiré + date impossible,
 *     règle par prédicat de destination. Fermés par le scellé v2.
 *   · v2 — trois passages indus : `pet_scheme` modifié (LE fait que la source doit étayer),
 *     scellé altéré (iso2, pays parasite) sans que l'égalité structurelle ne soit exigée,
 *     et `--sceller` qui consacrait la dérive au lieu de la révéler.
 *
 * Ce harnais rejoue les SIX mutations, plus les contrôles temporels et le verrou du scelleur.
 * Preuve manuelle datée — elle éprouve la livraison du lot A, pas un invariant du dépôt.
 *
 * QUATORZE CAS :
 *   1.  état conforme → 0.
 *   2.  URL fidjienne remplacée par une URL VALIDE (YAML + artefact) → 1, empreinte. [c-r v1]
 *   3.  la même mutation dans l'artefact SEUL → 1, divergence YAML ↔ généré.
 *   4.  lien retiré + verified_date « 2026-02-31 » → 1, date nommée. [c-r v1]
 *   5.  règle visant country_fj par `route.dest_country_id` → 1, compte canonique. [c-r v1]
 *   6.  reviewer modifié → 1, « reviewer ».
 *   7.  URL non-http(s) → 1, protocole nommé.
 *   8.  un pays des 122 perd sa source → 1, ensemble dérivé.
 *   9.  `pet_scheme` de country_fj passé à « EU Pet Movement » → 1, pet_scheme nommé. [c-r v2]
 *   10. scellé altéré : iso2 modifié ET pays parasite ajouté → 1, les deux nommés. [c-r v2]
 *   11. URL remplacée PUIS `--sceller` → le scelleur REFUSE (données non propres), et la
 *       vérification reste rouge. [c-r v2]
 *   12. `--as-of` absent, puis « 2026-02-31 » → 2, la date nommée.
 *   13. verified_date future (2030-01-01) → 1, « POSTÉRIEURE à --as-of ».
 *   14. re-sceller un état propre SANS `--remplace` → refus, l'empreinte attendue est exigée.
 */
import { readFileSync, writeFileSync, copyFileSync, symlinkSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import YAML from "yaml";

const AS_OF = "2026-08-24";
const defauts = [];
const echec = (cas, m) => defauts.push(`${cas} — ${m}`);
const lancer = (cwd, ...extra) =>
  spawnSync("node", ["--import", "tsx", "mesurer-lot-a.mjs", `--as-of=${AS_OF}`, ...extra], { cwd, encoding: "utf-8" });
const attendre = (cas, r, code, motifs) => {
  if (r.status !== code) { echec(cas, `sortie ${r.status} au lieu de ${code}`); return; }
  for (const motif of motifs) {
    if (!motif.test(r.stderr)) {
      echec(cas, `le diagnostic ne satisfait pas ${motif} — reçu :\n      ${r.stderr.trim().split("\n").slice(0, 4).join("\n      ")}`);
    }
  }
};

const conteneur = mkdtempSync(join(tmpdir(), "lot-a-wt-"));
const arbre = join(conteneur, "arbre");
const gitWt = (...a) => spawnSync("git", ["worktree", ...a], { encoding: "utf-8" });

try {
  const ajout = gitWt("add", "--detach", arbre, "HEAD");
  if (ajout.status !== 0) throw new Error(`git worktree add : ${(ajout.stderr || "").trim()}`);
  symlinkSync(resolve("node_modules"), join(arbre, "node_modules"));
  copyFileSync("mesurer-lot-a.mjs", join(arbre, "mesurer-lot-a.mjs"));
  copyFileSync("etat-reference-lot-a.json", join(arbre, "etat-reference-lot-a.json"));

  const chemins = {
    generes: join(arbre, "packages/ui/src/data/countries.generated.json"),
    yamlFj: join(arbre, "content/countries/fj.yml"),
    regles: join(arbre, "packages/knowledge/raw/rules.json"),
    objets: join(arbre, "packages/knowledge/raw/objects.json"),
    scelle: join(arbre, "etat-reference-lot-a.json"),
  };
  const pristins = Object.fromEntries(Object.entries(chemins).map(([k, p]) => [k, readFileSync(p, "utf-8")]));
  const restaurer = () => { for (const [k, p] of Object.entries(chemins)) writeFileSync(p, pristins[k]); };

  const muterFj = (muter, couches) => {
    if (couches.includes("yaml")) {
      const y = YAML.parse(pristins.yamlFj);
      muter(y);
      writeFileSync(chemins.yamlFj, YAML.stringify(y));
    }
    if (couches.includes("genere")) {
      const g = JSON.parse(pristins.generes);
      muter(g.country_fj);
      writeFileSync(chemins.generes, JSON.stringify(g, null, 2));
    }
  };

  /* ---- 1. conforme --------------------------------------------------------------------------- */
  {
    const r = lancer(arbre);
    if (r.status !== 0) {
      echec("1 conforme", `sortie ${r.status} sur l'état réel :\n      ${r.stderr.trim().split("\n").slice(0, 3).join("\n      ")}`);
    }
  }

  /* ---- 2-4. contre-épreuves v1 ---------------------------------------------------------------- */
  muterFj((x) => { x.sources[0].url = "https://example.org/replaced-but-valid"; }, ["yaml", "genere"]);
  attendre("2 URL remplacée (2 couches)", lancer(arbre), 1, [/country_fj/, /empreinte_sources/]);
  restaurer();

  muterFj((x) => { x.sources[0].url = "https://example.org/replaced-but-valid"; }, ["genere"]);
  attendre("3 artefact seul", lancer(arbre), 1, [/country_fj/, /DIVERGE du YAML/]);
  restaurer();

  muterFj((x) => { x.sources.pop(); x.verified_date = "2026-02-31"; }, ["yaml", "genere"]);
  attendre("4 lien retiré + 2026-02-31", lancer(arbre), 1, [/country_fj/, /2026-02-31/, /n'existe pas au calendrier/]);
  restaurer();

  /* ---- 5. règle par prédicat de destination --------------------------------------------------- */
  {
    const regles = JSON.parse(pristins.regles);
    const clone = JSON.parse(JSON.stringify(regles[0]));
    clone.id = "rule_contre_epreuve_fj";
    clone.applies_when = { all: [{ fact: "route.dest_country_id", op: "eq", value: "country_fj" }] };
    regles.push(clone);
    writeFileSync(chemins.regles, JSON.stringify(regles, null, 2));
    attendre("5 règle par destination", lancer(arbre), 1, [/country_fj/, /regles_ciblantes/]);
    restaurer();
  }

  /* ---- 6-8. reviewer, protocole, ensemble ----------------------------------------------------- */
  muterFj((x) => { x.reviewer = "Quelqu'un d'autre"; }, ["yaml", "genere"]);
  attendre("6 reviewer modifié", lancer(arbre), 1, [/country_fj/, /reviewer/]);
  restaurer();

  muterFj((x) => { x.sources[0].url = "ftp://baf.com.fj/animaux"; }, ["yaml", "genere"]);
  attendre("7 URL non-http", lancer(arbre), 1, [/country_fj/, /URL invalide ou non-http/]);
  restaurer();

  {
    const objets = JSON.parse(pristins.objets);
    delete objets.countries.find((c) => c.id === "country_fr").source;
    writeFileSync(chemins.objets, JSON.stringify(objets, null, 2));
    attendre("8 ensemble dérivé", lancer(arbre), 1, [/country_fr/, /ne sont plus les 18 contractuels/]);
    restaurer();
  }

  /* ---- 9. pet_scheme — LE fait à étayer ------------------------------------------------------- */
  {
    const objets = JSON.parse(pristins.objets);
    objets.countries.find((c) => c.id === "country_fj").pet_scheme = "EU Pet Movement";
    writeFileSync(chemins.objets, JSON.stringify(objets, null, 2));
    attendre("9 pet_scheme modifié", lancer(arbre), 1, [/country_fj/, /pet_scheme/, /EU Pet Movement/]);
    restaurer();
  }

  /* ---- 10. scellé altéré : iso2 + pays parasite ----------------------------------------------- */
  {
    const s = JSON.parse(pristins.scelle);
    s.pays.country_fj.iso2 = "zz";
    s.pays.country_zz = { ...s.pays.country_bh };
    writeFileSync(chemins.scelle, JSON.stringify(s, null, 2));
    attendre("10 scellé altéré", lancer(arbre), 1, [
      /country_fj\.iso2/, /country_zz/, /SANS CONTREPARTIE au relevé/,
    ]);
    restaurer();
  }

  /* ---- 11. dérive puis --sceller : le scelleur refuse ----------------------------------------- */
  muterFj((x) => { x.sources[0].url = "https://example.org/replaced-but-valid"; }, ["yaml", "genere"]);
  {
    const r = lancer(arbre, "--sceller");
    if (r.status !== 1) echec("11 sceller sur dérive", `sortie ${r.status} au lieu de 1 — le scelleur consacre la dérive`);
    if (!/REFUS de sceller/.test(r.stderr) || !/pas propres au sens de git/.test(r.stderr)) {
      echec("11 sceller sur dérive", `le refus ne nomme pas les données non propres — reçu :\n      ${r.stderr.trim().split("\n").slice(0, 3).join("\n      ")}`);
    }
    attendre("11 vérification après refus", lancer(arbre), 1, [/country_fj/]);
  }
  restaurer();

  /* ---- 12. --as-of obligatoire et calendaire -------------------------------------------------- */
  {
    const sans = spawnSync("node", ["--import", "tsx", "mesurer-lot-a.mjs"], { cwd: arbre, encoding: "utf-8" });
    if (sans.status !== 2) echec("12 as-of absent", `sortie ${sans.status} au lieu de 2`);
    const faux = spawnSync("node", ["--import", "tsx", "mesurer-lot-a.mjs", "--as-of=2026-02-31"], { cwd: arbre, encoding: "utf-8" });
    if (faux.status !== 2) echec("12 as-of impossible", `sortie ${faux.status} au lieu de 2`);
    if (!faux.stderr.includes("2026-02-31")) echec("12 as-of impossible", "la date refusée n'est pas nommée");
  }

  /* ---- 13. verified_date future --------------------------------------------------------------- */
  muterFj((x) => { x.verified_date = "2030-01-01"; }, ["yaml", "genere"]);
  attendre("13 date future", lancer(arbre), 1, [/country_fj/, /POSTÉRIEURE à --as-of/]);
  restaurer();

  /* ---- 14. re-sceller un état propre sans --remplace ------------------------------------------ */
  {
    const r = lancer(arbre, "--sceller");
    if (r.status !== 1) echec("14 sceller sans remplace", `sortie ${r.status} au lieu de 1 — le scellé se remplace sans être nommé`);
    if (!/--remplace=/.test(r.stderr)) echec("14 sceller sans remplace", "le refus n'exige pas l'empreinte du scellé en place");
  }
} finally {
  gitWt("remove", "--force", arbre);
  rmSync(conteneur, { recursive: true, force: true });
}

/* ---- verdict ---------------------------------------------------------------------------------- */
if (defauts.length === 0) {
  process.stdout.write("14 cas éprouvés en arbre de travail jetable : l'état conforme sort en 0 ; les trois\n");
  process.stdout.write("faux verts de la v1 (URL valide remplacée, lien + date impossible, règle par prédicat\n");
  process.stdout.write("de destination) et les trois passages indus de la v2 (pet_scheme, scellé altéré —\n");
  process.stdout.write("iso2 et pays parasite —, scelleur sur dérive) sortent chacun en 1 avec pays et champ\n");
  process.stdout.write("nommés ; --as-of est obligatoire et calendaire, une date future rougit, et remplacer\n");
  process.stdout.write("le scellé exige l'empreinte de celui qu'on remplace.\n\n");
  process.stdout.write("[lot-a] le scellé est exact, et le scelleur ne consacre pas les dérives.\n");
  process.exit(0);
}
process.stderr.write(`\n[lot-a] ÉCHEC — ${defauts.length} défaut(s) :\n`);
for (const d of defauts) process.stderr.write(`  ${d}\n`);
process.exit(1);
