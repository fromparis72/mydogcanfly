#!/usr/bin/env node
/**
 * LE SCELLÉ DU LOT A EST EXACT, ET IL NE SE REMPLACE PAS — MÊME PAR UNE DÉRIVE COMMITÉE.
 *
 *   node test-mesure-lot-a.mjs
 *
 * POURQUOI. Trois vagues de contre-revue, le 24/08/2026 :
 *   · v1 — trois faux verts : URL remplacée par une URL valide, lien retiré + date impossible,
 *     règle par prédicat de destination. Fermés par le scellé v2.
 *   · v2 — trois passages indus : `pet_scheme` modifié, scellé altéré (iso2, pays parasite),
 *     `--sceller` qui consacrait une dérive non commitée. Fermés en v3.
 *   · v3 — le scelleur consacrait encore une dérive COMMITÉE (la propreté git ne voit que le
 *     non-commité), et `_scelle` — exclu de la comparaison — se falsifiait sans échec.
 *     Fermés ici : l'instrument n'écrit plus JAMAIS le scellé (candidat seulement, produit
 *     uniquement sur des données identiques à la base exacte via `git diff --exit-code`),
 *     et `_scelle` est validé strictement, base exacte comprise.
 *
 * Preuve manuelle datée — elle éprouve la livraison du lot A, pas un invariant du dépôt.
 *
 * SEIZE CAS :
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
 *   11. dérive NON commitée puis génération → refus, candidat absent, scellé intact,
 *       vérification rouge. [c-r v2]
 *   12. dérive COMMITÉE puis génération → refus (« diffèrent de la base exacte »), candidat
 *       absent, scellé intact, vérification rouge. [c-r v3]
 *   13. `_scelle` falsifié (sha_base changé + champ ajouté) → 1, les deux nommés. [c-r v3]
 *   14. `--as-of` absent, puis « 2026-02-31 » → 2, la date nommée.
 *   15. verified_date future (2030-01-01) → 1, « POSTÉRIEURE à --as-of ».
 *   16. génération sur données saines → 0, le candidat naît ÉGAL au scellé promu, et le
 *       scellé lui-même n'a pas bougé d'un octet.
 */
