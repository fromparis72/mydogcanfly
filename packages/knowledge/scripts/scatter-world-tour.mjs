#!/usr/bin/env node
/* Page « Bailey world tour » du dossier de presse : huit polaroïds → cinq, éparpillés.
 *
 * Pourquoi. Huit selfies générés par IA alignés dans une grille de 4 × 2, tous au même
 * format, tous à la même distance : l'effet est mécanique et la répétition finit par se voir.
 * Cinq suffisent à dire la même chose, et laissent la place de les poser comme des tirages
 * jetés sur une table — inclinaisons franches et irrégulières, chevauchements, hauteurs
 * différentes. On garde Paris, Rome, le Grand Canyon, Santorin et Chichén Itzá.
 *
 * Les légendes ne sont pas réécrites : elles sont **reprises telles quelles** dans chaque
 * fichier de langue. Les retaper aurait signifié retraduire trois fois ce qui existait déjà,
 * avec le risque de faire dériver un nom de lieu d'une langue à l'autre.
 *
 *   node packages/knowledge/scripts/scatter-world-tour.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const DIR = "packages/ui/public/presskit";

/** Les cinq retenues, dans l'ordre où elles seront posées, avec leur pose.
 *  `rot` en degrés, `dx`/`dy` en pourcentage de la largeur d'une vignette, `z` l'empilement.
 *  Les valeurs sont volontairement irrégulières : une progression régulière se remarquerait
 *  autant qu'une grille. */
const KEEP = [
  { img: "france.jpg",  rot: -5.8, dx: 1.5, dy: 1.4,  z: 5, w: 21 },
  { img: "italie.jpg",  rot: 4.2,  dx: -5, dy: -2.6, z: 4, w: 21 },
  { img: "usa.jpg",     rot: -2.1, dx: -5, dy: 3.2,  z: 3, w: 23 },
  { img: "grece.jpg",   rot: 6.8,  dx: -5, dy: -1.8, z: 2, w: 21 },
  { img: "mexique.jpg", rot: -4.6, dx: -5, dy: 2.4,  z: 1, w: 22 },
];

/** Découpe les enfants de premier niveau d'un fragment HTML. */
function topLevelDivs(html) {
  const out = [];
  let depth = 0, start = -1;
  const re = /<\/?div\b[^>]*>/g;
  let m;
  while ((m = re.exec(html))) {
    const closing = m[0].startsWith("</");
    if (!closing) { if (depth === 0) start = m.index; depth++; }
    else { depth--; if (depth === 0 && start >= 0) { out.push(html.slice(start, m.index + m[0].length)); start = -1; } }
  }
  return out;
}

for (const L of ["en", "fr", "es"]) {
  const path = `${DIR}/press-kit-${L}.html`;
  const html = readFileSync(path, "utf-8");

  const gridStart = html.indexOf('<div style="margin-top:2.6cqh;display:grid;grid-template-columns:repeat(4,1fr);gap:1.8%">');
  if (gridStart < 0) { console.log(`${L} : grille déjà remplacée ou introuvable, ignoré`); continue; }
  // fin de la grille : on referme au niveau 0
  let depth = 0, gridEnd = -1;
  const re = /<\/?div\b[^>]*>/g;
  re.lastIndex = gridStart;
  let m;
  while ((m = re.exec(html))) {
    if (!m[0].startsWith("</")) depth++;
    else { depth--; if (depth === 0) { gridEnd = m.index + m[0].length; break; } }
  }
  if (gridEnd < 0) { console.error(`${L} : fin de grille introuvable, rien n'est écrit`); continue; }

  const grid = html.slice(gridStart, gridEnd);
  const inner = grid.slice(grid.indexOf(">") + 1, grid.lastIndexOf("</div>"));
  const cards = topLevelDivs(inner);

  const picked = KEEP.map((k) => {
    const card = cards.find((c) => c.includes(k.img));
    if (!card) return null;
    /* On ne garde du polaroïd d'origine que son contenu — image et légende traduite —
     * et on réécrit l'enveloppe avec la nouvelle pose. */
    const body = card.slice(card.indexOf(">") + 1, card.lastIndexOf("</div>"));
    return `<div style="flex:0 0 ${k.w}%;background:#FFFFFF;padding:1.1cqh 1.1cqh 0;box-shadow:0 10px 26px rgba(13,36,71,.18),0 2px 5px rgba(13,36,71,.12);transform:rotate(${k.rot}deg) translate(${k.dx}%,${k.dy}%);position:relative;z-index:${k.z}">${body}</div>`;
  }).filter(Boolean);

  if (picked.length !== KEEP.length) { console.error(`${L} : ${picked.length}/${KEEP.length} vignettes retrouvées, rien n'est écrit`); continue; }

  const scattered = `<div style="flex:1;margin-top:2.4cqh;display:flex;align-items:center;justify-content:center;padding:0 4%">\n    ${picked.join("\n    ")}\n  </div>`;
  writeFileSync(path, html.slice(0, gridStart) + scattered + html.slice(gridEnd));
  console.log(`${L} : ${picked.length} polaroïds conservés et éparpillés (Tokyo, Cusco et Sydney retirés)`);
}
