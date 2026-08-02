#!/usr/bin/env node
/* Fabrique le pack de logos téléchargeable à partir des DEUX vrais fichiers vectoriels.
 *
 * Ce qu'il y avait avant : six PNG, plus un fichier nommé `.svg` qui n'était pas vectoriel —
 * zéro chemin, une image bitmap encapsulée en base64. Un média qui l'ouvrait pour l'agrandir
 * obtenait du flou. Les deux sources livrées le 31/07 sont, elles, de vrais vectoriels :
 * 159 chemins pour l'emblème, 77 pour le logotype.
 *
 * Attention au nommage d'origine, qui induit en erreur : « MyDogCanFly logo full » est
 * l'emblème seul (le chien ailé), et « MyDogCanFly Domain » est le logotype « MyDogCanFly.com ».
 * Il n'existe pas de vectoriel du verrou complet (emblème + logotype côte à côte).
 *
 *   node packages/knowledge/scripts/build-logo-pack.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const SRC = "packages/ui/public/presskit/logos";
const OUT = SRC;
const PREV = "packages/ui/public/presskit/previews";

/** Charte : encre marine, accent orange, papier crème. */
const INK = "#011D48";
const PAPER = "#FCFBF9";

/** Aplatit toutes les couleurs de remplissage sur une seule.
 *  Le monochrome sert aux fonds contraignants — presse papier, sérigraphie, partenaire qui
 *  n'a qu'une encre. On perd les reflets, c'est le principe. */
const monochrome = (svg, color) =>
  svg
    .replace(/fill="#[0-9a-fA-F]{3,8}"/g, `fill="${color}"`)
    .replace(/fill:\s*#[0-9a-fA-F]{3,8}/g, `fill:${color}`)
    .replace(/stroke="#[0-9a-fA-F]{3,8}"/g, `stroke="${color}"`);

/** Retire l'espace vide autour du dessin : le viewBox d'origine laissait un tiers de vide
 *  sous l'emblème, ce qui décale tout logo posé dans une grille. */
function tightViewBox(svg, png) {
  const box = execFileSync("convert", [png, "-trim", "-format", "%wx%h%X%Y", "info:"]).toString();
  const m = /^(\d+)x(\d+)([+-]\d+)([+-]\d+)$/.exec(box);
  if (!m) return svg;
  const vb = /viewBox="([\d.\s-]+)"/.exec(svg);
  if (!vb) return svg;
  const [, , w0, h0] = vb[1].trim().split(/\s+/).map(Number);
  const dims = execFileSync("convert", [png, "-format", "%wx%h", "info:"]).toString().split("x").map(Number);
  const sx = w0 / dims[0], sy = h0 / dims[1];
  const nb = [Number(m[3]) * sx, Number(m[4]) * sy, Number(m[1]) * sx, Number(m[2]) * sy].map((n) => Math.round(n * 100) / 100);
  return svg.replace(/viewBox="[\d.\s-]+"/, `viewBox="${nb.join(" ")}"`).replace(/\s(width|height)="[\d.]+"/g, "");
}

const py = (code) => execFileSync("python3", ["-c", code]).toString();
const toPdf = (svg, pdf) => py(`import cairosvg; cairosvg.svg2pdf(url=${JSON.stringify(svg)}, write_to=${JSON.stringify(pdf)})`);
const toPng = (svg, png, w, bg) =>
  py(`import cairosvg; cairosvg.svg2png(url=${JSON.stringify(svg)}, write_to=${JSON.stringify(png)}, output_width=${w}${bg ? `, background_color=${JSON.stringify(bg)}` : ""})`);

mkdirSync(OUT, { recursive: true });
mkdirSync(PREV, { recursive: true });

const pieces = [
  { key: "emblem", src: "mydogcanfly-emblem.svg", w: 2400 },
  { key: "wordmark", src: "mydogcanfly-wordmark.svg", w: 3000 },
];

const made = [];
for (const p of pieces) {
  const svgPath = join(SRC, p.src);
  if (!existsSync(svgPath)) { console.error(`absent : ${svgPath}`); continue; }
  let svg = readFileSync(svgPath, "utf-8");

  // recadrage serré, calculé sur un rendu temporaire
  const tmp = `/tmp/_${p.key}.png`;
  toPng(svgPath, tmp, 1200, null);
  svg = tightViewBox(svg, tmp);
  writeFileSync(svgPath, svg);

  const variants = [
    ["", svg],
    ["-mono", monochrome(svg, INK)],
    ["-white", monochrome(svg, PAPER)],
  ];
  for (const [suffix, content] of variants) {
    const base = join(OUT, p.src.replace(/\.svg$/, `${suffix}`));
    writeFileSync(`${base}.svg`, content);
    toPdf(`${base}.svg`, `${base}.pdf`);
    toPng(`${base}.svg`, `${base}.png`, p.w, null);
    made.push(`${base}.svg`, `${base}.pdf`, `${base}.png`);
  }
  toPng(svgPath, join(PREV, `${p.key}.png`), 900, null);
}

console.log(`${made.length} fichiers produits pour ${pieces.length} pièces.`);
for (const f of made) console.log("  ·", f.replace(`${OUT}/`, ""));
