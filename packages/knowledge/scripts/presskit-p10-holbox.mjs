#!/usr/bin/env node
/* Page 10 des quatre plaquettes : une vraie photo, et les selfies relégués.
 *
 * Le reproche est juste. La page reposait sur cinq vignettes de Bailey détouré devant Paris,
 * Rome, le Grand Canyon… Des montages assumés, mais qui, sur une page de dossier de presse,
 * tirent tout le document vers le synthétique — au moment précis où l'on demande à un
 * journaliste de croire que la donnée est vérifiée. Une photographie authentique fait
 * l'inverse : elle atteste.
 *
 * La nouvelle composition, en trois bandes :
 *   · à gauche, le discours — sur-titre, titre, filet orange, signature manuscrite. Il peut
 *     mordre sur la photo : le sable et le ciel sont assez clairs pour porter du texte foncé ;
 *   · au centre, la photo de Holbox sur toute la hauteur, légèrement de travers, fondue sur
 *     ses quatre bords par un masque elliptique — elle n'a donc ni cadre ni arête, elle
 *     émerge du fond de page au lieu d'y être collée ;
 *   · à droite, les cinq polaroïds, deux fois plus petits, empilés en colonne. Ils ne sont
 *     pas supprimés : les noms de villes restent lisibles et disent le tour du monde. Ils
 *     cessent simplement d'être le sujet.
 *
 * Un choix à connaître : le masque est un `radial-gradient` unique plutôt que quatre dégradés
 * composés. Le résultat est le même à l'œil, mais un seul dégradé se rend de façon identique
 * dans Chromium à l'écran et dans le PDF — les masques composés, eux, sont diversement
 * interprétés, et cette page part à l'impression.
 *
 * Les textes ne sont jamais réécrits : ils sont relus dans chaque fichier et réinjectés tels
 * quels. Le script refuse de s'exécuter s'il n'en retrouve pas un seul.
 *
 *   node packages/knowledge/scripts/presskit-p10-holbox.mjs [--dry]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const DIR = "packages/ui/public/presskit";
const PHOTO = "assets/photos/bailey-holbox.jpg";
const dry = process.argv.includes("--dry");

/** Les cinq polaroïds : fichier, angle et décalage. Les angles restent dissemblables — deux
 *  inclinaisons égales et opposées se reliraient comme un motif, pas comme une pile. */
const VIGNETTES = [
  { file: "assets/photos/france.jpg", rot: -6.2, dx: -4, fit: "contain" },
  { file: "assets/photos/italie.jpg", rot: 4.8, dx: 3, fit: "contain" },
  { file: "assets/photos/usa.jpg", rot: -2.4, dx: -2, fit: "contain" },
  { file: "assets/photos/grece.jpg", rot: 5.6, dx: 4, fit: "contain" },
  { file: "assets/photos/mexique.jpg", rot: -4.1, dx: -3, fit: "cover", pos: "38% 55%" },
];

const echappe = (s) => s;

