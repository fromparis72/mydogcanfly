#!/usr/bin/env node
/* Dire, fiche par fiche, ce que les trois cases d'`origin` veulent dire.
 *
 * LE DÉFAUT, trouvé par Philippe sur un France → Mexique. Le paragraphe d'introduction des
 * étapes 2 et 4 de la fiche de voyage est tiré d'un bloc à trois cases nommées `eu`, `listed`
 * et `nonListed`, et le moteur choisit la case d'après LE RÉGIME EUROPÉEN DU PAYS DE DÉPART.
 * La France est `regime: eu`, il prend donc la case n° 1. Or le Mexique n'utilise pas ces cases
 * au sens européen : chez lui, la n° 1 veut dire « depuis les États-Unis ou le Canada ». Le
 * voyageur parisien lisait donc, en tête d'étape, une règle nord-américaine — que les puces
 * situées juste en dessous, elles, contredisaient depuis ce matin.
 *
 * Le tort n'est pas dans la donnée mexicaine. Il est dans la PRÉSOMPTION du gabarit : que tout
 * pays d'arrivée classe le monde comme l'Union européenne. 47 fiches sur 140 ne le font pas.
 *
 * CE QUE FAIT CE SCRIPT. Il inscrit dans chaque fiche ce que le gabarit devinait :
 *
 *   scheme: eu    les cases signifient bien « depuis l'UE / un pays listé / un pays non listé ».
 *                 Le moteur peut en choisir une, c'est ce qu'il fait aujourd'hui et il a raison.
 *   scheme: own   le pays a sa propre grille — groupes 1/2/3 australiens, régions désignées
 *                 japonaises, UEEA russe, Amérique du Nord mexicaine, pays indemnes de rage.
 *                 Le régime européen du départ ne dit rien sur la case applicable : le moteur
 *                 s'abstient et présente les cas, le lecteur reconnaît le sien.
 *
 * LA DÉTECTION SE FAIT SUR LE TITRE DE LA PREMIÈRE CASE, et sur lui seul. Le corps ne convient
 * pas : six fiches — Émirats, Hong Kong, Islande, Bahamas, Pérou, Pakistan — mentionnent l'UE
 * quelque part dans leur texte alors que leur case n° 1 s'appelle « Group I & II » ou
 * « Category 1 ». Se fier au corps les aurait classées `eu` et aurait laissé le défaut intact
 * là où il est le plus visible. Le titre, lui, dit sans ambiguïté de quoi la case parle.
 *
 * EN CAS DE DOUTE, `own`. Le coût d'un `own` de trop est une présentation un peu plus longue ;
 * le coût d'un `eu` de trop est une règle fausse affichée comme certaine. Les deux ne se valent
 * pas, et le schéma refuse d'ailleurs une fiche sans `scheme` : pas de valeur par défaut, parce
 * qu'une valeur par défaut serait à nouveau une présomption.
 *
 * Rejouable : une fiche qui porte déjà la bonne valeur est laissée intacte.
 *
 *   node packages/knowledge/scripts/origin-scheme.mjs [--dry]
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = join(HERE, "..", "..", "..", "content", "countries");
const dry = process.argv.includes("--dry");

/** L'Union européenne nommée dans le titre de la première case. */
const EU = /\bEU\b|Europe|European|EEA|Schengen/i;

let poses = 0, deja = 0;
const eu = [], own = [];

for (const f of readdirSync(SRC).filter((x) => x.endsWith(".yml") && !/^[_.]/.test(x))) {
  const chemin = join(SRC, f);
  const texte = readFileSync(chemin, "utf-8");
  const g = YAML.parse(texte);
  const bloc = g?.origin;
  if (!bloc?.eu?.title?.en) { console.error(`✗ ${f} — pas de origin.eu.title.en`); process.exitCode = 1; continue; }

  const valeur = EU.test(bloc.eu.title.en) ? "eu" : "own";
  (valeur === "eu" ? eu : own).push([f, bloc.eu.title.en]);

  if (bloc.scheme === valeur) { deja++; continue; }
  if (bloc.scheme) { console.error(`✗ ${f} — scheme déjà à « ${bloc.scheme} », non écrasé.`); continue; }

  /* Insertion en tête du bloc `origin:`, à l'indentation de ses enfants. On n'écrit qu'une
   * ligne : reparser puis resérialiser reformaterait des milliers de lignes écrites à la main. */
  const lignes = texte.split("\n");
  const i = lignes.findIndex((l) => /^origin:\s*$/.test(l));
  if (i < 0) { console.error(`✗ ${f} — bloc « origin: » introuvable, rien n'est écrit.`); process.exitCode = 1; continue; }
  const indent = (lignes[i + 1].match(/^(\s+)/) ?? [, "  "])[1];
  lignes.splice(i + 1, 0, `${indent}scheme: ${valeur}`);
  if (!dry) writeFileSync(chemin, lignes.join("\n"));
  poses++;
}

console.log(`scheme: eu   ${eu.length} fiches — le moteur peut choisir la case`);
console.log(`scheme: own  ${own.length} fiches — le moteur s'abstient et présente les cas\n`);
console.log("les fiches en « own », avec le titre de leur première case :");
for (const [f, t] of own) console.log(`   ${f.replace(".yml", "").padEnd(4)} ${t}`);
console.log(`\n${poses} fiche(s) écrite(s)${deja ? `, ${deja} déjà à jour` : ""}${dry ? " — essai à blanc" : ""}`);
