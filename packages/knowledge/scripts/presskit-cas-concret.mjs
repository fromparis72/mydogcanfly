#!/usr/bin/env node
/* Insère une page « cas concret » après la page 3, dans les quatre plaquettes.
 *
 * Pourquoi. La page 3 énumère huit familles de règles et conclut « Un voyage. Des dizaines de
 * règles ». C'est une promesse laissée sans preuve : le lecteur veut voir ce que ça donne sur
 * un trajet réel. La nouvelle page 4 répond exactement à ça — Paris → Mexico, Golden Retriever
 * de 30 kg, quatre étapes, des chiffres.
 *
 * Le fil de la page est un renversement, et il est délibéré : on commence par le vol, on finit
 * par le retour. Parce que la contrainte qui complique le voyage n'est pas au départ — le chien
 * quitte l'UE librement — mais à la fin, où le Mexique impose une démarche d'export et où la
 * France exige un certificat sanitaire endossé.
 *
 * DONNÉES. Tout est repris des fiches, vérifiées le 11/07/2026, pour un départ de FRANCE. Les
 * cas « depuis les États-Unis ou le Canada » ont été retirés : ils ne s'appliquent pas à ce
 * trajet et brouillaient la lecture. Aucun chiffre n'est inventé ; le tarif Air France (400 €
 * par trajet, zone « toutes autres routes ») a été reconfirmé par Philippe le 02/08/2026.
 *
 * RENUMÉROTATION. Insérer une page décale tout : les anciennes pages 4 à 12 deviennent 5 à 13,
 * et chaque page porte son numéro en pied. Le script les renumérote et VÉRIFIE le résultat —
 * une pagination fausse ne se voit qu'à l'impression, c'est-à-dire trop tard.
 *
 *   node packages/knowledge/scripts/presskit-cas-concret.mjs [--dry]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const DIR = "packages/ui/public/presskit";
const dry = process.argv.includes("--dry");

const T = {
  fr: {
    label: "04 Cas concret", eyebrow: "Cas concret",
    h2a: "Paris → Mexico,", h2b: "avec un chien de 30 kg",
    volTitre: "Le vol", volSoute: "Soute",
    vol: "Au-delà de 8 kg, la cabine est exclue : le chien voyage en soute, dans sa caisse. Air France l'accepte de 8 à 75 kg caisse comprise, à déclarer au moins 24 h avant le départ.",
    volPrix: "400 €", volPrixNote: "par trajet, sur cette route",
    invTitre: "Les invariants, dans les deux sens",
    inv: "Puce ISO implantée avant ou avec le vaccin · rage valide (1ʳᵉ dose à partir de 12 semaines, puis 21 jours d'attente) · rappels sans rupture · chien apte au voyage le jour J.",
    etapes: [
      { n: "1", t: "Au départ de France", c: "Aucune formalité de sortie : le chien quitte l'UE librement. Tout se joue à l'arrivée — et surtout au retour." },
      { n: "2", t: "À l'arrivée au Mexique", c: "Certificat de Bonne Santé établi dans les 15 jours, original et copie, à en-tête d'un vétérinaire agréé : date du vaccin antirabique, chien cliniquement sain, vermifugation dans les 6 mois. Inspection OISA du SENASICA. Caisse propre et vide. Ni puce imposée, ni titrage, ni quarantaine." },
      { n: "3", t: "Avant le retour, sortir du Mexique", c: "Certificat zoosanitaire d'exportation SENASICA à demander environ 3 jours ouvrés à l'avance, puis endossement au bureau de l'aéroport le jour du vol. À organiser sur place, en espagnol." },
      { n: "4", t: "Au retour en France", c: "Puce, vaccination antirabique valide et certificat sanitaire UE endossé par un vétérinaire officiel avant le départ. Pas de titrage. Entrée par un point de passage voyageurs, documents originaux." },
    ],
    chuteA: "Le Mexique n'exige pas la vaccination antirabique à l'entrée. Le retour en France, si.",
    chuteB: "La contrainte qui complique le voyage n'est pas au départ : elle est à la fin.",
    pied: "Données vérifiées le 11 juillet 2026 · sources officielles SENASICA et Air France",
  },
  en: {
    label: "04 Worked example", eyebrow: "Worked example",
    h2a: "Paris → Mexico City,", h2b: "with a 30 kg dog",
    volTitre: "The flight", volSoute: "Hold",
    vol: "Above 8 kg the cabin is out: the dog travels in the hold, in its crate. Air France accepts 8 to 75 kg including the crate, to be declared at least 24 h before departure.",
    volPrix: "€400", volPrixNote: "each way, on this route",
    invTitre: "The constants, both ways",
    inv: "ISO microchip implanted before or with the vaccine · valid rabies shot (first dose from 12 weeks, then a 21-day wait) · boosters with no lapse · dog fit to travel on the day.",
    etapes: [
      { n: "1", t: "Leaving France", c: "No exit formality: the dog leaves the EU freely. Everything hinges on arrival — and above all on the return." },
      { n: "2", t: "Arriving in Mexico", c: "Certificate of Good Health issued within 15 days, original plus copy, on a licensed vet's letterhead: rabies vaccination date, dog clinically healthy, dewormed within 6 months. SENASICA OISA inspection. Clean, empty crate. No microchip required, no titer, no quarantine." },
      { n: "3", t: "Before the return, leaving Mexico", c: "SENASICA export health certificate to request about 3 business days ahead, then endorsed at the airport office on departure day. To arrange on site, in Spanish." },
      { n: "4", t: "Back into France", c: "Microchip, valid rabies vaccination and an EU animal health certificate endorsed by an official vet before departure. No titer. Enter via a travellers' point of entry, original documents." },
    ],
    chuteA: "Mexico does not require rabies vaccination on entry. France, on the way back, does.",
    chuteB: "The constraint that complicates the trip is not at departure: it is at the end.",
    pied: "Data verified 11 July 2026 · official SENASICA and Air France sources",
  },
  es: {
    label: "04 Caso práctico", eyebrow: "Caso práctico",
    h2a: "París → Ciudad de México,", h2b: "con un perro de 30 kg",
    volTitre: "El vuelo", volSoute: "Bodega",
    vol: "Por encima de 8 kg la cabina queda descartada: el perro viaja en bodega, en su transportín. Air France lo acepta de 8 a 75 kg con transportín incluido, declarándolo al menos 24 h antes de la salida.",
    volPrix: "400 €", volPrixNote: "por trayecto, en esta ruta",
    invTitre: "Las constantes, en ambos sentidos",
    inv: "Microchip ISO implantado antes o con la vacuna · rabia válida (1.ª dosis a partir de las 12 semanas, luego 21 días de espera) · refuerzos sin interrupción · perro apto para viajar el día del vuelo.",
    etapes: [
      { n: "1", t: "Al salir de Francia", c: "Ninguna formalidad de salida: el perro abandona la UE libremente. Todo se juega a la llegada — y sobre todo al regreso." },
      { n: "2", t: "A la llegada a México", c: "Certificado de Buena Salud expedido en los últimos 15 días, original y copia, en papel de un veterinario autorizado: fecha de la vacuna antirrábica, perro clínicamente sano, desparasitado en los 6 meses previos. Inspección OISA del SENASICA. Transportín limpio y vacío. Sin microchip obligatorio, sin titulación, sin cuarentena." },
      { n: "3", t: "Antes del regreso, salir de México", c: "Certificado zoosanitario de exportación del SENASICA, a solicitar unos 3 días hábiles antes, y a refrendar en la oficina del aeropuerto el día del vuelo. A gestionar in situ, en español." },
      { n: "4", t: "De vuelta a Francia", c: "Microchip, vacuna antirrábica válida y certificado sanitario de la UE refrendado por un veterinario oficial antes de la salida. Sin titulación. Entrada por un punto de paso de viajeros, documentos originales." },
    ],
    chuteA: "México no exige la vacuna antirrábica a la entrada. Francia, a la vuelta, sí.",
    chuteB: "La limitación que complica el viaje no está en la salida: está al final.",
    pied: "Datos verificados el 11 de julio de 2026 · fuentes oficiales SENASICA y Air France",
  },
  pt: {
    label: "04 Caso prático", eyebrow: "Caso prático",
    h2a: "Paris → Cidade do México,", h2b: "com um cachorro de 30 kg",
    volTitre: "O voo", volSoute: "Porão",
    vol: "Acima de 8 kg a cabine está fora: o cachorro viaja no porão, na caixa de transporte. A Air France aceita de 8 a 75 kg com a caixa incluída, com declaração pelo menos 24 h antes da partida.",
    volPrix: "400 €", volPrixNote: "por trecho, nesta rota",
    invTitre: "As constantes, nos dois sentidos",
    inv: "Microchip ISO implantado antes ou junto com a vacina · antirrábica válida (1.ª dose a partir das 12 semanas, depois 21 dias de espera) · reforços sem interrupção · cachorro apto a viajar no dia.",
    etapes: [
      { n: "1", t: "Na saída da França", c: "Nenhuma formalidade de saída: o cachorro deixa a UE livremente. Tudo se decide na chegada — e sobretudo na volta." },
      { n: "2", t: "Na chegada ao México", c: "Certificado de Boa Saúde emitido nos últimos 15 dias, original e cópia, em papel timbrado de veterinário licenciado: data da vacina antirrábica, cachorro clinicamente saudável, vermifugado nos 6 meses anteriores. Inspeção OISA do SENASICA. Caixa limpa e vazia. Sem microchip obrigatório, sem titulação, sem quarentena." },
      { n: "3", t: "Antes da volta, sair do México", c: "Certificado zoossanitário de exportação do SENASICA, a solicitar cerca de 3 dias úteis antes, e a endossar no escritório do aeroporto no dia do voo. A organizar no local, em espanhol." },
      { n: "4", t: "De volta à França", c: "Microchip, vacina antirrábica válida e certificado sanitário da UE endossado por um veterinário oficial antes da partida. Sem titulação. Entrada por um ponto de passagem de viajantes, documentos originais." },
    ],
    chuteA: "O México não exige a vacina antirrábica na entrada. A França, na volta, exige.",
    chuteB: "A restrição que complica a viagem não está na partida: está no fim.",
    pied: "Dados verificados em 11 de julho de 2026 · fontes oficiais SENASICA e Air France",
  },
};

function page(langue, logoDomain) {
  const t = T[langue];
  const etapes = t.etapes.map((e) =>
    `<div style="flex:1;min-width:0">` +
    `<div style="display:flex;align-items:center;gap:.8em">` +
    `<span style="flex:0 0 auto;width:3.2cqh;height:3.2cqh;border-radius:50%;background:#EE7C1B;color:#FFF;` +
    `font-family:Poppins,sans-serif;font-weight:700;font-size:1.7cqh;display:flex;align-items:center;justify-content:center">${e.n}</span>` +
    `<div style="font-family:Poppins,sans-serif;font-weight:600;font-size:1.75cqh;line-height:1.2;color:#0D2447">${e.t}</div></div>` +
    `<p style="margin:1.2cqh 0 0;font-size:1.6cqh;line-height:1.45;color:#5A6B84">${e.c}</p></div>`,
  ).join("");

  return (
    `<section class="page" data-screen-label="${t.label}" style="position:relative;background:#FFFFFF;` +
    `padding:6.5% 6% 5%;box-sizing:border-box;display:flex;flex-direction:column;` +
    `font-family:'Source Sans 3',sans-serif;color:#0D2447">\n` +
    `  <div style="font-family:Poppins,sans-serif;font-size:1.7cqh;letter-spacing:.22em;text-transform:uppercase;color:#8A97AB">${t.eyebrow}</div>\n` +
    `  <h2 style="margin:1.2cqh 0 0;font-family:'Playfair Display',serif;font-weight:700;font-size:4.6cqh;line-height:1.05">${t.h2a} <span style="color:#EE7C1B">${t.h2b}</span></h2>\n` +
    `  <div style="margin-top:1.8cqh;width:66px;height:3px;background:#EE7C1B"></div>\n` +

    /* Le vol d'abord : c'est la première question que se pose un maître, et la seule qui
       porte un prix. Bandeau bleu pour le détacher du reste, qui est réglementaire. */
    `  <div style="margin-top:3cqh;display:flex;align-items:center;gap:4%;background:#F4F6FA;border-radius:14px;padding:2.2cqh 2.6cqh">\n` +
    `    <div style="flex:0 0 auto;text-align:center">` +
    `<div style="font-family:Poppins,sans-serif;font-size:1.4cqh;letter-spacing:.14em;text-transform:uppercase;color:#8A97AB">${t.volTitre}</div>` +
    `<div style="margin-top:.6cqh;display:inline-block;background:#0D2447;color:#FFF;border-radius:999px;padding:.5cqh 1.4cqh;` +
    `font-family:Poppins,sans-serif;font-weight:600;font-size:1.7cqh">${t.volSoute}</div></div>\n` +
    `    <p style="margin:0;flex:1;font-size:1.7cqh;line-height:1.45;color:#33436A">${t.vol}</p>\n` +
    `    <div style="flex:0 0 auto;text-align:right">` +
    `<div style="font-family:'Playfair Display',serif;font-weight:700;font-size:4.2cqh;line-height:1;color:#EE7C1B">${t.volPrix}</div>` +
    `<div style="margin-top:.4cqh;font-family:Poppins,sans-serif;font-size:1.4cqh;color:#5A6B84">${t.volPrixNote}</div></div>\n` +
    `  </div>\n` +

    `  <div style="margin-top:2.4cqh;padding-left:1.4cqh;border-left:3px solid #E3E8F0">\n` +
    `    <div style="font-family:Poppins,sans-serif;font-weight:600;font-size:1.55cqh;color:#0D2447">${t.invTitre}</div>\n` +
    `    <p style="margin:.6cqh 0 0;font-size:1.55cqh;line-height:1.45;color:#8A97AB">${t.inv}</p>\n` +
    `  </div>\n` +

    `  <div style="margin-top:3.2cqh;display:flex;gap:4%;align-items:flex-start">${etapes}</div>\n` +

    /* La chute, en pied de page : c'est l'argument que le journaliste retiendra. */
    `  <div style="margin-top:auto;padding-top:2.6cqh">\n` +
    `    <div style="background:#FFF4E9;border-left:4px solid #EE7C1B;border-radius:0 12px 12px 0;padding:1.8cqh 2.2cqh">\n` +
    `      <p style="margin:0;font-size:1.75cqh;line-height:1.45;color:#33436A">${t.chuteA}</p>\n` +
    `      <p style="margin:.8cqh 0 0;font-family:'Playfair Display',serif;font-style:italic;font-size:2.1cqh;line-height:1.35;color:#0D2447">${t.chuteB}</p>\n` +
    `    </div>\n` +
    `  </div>\n` +

    `  <div style="margin-top:2.4cqh;display:flex;justify-content:space-between;align-items:flex-end;gap:6%">\n` +
    `    <p style="margin:0;max-width:62%;font-size:1.45cqh;line-height:1.4;color:#9AA5B7">${t.pied}</p>\n` +
    `    <div style="display:flex;align-items:center;gap:2em;font-family:Poppins,sans-serif;font-size:1.5cqh;letter-spacing:.16em;text-transform:uppercase;color:#9AA5B7">` +
    `<img src="${logoDomain}" alt="MyDogCanFly.com" style="width:auto;height:2.6cqh;display:block"><span>04</span></div>\n` +
    `  </div>\n` +
    `</section>`
  );
}

