#!/usr/bin/env node
/* Page 10 : Bailey prend la parole.
 *
 * Deuxième passe, après `presskit-p10-holbox.mjs` qui avait posé la photo. Trois changements,
 * et un seul les résume : la page cesse d'être une vitrine pour devenir un témoignage.
 *
 *   · Les trois chiffres (160+, 90+, 1 mission) disparaissent. Ils faisaient doublon avec le
 *     reste de la plaquette, et l'un d'eux était illisible par-dessus la photo.
 *   · À leur place, un texte à la PREMIÈRE PERSONNE, dans le gris et le corps exacts de la
 *     biographie de la page 9. Le parallèle est voulu : page 9 le maître raconte, page 10 le
 *     chien répond. C'est aussi ce qui donne à la page sa valeur pour un journaliste — un
 *     chien qui vole en soute depuis ses quatre mois est un témoignage, pas un argumentaire.
 *   · La colonne de polaroïds passe en position absolue et déborde volontairement des deux
 *     côtés : le premier tirage est coupé par le bord haut, le cinquième l'est à moitié par le
 *     bord bas. Une pile qu'on ne voit pas finir se lit comme une série qui continue ; une
 *     pile bien cadrée se lit comme un inventaire.
 *
 * Le léger chevauchement entre tirages (-1.2cqh) n'est pas décoratif : c'est lui qui permet de
 * faire tenir cinq polaroïds sur 118 % de la hauteur de page. Sans lui, le cinquième tomberait
 * entièrement hors du cadre.
 *
 * Les textes existants — sur-titre, titre, légendes de villes, phrase de pied — sont relus
 * dans chaque fichier et réinjectés tels quels. Seule la biographie est nouvelle, et elle est
 * écrite ici dans les quatre langues.
 *
 *   node packages/knowledge/scripts/presskit-p10-bailey.mjs [--dry]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const DIR = "packages/ui/public/presskit";
/* Version sans la laisse, fournie le 02/08/2026. NOM de fichier différent, et non écrasement :
 * les plaquettes sont distribuées et mises en cache, un fichier remplacé sur place resservirait
 * l'ancienne image pendant des jours. */
const PHOTO = "assets/photos/bailey-holbox-2.jpg";
const dry = process.argv.includes("--dry");

/* La parole de Bailey. Quatre paragraphes courts : il se présente, il explique la soute, il
 * raconte le Mexique — la plage est celle de la photo, à côté —, puis il dit l'arrivée.
 * Le dernier est le plus important : c'est lui qui rassure un maître inquiet. */
const BIO = {
  fr: [
    "Je m'appelle Bailey, je suis un Golden Retriever mâle et j'ai quatre ans. Je voyage depuis que j'en ai quatre : quatre mois, pas quatre ans. Autant dire que l'avion fait partie de ma vie depuis à peu près toujours.",
    "Vu mon gabarit, ma place est en soute, dans ma caisse. J'ai eu la chance d'y être habitué très jeune, et ça change tout : aujourd'hui j'y entre tranquillement, je m'installe, et je dors. J'ai déjà fait des trajets de plus de seize heures de porte à porte sans que ça me pose le moindre problème.",
    "Le plus loin ? Le Mexique, pour ces plages-là — celle de la photo, juste à côté. L'eau était tiède, le sable brûlant, et je crois que je n'ai jamais eu aussi peu envie de rentrer.",
    "Une seule chose n'a pas changé en quatre ans : le moment où la porte s'ouvre à l'arrivée et où je retrouve mon maître. C'est toujours le meilleur du voyage.",
  ],
  en: [
    "My name is Bailey, I'm a male Golden Retriever and I'm four years old. I've been travelling since I was four — four months, that is, not four years. Flying has been part of my life for about as long as I can remember.",
    "Given my size, my place is in the hold, in my crate. I was lucky enough to get used to it very young, and that changes everything: today I walk in calmly, settle down and sleep. I've done door-to-door journeys of more than sixteen hours without the slightest trouble.",
    "The furthest? Mexico, for those beaches — the one in the photo, right beside this. The water was warm, the sand was scorching, and I don't think I've ever wanted to go home less.",
    "One thing hasn't changed in four years: the moment the door opens on arrival and I find my human again. That's still the best part of the trip.",
  ],
  es: [
    "Me llamo Bailey, soy un Golden Retriever macho y tengo cuatro años. Viajo desde que tenía cuatro: cuatro meses, no cuatro años. El avión forma parte de mi vida desde casi siempre.",
    "Por mi tamaño, mi sitio está en la bodega, dentro de mi transportín. Tuve la suerte de acostumbrarme muy pronto, y eso lo cambia todo: hoy entro tranquilo, me acomodo y me duermo. He hecho trayectos de más de dieciséis horas de puerta a puerta sin el menor problema.",
    "¿Lo más lejos? México, por esas playas — la de la foto, justo al lado. El agua estaba templada, la arena ardiendo, y creo que nunca he tenido tan pocas ganas de volver.",
    "Una cosa no ha cambiado en cuatro años: el momento en que se abre la puerta al llegar y vuelvo a encontrar a mi dueño. Sigue siendo lo mejor del viaje.",
  ],
  pt: [
    "Meu nome é Bailey, sou um Golden Retriever macho e tenho quatro anos. Viajo desde os quatro: quatro meses, não quatro anos. O avião faz parte da minha vida praticamente desde sempre.",
    "Pelo meu porte, meu lugar é no porão, dentro da minha caixa de transporte. Tive a sorte de me acostumar bem cedo, e isso muda tudo: hoje eu entro tranquilo, me ajeito e durmo. Já fiz viagens de mais de dezesseis horas de porta a porta sem o menor problema.",
    "O mais longe? O México, por causa daquelas praias — a da foto, bem ao lado. A água estava morna, a areia quente, e acho que nunca tive tão pouca vontade de voltar.",
    "Uma coisa não mudou em quatro anos: a hora em que a porta se abre na chegada e eu reencontro meu dono. Continua sendo a melhor parte da viagem.",
  ],
};

