#!/usr/bin/env node
/* Le cas concret, deuxième version : déplacé en page 7, et présenté comme une sortie de moteur.
 *
 * Ce script REMPLACE `presskit-cas-concret.mjs`, qui avait posé la page en position 4. Trois
 * demandes l'ont fait évoluer, et une seule idée les relie : un journaliste doit comprendre
 * d'un coup d'œil qu'il lit un résultat produit par la machine, pas un paragraphe rédigé.
 *
 *   · POSITION. La page passe de 4 à 7, juste après « De la complexité. À la clarté ». Elle y
 *     est mieux : cette page-là promet la clarté, celle-ci la démontre. En 4, elle arrivait
 *     avant même que le lecteur sache ce qu'est la plateforme.
 *   · IDENTITÉ. En-tête en bandeau bleu nuit « MyDogCanFly Decision Engine™ », avec un verdict
 *     à droite au format des fiches du site. Le sur-titre gris est conservé — il est bien, il
 *     n'était simplement pas suffisant à lui seul.
 *   · OUTILS. Deux encarts avant la chute : la caisse IATA et le risque chaleur, chacun sous
 *     le nom de l'outil public qui produit la réponse. Le rétro-planning, initialement prévu,
 *     a été retiré : cet outil n'existe plus, et une plaquette qui renvoie vers une page morte
 *     détruit exactement la confiance qu'elle cherche à établir.
 *
 * DONNÉES. Départ de FRANCE uniquement — les cas « depuis les États-Unis ou le Canada » ont été
 * retirés, ils ne s'appliquent pas à ce trajet. Golden Retriever de 35 kg, 71 cm de long, 67 cm
 * au garrot ; caisse 500 / XL, intérieur minimum 85 × 41 × 67 cm : ces valeurs sortent du
 * calculateur du site, elles ne sont pas estimées ici. Tarif Air France 400 € par trajet, zone
 * « toutes autres routes », reconfirmé le 02/08/2026. Fiches vérifiées le 11/07/2026.
 *
 * DÉPLACEMENT. Retirer une page et la réinsérer ailleurs impose DEUX renumérotations. Le script
 * les fait dans l'ordre et vérifie le résultat : chaque numéro affiché doit correspondre à sa
 * position. Trois pages n'en affichent aucun — la couverture, la clôture, et la page 9 de la
 * plaquette portugaise dont le pied avait été retiré. Ces absences sont légitimes et tolérées ;
 * une pagination fausse, elle, ne se voit qu'à l'impression.
 *
 *   node packages/knowledge/scripts/presskit-cas-concret-v2.mjs [--dry]
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";

const DIR = "packages/ui/public/presskit";
const dry = process.argv.includes("--dry");
/* Index 0-based, DANS LE DOCUMENT DE 12 PAGES, c'est-à-dire APRÈS retrait de l'ancienne version.
 * Le piège est là : dans le document actuel de 13 pages, « De la complexité. À la clarté » est
 * la page 6 ; une fois le cas concret retiré de sa position 4, elle remonte en page 5. La page
 * réinsérée juste après devient donc la 6, et non la 7 comme on pourrait le croire. */
const APRES = 4;