import { readFileSync, writeFileSync, copyFileSync, symlinkSync, mkdtempSync, rmSync, existsSync } from "node:fs";
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

  const CANDIDAT = join(arbre, "etat-reference-lot-a.candidat.json");
  const gitArbre = (...a) => spawnSync("git", ["-C", arbre, ...a], { encoding: "utf-8" });
  const generationRefusee = (cas, motif) => {
    const r = lancer(arbre, "--generer-scelle-candidat");
    if (r.status !== 1) echec(cas, `sortie ${r.status} au lieu de 1 — le générateur consacre la dérive`);
    if (!/REFUS de générer/.test(r.stderr) || !motif.test(r.stderr)) {
      echec(cas, `le refus ne porte pas le motif ${motif} — reçu :\n      ${r.stderr.trim().split("\n").slice(0, 3).join("\n      ")}`);
    }
    if (existsSync(CANDIDAT)) echec(cas, "un CANDIDAT a été écrit malgré le refus");
    if (readFileSync(chemins.scelle, "utf-8") !== pristins.scelle) echec(cas, "le SCELLÉ a été modifié");
  };

  /* ---- 11. dérive NON commitée puis génération ------------------------------------------------ */
  muterFj((x) => { x.sources[0].url = "https://example.org/replaced-but-valid"; }, ["yaml", "genere"]);
  generationRefusee("11 génération sur dérive non commitée", /DIFFÈRENT de la base exacte/);
  attendre("11 vérification après refus", lancer(arbre), 1, [/country_fj/]);
  restaurer();

  /* ---- 12. dérive COMMITÉE puis génération — la contre-épreuve de la v3 ----------------------- */
  muterFj((x) => { x.reviewer = "Quelqu'un d'autre"; }, ["yaml", "genere"]);
  {
    /* Seules les DONNÉES dérivées sont commitées — l'instrument et le scellé copiés (versions
     * courantes, plus récentes que HEAD) restent hors du commit, et le reset ci-dessous les
     * écrasant tout de même (reset --hard restaure TOUT le suivi), ils sont RECOPIÉS après. */
    gitArbre("add", "--", "content/countries/fj.yml", "packages/ui/src/data/countries.generated.json");
    const commit = gitArbre("-c", "user.email=contre-epreuve@invalid", "-c", "user.name=Contre-épreuve",
      "commit", "-m", "contre-épreuve : dérive commitée");
    if (commit.status !== 0) echec("12 dérive commitée", `le commit de contre-épreuve a échoué : ${(commit.stderr || "").trim()}`);
    generationRefusee("12 génération sur dérive commitée", /DIFFÈRENT de la base exacte/);
    attendre("12 vérification après refus", lancer(arbre), 1, [/country_fj/, /reviewer/]);
    gitArbre("reset", "--hard", "HEAD~1");
    copyFileSync("mesurer-lot-a.mjs", join(arbre, "mesurer-lot-a.mjs"));
    copyFileSync("etat-reference-lot-a.json", join(arbre, "etat-reference-lot-a.json"));
  }
  restaurer();

  /* ---- 13. _scelle falsifié ------------------------------------------------------------------- */
  {
    const s = JSON.parse(pristins.scelle);
    s._scelle.sha_base = "0000000000000000000000000000000000000000";
    s._scelle.remplace = "champ-fantome";
    writeFileSync(chemins.scelle, JSON.stringify(s, null, 2));
    attendre("13 _scelle falsifié", lancer(arbre), 1, [/sha_base/, /n'est pas la base exacte/, /champs inattendus/]);
    restaurer();
  }

  /* ---- 14. --as-of obligatoire et calendaire -------------------------------------------------- */
  {
    const sans = spawnSync("node", ["--import", "tsx", "mesurer-lot-a.mjs"], { cwd: arbre, encoding: "utf-8" });
    if (sans.status !== 2) echec("14 as-of absent", `sortie ${sans.status} au lieu de 2`);
    const faux = spawnSync("node", ["--import", "tsx", "mesurer-lot-a.mjs", "--as-of=2026-02-31"], { cwd: arbre, encoding: "utf-8" });
    if (faux.status !== 2) echec("14 as-of impossible", `sortie ${faux.status} au lieu de 2`);
    if (!faux.stderr.includes("2026-02-31")) echec("14 as-of impossible", "la date refusée n'est pas nommée");
  }

  /* ---- 15. verified_date future --------------------------------------------------------------- */
  muterFj((x) => { x.verified_date = "2030-01-01"; }, ["yaml", "genere"]);
  attendre("15 date future", lancer(arbre), 1, [/country_fj/, /POSTÉRIEURE à --as-of/]);
  restaurer();

  /* ---- 16. génération sur données saines : candidat égal au scellé, scellé intact ------------- */
  {
    const r = lancer(arbre, "--generer-scelle-candidat");
    if (r.status !== 0) {
      echec("16 génération saine", `sortie ${r.status} :\n      ${r.stderr.trim().split("\n").slice(0, 3).join("\n      ")}`);
    } else {
      if (readFileSync(CANDIDAT, "utf-8") !== pristins.scelle) echec("16 génération saine", "le candidat DIFFÈRE du scellé promu");
      if (readFileSync(chemins.scelle, "utf-8") !== pristins.scelle) echec("16 génération saine", "le scellé a été modifié par la génération");
      rmSync(CANDIDAT, { force: true });
    }
  }
} finally {
  gitWt("remove", "--force", arbre);
  rmSync(conteneur, { recursive: true, force: true });
}

/* ---- verdict ---------------------------------------------------------------------------------- */
if (defauts.length === 0) {
  process.stdout.write("16 cas éprouvés en arbre de travail jetable : l'état conforme sort en 0 ; les trois\n");
  process.stdout.write("faux verts de la v1, les trois passages indus de la v2 et les deux de la v3 sont\n");
  process.stdout.write("morts — une dérive, commitée ou non, fait refuser la génération sans qu'un candidat\n");
  process.stdout.write("naisse ni que le scellé bouge ; un _scelle falsifié (sha_base, champ fantôme) rougit ;\n");
  process.stdout.write("--as-of est obligatoire et calendaire, une date future rougit ; et sur données saines\n");
  process.stdout.write("le candidat naît égal au scellé promu, sans que l'instrument touche jamais au scellé.\n\n");
  process.stdout.write("[lot-a] le scellé est exact, et il ne se remplace pas.\n");
  process.exit(0);
}
process.stderr.write(`\n[lot-a] ÉCHEC — ${defauts.length} défaut(s) :\n`);
for (const d of defauts) process.stderr.write(`  ${d}\n`);
process.exit(1);