/** Les cinq polaroïds. Angles dissemblables : deux inclinaisons égales et opposées se
 *  reliraient comme un motif, pas comme une pile posée à la main. */
const VIGNETTES = [
  { file: "assets/photos/france.jpg", rot: -6.2, dx: -4, fit: "contain" },
  { file: "assets/photos/italie.jpg", rot: 4.8, dx: 3, fit: "contain" },
  { file: "assets/photos/usa.jpg", rot: -2.4, dx: -2, fit: "contain" },
  { file: "assets/photos/grece.jpg", rot: 5.6, dx: 4, fit: "contain" },
  { file: "assets/photos/mexique.jpg", rot: -4.1, dx: -3, fit: "cover", pos: "38% 55%" },
];

function construire({ langue, label, eyebrow, h2, role, villes, phrase, logoDomain, numero }) {
  const polaroids = VIGNETTES.map((v, i) =>
    `<div style="background:#FFFFFF;padding:.55cqh .55cqh 0;${i ? "margin-top:-1.2cqh;" : ""}` +
    `box-shadow:0 6px 16px rgba(13,36,71,.16),0 1px 3px rgba(13,36,71,.10);` +
    `transform:rotate(${v.rot}deg) translateX(${v.dx}%);position:relative;z-index:${5 - i}">` +
    `<img src="${v.file}" alt="" style="display:block;width:100%;aspect-ratio:1.25/1;` +
    `object-fit:${v.fit};${v.pos ? `object-position:${v.pos};` : ""}background:#FFFFFF">` +
    `<div style="padding:.45cqh 0 .6cqh;text-align:center;font-family:Caveat,cursive;` +
    `font-size:1.55cqh;line-height:1.1;color:#0D2447">${villes[i]}</div></div>`,
  ).join("");

  /* Le gris, le corps et l'interligne sont ceux de la biographie de la page 9. C'est
   * volontaire : les deux pages doivent se répondre, pas se ressembler vaguement. */
  const bio = BIO[langue].map((t, i) =>
    `<p style="margin:${i ? "1.4cqh" : "2.6cqh"} 0 0;font-size:1.9cqh;line-height:1.52;color:#5A6B84">${t}</p>`,
  ).join("");

  return (
    `<section class="page" data-screen-label="${label}" style="position:relative;overflow:hidden;` +
    `background:#F4F6FA;padding:6.5% 6% 5%;box-sizing:border-box;display:flex;flex-direction:column;` +
    `font-family:'Source Sans 3',sans-serif;color:#0D2447">\n` +

    /* La photo, sous tout le reste. Elle déborde en haut et en bas ; le masque elliptique
       efface ses quatre bords, donc aucune coupe n'est visible. */
    `  <img src="${PHOTO}" alt="Bailey dans l'eau turquoise à Holbox, Mexique" ` +
    `style="position:absolute;z-index:0;left:34%;top:-6%;height:112%;width:auto;` +
    `transform:rotate(-2.2deg);pointer-events:none;` +
    `-webkit-mask-image:radial-gradient(ellipse 74% 80% at 50% 50%, #000 46%, rgba(0,0,0,.62) 72%, transparent 100%);` +
    `mask-image:radial-gradient(ellipse 74% 80% at 50% 50%, #000 46%, rgba(0,0,0,.62) 72%, transparent 100%)">\n` +

    /* La pile de polaroïds, en position absolue et hors du flux : c'est ce qui lui permet de
       déborder des deux bords sans pousser quoi que ce soit. `top:-6%` coupe le premier
       tirage en haut ; la hauteur cumulée fait sortir le cinquième à moitié en bas. */
    `  <div style="position:absolute;z-index:1;right:6%;top:-6%;width:19%;display:flex;flex-direction:column">${polaroids}</div>\n` +

    `  <div style="position:relative;z-index:2;display:flex;flex-direction:column;height:100%">\n` +
    /* Colonne de gauche. Elle mord sur le bord fondu de la photo, là où il ne reste que du
       sable et du ciel très clairs : le texte foncé y garde son contraste. */
    `    <div style="width:46%">\n` +
    `      <div style="font-family:Poppins,sans-serif;font-size:1.7cqh;letter-spacing:.22em;text-transform:uppercase;color:#8A97AB">${eyebrow}</div>\n` +
    `      <h2 style="margin:1.2cqh 0 0;font-family:'Playfair Display',serif;font-weight:700;font-size:5cqh;line-height:1.02">${h2}</h2>\n` +
    `      <div style="margin-top:2cqh;width:66px;height:3px;background:#EE7C1B"></div>\n` +
    `      ${bio}\n` +
    `    </div>\n` +

    /* La signature, en bas de page et dans la zone claire, comme au pied d'une lettre. Pas
       d'âge : il est dit dans le texte, le répéter ici l'affaiblirait. */
    `    <div style="margin-top:auto;padding-top:2.4cqh">\n` +
    `      <div style="font-family:Caveat,cursive;font-size:4.2cqh;color:#0D2447;line-height:1">Bailey,</div>\n` +
    `      <div style="margin-top:.5cqh;font-family:Poppins,sans-serif;font-size:1.75cqh;color:#8A97AB">${role}</div>\n` +
    `    </div>\n` +

    `    <div style="margin-top:2.6cqh;display:flex;justify-content:space-between;align-items:flex-end;gap:6%">\n` +
    `      <p style="margin:0;max-width:52%;font-size:1.85cqh;line-height:1.4;color:#5A6B84">${phrase}</p>\n` +
    `      <div style="display:flex;align-items:center;gap:2em;font-family:Poppins,sans-serif;font-size:1.5cqh;letter-spacing:.16em;text-transform:uppercase;color:#9AA5B7">` +
    `<img src="${logoDomain}" alt="MyDogCanFly.com" style="width:auto;height:2.6cqh;display:block"><span>${numero}</span></div>\n` +
    `    </div>\n` +
    `  </div>\n` +
    `</section>`
  );
}

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
  /* On reconnaît la page à son contenu, pas à son libellé d'écran qui est traduit. */
  if (!p.includes("assets/photos/france.jpg")) { console.error(`✗ ${langue} : la page 10 n'est pas celle attendue`); process.exit(1); }

  const label = /data-screen-label="([^"]*)"/.exec(p)?.[1] ?? "10";
  const eyebrow = attendu(/letter-spacing:\.22em[^>]*>([^<]+)</.exec(p)?.[1], "sur-titre", langue);
  const h2 = attendu(/<h2[^>]*>([\s\S]*?)<\/h2>/.exec(p)?.[1], "titre", langue);
  const role = attendu(/font-size:1\.75cqh;color:#8A97AB">([^<]+)</.exec(p)?.[1], "fonction", langue);
  /* Les légendes de ville : au corps de la première passe (1.55cqh) ou de l'original (2.5cqh),
   * pour que le script fonctionne quelle que soit la version en place. */
  const villes = [...p.matchAll(/font-family:Caveat,cursive;font-size:(?:1\.55|2\.5)cqh[^>]*>([^<]+)</g)].map((m) => m[1]);
  if (villes.length !== 5) { console.error(`✗ ${langue} : ${villes.length} légendes de ville au lieu de 5`); process.exit(1); }
  const phrase = attendu(/<p style="[^"]*">([^<]+)<\/p>/.exec(p)?.[1], "phrase de pied", langue);
  const logoDomain = attendu(/src="([^"]*Domain[^"]*)"/.exec(p)?.[1], "logo de pied", langue);
  const numero = attendu(/<span>(\d+)<\/span>/.exec(p)?.[1], "numéro de page", langue);

  const neuf = construire({ langue, label, eyebrow, h2, role, villes, phrase, logoDomain, numero });
  if (!dry) writeFileSync(path, html.replace(p, neuf));
  faits++;
  console.log(`${langue} : Bailey prend la parole — ${BIO[langue].length} paragraphes, chiffres retirés`);
}
console.log(`\n${faits} plaquette(s) mise(s) à jour${dry ? " — essai à blanc" : ""}`);