function construire({ label, eyebrow, h2, sig, role, stats, villes, phrase, logoDomain, numero }) {
  const polaroids = VIGNETTES.map((v, i) => {
    const ville = villes[i];
    return (
      `<div style="background:#FFFFFF;padding:.55cqh .55cqh 0;` +
      `box-shadow:0 6px 16px rgba(13,36,71,.16),0 1px 3px rgba(13,36,71,.10);` +
      `transform:rotate(${v.rot}deg) translateX(${v.dx}%)">` +
      `<img src="${v.file}" alt="" style="display:block;width:100%;aspect-ratio:1.25/1;` +
      `object-fit:${v.fit};${v.pos ? `object-position:${v.pos};` : ""}background:#FFFFFF">` +
      `<div style="padding:.45cqh 0 .6cqh;text-align:center;font-family:Caveat,cursive;` +
      `font-size:1.55cqh;line-height:1.1;color:#0D2447">${echappe(ville)}</div>` +
      `</div>`
    );
  }).join("");

  const chiffres = stats.map((s) =>
    `<div><div style="font-family:'Playfair Display',serif;font-weight:700;font-size:4cqh;` +
    `line-height:1;color:#EE7C1B">${s.v}</div>` +
    `<div style="margin-top:.5cqh;font-family:Poppins,sans-serif;font-size:1.6cqh;color:#5A6B84">${s.l}</div></div>`,
  ).join("");

  return (
    `<section class="page" data-screen-label="${label}" style="position:relative;overflow:hidden;` +
    `background:#F4F6FA;padding:6.5% 6% 5%;box-sizing:border-box;display:flex;flex-direction:column;` +
    `font-family:'Source Sans 3',sans-serif;color:#0D2447">\n` +

    /* La photo, posée AVANT tout le reste et en `z-index:0` : le texte et les polaroïds
       passent au-dessus sans qu'on ait à empiler des contextes. Elle déborde volontairement
       en haut et en bas — le masque efface les bords, donc rien ne se voit couper. */
    `  <img src="${PHOTO}" alt="Bailey dans l'eau turquoise à Holbox, Mexique" ` +
    `style="position:absolute;z-index:0;left:34%;top:-6%;height:112%;width:auto;` +
    `transform:rotate(-2.2deg);pointer-events:none;` +
    `-webkit-mask-image:radial-gradient(ellipse 74% 80% at 50% 50%, #000 46%, rgba(0,0,0,.62) 72%, transparent 100%);` +
    `mask-image:radial-gradient(ellipse 74% 80% at 50% 50%, #000 46%, rgba(0,0,0,.62) 72%, transparent 100%)">\n` +

    `  <div style="position:relative;z-index:2;display:flex;flex-direction:column;height:100%">\n` +
    `    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:4%">\n` +

    /* Colonne de gauche : le discours. Elle mord sur le bord fondu de la photo, là où il ne
       reste que du sable et du ciel très clairs — le texte foncé y garde son contraste. */
    `      <div style="width:44%">\n` +
    `        <div style="font-family:Poppins,sans-serif;font-size:1.7cqh;letter-spacing:.22em;text-transform:uppercase;color:#8A97AB">${eyebrow}</div>\n` +
    `        <h2 style="margin:1.2cqh 0 0;font-family:'Playfair Display',serif;font-weight:700;font-size:5cqh;line-height:1.02">${h2}</h2>\n` +
    `        <div style="margin-top:2cqh;width:66px;height:3px;background:#EE7C1B"></div>\n` +
    `        <div style="margin-top:3.4cqh">\n` +
    `          <div style="font-family:Caveat,cursive;font-size:3.8cqh;color:#0D2447;line-height:1">${sig}</div>\n` +
    `          <div style="margin-top:.6cqh;font-family:Poppins,sans-serif;font-size:1.75cqh;color:#8A97AB">${role}</div>\n` +
    `        </div>\n` +
    /* Les chiffres descendent sous la signature : la colonne de droite est désormais occupée
       par les polaroïds, et les empiler tous les deux à droite aurait fait un mur. */
    `        <div style="margin-top:4cqh;display:flex;gap:7%">${chiffres}</div>\n` +
    `      </div>\n` +

    /* Colonne de droite : les polaroïds, en colonne serrée. `width:19%` les met à un peu moins
       de la moitié de leur taille d'origine (21 à 23 % de la LARGEUR de page auparavant, sur
       une seule rangée) — c'est la réduction demandée, mesurée sur la surface. */
    `      <div style="width:19%;display:flex;flex-direction:column;align-items:stretch;gap:1.4cqh;margin-top:.4cqh">${polaroids}</div>\n` +
    `    </div>\n` +

    `    <div style="margin-top:auto;display:flex;justify-content:space-between;align-items:flex-end;gap:6%">\n` +
    `      <p style="margin:0;flex:1;font-size:1.85cqh;line-height:1.4;color:#5A6B84;white-space:nowrap">${phrase}</p>\n` +
    `      <div style="display:flex;align-items:center;gap:2em;font-family:Poppins,sans-serif;font-size:1.5cqh;letter-spacing:.16em;text-transform:uppercase;color:#9AA5B7">` +
    `<img src="${logoDomain}" alt="MyDogCanFly.com" style="width:auto;height:2.6cqh;display:block"><span>${numero}</span></div>\n` +
    `    </div>\n` +
    `  </div>\n` +
    `</section>`
  );
}

