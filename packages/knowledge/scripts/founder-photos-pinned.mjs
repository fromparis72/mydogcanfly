#!/usr/bin/env node
/* Page 09 : deux tirages punaisés, au lieu de deux images alignées.
 *
 * Le reproche, juste : deux photos de même largeur, empilées, centrées et parfaitement
 * d'aplomb, ça se lit comme une planche-contact, pas comme un souvenir. Or c'est bien de
 * souvenirs qu'il s'agit — le chien et son maître, avant que le site existe.
 *
 * Ce qui change :
 *   · Chaque tirage est incliné, d'un angle différent et pas symétrique (-3,4° et +2,6°) :
 *     deux angles opposés et égaux se reliraient comme un motif.
 *   · Une punaise est plantée en haut de chaque tirage, à gauche pour l'un, à droite pour
 *     l'autre. Le dégradé radial lui donne son relief : un aplat rond aurait fait pastille.
 *   · Les tirages débordent sur la colonne de texte. Ils ne mordent que sur sa marge
 *     intérieure — vérifié à l'écran, aucune lettre n'est recouverte — mais ce chevauchement
 *     suffit à casser la frontière rectiligne entre l'image et le texte, qui était le vrai
 *     responsable de l'effet « scolaire ».
 *   · L'ombre est portée plus loin et plus doucement, comme un objet posé sur un mur.
 *
 * Les tirages sont positionnés par rapport à la page, pas à la bande crème : c'est ce qui
 * leur permet de la dépasser. La page est en `overflow:hidden`, rien ne fuit au-delà.
 *
 *   node packages/knowledge/scripts/founder-photos-pinned.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const DIR = "packages/ui/public/presskit";

/** Les deux tirages : position et inclinaison, en pourcentage de la page. */
const SHOTS = [
  {
    file: "assets/photos/founder-mountain.jpg",
    left: 3.5, top: 9.5, width: 39, rot: -3.4, pin: 21, z: 5,
    en: "Phil Albert-Benoist and Bailey in the mountains",
    fr: "Phil Albert-Benoist et Bailey à la montagne",
    es: "Phil Albert-Benoist y Bailey en la montaña",
  },
  {
    file: "assets/photos/bailey-crate.jpg",
    left: 4.8, top: 49.5, width: 37.5, rot: 2.6, pin: 78, z: 4,
    en: "Bailey beside his IATA travel crate",
    fr: "Bailey devant sa caisse de transport IATA",
    es: "Bailey junto a su transportín IATA",
  },
];

/** La punaise : dégradé radial pour le relief, ombre courte pour le décollement. */
const pin = (at) =>
  `<div style="position:absolute;left:${at}%;top:-1.3cqh;width:2.6cqh;height:2.6cqh;border-radius:50%;` +
  `background:radial-gradient(circle at 34% 30%, #F9C79E 0 14%, #EE7C1B 52%, #A8490A 100%);` +
  `box-shadow:0 3px 6px rgba(13,36,71,.45)"></div>`;

const prints = (L) =>
  SHOTS.map(
    (s) =>
      `<div style="position:absolute;left:${s.left}%;top:${s.top}%;width:${s.width}%;` +
      `transform:rotate(${s.rot}deg);z-index:${s.z}">` +
      `<img src="${s.file}" alt="${s[L]}" style="display:block;width:100%;height:auto;background:#FFFFFF;` +
      `padding:1.2cqh;box-sizing:border-box;box-shadow:0 16px 34px rgba(13,36,71,.22),0 4px 9px rgba(13,36,71,.14)">` +
      pin(s.pin) +
      `</div>`,
  ).join("");

/** Bande crème de fond, sans contenu : les tirages sont posés par-dessus, pas dedans. */
const band = `<div style="position:absolute;left:0;top:0;bottom:0;width:40%;background:#F1EDE6;z-index:1"></div>`;

for (const L of ["en", "fr", "es"]) {
  const path = `${DIR}/press-kit-${L}.html`;
  if (!existsSync(path)) { console.error(`${path} absent`); continue; }
  let html = readFileSync(path, "utf-8");

  if (html.includes("radial-gradient(circle at 34% 30%")) { console.log(`${L} : déjà punaisé, ignoré`); continue; }

  const anchor = html.indexOf("assets/photos/founder-mountain.jpg");
  if (anchor < 0) { console.error(`${L} : page 09 non préparée (lancer d'abord founder-two-photos.mjs)`); continue; }

  /* La colonne actuelle : on remonte à son `<div>` ouvrant et on suit les niveaux jusqu'à sa
   * fermeture, plutôt que de compter sur une chaîne exacte qui a déjà bougé une fois. */
  const start = html.lastIndexOf("<div", anchor);
  const re = /<\/?div\b[^>]*>/g;
  re.lastIndex = start;
  let depth = 0, end = -1, m;
  while ((m = re.exec(html))) {
    if (!m[0].startsWith("</")) depth++;
    else if (--depth === 0) { end = m.index + m[0].length; break; }
  }
  if (end < 0) { console.error(`${L} : fin de la colonne introuvable, rien n'est écrit`); continue; }

  writeFileSync(path, html.slice(0, start) + band + prints(L) + html.slice(end));
  console.log(`${L} : deux tirages punaisés, inclinés de ${SHOTS.map((s) => `${s.rot}°`).join(" et ")}`);
}