const T = {
  fr: {
    label: "06 Cas concret", eyebrow: "Cas concret", engine: "MyDogCanFly Decision Engine™",
    verdictMot: "Verdict", verdict: "Réalisable", verdictNote: "sous conditions",
    manuscrit: "Par exemple :", h2: "Paris → Mexico → Paris", ident: "Identité", identV: "Golden Retriever, 35 kg",
    volTitre: "Le vol", volSoute: "Soute",
    vol: "Au-delà de 8 kg, la cabine est exclue. <b>Air France</b> accepte <b>la soute</b> de <b>8 à 75 kg</b> caisse comprise, à déclarer au moins 24 h avant le départ.",
    volPrix: "400 €", volPrixNote: "par trajet, sur cette route",
    invTitre: "Les invariants, dans les deux sens",
    inv: "<b>Puce ISO implantée</b> avant ou avec le vaccin · <b>vaccin rage valide</b> (1ʳᵉ dose à partir de 12 semaines, puis 21 jours d'attente) · rappels sans rupture · <b>chien apte au voyage</b> le jour J.",
    etapes: [
      { n: "1", t: "Au départ de France", c: "Aucune formalité de sortie : le chien quitte l'UE librement. Tout se joue à l'arrivée — et surtout au retour." },
      { n: "2", t: "À l'arrivée au Mexique", c: "Certificat de Bonne Santé établi dans les 15 jours, original et copie, à en-tête d'un vétérinaire agréé. Inspection OISA du SENASICA. Caisse propre et vide. Ni puce imposée, ni titrage, ni quarantaine." },
      { n: "3", t: "Avant le retour, sortir du Mexique", c: "Certificat zoosanitaire d'exportation SENASICA à demander environ 3 jours ouvrés à l'avance, puis endossement à l'aéroport le jour du vol. À organiser sur place, en espagnol." },
      { n: "4", t: "Au retour en France", c: "Puce, rage valide et certificat sanitaire UE endossé par un vétérinaire officiel avant le départ. Pas de titrage. Point de passage voyageurs, documents originaux." },
    ],
    outils: [
      { ic: "📦", outil: "Calculateur de caisse IATA", titre: "500 / XL",
        c: "Intérieur minimum <b>85 × 41 × 67 cm</b>, calculé sur les mesures réelles du chien (71 cm de long, 67 cm au garrot). Série indicative ≈ 94 × 64 × 68 cm — toujours vérifier l'intérieur réel de la caisse." },
      { ic: "🌡️", outil: "Risque chaleur en soute", titre: "Seuil ≈ 30 °C",
        c: "Au-delà, beaucoup de compagnies suspendent la soute — l'embargo suit la température, pas la saison. Ce qui compte est le tarmac au départ <b>et</b> à l'arrivée, pas la météo en ville." },
    ],
    chuteA: "Le Mexique n'exige pas la vaccination antirabique à l'entrée. Le retour en France, si.",
    chuteB: "La contrainte qui complique le voyage n'est pas au départ : mais au retour.",
    pied: "Données vérifiées le 11 juillet 2026 · sources officielles SENASICA et Air France",
  },
  en: {
    label: "06 Worked example", eyebrow: "Worked example", engine: "MyDogCanFly Decision Engine™",
    verdictMot: "Verdict", verdict: "Feasible", verdictNote: "with conditions",
    manuscrit: "For example:", h2: "Paris → Mexico City → Paris", ident: "Profile", identV: "Golden Retriever, 35 kg",
    volTitre: "The flight", volSoute: "Hold",
    vol: "Above 8 kg the cabin is out. <b>Air France</b> accepts <b>the hold</b> from <b>8 to 75 kg</b> including the crate, to be declared at least 24 h before departure.",
    volPrix: "€400", volPrixNote: "each way, on this route",
    invTitre: "The constants, both ways",
    inv: "<b>ISO microchip implanted</b> before or with the vaccine · <b>valid rabies shot</b> (first dose from 12 weeks, then a 21-day wait) · boosters with no lapse · <b>dog fit to travel</b> on the day.",
    etapes: [
      { n: "1", t: "Leaving France", c: "No exit formality: the dog leaves the EU freely. Everything hinges on arrival — and above all on the return." },
      { n: "2", t: "Arriving in Mexico", c: "Certificate of Good Health issued within 15 days, original plus copy, on a licensed vet's letterhead. SENASICA OISA inspection. Clean, empty crate. No microchip required, no titer, no quarantine." },
      { n: "3", t: "Before the return, leaving Mexico", c: "SENASICA export health certificate to request about 3 business days ahead, then endorsed at the airport on departure day. To arrange on site, in Spanish." },
      { n: "4", t: "Back into France", c: "Microchip, valid rabies vaccination and an EU animal health certificate endorsed by an official vet before departure. No titer. Travellers' point of entry, original documents." },
    ],
    outils: [
      { ic: "📦", outil: "IATA crate calculator", titre: "500 / XL",
        c: "Minimum interior <b>85 × 41 × 67 cm</b>, computed from the dog's real measurements (71 cm long, 67 cm at the shoulder). Indicative series ≈ 94 × 64 × 68 cm — always check the crate's real interior." },
      { ic: "🌡️", outil: "Heat risk in the hold", titre: "Threshold ≈ 30 °C",
        c: "Above it, many airlines suspend the hold — the embargo follows the temperature, not the season. What counts is the tarmac at departure <b>and</b> on arrival, not the forecast in town." },
    ],
    chuteA: "Mexico does not require rabies vaccination on entry. France, on the way back, does.",
    chuteB: "The constraint that complicates the trip is not at departure: it is on the way back.",
    pied: "Data verified 11 July 2026 · official SENASICA and Air France sources",
  },
  es: {
    label: "06 Caso práctico", eyebrow: "Caso práctico", engine: "MyDogCanFly Decision Engine™",
    verdictMot: "Veredicto", verdict: "Viable", verdictNote: "con condiciones",
    manuscrit: "Por ejemplo:", h2: "París → Ciudad de México → París", ident: "Identidad", identV: "Golden Retriever, 35 kg",
    volTitre: "El vuelo", volSoute: "Bodega",
    vol: "Por encima de 8 kg la cabina queda descartada. <b>Air France</b> acepta <b>la bodega</b> de <b>8 a 75 kg</b> con transportín incluido, declarándolo al menos 24 h antes de la salida.",
    volPrix: "400 €", volPrixNote: "por trayecto, en esta ruta",
    invTitre: "Las constantes, en ambos sentidos",
    inv: "<b>Microchip ISO implantado</b> antes o con la vacuna · <b>vacuna de rabia válida</b> (1.ª dosis a partir de las 12 semanas, luego 21 días de espera) · refuerzos sin interrupción · <b>perro apto para viajar</b> el día del vuelo.",
    etapes: [
      { n: "1", t: "Al salir de Francia", c: "Ninguna formalidad de salida: el perro abandona la UE libremente. Todo se juega a la llegada — y sobre todo al regreso." },
      { n: "2", t: "A la llegada a México", c: "Certificado de Buena Salud expedido en los últimos 15 días, original y copia, en papel de un veterinario autorizado. Inspección OISA del SENASICA. Transportín limpio y vacío. Sin microchip obligatorio, sin titulación, sin cuarentena." },
      { n: "3", t: "Antes del regreso, salir de México", c: "Certificado zoosanitario de exportación del SENASICA, a solicitar unos 3 días hábiles antes, y a refrendar en el aeropuerto el día del vuelo. A gestionar in situ, en español." },
      { n: "4", t: "De vuelta a Francia", c: "Microchip, rabia válida y certificado sanitario de la UE refrendado por un veterinario oficial antes de la salida. Sin titulación. Punto de paso de viajeros, documentos originales." },
    ],
    outils: [
      { ic: "📦", outil: "Calculadora de transportín IATA", titre: "500 / XL",
        c: "Interior mínimo <b>85 × 41 × 67 cm</b>, calculado con las medidas reales del perro (71 cm de largo, 67 cm de alzada). Serie indicativa ≈ 94 × 64 × 68 cm — comprueba siempre el interior real." },
      { ic: "🌡️", outil: "Riesgo de calor en bodega", titre: "Umbral ≈ 30 °C",
        c: "Por encima, muchas aerolíneas suspenden la bodega — el embargo sigue la temperatura, no la estación. Lo que cuenta es la pista a la salida <b>y</b> a la llegada, no el pronóstico en la ciudad." },
    ],
    chuteA: "México no exige la vacuna antirrábica a la entrada. Francia, a la vuelta, sí.",
    chuteB: "La limitación que complica el viaje no está en la salida: está en el regreso.",
    pied: "Datos verificados el 11 de julio de 2026 · fuentes oficiales SENASICA y Air France",
  },
  pt: {
    label: "06 Caso prático", eyebrow: "Caso prático", engine: "MyDogCanFly Decision Engine™",
    verdictMot: "Veredicto", verdict: "Viável", verdictNote: "com condições",
    manuscrit: "Por exemplo:", h2: "Paris → Cidade do México → Paris", ident: "Identidade", identV: "Golden Retriever, 35 kg",
    volTitre: "O voo", volSoute: "Porão",
    vol: "Acima de 8 kg a cabine está fora. A <b>Air France</b> aceita <b>o porão</b> de <b>8 a 75 kg</b> com a caixa incluída, com declaração pelo menos 24 h antes da partida.",
    volPrix: "400 €", volPrixNote: "por trecho, nesta rota",
    invTitre: "As constantes, nos dois sentidos",
    inv: "<b>Microchip ISO implantado</b> antes ou junto com a vacina · <b>vacina antirrábica válida</b> (1.ª dose a partir das 12 semanas, depois 21 dias de espera) · reforços sem interrupção · <b>cachorro apto a viajar</b> no dia.",
    etapes: [
      { n: "1", t: "Na saída da França", c: "Nenhuma formalidade de saída: o cachorro deixa a UE livremente. Tudo se decide na chegada — e sobretudo na volta." },
      { n: "2", t: "Na chegada ao México", c: "Certificado de Boa Saúde emitido nos últimos 15 dias, original e cópia, em papel timbrado de veterinário licenciado. Inspeção OISA do SENASICA. Caixa limpa e vazia. Sem microchip obrigatório, sem titulação, sem quarentena." },
      { n: "3", t: "Antes da volta, sair do México", c: "Certificado zoossanitário de exportação do SENASICA, a solicitar cerca de 3 dias úteis antes, e a endossar no aeroporto no dia do voo. A organizar no local, em espanhol." },
      { n: "4", t: "De volta à França", c: "Microchip, antirrábica válida e certificado sanitário da UE endossado por um veterinário oficial antes da partida. Sem titulação. Ponto de passagem de viajantes, documentos originais." },
    ],
    outils: [
      { ic: "📦", outil: "Calculadora de caixa IATA", titre: "500 / XL",
        c: "Interior mínimo <b>85 × 41 × 67 cm</b>, calculado com as medidas reais do cachorro (71 cm de comprimento, 67 cm de altura). Série indicativa ≈ 94 × 64 × 68 cm — verifique sempre o interior real." },
      { ic: "🌡️", outil: "Risco de calor no porão", titre: "Limite ≈ 30 °C",
        c: "Acima disso, muitas companhias suspendem o porão — o embargo segue a temperatura, não a estação. O que conta é a pista na partida <b>e</b> na chegada, não a previsão na cidade." },
    ],
    chuteA: "O México não exige a vacina antirrábica na entrada. A França, na volta, exige.",
    chuteB: "A restrição que complica a viagem não está na partida: está na volta.",
    pied: "Dados verificados em 11 de julho de 2026 · fontes oficiais SENASICA e Air France",
  },
};

