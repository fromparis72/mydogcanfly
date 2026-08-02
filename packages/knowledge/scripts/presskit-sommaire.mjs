#!/usr/bin/env node
/* Page 2 : remettre le sommaire d'aplomb après l'insertion du cas concret.
 *
 * Le sommaire n'avait jamais été renuméroté. Il annonçait la mascotte en page 10 alors qu'elle
 * est en 11, décalait tout à partir de la sixième entrée, et ne mentionnait pas du tout la page
 * « Cas concret ». Sur un dossier de presse, c'est le pire endroit où se tromper : c'est la
 * première page qu'un journaliste lit, et la seule qui promette que le document est tenu.
 *
 * DEUX OPÉRATIONS.
 *   · L'entrée « De la complexité à la clarté » couvre désormais DEUX pages, 05 et 06 : la page
 *     du Decision Engine et le cas concret qui la démontre. C'est le choix de Philippe, et il se
 *     défend mieux qu'une entrée séparée — le cas concret n'est pas un chapitre, c'est la preuve
 *     du précédent. Une ligne de sommaire de plus aurait annoncé un sujet là où il n'y a qu'une
 *     démonstration.
 *   · Les entrées suivantes glissent d'un rang : 06→07, 07→08, et ainsi jusqu'à 12→13.
 *
 * LARGEUR DE LA COLONNE DES NUMÉROS. « 05 & 06 » ne tient pas dans les 2,2em prévus pour deux
 * chiffres. La colonne passe donc à 4,4em sur TOUTES les lignes, et non sur la seule qui déborde :
 * élargir une seule case décalerait son titre par rapport aux neuf autres, et un sommaire dont
 * une ligne est en retrait se lit comme une faute avant d'être lu comme une information.
 *
 * ORDRE. Les dix entrées sont disposées en deux colonnes entrelacées — 03, 08, 04, 09, 05… La
 * correspondance se fait donc sur le NUMÉRO, jamais sur la position. Et la substitution est faite
 * en un seul passage : renuméroter 06→07 puis 07→08 à la suite appliquerait deux fois le décalage
 * à la même entrée.
 *
 * Le script vérifie qu'il retrouve exactement dix entrées, et que la table d'arrivée ne contient
 * ni trou ni doublon. Il est rejouable : un sommaire déjà corrigé est reconnu et laissé tel quel.
 *
 *   node packages/knowledge/scripts/presskit-sommaire.mjs [--dry]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const DIR = "packages/ui/public/presskit";
const dry = process.argv.includes("--dry");
const SOMMAIRE = 1;
const LARGEUR = "4.4em";

/* Ancien numéro → nouveau. 03 et 04 ne bougent pas, 05 se dédouble, le reste glisse de un. */
const TABLE = {
  "03": "03", "04": "04", "05": "05 &amp; 06", "06": "07", "07": "08",
  "08": "09", "09": "10", "10": "11", "11": "12", "12": "13",
};

let faits = 0;
for (const langue of ["en", "fr", "es", "pt"]) {
  const path = `${DIR}/press-kit-${langue}.html`;
  if (!existsSync(path)) { console.error(`${path} absent`); continue; }
  const html = readFileSync(path, "utf-8");
  const pages = html.match(/<section class="page"[^>]*>[\s\S]*?<\/section>/g) ?? [];
  if (pages.length !== 13) { console.error(`✗ ${langue} : ${pages.length} pages au lieu de 13`); process.exit(1); }
  const p = pages[SOMMAIRE];

  const cellule = /<span style="(font-family:Poppins[^"]*?)width:2\.2em">(\d+)<\/span>/g;
  const trouvees = [...p.matchAll(cellule)];
  if (!trouvees.length && p.includes(`width:${LARGEUR}`)) { console.log(`${langue} : sommaire déjà corrigé, ignoré`); continue; }
  if (trouvees.length !== 10) {
    console.error(`✗ ${langue} : ${trouvees.length} entrées de sommaire au lieu de 10 — rien n'est écrit.`);
    process.exit(1);
  }
  const inconnus = trouvees.map((m) => m[2]).filter((n) => !(n in TABLE));
  if (inconnus.length) {
    console.error(`✗ ${langue} : numéro(s) hors table : ${inconnus.join(", ")} — rien n'est écrit.`);
    process.exit(1);
  }

  /* Un seul passage : chaque cellule est lue une fois et réécrite une fois. */
  const neuve = p.replace(cellule, (_, style, n) => `<span style="${style}width:${LARGEUR}">${TABLE[n]}</span>`);

  const apres = [...neuve.matchAll(/<span style="font-family:Poppins[^"]*?width:4\.4em">([^<]+)<\/span>/g)].map((m) => m[1]);
  if (apres.length !== 10) { console.error(`✗ ${langue} : ${apres.length} entrées après réécriture`); process.exit(1); }

  if (!dry) writeFileSync(path, html.replace(p, neuve));
  faits++;
  console.log(`${langue} : ${apres.slice().sort().join(" · ")}`);
}
console.log(`\n${faits} sommaire(s) mis à jour${dry ? " — essai à blanc" : ""}`);
