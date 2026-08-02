#!/usr/bin/env node
/* Page 11 (Bailey) : mise au carré du cadre. Quatre corrections, aucun texte réécrit.
 *
 *   · PIED RETIRÉ. Le bloc de pied — logo MyDogCanFly.com et numéro de page — tombait sur le
 *     cinquième polaroïd et devenait illisible. Il partait avec une phrase de bas de page qui
 *     n'était qu'un doublon : lors d'une passe précédente, l'extracteur avait repris le premier
 *     <p> de la page, c'est-à-dire le premier paragraphe de la biographie, et l'avait réinjecté
 *     en pied. Le lecteur lisait donc deux fois le même paragraphe. Le retrait règle les deux.
 *     Une page sans numéro est tolérée par le contrôle de pagination — couverture et clôture
 *     sont dans le même cas.
 *
 *   · POLAROÏDS ALIGNÉS. Les quatre premières photos font 1,111 de rapport ; la mexicaine fait
 *     1,5. Dans une fenêtre de rapport 1,25, `contain` laissait aux quatre premières une marge
 *     blanche à gauche et à droite, tandis que `cover` faisait toucher les bords à la cinquième.
 *     D'où l'écart visible. Les cinq images reçoivent maintenant la MÊME fenêtre : 88,9 % de la
 *     largeur du tirage, rapport 1,111. Les quatre premières y entrent sans recadrage — c'est
 *     exactement leur rapport —, la cinquième est recadrée, guidée par son `object-position`.
 *     La hauteur du tirage ne bouge pas d'un pixel : 0,889 / 1,111 = 1 / 1,25.
 *
 *   · COLONNE DE TEXTE SUR LE BLANC. Le texte débordait sur la photo à partir de 34 % de la
 *     largeur de page. La colonne passe de 46 % à 31,5 % de la zone utile, ce qui la ramène au
 *     bord exact du fond blanc. Le corps descend de 1,9 à 1,7cqh : à largeur réduite, la même
 *     taille aurait fait tomber le texte sous le bas de page.
 *
 *   · UN SEUL BLOC. Les quatre paragraphes sont fondus en un seul, et plus rien ne figure sous
 *     la signature.
 *
 * Le script TRANSFORME le HTML existant au lieu de le reconstruire : les libellés, les titres et
 * les légendes de villes sont traduits dans quatre langues, et une reconstruction les aurait
 * fait dépendre d'une table tenue à la main. Chaque transformation est vérifiée ; au premier
 * écart, rien n'est écrit.
 *
 *   node packages/knowledge/scripts/presskit-p11-bailey-cadre.mjs [--dry]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const DIR = "packages/ui/public/presskit";
const dry = process.argv.includes("--dry");
const PAGE = 10; // index 0-based ; page 11 depuis l'insertion du cas concret

/** Fenêtre commune aux cinq tirages. 88,9 % = 1,111 / 1,25 : la largeur que les quatre premières
 *  photos occupaient déjà d'elles-mêmes sous `contain`. */
const FENETRE = "display:block;width:88.9%;margin:0 auto;aspect-ratio:1.111/1;";

let faits = 0;
for (const langue of ["en", "fr", "es", "pt"]) {
  const path = `${DIR}/press-kit-${langue}.html`;
  if (!existsSync(path)) { console.error(`${path} absent`); continue; }
  const html = readFileSync(path, "utf-8");
  const pages = html.match(/<section class="page"[^>]*>[\s\S]*?<\/section>/g) ?? [];
  if (pages.length !== 13) { console.error(`✗ ${langue} : ${pages.length} pages au lieu de 13`); process.exit(1); }
  let p = pages[PAGE];
  /* On reconnaît la page à son contenu, pas à son libellé : celui-ci est traduit. */
  if (!p.includes("assets/photos/france.jpg") || !p.includes("bailey-holbox")) {
    console.error(`✗ ${langue} : la page ${PAGE + 1} n'est pas celle de Bailey`); process.exit(1);
  }
  const echec = (quoi) => { console.error(`✗ ${langue} : ${quoi} — rien n'est écrit.`); process.exit(1); };

  /* 1. Le pied s'en va en entier : phrase en doublon, logo et numéro. */
  const pied = /\n?\s*<div style="margin-top:2\.6cqh;display:flex;justify-content:space-between[\s\S]*?<\/div>\n?\s*(?=<\/div>)/;
  if (!pied.test(p)) echec("bloc de pied introuvable");
  p = p.replace(pied, "\n  ");

  /* 2. Les cinq tirages reçoivent la même fenêtre. */
  const avant = (p.match(/<img src="assets\/photos\/(?!bailey)/g) ?? []).length;
  if (avant !== 5) echec(`${avant} polaroïds au lieu de 5`);
  p = p.replace(/(<img src="assets\/photos\/(?!bailey)[^"]+"[^>]*style=")display:block;width:100%;aspect-ratio:1\.25\/1;object-fit:(?:contain|cover);/g,
    (_, tete) => `${tete}${FENETRE}object-fit:cover;`);
  if ((p.match(/aspect-ratio:1\.111\/1/g) ?? []).length !== 5) echec("fenêtre des polaroïds non appliquée aux cinq");

  /* 3. La colonne revient sur le fond blanc. */
  if (!p.includes(`<div style="width:46%">`)) echec("colonne de texte introuvable");
  p = p.replace(`<div style="width:46%">`, `<div style="width:31.5%">`);

  /* 4. Les quatre paragraphes n'en font plus qu'un. */
  const paras = [...p.matchAll(/<p style="margin:[^"]*font-size:1\.9cqh;line-height:1\.52;color:#5A6B84">([\s\S]*?)<\/p>/g)];
  if (paras.length !== 4) echec(`${paras.length} paragraphes de biographie au lieu de 4`);
  const fondu = `<p style="margin:2.6cqh 0 0;font-size:1.7cqh;line-height:1.55;color:#5A6B84">` +
    `${paras.map((m) => m[1].trim()).join(" ")}</p>`;
  p = p.replace(paras.map((m) => m[0]).join(""), fondu);
  if ((p.match(/font-size:1\.9cqh;line-height:1\.52/g) ?? []).length) echec("paragraphes non fondus");

  if (!dry) writeFileSync(path, html.replace(pages[PAGE], p));
  faits++;
  console.log(`${langue} : pied retiré, 5 tirages alignés, colonne à 31,5 %, ${paras.length} paragraphes fondus en 1`);
}
console.log(`\n${faits} plaquette(s) mise(s) à jour${dry ? " — essai à blanc" : ""}`);