function page(langue, logoDomain) {
  const t = T[langue];

  const etapes = t.etapes.map((e) =>
    `<div style="flex:1;min-width:0">` +
    `<div style="display:flex;align-items:center;gap:.7em">` +
    `<span style="flex:0 0 auto;width:2.9cqh;height:2.9cqh;border-radius:50%;background:#EE7C1B;color:#FFF;` +
    `font-family:Poppins,sans-serif;font-weight:700;font-size:1.55cqh;display:flex;align-items:center;justify-content:center">${e.n}</span>` +
    `<div style="font-family:Poppins,sans-serif;font-weight:600;font-size:1.6cqh;line-height:1.2;color:#0D2447">${e.t}</div></div>` +
    `<p style="margin:1cqh 0 0;font-size:1.5cqh;line-height:1.42;color:#5A6B84">${e.c}</p></div>`,
  ).join("");

  /* Chaque encart porte le NOM de l'outil qui produit la réponse : c'est ce qui montre au
     journaliste que ces chiffres sortent d'outils publics, et non d'un paragraphe rédigé. */
  const outils = t.outils.map((o) =>
    `<div style="flex:1;min-width:0;background:#F4F6FA;border-radius:12px;padding:1.6cqh 1.9cqh">` +
    `<div style="display:flex;align-items:baseline;gap:.6em">` +
    `<span style="font-size:2cqh">${o.ic}</span>` +
    `<span style="font-family:Poppins,sans-serif;font-size:1.35cqh;letter-spacing:.12em;text-transform:uppercase;color:#8A97AB">${o.outil}</span></div>` +
    `<div style="margin-top:.7cqh;font-family:'Playfair Display',serif;font-weight:700;font-size:2.6cqh;line-height:1;color:#EE7C1B">${o.titre}</div>` +
    `<p style="margin:.8cqh 0 0;font-size:1.45cqh;line-height:1.42;color:#5A6B84">${o.c}</p></div>`,
  ).join("");

  return (
    `<section class="page" data-screen-label="${t.label}" style="position:relative;background:#FFFFFF;` +
    `padding:6.5% 6% 5%;box-sizing:border-box;display:flex;flex-direction:column;` +
    `font-family:'Source Sans 3',sans-serif;color:#0D2447">\n` +

    /* Le bandeau d'en-tête. Fond bleu nuit et mention du Decision Engine : le lecteur doit
       reconnaître, avant même de lire, le vocabulaire des fiches du site. Le verdict à droite
       reprend la forme exacte des pastilles de résultat. */
    `  <div style="display:flex;align-items:center;justify-content:space-between;gap:4%;` +
    `background:#0D2447;border-radius:14px;padding:1.8cqh 2.4cqh;color:#FFFFFF">\n` +
    `    <div>` +
    `<div style="font-family:Poppins,sans-serif;font-weight:700;font-size:1.5cqh;letter-spacing:.18em;`+`text-transform:uppercase;color:#EE7C1B">${t.eyebrow}</div>` +
    `<div style="margin-top:.5cqh;font-family:Poppins,sans-serif;font-weight:600;font-size:1.95cqh">${t.engine}</div></div>\n` +
    `    <div style="flex:0 0 auto;text-align:right">` +
    `<span style="display:inline-block;background:#EE7C1B;border-radius:999px;padding:.55cqh 1.7cqh;` +
    `font-family:Poppins,sans-serif;font-weight:700;font-size:1.8cqh">${t.verdictMot} : ${t.verdict}</span>` +
    `<div style="margin-top:.5cqh;font-family:Poppins,sans-serif;font-size:1.35cqh;color:#8FA2C4">${t.verdictNote}</div></div>\n` +
    `  </div>\n` +

    /* La mention manuscrite. Caveat — la police déjà employée pour les signatures du document —
       en orange, fine, et penchée de 2,4°. Elle joue le rôle d'une annotation portée à la main
       en marge d'un dossier : c'est elle qui dit « cas d'école » sans qu'on ait à l'écrire dans
       un titre. L'inclinaison est légère à dessein ; au-delà de 3° on ne lit plus une note, on
       voit un effet. */
    `  <div style="margin-top:2.8cqh;font-family:Caveat,cursive;font-size:3.6cqh;line-height:1;`+
    `color:#EE7C1B;transform:rotate(-2.4deg);transform-origin:left center">${t.manuscrit}</div>\n` +
    `  <h2 style="margin:1.4cqh 0 0;font-family:'Playfair Display',serif;font-weight:700;font-size:4.4cqh;line-height:1.05">${t.h2}</h2>\n` +
    `  <div style="margin-top:1.2cqh;font-family:Poppins,sans-serif;font-size:2.3cqh;color:#0D2447">`+
    `<span style="color:#8A97AB">${t.ident} : </span><b>${t.identV}</b></div>\n` +
    `  <div style="margin-top:1.6cqh;width:66px;height:3px;background:#EE7C1B"></div>\n` +

    /* Le vol d'abord : c'est la première question que se pose un maître, et la seule qui
       porte un prix. */
    `  <div style="margin-top:3cqh;display:flex;align-items:center;gap:3.5%;background:#F4F6FA;border-radius:14px;padding:1.8cqh 2.2cqh">\n` +
    `    <div style="flex:0 0 auto;text-align:center">` +
    `<div style="font-family:Poppins,sans-serif;font-size:1.3cqh;letter-spacing:.14em;text-transform:uppercase;color:#8A97AB">${t.volTitre}</div>` +
    `<div style="margin-top:.5cqh;display:inline-block;background:#0D2447;color:#FFF;border-radius:999px;padding:.45cqh 1.3cqh;` +
    `font-family:Poppins,sans-serif;font-weight:600;font-size:1.6cqh">${t.volSoute}</div></div>\n` +
    `    <p style="margin:0;flex:1;font-size:1.6cqh;line-height:1.42;color:#33436A">${t.vol}</p>\n` +
    `    <div style="flex:0 0 auto;text-align:right">` +
    `<div style="font-family:'Playfair Display',serif;font-weight:700;font-size:3.6cqh;line-height:1;color:#EE7C1B">${t.volPrix}</div>` +
    `<div style="margin-top:.35cqh;font-family:Poppins,sans-serif;font-size:1.3cqh;color:#5A6B84">${t.volPrixNote}</div></div>\n` +
    `  </div>\n` +

    `  <div style="margin-top:2.6cqh;padding-left:1.3cqh;border-left:3px solid #E3E8F0">\n` +
    `    <div style="font-family:Poppins,sans-serif;font-weight:600;font-size:1.45cqh;color:#0D2447">${t.invTitre}</div>\n` +
    `    <p style="margin:.5cqh 0 0;font-size:1.45cqh;line-height:1.42;color:#8A97AB">${t.inv}</p>\n` +
    `  </div>\n` +

    `  <div style="margin-top:3.2cqh;display:flex;gap:3.5%;align-items:flex-start">${etapes}</div>\n` +
    `  <div style="margin-top:3.2cqh;display:flex;gap:3.5%;align-items:stretch">${outils}</div>\n` +

    /* La chute, en pied de page : c'est l'argument que le journaliste retiendra. */
    `  <div style="margin-top:auto;padding-top:2.2cqh">\n` +
    `    <div style="background:#FFF4E9;border-left:4px solid #EE7C1B;border-radius:0 12px 12px 0;padding:1.6cqh 2cqh">\n` +
    `      <p style="margin:0;font-size:1.65cqh;line-height:1.42;color:#33436A">${t.chuteA}</p>\n` +
    `      <p style="margin:.7cqh 0 0;font-family:'Playfair Display',serif;font-style:italic;font-size:2cqh;line-height:1.35;color:#0D2447">${t.chuteB}</p>\n` +
    `    </div>\n` +
    `  </div>\n` +

    `  <div style="margin-top:2cqh;display:flex;justify-content:space-between;align-items:flex-end;gap:6%">\n` +
    `    <p style="margin:0;max-width:62%;font-size:1.35cqh;line-height:1.4;color:#9AA5B7">${t.pied}</p>\n` +
    `    <div style="display:flex;align-items:center;gap:2em;font-family:Poppins,sans-serif;font-size:1.5cqh;letter-spacing:.16em;text-transform:uppercase;color:#9AA5B7">` +
    `<img src="${logoDomain}" alt="MyDogCanFly.com" style="width:auto;height:2.6cqh;display:block"><span>06</span></div>\n` +
    `  </div>\n` +
    `</section>`
  );
}

