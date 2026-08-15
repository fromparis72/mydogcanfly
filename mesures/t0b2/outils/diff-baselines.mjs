/**
 * T0-B2 — diff exhaustif de deux baselines du contrat public, segment par segment.
 *
 *   node mesures/t0b2/outils/diff-baselines.mjs <avant.json> <apres.json> <sortie.json>
 *
 * L'artefact produit ne contient AUCUN chemin : il identifie ses deux entrées par un libellé
 * logique et par leur empreinte SHA-256. Un chemin absolu rendrait le fichier dépendant de la
 * machine — son contenu fonctionnel serait identique, son empreinte non, et la comparaison aux
 * empreintes publiées deviendrait impossible à honorer ailleurs que sur la machine d'origine.
 *
 * Une ligne compagnie de la baseline est une chaîne jointe par " | " ; chaque segment est nommé,
 * de sorte qu'un écart se lit comme un champ métier et non comme une différence de texte.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const [, , FA, FB, OUT] = process.argv;
if (!FA || !FB || !OUT) { console.error("usage : diff-baselines.mjs <avant.json> <apres.json> <sortie.json>"); process.exit(2); }

const brutA = readFileSync(FA, "utf8"), brutB = readFileSync(FB, "utf8");
const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");
const avant = JSON.parse(brutA);
const apres = JSON.parse(brutB);
const cles = Object.keys(avant);
if (JSON.stringify(cles) !== JSON.stringify(Object.keys(apres))) throw new Error("ensembles de scénarios différents");

/** Ordre des segments produit par `air()` dans test-t0a-baseline.mjs. */
const SEGMENTS = ["airline_id", "liaison", "confiance", "statuts", "decisions", "booleens", "confirm", "pets", "deny", "label", "fee", "heat"];
const id = (ligne) => ligne.split(" | ")[0];

const details = [], parCompagnie = {}, natures = {};
for (const k of cles) {
  const A = avant[k], B = apres[k];
  if (JSON.stringify(A) === JSON.stringify(B)) continue;
  const d = { scenario: k, tete: {}, compagnies: [] };
  for (const f of new Set([...Object.keys(A), ...Object.keys(B)])) {
    if (f === "airlines") continue;
    if (JSON.stringify(A[f]) !== JSON.stringify(B[f])) d.tete[f] = { avant: A[f], apres: B[f] };
  }
  const mapA = new Map((A.airlines || []).map((l) => [id(l), l]));
  const mapB = new Map((B.airlines || []).map((l) => [id(l), l]));
  const ordreA = (A.airlines || []).map(id), ordreB = (B.airlines || []).map(id);
  if (JSON.stringify(ordreA) !== JSON.stringify(ordreB)) {
    d.classement = { avant: ordreA, apres: ordreB };
    natures.classement = (natures.classement || 0) + 1;
  }
  for (const a of new Set([...mapA.keys(), ...mapB.keys()])) {
    const la = mapA.get(a), lb = mapB.get(a);
    if (!la || !lb) { d.compagnies.push({ airline: a, probleme: la ? "disparue" : "apparue" }); continue; }
    const sa = la.split(" | "), sb = lb.split(" | ");
    const segs = [];
    for (let i = 0; i < Math.max(sa.length, sb.length); i++) {
      if (sa[i] !== sb[i]) segs.push({ champ: SEGMENTS[i] ?? `seg${i}`, avant: sa[i], apres: sb[i] });
    }
    if (!segs.length) continue;
    d.compagnies.push({ airline: a, segments: segs });
    const pc = (parCompagnie[a] ||= { scenarios: 0, natures: new Set() });
    pc.scenarios++;
    for (const s of segs) { pc.natures.add(s.champ); natures[s.champ] = (natures[s.champ] || 0) + 1; }
  }
  for (const f of Object.keys(d.tete)) natures["tete:" + f] = (natures["tete:" + f] || 0) + 1;
  details.push(d);
}

const rapport = {
  entrees: {
    avant: { role: "baseline figée AVANT (contrat public de référence)", sha256: sha(brutA) },
    apres: { role: "baseline candidate APRÈS migration T0-B2", sha256: sha(brutB) },
  },
  scenarios_totaux: cles.length,
  scenarios_touches: details.length,
  scenarios_identiques: cles.length - details.length,
  compagnies_touchees: Object.fromEntries(Object.entries(parCompagnie)
    .map(([k, v]) => [k, { scenarios: v.scenarios, natures: [...v.natures].sort() }])),
  natures_d_ecart: natures,
  details,
};
writeFileSync(OUT, JSON.stringify(rapport, null, 1) + "\n");
console.log("scénarios touchés  :", details.length, "/", cles.length);
console.log("compagnies touchées:", Object.keys(parCompagnie).length);
console.log("natures d'écart    :", natures);
