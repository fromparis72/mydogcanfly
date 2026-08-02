// QA scan of Spanish (es) fields: detect FR/EN leakage, untranslated (es==fr), and odd artifacts.
import fs from "node:fs";

const countries = JSON.parse(fs.readFileSync("packages/ui/src/data/countries.generated.json", "utf8"));
const airlines = JSON.parse(fs.readFileSync("packages/ui/src/data/airlines.generated.json", "utf8"));
const objects = JSON.parse(fs.readFileSync("packages/knowledge/raw/objects.json", "utf8"));

// French tell-tales unlikely in correct Spanish (word-boundary).
const FR = /\b(chien|chiens|vétérinaire|vétérinaires|votre|vous|être|où|français|française|passeport européen|d'un|d'une|qu'il|n'est|c'est|aéroport|billet|séjour|démarches|puce|prélèvement|obligatoire pour|selon le|depuis un pays|est requis|doit être|soute|frais du propriétaire)\b/i;
// English tell-tales unlikely in correct Spanish.
const EN = /\b(the |dog|dogs|and the|with your|required|must be|airline|health certificate|microchip must|before|entry requirements|hold|cabin only|no cabin|weeks|months|blood test|owner|breed|please|puppy)\b/;

let issues = 0;
const report = (kind, id, path, val, why) => { issues++; if (issues <= 400) console.log(`[${why}] ${kind} ${id} ${path}\n   ES: ${val.slice(0,160)}`); };

function walk(kind, id, node, fr, path = "") {
  if (typeof node !== "object" || node === null) return;
  // Bilingual leaf?
  if (typeof node.es === "string" && typeof node.en === "string") {
    const es = node.es, en = node.en, frv = node.fr;
    const isPriceOrCode = /^[\d\s.,–—$€£₫%+/()A-Z·-]+$/.test(es) || es === "—";
    if (FR.test(es) && !FR.test(en)) report(kind, id, path, es, "FR leak");
    else if (EN.test(es)) report(kind, id, path, es, "EN leak");
    else if (es === frv && frv !== en && es.length > 3 && !isPriceOrCode && /[a-z]{4,}/.test(es)) report(kind, id, path, es, "es==fr (untranslated?)");
  }
  for (const k of Object.keys(node)) {
    if (k === "en" || k === "fr" || k === "es") continue;
    const v = node[k];
    if (Array.isArray(v)) v.forEach((x, i) => walk(kind, id, x, fr, `${path}.${k}[${i}]`));
    else if (typeof v === "object" && v) walk(kind, id, v, fr, `${path}.${k}`);
  }
}

for (const [id, g] of Object.entries(countries)) walk("country", id, g, true);
for (const [id, a] of Object.entries(airlines)) walk("airline", id, a, true);

// terminology consistency: count variants of key concepts across ALL es strings
const allEs = [];
(function collect(node){ if(typeof node!=="object"||!node)return; if(typeof node.es==="string")allEs.push(node.es); for(const k of Object.keys(node)){if(["en","fr","es"].includes(k))continue; const v=node[k]; if(Array.isArray(v))v.forEach(collect); else if(typeof v==="object")collect(v);} })({countries,airlines});
const joined = allEs.join("  ");
const variants = {
  "hold(bodega/soute)": [/\bbodega\b/gi, /\bsoute\b/gi],
  "titer(titulación/titrage)": [/titulaci[óo]n/gi, /titrage/gi],
  "crate(transportín/caisse/jaula)": [/transport[íi]n/gi, /\bcaisse\b/gi, /\bjaula\b/gi],
  "microchip(microchip/puce)": [/microchip/gi, /\bpuce\b/gi],
};
console.log("\n=== terminology counts (want the French variant = 0) ===");
for (const [name, res] of Object.entries(variants)) console.log(name, res.map(r => (joined.match(r)||[]).length).join(" / "));

console.log(`\n=== total flagged issues: ${issues} ===`);
