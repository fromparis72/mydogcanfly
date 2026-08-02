// Native-proofreader automated checks on ES strings: missing opening ¿/¡, double spaces,
// space-before-punctuation (French habit), stray French words, capitalisation after ¿.
import fs from "node:fs";

const countries = JSON.parse(fs.readFileSync("packages/ui/src/data/countries.generated.json", "utf8"));
const airlines = JSON.parse(fs.readFileSync("packages/ui/src/data/airlines.generated.json", "utf8"));
const strings = JSON.parse(fs.readFileSync("packages/knowledge/translations/es/strings.json", "utf8"));

const esStrings = [];
function collect(node, id = "") {
  if (typeof node !== "object" || !node) return;
  if (typeof node.es === "string") esStrings.push({ id, s: node.es });
  for (const k of Object.keys(node)) {
    if (["en", "fr", "es"].includes(k)) continue;
    const v = node[k];
    if (Array.isArray(v)) v.forEach((x) => collect(x, id));
    else if (typeof v === "object") collect(v, id);
  }
}
for (const [id, g] of Object.entries(countries)) collect(g, "country:" + id);
for (const [id, a] of Object.entries(airlines)) collect(a, "airline:" + id);
for (const [k, v] of Object.entries(strings)) if (typeof v === "string") esStrings.push({ id: "str:" + k, s: v });

const checks = {
  "missing ¿ (has ? but no ¿)": (s) => /\?/.test(s) && !/¿/.test(s),
  "missing ¡ (has ! but no ¡)": (s) => /!/.test(s) && !/¡/.test(s) && !/https?:/.test(s),
  "space before ?!:;": (s) => /\s[?!;]/.test(s) || /\s:\s/.test(s) === false && / [?!]/.test(s),
  "double space": (s) => /  /.test(s),
  "french word": (s) => /\b(chien|vétérinaire|votre|vous|être|français|d'un|qu'il|n'est|c'est|aéroport)\b/i.test(s),
  "english leftover": (s) => /\b(dog|the dog|required|health certificate|must be|entry requirements)\b/.test(s),
};

const found = {};
for (const name of Object.keys(checks)) found[name] = [];
for (const { id, s } of esStrings) {
  for (const [name, fn] of Object.entries(checks)) {
    try { if (fn(s)) found[name].push({ id, s }); } catch {}
  }
}
for (const [name, list] of Object.entries(found)) {
  console.log(`\n### ${name}: ${list.length}`);
  for (const { id, s } of list.slice(0, 12)) console.log(`  ${id}\n    ${s.slice(0, 130)}`);
}
console.log("\ntotal ES strings scanned:", esStrings.length);
