#!/usr/bin/env node
/* Page 09 « Fondateur » du dossier de presse : une photo verticale → deux photos larges.
 *
 * Pourquoi deux. La page ne montrait que le fondateur. Elle montre maintenant les deux sujets
 * du site : l'homme et le chien à la montagne, puis le chien devant sa caisse de transport —
 * c'est-à-dire le propos du site, un chien qui voyage. La seconde image est aussi la seule du
 * dossier qui donne à voir l'objet dont tout le reste parle.
 *
 * Pourquoi sans recadrage. Les deux photos sont en 16/9. La colonne d'origine était une bande
 * verticale plein cadre : y loger du 16/9 aurait obligé à tailler dedans, donc à perdre
 * précisément ce qui fait le « plan large » — la montagne derrière, le tarmac et le chariot.
 * On garde donc le format natif, et c'est la colonne qui s'adapte : les deux tirages sont
 * posés au centre d'un fond crème, avec un liseré blanc qui fait passe-partout. La marge
 * au-dessus et en dessous devient une marge d'encadrement, pas un trou.
 *
 *   node packages/knowledge/scripts/founder-two-photos.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const DIR = "packages/ui/public/presskit";

/** Les deux tirages, dans l'ordre haut → bas, avec leur texte alternatif par langue. */
const SHOTS = [
  {
    file: "assets/photos/founder-mountain.jpg",
    en: "Phil Albert-Benoist and Bailey in the mountains",
    fr: "Phil Albert-Benoist et Bailey à la montagne",
    es: "Phil Albert-Benoist y Bailey en la montaña",
  },
  {
    file: "assets/photos/bailey-crate.jpg",
    en: "Bailey beside his IATA travel crate",
    fr: "Bailey devant sa caisse de transport IATA",
    es: "Bailey junto a su transportín IATA",
  },
];

/** La bande de gauche : fond crème, deux tirages centrés, liseré blanc et ombre portée. */
const column = (L) =>
  `<div style="position:absolute;left:0;top:0;bottom:0;width:40%;background:#F1EDE6;` +
  `display:flex;flex-direction:column;justify-content:center;gap:3.4cqh;padding:0 3.4cqh;box-sizing:border-box">` +
  SHOTS.map(
    (s) =>
      `<img src="${s.file}" alt="${s[L]}" style="display:block;width:100%;height:auto;` +
      `background:#FFFFFF;padding:1.1cqh;box-sizing:border-box;` +
      `box-shadow:0 8px 22px rgba(13,36,71,.16),0 2px 5px rgba(13,36,71,.10)">`,
  ).join("") +
  `</div>`;

for (const L of ["en", "fr", "es"]) {
  const path = `${DIR}/press-kit-${L}.html`;
  if (!existsSync(path)) { console.error(`${path} absent`); continue; }
  let html = readFileSync(path, "utf-8");

  if (html.includes("assets/photos/founder-mountain.jpg")) {
    console.log(`${L} : déjà fait, ignoré`);
    continue;
  }

  /* On ne cherche pas la page par son libellé — il est traduit — mais par la seule
   * occurrence de l'ancienne photo du fondateur, qui n'apparaît nulle part ailleurs. */
  const anchor = html.indexOf("assets/photos/founder-real.jpg");
  if (anchor < 0) { console.error(`${L} : photo du fondateur introuvable, rien n'est écrit`); continue; }

  const start = html.lastIndexOf("<div", anchor);
  const end = html.indexOf("</div>", anchor) + "</div>".length;
  const old = html.slice(start, end);
  if (!old.includes("width:36%")) { console.error(`${L} : colonne inattendue → ${old.slice(0, 90)}…`); continue; }

  html = html.slice(0, start) + column(L) + html.slice(end);
  /* La colonne de texte reprend la largeur restante. */
  const before = html;
  html = html.replace('style="position:absolute;right:0;top:0;bottom:0;width:64%', 'style="position:absolute;right:0;top:0;bottom:0;width:60%');
  if (html === before) console.error(`${L} : largeur du texte non ajustée (à vérifier)`);

  writeFileSync(path, html);
  console.log(`${L} : deux tirages 16/9 posés en page 09`);
}