/* ------------------------------------------------------------------ */

const pagesDe = (html) => html.match(/<section class="page"[^>]*>[\s\S]*?<\/section>/g) ?? [];
const estCasConcret = (p) => /data-screen-label="\d+ (Cas concret|Worked example|Caso práctico|Caso prático)"/.test(p);

/** Renumérote les pieds de page d'après la position réelle, puis vérifie. */
function renumeroter(html, langue) {
  const pages = pagesDe(html);
  pages.forEach((p, i) => {
    if (!/<span>\d+<\/span>/.test(p)) return;   // couverture, clôture, page 9 pt
    const neuf = p.replace(/<span>\d+<\/span>/, `<span>${String(i + 1).padStart(2, "0")}</span>`);
    if (neuf !== p) html = html.replace(p, neuf);
  });
  /* Le libellé d'écran porte lui aussi un numéro en tête. */
  for (const p of pagesDe(html)) {
    const i = pagesDe(html).indexOf(p);
    const m = /data-screen-label="(\d+)([^"]*)"/.exec(p);
    if (!m) continue;
    const attendu = String(i + 1).padStart(2, "0");
    if (m[1] === attendu) continue;
    html = html.replace(p, p.replace(`data-screen-label="${m[1]}${m[2]}"`, `data-screen-label="${attendu}${m[2]}"`));
  }
  const numeros = pagesDe(html).map((p) => /<span>(\d+)<\/span>/.exec(p)?.[1] ?? "—");
  const ok = numeros.every((n, i) => n === "—" || Number(n) === i + 1);
  if (!ok) { console.error(`✗ ${langue} : pagination incohérente → ${numeros.join(" ")}`); process.exit(1); }
  return { html, numeros };
}

