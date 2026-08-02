#!/usr/bin/env node
/* Second pass: fix the residual edge cases from fr-tutoiement.mjs — leftover 2nd-plural imperatives,
   reflexive "vous vous" → "tu tu" (should be "tu te/t' <verb>"), object-pronoun-before-infinitive,
   and stressed pronouns after a preposition. Dry-run by default; --apply to write. */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..");
const APPLY = process.argv.includes("--apply");
const vowel = (w) => /^[aeiouyàâäéèêëîïôöûù]/i.test(w);

const RULES = [
  // reflexive imperatives (before plain imperatives)
  [/\bAttendez-vous\b/g, "Attends-toi"], [/\battendez-vous\b/g, "attends-toi"],
  [/\bAdressez-vous\b/g, "Adresse-toi"], [/\badressez-vous\b/g, "adresse-toi"],
  [/\bMéfiez-vous\b/g, "Méfie-toi"], [/\bméfiez-vous\b/g, "méfie-toi"],
  // reflexive present: "tu tu <verb>ez" → "tu te/t' <verb>es"
  [/\btu tu ([a-zà-ÿ]+)ez\b/g, (_, v) => "tu " + (vowel(v) ? "t'" : "te ") + v + "es"],
  [/\btu tu rends\b/g, "tu te rends"], [/\btu tu rend\b/g, "tu te rends"],
  // any remaining "tu tu <word>" → "tu te/t' <word>" (verb already singular)
  [/\btu tu ([a-zà-ÿ']+)\b/g, (_, v) => "tu " + (vowel(v) ? "t'" : "te ") + v],
  // object pronoun before an infinitive: "toi aider" → "t'aider"
  [/\btoi (aider|accompagner|informer|orienter|éviter|aiguiller|alerter)\b/g, "t'$1"],
  [/\btoi (guider|permettre|proposer|conseiller|renseigner|préparer|prévenir)\b/g, "te $1"],
  // stressed pronoun after a preposition: "devant tu" → "devant toi"
  [/\b(devant|derrière|après|contre|malgré|parmi|selon|entre|vers|sans) tu\b/g, "$1 toi"],
  // remaining 2nd-plural imperatives → singular
  ...[["Lisez", "Lis"], ["Suivez", "Suis"], ["Remplissez", "Remplis"], ["Appelez", "Appelle"],
     ["Essayez", "Essaie"], ["Confirmez", "Confirme"], ["Veillez", "Veille"], ["Attendez", "Attends"],
     ["Adressez", "Adresse"], ["Songez", "Songe"], ["Regardez", "Regarde"], ["Téléphonez", "Téléphone"],
     ["Oubliez", "Oublie"], ["Inscrivez", "Inscris"], ["Complétez", "Complète"], ["Téléchargez", "Télécharge"],
     ["Munissez", "Munis"], ["Prévenez", "Préviens"], ["Fournissez", "Fournis"]]
    .flatMap(([a, b]) => [[new RegExp("\\b" + a + "\\b", "g"), b], [new RegExp("\\b" + a.toLowerCase() + "\\b", "g"), b.toLowerCase()]]),
];

function convert(text) {
  let out = text, n = 0;
  for (const [re, rep] of RULES) out = out.replace(re, (...a) => { n++; return typeof rep === "function" ? rep(...a) : rep; });
  return { out, n };
}
function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|dist|\.git/.test(p)) walk(p, acc); }
    else if (/\.(yml|json|astro|ts)$/.test(e.name) || /\.fr\.md$/.test(e.name)) acc.push(p);
  }
  return acc;
}
const targets = [
  resolve(ROOT, "packages/knowledge/translations/fr/strings.json"),
  resolve(ROOT, "packages/knowledge/raw/objects.json"),
  ...walk(resolve(ROOT, "content/hub")),
  ...walk(resolve(ROOT, "content/countries")),
  ...walk(resolve(ROOT, "content/airlines")),
  ...walk(resolve(ROOT, "packages/ui/src/components")),
  resolve(ROOT, "packages/ui/src/lib/pagedata.ts"),
];
let files = 0, total = 0;
for (const f of targets) {
  const before = readFileSync(f, "utf8");
  const { out, n } = convert(before);
  if (n > 0 && out !== before) { files++; total += n; if (APPLY) writeFileSync(f, out); }
}
console.log(`${APPLY ? "Appliqué" : "Dry-run"} : ${total} corrections dans ${files} fichiers.`);