/* ------------------------------------------------------------------ extraction */

const attendu = (v, quoi, f) => {
  if (!v) { console.error(`✗ ${f} : ${quoi} introuvable — rien n'est écrit.`); process.exit(1); }
  return v;
};

let faits = 0;
for (const langue of ["en", "fr", "es", "pt"]) {
  const path = `${DIR}/press-kit-${langue}.html`;
  if (!existsSync(path)) { console.error(`${path} absent`); continue; }
  const html = readFileSync(path, "utf-8");
  const pages = html.match(/<section class="page"[^>]*>[\s\S]*?<\/section>/g) ?? [];
  if (pages.length !== 12) { console.error(`✗ ${langue} : ${pages.length} pages au lieu de 12`); process.exit(1); }
  const p = pages[9];
  /* On reconnaît la page à son CONTENU — la pile de polaroïds — et non à son libellé
   * d'écran, qui est traduit : « Bailey world tour », « Vuelta al mundo », « Volta ao mundo ».
   * Une garde écrite en anglais n'aurait vérifié qu'une langue sur quatre. */
  if (!p.includes("assets/photos/france.jpg")) { console.error(`✗ ${langue} : la page 10 n'est pas celle attendue`); process.exit(1); }
  const label = /data-screen-label="([^"]*)"/.exec(p)?.[1] ?? "10";
  if (p.includes("bailey-holbox")) { console.log(`${langue} : déjà refaite, ignorée`); continue; }

  const eyebrow = attendu(/letter-spacing:\.22em[^>]*>([^<]+)</.exec(p)?.[1], "sur-titre", langue);
  const h2 = attendu(/<h2[^>]*>([\s\S]*?)<\/h2>/.exec(p)?.[1], "titre", langue);
  const sig = attendu(/font-family:Caveat,cursive;font-size:3\.8cqh[^>]*>([^<]+)</.exec(p)?.[1], "signature", langue);
  const role = attendu(/font-size:1\.75cqh;color:#8A97AB">([^<]+)</.exec(p)?.[1], "fonction", langue);
  const villes = [...p.matchAll(/font-family:Caveat,cursive;font-size:2\.5cqh">([^<]+)</g)].map((m) => m[1]);
  if (villes.length !== 5) { console.error(`✗ ${langue} : ${villes.length} légendes de ville au lieu de 5`); process.exit(1); }
  const stats = [...p.matchAll(/font-size:4\.6cqh;line-height:1;color:#EE7C1B">([^<]+)<\/div><div[^>]*>([^<]+)</g)]
    .map((m) => ({ v: m[1], l: m[2] }));
  if (stats.length !== 3) { console.error(`✗ ${langue} : ${stats.length} chiffres au lieu de 3`); process.exit(1); }
  /* La phrase de pied n'a pas le même style d'une langue à l'autre — le français a reçu un
   * `white-space:nowrap` que les autres n'ont pas. On la repère donc par sa balise, seule <p>
   * de la page, plutôt que par un style qui ne vaut que pour une langue. */
  const phrase = attendu(/<p style="[^"]*">([^<]+)<\/p>/.exec(p)?.[1], "phrase de pied", langue);
  const logoDomain = attendu(/src="([^"]*Domain[^"]*)"/.exec(p)?.[1], "logo de pied", langue);
  const numero = attendu(/<span>(\d+)<\/span>/.exec(p)?.[1], "numéro de page", langue);

  const neuf = construire({ label, eyebrow, h2, sig, role, stats, villes, phrase, logoDomain, numero });
  if (!dry) writeFileSync(path, html.replace(p, neuf));
  faits++;
  console.log(`${langue} : page 10 recomposée — photo pleine hauteur, ${villes.length} polaroïds à droite`);
}
console.log(`\n${faits} plaquette(s) mise(s) à jour${dry ? " — essai à blanc" : ""}`);
