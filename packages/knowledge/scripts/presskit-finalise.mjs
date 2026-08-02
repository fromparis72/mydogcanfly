#!/usr/bin/env node
/* Mise au propre du dossier de presse, dans les trois langues, en une passe.
 *
 * Quatre gestes, dans cet ordre — l'ordre compte, la renumérotation vient après la suppression :
 *
 *  1. Page 10 « mascotte » : le verrou complet (emblème + nom de domaine) est posé en haut à
 *     droite, exactement à la place qu'il occupe sur les autres pages, et les trois chiffres
 *     descendent sous lui. La rangée d'en-tête passe donc d'un alignement par le bas à un
 *     alignement par le haut : sans ça, le titre de gauche serait descendu au niveau du bas
 *     d'une colonne devenue deux fois plus haute.
 *
 *  2. La page « communiqué de presse » est retirée. Son titre est désormais celui de la page 04
 *     — le garder aurait fait lire deux fois la même phrase à quatre pages d'intervalle.
 *
 *  3. Les pages qui la suivaient reculent d'un rang : le produit passe de 12 à 11. On corrige
 *     à la fois le numéro imprimé en pied de page et le libellé technique `data-screen-label`,
 *     qui sert de repère au lecteur HTML et aux scripts.
 *
 *  4. Le sommaire est refait : deux titres avaient changé sur les pages sans être reportés,
 *     et la ligne du communiqué est remplacée par celle du produit, qui n'y figurait pas.
 *     Un sommaire faux est pire que pas de sommaire.
 *
 *   node packages/knowledge/scripts/presskit-finalise.mjs
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const DIR = "packages/ui/public/presskit";
const LANGS = ["en", "fr", "es"];

/** Sommaire : ancien intitulé → nouvel intitulé (et nouveau libellé de droite). */
const TOC = {
  en: {
    "Every journey starts here": ["Whether your dog can fly", null],
    "Bailey's been around": ["Our beta tester has four legs", null],
    "Press release": ["What it actually looks like", "The product"],
  },
  fr: {
    "Chaque voyage commence ici": ["Si votre chien peut voler", null],
    "Bailey a fait le tour du monde": ["Notre bêta-testeur a quatre pattes", null],
    "Communiqué de presse": ["À quoi ça ressemble", "Le produit"],
  },
  es: {
    "Cada viaje empieza aquí": ["Si tu perro puede volar", null],
    "Bailey ya ha viajado": ["Nuestro probador beta tiene cuatro patas", null],
    "Comunicado de prensa": ["Qué aspecto tiene", "El producto"],
  },
};

/** Le bandeau logo de la page 10, identique dans les trois langues. */
const LOGO = `<img src="assets/logo-full.png" alt="MyDogCanFly.com" style="width:33%;height:auto;display:block;margin-left:auto">`;

/** Renvoie l'index de fin du `<div>` ouvert à `from` (fermeture au niveau 0).
 *  Indispensable ici : on remplace un conteneur entier, pas seulement sa balise ouvrante —
 *  ajouter un `<div>` sans sa fermeture ferait avaler la moitié de la page par l'en-tête. */
function endOfDiv(html, from) {
  const re = /<\/?div\b[^>]*>/g;
  re.lastIndex = from;
  let depth = 0, m;
  while ((m = re.exec(html))) {
    if (!m[0].startsWith("</")) depth++;
    else if (--depth === 0) return m.index + m[0].length;
  }
  return -1;
}

for (const L of LANGS) {
  const path = `${DIR}/press-kit-${L}.html`;
  if (!existsSync(path)) { console.error(`${path} absent`); continue; }
  let html = readFileSync(path, "utf-8");
  const log = [];

  /* ---- 1. Logo sur la page « mascotte » ------------------------------------------------ */
  const statsOpen = `<div style="width:46%;display:flex;gap:6%;padding-bottom:1cqh">`;
  if (html.includes(LOGO)) {
    log.push("logo déjà posé");
  } else if (html.includes(statsOpen)) {
    const s = html.indexOf(statsOpen);
    const e = endOfDiv(html, s);
    if (e < 0) { console.error(`${L} : fin du bloc des chiffres introuvable, rien n'est écrit`); continue; }
    const inner = html.slice(s + statsOpen.length, e - "</div>".length);
    html =
      html.slice(0, s) +
      `<div style="width:46%;display:flex;flex-direction:column;align-items:flex-end;gap:3cqh">` +
      LOGO +
      `<div style="width:100%;display:flex;gap:6%">${inner}</div>` +
      `</div>` +
      html.slice(e);
    /* La rangée qui contient le titre et les chiffres : on repasse en alignement haut. */
    const row = `<div style="display:flex;justify-content:space-between;align-items:flex-end;gap:6%">\n    <div style="width:48%">`;
    if (!html.includes(row)) log.push("⚠ rangée d'en-tête introuvable");
    html = html.replace(row, `<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:6%">\n    <div style="width:48%">`);
    log.push("logo posé, chiffres descendus");
  } else {
    log.push("⚠ bloc des chiffres introuvable");
  }

  /* ---- 2. Suppression du communiqué ----------------------------------------------------- */
  const pr = html.search(/<section class="page" data-screen-label="11 [^"]*"/);
  if (pr < 0) {
    log.push("communiqué déjà retiré");
  } else {
    const next = html.indexOf('<section class="page"', pr + 10);
    if (next < 0) { console.error(`${L} : fin du communiqué introuvable, rien n'est écrit`); continue; }
    html = html.slice(0, pr) + html.slice(next);
    log.push("communiqué retiré");
  }

  /* ---- 3. Renumérotation du produit : 12 → 11 ------------------------------------------- */
  const prod = html.search(/<section class="page" data-screen-label="12 [^"]*"/);
  if (prod >= 0) {
    const end = html.indexOf('<section class="page"', prod + 10);
    let sec = html.slice(prod, end);
    if (sec.includes("<span>12</span>")) {
      sec = sec.replace('data-screen-label="12 ', 'data-screen-label="11 ').replace("<span>12</span>", "<span>11</span>");
      html = html.slice(0, prod) + sec + html.slice(end);
      log.push("produit renuméroté 11");
    } else {
      log.push("⚠ numéro imprimé du produit introuvable");
    }
  }

  /* ---- 4. Sommaire ---------------------------------------------------------------------- */
  for (const [oldTitle, [newTitle, newLabel]] of Object.entries(TOC[L])) {
    const re = new RegExp(
      `(width:2\\.2em">)(\\d\\d)(</span><span[^>]*>)${oldTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(</span><span[^>]*>)([^<]*)(</span>)`,
    );
    if (!re.test(html)) { log.push(`⚠ ligne de sommaire « ${oldTitle} » introuvable`); continue; }
    html = html.replace(re, (_m, a, num, b, c, label, d) =>
      `${a}${newLabel ? "11" : num}${b}${newTitle}${c}${newLabel ?? label}${d}`);
  }
  log.push("sommaire à jour");

  writeFileSync(path, html);
  console.log(`${L} : ${log.join(" · ")}`);
}
