#!/usr/bin/env node
/* Rend à l'emblème vectoriel son hélice et son arc pointillé.
 *
 * Le problème. Le SVG fourni est un vrai vectoriel — 159 chemins, aucune image encapsulée —
 * mais c'est un dessin ANTÉRIEUR : il lui manque l'hélice de l'avion et l'arc de pointillés
 * qui surplombe la scène. Or ces deux éléments sont sur l'emblème publié. Le pack presse
 * livrait donc un logo qui n'était pas celui du site. Vérifié au passage : les fichiers
 * d'origine n'ont pas été altérés, leur MD5 est intact — le manque était déjà dans la source.
 *
 * Ce qui existe : `MyDogCanFly logo full_white background.png` contient le dessin COMPLET,
 * dans le même canevas 1096 × 976 que le vectoriel. Aucun alignement à chercher, les deux
 * partagent le repère.
 *
 * La méthode, différente pour chaque élément :
 *
 *   · L'HÉLICE est décalquée. C'est une forme libre, et elle forme un composant connexe
 *     isolé dans le raster (x 938-981, y 298-542), donc extractible sans toucher au fuselage.
 *     Potrace la vectorise après un agrandissement ×4 : plus le bord est décrit par de
 *     pixels, mieux la courbe est lissée et moins l'escalier du raster se voit.
 *
 *   · L'ARC est REDESSINÉ, pas décalqué. Ce sont 51 pastilles rondes : les décalquer
 *     figerait dans le vectoriel les irrégularités du rendu d'origine, alors qu'un cercle
 *     est exact à toute échelle. On relève leur centre, leur rayon et leur couleur, et on
 *     émet des <circle>. C'est plus fidèle à l'intention qu'à l'image.
 *
 *   node packages/knowledge/scripts/restore-emblem-details.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const DIR = "packages/ui/public/presskit/logos";
const SRC = `${DIR}/mydogcanfly-emblem.svg`;
const DETAILS = "content/objects-i18n/emblem-details.json"; // hélice + pastilles, relevés une fois

if (!existsSync(DETAILS)) {
  console.error(`${DETAILS} absent — lancer d'abord l'extraction (voir en-tête).`);
  process.exit(1);
}
const { propeller, propeller_offset: [px, py], dots } = JSON.parse(readFileSync(DETAILS, "utf-8"));

const svg = readFileSync(SRC, "utf-8");
if (svg.includes('id="mdcf-details"')) {
  console.log("hélice et arc déjà présents — rien à faire.");
  process.exit(0);
}

/* Le vectoriel n'a pas de viewBox, seulement width/height : son repère est donc 0 0 1096 976,
 * exactement celui du PNG de référence. Les chemins relevés s'insèrent tels quels. */
const NAVY = "#0E2350";
const details =
  `<g id="mdcf-details">` +
  `<g transform="translate(${px},${py})">` +
  propeller.map((d) => `<path d="${d}" fill="${NAVY}"/>`).join("") +
  `</g>` +
  dots.map(([cx, cy, r, col]) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${col}"/>`).join("") +
  `</g>`;

writeFileSync(SRC, svg.replace(/<\/svg>\s*$/, `${details}</svg>\n`));
console.log(`hélice (${propeller.length} chemin(s)) et arc (${dots.length} pastilles) rendus à l'emblème.`);