let faits = 0;
for (const langue of ["en", "fr", "es", "pt"]) {
  const path = `${DIR}/press-kit-${langue}.html`;
  if (!existsSync(path)) { console.error(`${path} absent`); continue; }
  let html = readFileSync(path, "utf-8");
  let pages = pagesDe(html);

  /* 1. Retirer la version précédente, où qu'elle soit. */
  const ancienne = pages.filter(estCasConcret);
  if (ancienne.length > 1) { console.error(`✗ ${langue} : ${ancienne.length} pages « cas concret » trouvées`); process.exit(1); }
  if (ancienne.length === 1) html = html.replace(`\n\n${ancienne[0]}`, "").replace(ancienne[0], "");

  pages = pagesDe(html);
  if (pages.length !== 12) { console.error(`✗ ${langue} : ${pages.length} pages après retrait, 12 attendues`); process.exit(1); }
  /* Garde de position : la page d'accueil du cas concret doit bien être « la clarté ». */
  const cible = pages[APRES];
  /* Les quatre graphies du mot, et elles diffèrent plus qu'on ne croit : « complexité »,
   * « complexity », « complejidad » — avec un J en espagnol — et « complexidade ». Écrire ce
   * motif de mémoire fait manquer l'espagnol, ce qui est exactement arrivé au premier essai. */
  if (!/complexit|complejidad|complexidade|complexity/i.test(cible)) {
    console.error(`✗ ${langue} : la page ${APRES + 1} n'est pas « De la complexité à la clarté »`); process.exit(1);
  }
  const logoDomain = /src="([^"]*Domain[^"]*)"/.exec(pages[9])?.[1];
  if (!logoDomain) { console.error(`✗ ${langue} : logo de pied introuvable`); process.exit(1); }

  /* 2. Insérer à la nouvelle place, puis renuméroter tout d'un coup. */
  html = html.replace(cible, `${cible}\n\n${page(langue, logoDomain)}`);
  const r = renumeroter(html, langue);
  html = r.html;

  if (!dry) writeFileSync(path, html);
  faits++;
  console.log(`${langue} : ${pagesDe(html).length} pages · pagination ${r.numeros.join(" ")} ✓`);
}
console.log(`\n${faits} plaquette(s) mise(s) à jour${dry ? " — essai à blanc" : ""}`);
