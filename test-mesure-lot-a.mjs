#!/usr/bin/env node
/**
 * LE SCELLÉ DU LOT A MORD — LES TROIS FAUX VERTS DE LA CONTRE-REVUE SONT MORTS.
 *
 *   node test-mesure-lot-a.mjs
 *
 * POURQUOI. La contre-revue du 24/08/2026 a reproduit TROIS faux verts sur la v1 du relevé :
 *   · une URL fidjienne remplacée par « https://example.org/replaced-but-valid » → sortie 0 ;
 *   · un lien retiré et une verified_date « 2026-02-31 » → sortie 0 ;
 *   · une règle visant country_fj par `route.dest_country_id` → sortie 0, « 0 règle ciblante ».
 * La v1 ne scellait ni les URL, ni les métadonnées, ni l'égalité YAML ↔ généré, et recomptait
 * les règles avec un filtre partiel au lieu de la sémantique canonique `rulesForCountry`.
 *
 * Ce harnais rejoue ces trois mutations — et cinq autres — dans un ARBRE DE TRAVAIL GIT
 * jetable, et exige la sortie 1 avec le pays et le champ nommés. Preuve manuelle datée, comme
 * les autres harnais de dossier : elle éprouve la livraison du lot A, pas un invariant du
 * dépôt, et n'est pas câblée en CI.
 *
 * HUIT CAS :
 *   1. état conforme → 0.
 *   2. URL fidjienne remplacée par une URL VALIDE, dans le YAML ET l'artefact (cohérents
 *      entre eux) → 1, l'empreinte scellée de country_fj rougit. [contre-revue]
 *   3. la même URL remplacée dans l'artefact SEUL → 1, divergence YAML ↔ généré — l'artefact
 *      ne fait pas foi seul.
 *   4. un lien retiré + verified_date « 2026-02-31 » → 1, la date impossible est nommée. [c-r]
 *   5. une règle ajoutée visant country_fj par `route.dest_country_id` → 1, le compte canonique
 *      de règles ciblantes rougit. [contre-revue]
 *   6. reviewer modifié (deux couches) → 1, « reviewer » nommé.
 *   7. URL remplacée par du non-http(s) (ftp://) → 1, URL invalide nommée.
 *   8. un pays des 122 perd sa source au référentiel → 1, l'ensemble des 18 a dérivé.
 */
import { readFileSync, writeFileSync, copyFileSync, symlinkSync, mkdtempSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import YAML from "yaml";

const defauts = [];
const echec = (cas, m) => defauts.push(`${cas} — ${m}`);
const lancer = (cwd) =>
  spawnSync("node", ["--import", "tsx", "mesurer-lot-a.mjs"], { cwd, encoding: "utf-8" });
const attendre = (cas, r, motifs) => {
  if (r.status !== 1) { echec(cas, `sortie ${r.status} au lieu de 1 — la mutation passe`); return; }
  for (const motif of motifs) {
    if (!motif.test(r.stderr)) {
      echec(cas, `le diagnostic ne nomme pas ${motif} — reçu :\n      ${r.stderr.trim().split("\n").slice(0, 4).join("\n      ")}`);
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
  };
  const pristins = Object.fromEntries(Object.entries(chemins).map(([k, p]) => [k, readFileSync(p, "utf-8")]));
  const restaurer = () => { for (const [k, p] of Object.entries(chemins)) writeFileSync(p, pristins[k]); };

  /* Mute le guide fidjien dans les DEUX couches (cohérentes), ou dans l'artefact seul. */
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

  /* ---- 2. URL valide remplacée, deux couches cohérentes — LA contre-épreuve ------------------ */
  muterFj((x) => { x.sources[0].url = "https://example.org/replaced-but-valid"; }, ["yaml", "genere"]);
  attendre("2 URL remplacée (2 couches)", lancer(arbre), [/country_fj/, /empreinte_sources/]);
  restaurer();

  /* ---- 3. la même mutation dans l'artefact SEUL ---------------------------------------------- */
  muterFj((x) => { x.sources[0].url = "https://example.org/replaced-but-valid"; }, ["genere"]);
  attendre("3 artefact seul", lancer(arbre), [/country_fj/, /DIVERGE du YAML/]);
  restaurer();

  /* ---- 4. lien retiré + date impossible ------------------------------------------------------ */
  muterFj((x) => { x.sources.pop(); x.verified_date = "2026-02-31"; }, ["yaml", "genere"]);
  attendre("4 lien retiré + 2026-02-31", lancer(arbre), [/country_fj/, /2026-02-31/, /n'existe pas au calendrier/]);
  restaurer();

  /* ---- 5. règle ajoutée par prédicat de destination ------------------------------------------ */
  {
    const regles = JSON.parse(pristins.regles);
    const clone = JSON.parse(JSON.stringify(regles[0]));
    clone.id = "rule_contre_epreuve_fj";
    clone.applies_when = { all: [{ fact: "route.dest_country_id", op: "eq", value: "country_fj" }] };
    regles.push(clone);
    writeFileSync(chemins.regles, JSON.stringify(regles, null, 2));
    attendre("5 règle par destination", lancer(arbre), [/country_fj/, /regles_ciblantes/]);
    restaurer();
  }

  /* ---- 6. reviewer modifié ------------------------------------------------------------------- */
  muterFj((x) => { x.reviewer = "Quelqu'un d'autre"; }, ["yaml", "genere"]);
  attendre("6 reviewer modifié", lancer(arbre), [/country_fj/, /reviewer/]);
  restaurer();

  /* ---- 7. URL non-http(s) -------------------------------------------------------------------- */
  muterFj((x) => { x.sources[0].url = "ftp://baf.com.fj/animaux"; }, ["yaml", "genere"]);
  attendre("7 URL non-http", lancer(arbre), [/country_fj/, /URL invalide ou non-http/]);
  restaurer();

  /* ---- 8. un pays des 122 perd sa source ----------------------------------------------------- */
  {
    const objets = JSON.parse(pristins.objets);
    delete objets.countries.find((c) => c.id === "country_fr").source;
    writeFileSync(chemins.objets, JSON.stringify(objets, null, 2));
    attendre("8 ensemble dérivé", lancer(arbre), [/country_fr/, /ne sont plus les 18 contractuels/]);
    restaurer();
  }
} finally {
  gitWt("remove", "--force", arbre);
  rmSync(conteneur, { recursive: true, force: true });
}

/* ---- verdict ---------------------------------------------------------------------------------- */
if (defauts.length === 0) {
  process.stdout.write("8 cas éprouvés en arbre de travail jetable : l'état conforme sort en 0, et les trois\n");
  process.stdout.write("faux verts de la contre-revue sont morts — URL valide remplacée (empreinte scellée),\n");
  process.stdout.write("lien retiré + date impossible (calendrier), règle par prédicat de destination\n");
  process.stdout.write("(sémantique canonique). L'artefact seul ne fait pas foi, le reviewer et le protocole\n");
  process.stdout.write("des URL sont tenus, et la dérive de l'ensemble des 18 est nommée.\n\n");
  process.stdout.write("[lot-a] le scellé mord.\n");
  process.exit(0);
}
process.stderr.write(`\n[lot-a] ÉCHEC — ${defauts.length} défaut(s) :\n`);
for (const d of defauts) process.stderr.write(`  ${d}\n`);
process.exit(1);
