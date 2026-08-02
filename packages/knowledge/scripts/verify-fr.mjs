import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
function walk(d, a = []) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name);
    if (e.isDirectory()) { if (!/node_modules|dist/.test(p)) walk(p, a); }
    else if (/\.ya?ml$|\.fr\.md$/.test(e.name)) a.push(p);
  }
  return a;
}
const files = [
  ...walk("content/countries"), ...walk("content/airlines"), ...walk("content/hub/drafts"),
  "packages/knowledge/translations/fr/strings.json",
  "packages/ui/src/components/HomeSections.astro",
  "packages/ui/src/data/countries.generated.json",
  "packages/ui/src/data/airlines.generated.json",
  "packages/knowledge/raw/guides.json",
];
const B = "\\p{L}";
const reVous = new RegExp(`(?<![${B}'])(votre|vos|vous)(?![${B}])`, "giu");
const reBug = /\$1 toi|t'\$1|te \$1/g;
const reEz = new RegExp(`(?<![${B}])(\\p{L}+ez)(?![${B}])`, "giu");
const FR_IMP = new Set(["mettez", "permettez", "remettez", "transmettez", "soumettez", "réalisez", "respectez",
  "détenez", "retenez", "maintenez", "prévenez", "revenez", "tenez", "disposez", "procurez", "veuillez",
  "sachez", "voyez", "faites", "présentez", "gardez", "choisissez", "saisissez", "venez", "allez"]);
let vous = 0, bug = 0; const imp = {};
const vousSamples = [];
for (const f of files) {
  const t = readFileSync(f, "utf8");
  bug += (t.match(reBug) || []).length;
  for (const m of t.matchAll(reVous)) { vous++; if (vousSamples.length < 8) vousSamples.push(f.split("/").pop() + ": …" + t.slice(Math.max(0, m.index - 25), m.index + 12) + "…"); }
  for (const m of t.matchAll(reEz)) { const w = m[1].toLowerCase(); if (FR_IMP.has(w)) imp[w] = (imp[w] || 0) + 1; }
}
console.log("bug artefacts ($1 toi / t'$1 / te $1):", bug);
console.log("vous/votre/vos restants (hors URL):", vous);
if (vousSamples.length) console.log("échantillons:\n  " + vousSamples.join("\n  "));
console.log("impératifs FR réels restants:", JSON.stringify(imp));
