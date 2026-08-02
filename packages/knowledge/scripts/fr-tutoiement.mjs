#!/usr/bin/env node
/* Convert French vouvoiement → tutoiement across UI strings, country/airline fiches, breeds and
   components. Ordered replacements (most specific first). French-only tokens (votre/vous/imperatives)
   never appear in EN/ES text, so running on mixed-locale files is safe.
   Dry-run by default; pass --apply to write. */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..");
const APPLY = process.argv.includes("--apply");

// [pattern, replacement] — applied in order. Keep multi-word + reflexive BEFORE generic vous/votre.
const RULES = [
  // polite formulas
  [/\bs'il vous plaît\b/g, "s'il te plaît"], [/\bvous-même\b/g, "toi-même"], [/\bVous-même\b/g, "Toi-même"],
  // reflexive imperatives
  [/\bAssurez-vous\b/g, "Assure-toi"], [/\bassurez-vous\b/g, "assure-toi"],
  [/\bRenseignez-vous\b/g, "Renseigne-toi"], [/\brenseignez-vous\b/g, "renseigne-toi"],
  [/\bAdressez-vous\b/g, "Adresse-toi"], [/\badressez-vous\b/g, "adresse-toi"],
  [/\bMunissez-vous\b/g, "Munis-toi"], [/\bmunissez-vous\b/g, "munis-toi"],
  [/\bRapprochez-vous\b/g, "Rapproche-toi"], [/\brapprochez-vous\b/g, "rapproche-toi"],
  // verb + vous (subject) — case-aware so sentence-initial "Vous devez" → "Tu dois"
  ...Object.entries({
    "devez": "dois", "pouvez": "peux", "devrez": "devras", "pourrez": "pourras", "avez": "as",
    "aurez": "auras", "êtes": "es", "serez": "seras", "voyagez": "voyages", "souhaitez": "souhaites",
    "voulez": "veux", "partez": "pars", "prévoyez": "prévois", "préparez": "prépares", "arrivez": "arrives",
    "risquez": "risques", "trouverez": "trouveras", "saurez": "sauras", "devriez": "devrais",
    "pourriez": "pourrais", "êtes-vous": "es-tu",
  }).map(([a, b]) => [new RegExp("\\b([Vv])ous " + a + "\\b", "g"), (_, c) => (c === "V" ? "Tu " : "tu ") + b]),
  // verb + vous (object / reflexive-ish)
  [/\bvous aide\b/g, "t'aide"], [/\bvous aidons\b/g, "t'aidons"], [/\bvous permet\b/g, "te permet"],
  [/\bvous permettra\b/g, "te permettra"], [/\bvous accompagne\b/g, "t'accompagne"],
  [/\bvous rendre\b/g, "te rendre"], [/\bvous concerne\b/g, "te concerne"], [/\bvous guide\b/g, "te guide"],
  [/\bvous évite\b/g, "t'évite"], [/\bvous coûtera\b/g, "te coûtera"], [/\bvous faut\b/g, "te faut"],
  // prepositions + vous
  [/\bpour vous\b/g, "pour toi"], [/\bchez vous\b/g, "chez toi"], [/\bavec vous\b/g, "avec toi"],
  [/\bà vous\b/g, "à toi"], [/\bde vous\b/g, "de toi"],
  // subject vous fallback
  [/\bsi vous\b/g, "si tu"], [/\bSi vous\b/g, "Si tu"], [/\bque vous\b/g, "que tu"],
  [/\blorsque vous\b/g, "lorsque tu"], [/\bLorsque vous\b/g, "Lorsque tu"],
  [/\bquand vous\b/g, "quand tu"], [/\bQuand vous\b/g, "Quand tu"], [/\boù vous\b/g, "où tu"],
  [/\bvous\b/g, "tu"], [/\bVous\b/g, "Tu"],
  // votre → ta (consonant-initial FEMININE nouns) — before generic votre→ton.
  // Vowel-initial feminine (arrivée, entrée, identité…) correctly stay "ton" via the generic rule.
  [/\b([Vv])otre (date|destination|caisse|cage|jaula|race|compagnie|réservation|demande|situation|puce|vaccination|carte|pièce|preuve|sortie|procédure|valise|santé|région|ville|taille|période|durée|franchise|quarantaine|photo|copie|prise|cabine|soute|patte|laisse|muselière|gamelle|couverture|trousse|protection|documentation|responsabilité|checklist|liste|micropuce|puçe|titulation|titration)\b/g,
    (_, c, noun) => (c === "V" ? "Ta" : "ta") + " " + noun],
  // vos → tes
  [/\bvos\b/g, "tes"], [/\bVos\b/g, "Tes"],
  // votre → ton (masculine + vowel-initial feminine like "arrivée")
  [/\bvotre\b/g, "ton"], [/\bVotre\b/g, "Ton"],
  // imperatives (2nd plural → singular)
  ...[["Consultez", "Consulte"], ["Vérifiez", "Vérifie"], ["Préparez", "Prépare"], ["Prévoyez", "Prévois"],
     ["Comparez", "Compare"], ["Choisissez", "Choisis"], ["Indiquez", "Indique"], ["Contactez", "Contacte"],
     ["Évitez", "Évite"], ["Réservez", "Réserve"], ["Anticipez", "Anticipe"], ["Saisissez", "Saisis"],
     ["Cliquez", "Clique"], ["Trouvez", "Trouve"], ["Pensez", "Pense"], ["Gardez", "Garde"], ["Notez", "Note"],
     ["Sachez", "Sache"], ["Présentez", "Présente"], ["Demandez", "Demande"], ["Emportez", "Emporte"],
     ["Prenez", "Prends"], ["Soyez", "Sois"], ["Gardez", "Garde"], ["Renseignez", "Renseigne"],
     ["Assurez", "Assure"], ["Munissez", "Munis"], ["Rendez", "Rends"]]
    .flatMap(([a, b]) => [[new RegExp("\\b" + a + "\\b", "g"), b], [new RegExp("\\b" + a.toLowerCase() + "\\b", "g"), b.toLowerCase()]]),
];

export function convert(text) {
  let out = text, n = 0;
  for (const [re, rep] of RULES) out = out.replace(re, (...a) => { n++; return typeof rep === "function" ? rep(...a) : rep; });
  return { out, n };
}

const isMain = import.meta.url === `file://${process.argv[1]}`;
if (isMain) {

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
  if (n > 0 && out !== before) {
    files++; total += n;
    if (APPLY) writeFileSync(f, out);
  }
}
console.log(`${APPLY ? "Appliqué" : "Dry-run"} : ${total} remplacements dans ${files} fichiers.`);
}
