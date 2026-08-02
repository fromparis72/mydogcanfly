#!/usr/bin/env node
/* Final pass: convert remaining 2nd-plural imperatives/verbs in -ez that the earlier passes missed
   (not-listed verbs + accent-initial verbs where JS \b fails). EXPLICIT French verb list only, so
   Spanish look-alikes (Túnez, diez, Chávez, vez, veces) are never touched. Unicode letter lookarounds
   so "Évitez" converts too. Dry-run by default; --apply to write. */
import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..", "..", "..");
const APPLY = process.argv.includes("--apply");

// "Xez" → singular. Regular -er verbs: stem+"e". Irregular given explicitly.
const VERBS = {
  validez: "valide", ajoutez: "ajoute", entrez: "entre", utilisez: "utilise", comptez: "compte",
  déclarez: "déclare", privilégiez: "privilégie", considérez: "considère", conservez: "conserve",
  présumez: "présume", contrôlez: "contrôle", voyagez: "voyage", mesurez: "mesure", organisez: "organise",
  commencez: "commence", concentrez: "concentre", laissez: "laisse", rentrez: "rentre", planifiez: "planifie",
  portez: "porte", empruntez: "emprunte", enregistrez: "enregistre", notifiez: "notifie", apportez: "apporte",
  signalez: "signale", passez: "passe", séjournez: "séjourne", informez: "informe", arrivez: "arrive",
  présentez: "présente", évitez: "évite", déposez: "dépose", récupérez: "récupère", précisez: "précise",
  échangez: "échange", payez: "paie", vérifiez: "vérifie", gardez: "garde", pensez: "pense",
  emportez: "emporte", demandez: "demande", montrez: "montre", regroupez: "regroupe", téléchargez: "télécharge",
  scannez: "scanne", imprimez: "imprime", cochez: "coche", remplissez: "remplis", suivez: "suis",
  // -mettre / -tenir / -venir families + others found in a final pass
  mettez: "mets", remettez: "remets", permettez: "permets", soumettez: "soumets", transmettez: "transmets",
  admettez: "admets", réalisez: "réalise", respectez: "respecte", détenez: "détiens", retenez: "retiens",
  maintenez: "maintiens", tenez: "tiens", prévenez: "préviens", revenez: "reviens", provenez: "proviens",
  disposez: "dispose", procurez: "procure",
  // irregular
  obtenez: "obtiens", venez: "viens", envoyez: "envoie", faites: "fais", prévoyez: "prévois",
  // future tense (-erez → -eras)
  résiderez: "résideras", trouverez: "trouveras", devrez: "devras", pourrez: "pourras", aurez: "auras",
  serez: "seras", saurez: "sauras",
};
const cap = (w) => w.charAt(0).toUpperCase() + w.slice(1);
const L = "A-Za-zÀ-ÖØ-öø-ÿ";
const RULES = [];
// "tu Xez" → "tu Xes" (present tense) handled by the same map giving singular; but for present after "tu"
// the correct form is stem+"es"; our map gives imperative (stem+"e"). Present-after-"tu" leftovers are rare
// (subject-verb pass caught them); we prioritise the imperative form which dominates the content.
for (const [plural, singular] of Object.entries(VERBS)) {
  RULES.push([new RegExp(`(?<![${L}])${plural}(?![${L}])`, "gu"), singular]);
  RULES.push([new RegExp(`(?<![${L}])${cap(plural)}(?![${L}])`, "gu"), cap(singular)]);
}

function convert(text) {
  let out = text, n = 0;
  for (const [re, rep] of RULES) out = out.replace(re, () => { n++; return rep; });
  return { out, n };
}
function walk(dir, acc = []) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) { if (!/node_modules|dist/.test(p)) walk(p, acc); }
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
];
let files = 0, total = 0;
for (const f of targets) {
  const before = readFileSync(f, "utf8");
  const { out, n } = convert(before);
  if (n > 0 && out !== before) { files++; total += n; if (APPLY) writeFileSync(f, out); }
}
console.log(`${APPLY ? "Appliqué" : "Dry-run"} : ${total} impératifs dans ${files} fichiers.`);