let faits = 0;
for (const langue of ["en", "fr", "es", "pt"]) {
  const path = `${DIR}/press-kit-${langue}.html`;
  if (!existsSync(path)) { console.error(`${path} absent`); continue; }
  let html = readFileSync(path, "utf-8");
  const pages = html.match(/<section class="page"[^>]*>[\s\S]*?<\/section>/g) ?? [];

  if (html.includes("Cas concret") || html.includes("Worked example") || html.includes("Caso práctico") || html.includes("Caso prático")) {
    console.log(`${langue} : page déjà insérée, ignorée`);
    continue;
  }
  if (pages.length !== 12) { console.error(`✗ ${langue} : ${pages.length} pages au lieu de 12`); process.exit(1); }

  const logoDomain = /src="([^"]*Domain[^"]*)"/.exec(pages[9])?.[1];
  if (!logoDomain) { console.error(`✗ ${langue} : logo de pied introuvable`); process.exit(1); }

  /* 1. Renumérotation AVANT insertion, et de la FIN vers le début : en remontant, on ne peut
   *    pas réécrire deux fois la même page.
   *
   *    La couverture et la page de clôture ne portent pas de numéro — c'est voulu, et c'est ce
   *    qui a fait échouer la première version de ce script, qui traitait cette absence comme
   *    une anomalie. On ne renumérote donc que les pages qui affichent un numéro, et on vérifie
   *    la suite obtenue à la fin plutôt que de présumer de chaque page. */
  let renumerotees = 0;
  for (let i = 11; i >= 3; i--) {
    const ancien = pages[i];
    if (!/<span>\d+<\/span>/.test(ancien)) continue;
    const neuf = ancien.replace(/<span>(\d+)<\/span>/, (_, n) => `<span>${String(Number(n) + 1).padStart(2, "0")}</span>`);
    html = html.replace(ancien, neuf);
    renumerotees++;
  }
  if (renumerotees === 0) { console.error(`✗ ${langue} : aucune page renumérotée`); process.exit(1); }

  /* 2. Insertion juste après la page 3. */
  html = html.replace(pages[2], `${pages[2]}\n\n${page(langue, logoDomain)}`);

  if (!dry) writeFileSync(path, html);
  faits++;

  const apres = (html.match(/<section class="page"[^>]*>[\s\S]*?<\/section>/g) ?? []);
  const numeros = apres.map((p) => /<span>(\d+)<\/span>/.exec(p)?.[1] ?? "—");
  /* Le bon invariant n'est pas « la suite est continue » mais « chaque numéro affiché
   * correspond à sa position ». Trois pages n'affichent volontairement aucun numéro : la
   * couverture, la page de clôture, et la page 9 de la plaquette PORTUGAISE, dont le pied
   * avait été retiré parce que le titre y court sur quatre lignes. Une vérification exigeant
   * une suite sans trou aurait rejeté cette exception légitime — et c'est ce qu'elle a fait
   * au premier essai. */
  const suite = numeros.every((n, i) => n === "—" || Number(n) === i + 1);
  console.log(`${langue} : ${apres.length} pages · pagination ${numeros.join(" ")} ${suite ? "✓" : "✗ SUITE ROMPUE"}`);
  if (!suite) process.exit(1);
}
console.log(`\n${faits} plaquette(s) mise(s) à jour${dry ? " — essai à blanc" : ""}`);
