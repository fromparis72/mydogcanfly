#!/usr/bin/env node
/* Séparer, dans les blocs « sortie », ce qui vaut pour tout voyage de ce qui ne vaut que pour l'Europe.
 *
 * LE CONSTAT. 90 des 98 blocs `exit` ouvrent sur une phrase européenne — « Les États-Unis sont un
 * pays listé : pas de titrage pour revenir, mais il faut le certificat sanitaire UE endossé par
 * l'USDA APHIS ». Le site est né pour un lecteur européen et l'étape 1 supposait partout qu'on
 * rentrait en Europe. Sur un États-Unis → Mexique, cette étape racontait donc l'Union européenne
 * à quelqu'un qui n'y allait pas.
 *
 * MAIS LE BLOC N'EST PAS EUROPÉEN D'UN BLOC. En comptant étape par étape : sur 180 étapes,
 * 100 mentionnent l'Europe — le modèle de certificat UE, le laboratoire agréé UE, la fenêtre de
 * validité avant l'entrée dans l'UE — et **80 n'en parlent pas du tout**. Ces 80-là décrivent la
 * machinerie d'export du pays et rien d'autre : quel service délivre le certificat, par quel
 * portail, qui l'endosse, en combien de jours. Elles sont vraies quelle que soit la destination.
 *
 * Il n'y avait donc pas 95 blocs à réécrire, mais 180 étapes à étiqueter — et une étiquette ne
 * touche pas au texte, ne demande aucune traduction et ne peut rien perdre.
 *
 *   scope: any   l'étape décrit la procédure du pays ; elle vaut pour toute destination.
 *   scope: eu    l'étape parle du dispositif européen ; elle n'a de sens que vers l'UE.
 *
 * LE DÉFAUT EST `eu`, ET C'EST VOULU. Une étape mal classée `any` s'afficherait à tort sur un
 * trajet qui n'a rien à voir avec l'Europe — le défaut qu'on répare. Mal classée `eu`, elle
 * manque simplement à l'appel. Les deux erreurs ne se valent pas : en cas de doute, on se tait.
 *
 * L'INTRO ET LA NOTE DE FIN NE SONT PAS ÉTIQUETÉES. 90 intros sur 98 et 92 notes sur 98 sont
 * européennes ; les huit et les six qui ne le sont pas ne justifient pas un troisième réglage.
 * Hors Europe, elles sont remplacées par une phrase que le gabarit construit et qui dit la seule
 * chose universellement vraie : le certificat à obtenir est celui qu'exige le pays d'arrivée, et
 * côté départ c'est telle autorité qui le délivre ou le vise.
 *
 * Rejouable : une étape déjà étiquetée n'est pas retouchée.
 *
 *   node packages/knowledge/scripts/exit-scope.mjs [--dry]
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "..", "..", "content", "countries");
const dry = process.argv.includes("--dry");

/* La détection porte sur l'anglais, langue de référence des fiches. « Union » attrape « European
 * Union » écrit en toutes lettres ; les autres formes couvrent UE, EEE et l'adjectif. */
const UE = /\bEU\b|\bUE\b|Europe|European|EEA|EEE|Union/i;

let etiquetees = 0, deja = 0, eu = 0, any = 0;
const douteuses = [];

for (const f of readdirSync(SRC).filter((x) => x.endsWith(".yml") && !/^[_.]/.test(x))) {
  const chemin = join(SRC, f);
  const texte = readFileSync(chemin, "utf-8");
  const g = YAML.parse(texte);
  const pas = g?.exit?.steps;
  if (!pas?.length) continue;

  const lignes = texte.split("\n");

  /* Repérage ancré : on part de `exit:`, on descend jusqu'à `steps:`, et on ne considère que les
   * lignes du bloc. Une version antérieure de ce genre de script cherchait la première clé du nom
   * voulu dans TOUT le fichier et écrivait deux cents lignes plus haut, dans un bloc homonyme.
   * L'ancre coûte trois lignes et supprime la classe d'erreur. */
  const iExit = lignes.findIndex((l) => /^exit:\s*$/.test(l));
  if (iExit < 0) { console.error(`✗ ${f} — bloc « exit: » introuvable`); process.exitCode = 1; continue; }
  const relSteps = lignes.slice(iExit + 1).findIndex((l) => /^\s{2}steps:\s*$/.test(l));
  if (relSteps < 0) { console.error(`✗ ${f} — « steps: » introuvable sous exit`); process.exitCode = 1; continue; }
  const iSteps = iExit + 1 + relSteps;

  /* Les débuts d'items, dans l'ordre — le même que celui de `g.exit.steps`. On s'arrête dès
   * qu'une ligne quitte l'indentation de la liste. */
  const debuts = [];
  for (let i = iSteps + 1; i < lignes.length; i++) {
    const l = lignes[i];
    if (l.trim() === "") continue;
    if (!/^\s{4}/.test(l)) break;
    if (/^\s{4}- /.test(l)) debuts.push(i);
  }
  if (debuts.length !== pas.length) {
    console.error(`✗ ${f} — ${debuts.length} items lus dans le texte pour ${pas.length} étapes analysées, rien n'est écrit.`);
    process.exitCode = 1;
    continue;
  }

  /* Insertion de bas en haut, pour que les index relevés restent valables. */
  let modifie = false;
  for (let k = pas.length - 1; k >= 0; k--) {
    if (pas[k].scope) { deja++; continue; }
    const en = pas[k].text?.en ?? "";
    const valeur = UE.test(en) ? "eu" : "any";
    valeur === "eu" ? eu++ : any++;
    /* Une étape neutre qui parle quand même de certificat « modèle » mérite un œil : le modèle
     * est souvent celui de la destination, et la phrase peut sous-entendre l'Europe sans la nommer. */
    if (valeur === "any" && /\bmodel\b|\btemplate\b/i.test(en)) douteuses.push(`${f} — ${en.slice(0, 95)}`);
    const indent = lignes[debuts[k]].match(/^(\s*)- /)[1] + "  ";
    lignes.splice(debuts[k] + 1, 0, `${indent}scope: ${valeur}`);
    etiquetees++;
    modifie = true;
  }
  if (modifie && !dry) writeFileSync(chemin, lignes.join("\n"));
}

console.log(`${etiquetees} étape(s) étiquetée(s) — ${any} « any » (valables partout), ${eu} « eu »` +
  `${deja ? `, ${deja} déjà faite(s)` : ""}${dry ? " — essai à blanc" : ""}`);
if (douteuses.length) {
  console.log(`\n${douteuses.length} étape(s) classées « any » mais parlant d'un MODÈLE de certificat — à relire :`);
  for (const d of douteuses) console.log("   " + d);
}
