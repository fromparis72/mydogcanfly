#!/usr/bin/env node
/* Donne aux pages outils/statiques une meta description propre, ≤ 165 caractères.
 *
 * Ces pages passaient leur `blurb` en description — or le blurb est AUSSI le paragraphe
 * affiché à l'écran. Le raccourcir pour Google aurait appauvri la page. On introduit donc
 * une constante `metaDesc` distincte, et `<Base description={metaDesc}>` s'y réfère.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const P = (f) => resolve(ROOT, "packages/ui/src/pages/[...loc]", f);

// Descriptions rédigées pour la recherche : la requête d'abord, la promesse ensuite.
const DESC = {
  "tools/pet-relief.astro": {
    en: "Where is the dog bathroom at the airport? Find the pet relief area of any airport, before or after security, with its official source.",
    fr: "Où faire pipi à son chien à l'aéroport ? Trouve le coin pipi de chaque aéroport, avant ou après la sûreté, avec sa source officielle.",
    es: "¿Dónde está el baño para perros del aeropuerto? Encuentra la zona de alivio de cada aeropuerto, antes o después del control, con su fuente.",
  },
  "tools/best-carriers.astro": {
    en: "The best soft cabin carriers for dogs: comfort, ventilation, under-seat compliance and airline acceptance. Ranking coming soon.",
    fr: "Les meilleurs sacs de transport souples pour la cabine : confort, ventilation, conformité sous le siège et acceptation par les compagnies.",
    es: "Los mejores bolsos de transporte flexibles para cabina: comodidad, ventilación, medidas bajo el asiento y aceptación de las aerolíneas.",
  },
  "tools/best-crates.astro": {
    en: "The best IATA-compliant dog travel crates: safety, ventilation, sturdiness and airline compliance. Ranking coming soon.",
    fr: "Les meilleures caisses de transport conformes IATA : sécurité, ventilation, solidité et conformité aux exigences des compagnies.",
    es: "Las mejores jaulas de viaje conformes con la IATA: seguridad, ventilación, solidez y cumplimiento de las exigencias de las aerolíneas.",
  },
  "tools/destinations.astro": {
    en: "Where can your dog travel from your airport? Destinations ranked by comfortable arrival temperature and direct flights.",
    fr: "Où ton chien peut-il voyager depuis ton aéroport ? Destinations classées par température agréable à l'arrivée et vol direct.",
    es: "¿Adónde puede viajar tu perro desde tu aeropuerto? Destinos ordenados por temperatura agradable a la llegada y vuelo directo.",
  },
  "tools/timeline.astro": {
    en: "Dog travel countdown: when to do the microchip, rabies vaccination, blood test and health certificate before your flight.",
    fr: "Rétroplanning chien : quand faire la puce, le vaccin antirabique, le titrage et le certificat sanitaire avant ton vol.",
    es: "Cuenta atrás para viajar con tu perro: cuándo hacer el microchip, la vacuna antirrábica, la titulación y el certificado sanitario.",
  },
  "report-error.astro": {
    en: "Spotted an error on MyDogCanFly? Report an airline rule, a country requirement or a breed detail — every report is reviewed.",
    fr: "Une erreur sur MyDogCanFly ? Signale une règle de compagnie, une formalité pays ou une donnée de race — chaque signalement est relu.",
    es: "¿Has visto un error en MyDogCanFly? Informa de una regla de aerolínea, un requisito de país o un dato de raza — todo se revisa.",
  },
};

let done = 0, skipped = [];
for (const [file, d] of Object.entries(DESC)) {
  const p = P(file);
  if (!existsSync(p)) { skipped.push(`${file} (absent)`); continue; }
  let s = readFileSync(p, "utf8");
  if (s.includes("const metaDesc")) { skipped.push(`${file} (déjà fait)`); continue; }
  if (!s.includes("description={blurb}")) { skipped.push(`${file} (pas de description={blurb})`); continue; }

  const decl = `const metaDesc = fr\n  ? ${JSON.stringify(d.fr)}\n  : es\n    ? ${JSON.stringify(d.es)}\n    : ${JSON.stringify(d.en)};\n`;
  // Insérer juste avant la fermeture du frontmatter
  const i = s.indexOf("\n---", 3);
  s = s.slice(0, i + 1) + decl + s.slice(i + 1);
  s = s.replace("description={blurb}", "description={metaDesc}");
  writeFileSync(p, s);
  done++;
}
console.log(`meta descriptions ajoutées : ${done}`);
if (skipped.length) console.log("ignorés :", skipped.join(" · "));
for (const [f, d] of Object.entries(DESC))
  for (const [l, v] of Object.entries(d))
    if (v.length > 165) console.log(`  !! ${f} [${l}] ${v.length} car.`);
