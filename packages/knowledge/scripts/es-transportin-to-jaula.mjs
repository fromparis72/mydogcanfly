// Replace Spanish "transportín"/"transportines" (masc.) with "jaula"/"jaulas" (fem.) + gender agreement.
// "transportín" is ES-exclusive here (EN "crate", FR "caisse"), and \b protects English words like
// "Transporting". Ordered: determiner fixes, then bare noun, then adjective agreement (sing. + plural).
import fs from "node:fs";

const listDir = (d, filter) => fs.readdirSync(d).filter(filter).map(f => d + "/" + f);
const files = [
  ...listDir("content/countries", f => f.endsWith(".yml")),
  ...listDir("content/airlines", f => f.endsWith(".yml") && f !== "_template.yml"),
  "packages/knowledge/translations/es/strings.json",
  ...listDir("packages/ui/src/components", f => f.endsWith(".astro")),
  ...listDir("packages/ui/src/pages/[...loc]/tools", f => f.endsWith(".astro")),
  "packages/ui/src/lib/breedTravel.ts",
];

const rules = [
  [/\btransportin\b/g, "transportín"],
  [/\btransportines\b/g, "transportínPL"], // temp marker for plural
  [/\bTransportines\b/g, "TransportínPL"],
  // determiner + singular
  [/\bun transportín\b/g, "una jaula"],
  [/\bUn transportín\b/g, "Una jaula"],
  [/\bdel transportín\b/g, "de la jaula"],
  [/\bDel transportín\b/g, "De la jaula"],
  [/\bal transportín\b/g, "a la jaula"],
  [/\beste transportín\b/g, "esta jaula"],
  [/\bEste transportín\b/g, "Esta jaula"],
  [/\bese transportín\b/g, "esa jaula"],
  [/\bning[úu]n transportín\b/g, "ninguna jaula"],
  [/\balg[úu]n transportín\b/g, "alguna jaula"],
  [/\bincluido el transportín\b/g, "incluida la jaula"],
  [/\bIncluido el transportín\b/g, "Incluida la jaula"],
  [/\bel transportín\b/g, "la jaula"],
  [/\bEl transportín\b/g, "La jaula"],
  // bare singular
  [/\bTransportín\b/g, "Jaula"],
  [/\btransportín\b/g, "jaula"],
  // plural marker -> jaulas
  [/\btransportínPL\b/g, "jaulas"],
  [/\bTransportínPL\b/g, "Jaulas"],
  // singular adjective agreement
  [/\bjaula IATA adecuado\b/g, "jaula IATA adecuada"],
  [/\bJaula IATA adecuado\b/g, "Jaula IATA adecuada"],
  [/\bjaula adecuado\b/g, "jaula adecuada"],
  [/\bjaula blando\b/g, "jaula blanda"],
  [/\b(jaula|Jaula) rígido\b/g, "$1 rígida"],
  [/\b(jaula|Jaula) típico\b/g, "$1 típica"],
  [/\bjaula IATA típico\b/g, "jaula IATA típica"],
  [/\bJaula IATA típico\b/g, "Jaula IATA típica"],
  [/\bjaula pequeño\b/g, "jaula pequeña"],
  [/\bjaula incluido\b/g, "jaula incluida"],
  [/\b(jaula|Jaula) compartido\b/g, "$1 compartida"],
  [/\bjaula homologado\b/g, "jaula homologada"],
  [/\bjaula aprobado\b/g, "jaula aprobada"],
  [/\bjaula reforzado\b/g, "jaula reforzada"],
  [/\bjaula duro\b/g, "jaula dura"],
  // plural adjective agreement
  [/\bjaulas blandos\b/g, "jaulas blandas"],
  [/\bjaulas rígidos\b/g, "jaulas rígidas"],
  [/\bjaulas reforzados\b/g, "jaulas reforzadas"],
  [/\bjaulas homologados\b/g, "jaulas homologadas"],
  [/\bjaulas aprobados\b/g, "jaulas aprobadas"],
  [/\bjaulas duros\b/g, "jaulas duras"],
  [/\bjaulas adecuados\b/g, "jaulas adecuadas"],
  [/\bjaulas plegables\b/g, "jaulas plegables"],
];

let changed = 0;
for (const fp of files) {
  let s = fs.readFileSync(fp, "utf8");
  const before = s;
  for (const [re, rep] of rules) s = s.replace(re, rep);
  if (s !== before) { fs.writeFileSync(fp, s); changed++; }
}
console.log("files changed:", changed);
