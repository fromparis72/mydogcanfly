#!/usr/bin/env node
/* Ajoute au dossier de presse une page de captures du produit, dans les trois langues.
 *
 * Pourquoi. Le dossier faisait très bien découvrir la marque et pas du tout l'interface :
 * douze pages, aucune capture d'écran. Un journaliste spécialisé a besoin de voir ce que le
 * site rend, pas seulement ce qu'il promet — et c'est aussi ce qui équilibre une campagne
 * visuelle largement générée par IA.
 *
 * Où. En annexe, juste après le communiqué et avant les contacts. Ce placement est choisi
 * pour une raison mécanique : les pages « 07 Key facts », « 10 Bailey » et « 12 Contact »
 * ne portent pas de numéro imprimé, et la page insérée prend le numéro 12 sans obliger à
 * renuméroter quoi que ce soit. Insérer plus tôt aurait demandé de reprendre huit pieds de
 * page et neuf lignes de sommaire dans trois fichiers — beaucoup de risque pour peu de gain.
 *
 *   node packages/knowledge/scripts/add-product-page.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";

const DIR = "packages/ui/public/presskit";

/** Les quatre captures, avec leur légende par langue. */
const SHOTS = [
  {
    file: "01-flight-finder-2",
    en: ["Flight Finder", "Route, breed, weight, cabin or hold, travel date."],
    fr: ["Le Finder", "Trajet, race, poids, cabine ou soute, date du voyage."],
    es: ["El buscador", "Ruta, raza, peso, cabina o bodega, fecha del viaje."],
  },
  {
    file: "02-recommendation-2",
    en: ["The recommendation", "A verdict, a compatibility score, and the airlines that fly the route."],
    fr: ["La recommandation", "Un verdict, un taux de compatibilité, et les compagnies qui font la route."],
    es: ["La recomendación", "Un veredicto, un porcentaje de compatibilidad y las aerolíneas que cubren la ruta."],
  },
  {
    file: "03-requirements-sheet-3",
    en: ["The tailored sheet", "Step by step, outbound and return — each rule names its authority."],
    fr: ["La fiche sur mesure", "Étape par étape, aller et retour — chaque règle nomme son autorité."],
    es: ["La ficha a medida", "Paso a paso, ida y vuelta — cada norma nombra su autoridad."],
  },
  {
    file: "04-breed-report-2",
    en: ["The breed report", "Cabin, hold, cargo, heat and cold, read from the breed's own data."],
    fr: ["Le rapport de race", "Cabine, soute, cargo, chaleur et froid, lus sur les données de la race."],
    es: ["El informe de raza", "Cabina, bodega, carga, calor y frío, leídos de los datos de la raza."],
  },
];

const HEAD = {
  en: ["THE PRODUCT", "What it actually", "looks like", "Four screenshots of the live site — not mock-ups."],
  fr: ["LE PRODUIT", "À quoi ça", "ressemble", "Quatre captures du site en ligne — pas des maquettes."],
  es: ["EL PRODUCTO", "Qué aspecto", "tiene", "Cuatro capturas del sitio en línea — no son maquetas."],
};

const page = (L) => `
<section class="page" data-screen-label="12 Product" style="position:relative;background:#FCFBF9;padding:7% 6% 5%;box-sizing:border-box;display:flex;flex-direction:column;font-family:'Source Sans 3',sans-serif;color:#0D2447">
  <div style="font-family:Poppins,sans-serif;font-size:1.5cqh;letter-spacing:.22em;text-transform:uppercase;color:#8A97AB">${HEAD[L][0]}</div>
  <h2 style="font-family:Georgia,'Times New Roman',serif;font-size:4.4cqh;line-height:1.1;font-weight:700;margin:.6cqh 0 0">${HEAD[L][1]} <span style="color:#F2700F">${HEAD[L][2]}</span></h2>
  <div style="width:7cqh;height:.45cqh;background:#F2700F;margin:1.4cqh 0 1.2cqh"></div>
  <p style="font-size:1.75cqh;line-height:1.5;color:#4A5A73;margin:0 0 2.2cqh;max-width:60%">${HEAD[L][3]}</p>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:2.4cqh 2.6cqh">
    ${SHOTS.map((s) => `<figure style="margin:0">
      <img src="screenshots/${s.file}.webp" alt="${s[L][0]}" style="display:block;width:100%;height:28cqh;object-fit:cover;object-position:top center;border:1px solid #E2E7EE;border-radius:1.1cqh;background:#fff">
      <figcaption style="margin-top:.9cqh">
        <span style="display:block;font-weight:700;font-size:1.8cqh">${s[L][0]}</span>
        <span style="display:block;font-size:1.5cqh;line-height:1.45;color:#6B7A91">${s[L][1]}</span>
      </figcaption>
    </figure>`).join("\n    ")}
  </div>
  <div style="margin-top:auto;display:flex;justify-content:space-between;align-items:center;font-family:Poppins,sans-serif;font-size:1.5cqh;letter-spacing:.16em;text-transform:uppercase;color:#9AA5B7"><span>mydogcanfly.com</span><span>12</span></div>
</section>
`;

for (const L of ["en", "fr", "es"]) {
  const path = `${DIR}/press-kit-${L}.html`;
  let html = readFileSync(path, "utf-8");
  if (html.includes('data-screen-label="12 Product"')) { console.log(`${L} : déjà présent, ignoré`); continue; }
  /* Le libellé de la dernière page est traduit dans chaque fichier — « 12 Contact »,
   * « 12 Contacts », « 12 Contacto ». On l'attrape par son numéro, pas par son mot. */
  const anchor = html.search(/<section class="page" data-screen-label="12 [^"]*"/);
  if (anchor < 0) { console.error(`${L} : dernière page introuvable, rien n'est écrit`); continue; }
  html = html.slice(0, anchor) + page(L).trim() + "\n\n" + html.slice(anchor);
  writeFileSync(path, html);
  console.log(`${L} : page produit insérée avant la page Contact`);
}
