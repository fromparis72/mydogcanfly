/**
 * T0-B2 — génération du DIFF APPROUVÉ, sur le modèle de `t0a-approved-diff.json`.
 *
 *   node mesures/t0b2/outils/generer-diff-approuve.mjs <avant.json> <apres.json> <registre.json> <sortie.json>
 *
 * Chaque carte modifiée est figée à sa valeur EXACTE, avant et après, et rattachée au couple
 * (compagnie, placement) du registre approuvé qui la justifie. Les champs de tête modifiés
 * (score, compatible) le sont aussi : un lot qui changerait un score sans changer une carte
 * doit échouer, lui aussi.
 *
 * Ce fichier n'est pas un journal : c'est un CONTRAT. Le harnais exige la bijection dans les deux
 * sens — aucune carte modifiée hors de cette liste, aucune entrée de cette liste non observée.
 */
import { readFileSync, writeFileSync } from "node:fs";

const [, , FA, FB, FREG, OUT] = process.argv;
if (!FA || !FB || !FREG || !OUT) {
  console.error("usage : generer-diff-approuve.mjs <avant.json> <apres.json> <registre.json> <sortie.json>");
  process.exit(2);
}

const avant = JSON.parse(readFileSync(FA, "utf8"));
const apres = JSON.parse(readFileSync(FB, "utf8"));
const registre = JSON.parse(readFileSync(FREG, "utf8"));
/** Couples MIGRÉS : tout ce qui n'est pas une conversion mécanique. */
const migres = new Map(registre.registre.filter((r) => r.lot !== "218_mecanique").map((r) => [r.key, r]));

const id = (ligne) => ligne.split(" | ")[0];
const CHAMPS_TETE = ["verdict", "score", "compatible", "domestic", "climate", "destination_country",
  "confidence", "conditions", "positives", "warnings", "risks", "alternatives", "sources"];

const cartes = [], tetes = [], classements = [];
const couplesJustifiants = new Set();

for (const k of Object.keys(avant)) {
  const A = avant[k], B = apres[k];
  if (!B) throw new Error(`scénario absent de l'après : ${k}`);

  for (const champ of CHAMPS_TETE) {
    if (JSON.stringify(A[champ]) === JSON.stringify(B[champ])) continue;
    tetes.push({ scenario: k, champ, avant: A[champ], apres: B[champ] });
  }

  /* L'ORDRE des cartes est un contenu public : c'est le classement que le visiteur lit. Le
     comparer par `Map` ne le voit pas — deux listes permutées ont les mêmes clés. Les 28
     permutations sont donc figées comme SÉQUENCES avant/après (contre-revue du 15/08/2026). */
  const ordreA = (A.airlines || []).map(id), ordreB = (B.airlines || []).map(id);
  if (JSON.stringify(ordreA) !== JSON.stringify(ordreB)) {
    classements.push({ scenario: k, avant: ordreA, apres: ordreB });
  }

  const parId = new Map((A.airlines || []).map((l) => [id(l), l]));
  for (const ligneB of B.airlines || []) {
    const ligneA = parId.get(id(ligneB));
    if (ligneA === undefined) throw new Error(`compagnie apparue : ${k} ${id(ligneB)}`);
    if (ligneA === ligneB) continue;
    /* Le couple qui JUSTIFIE la carte : le placement dont la décision a basculé. On le relit de
       la carte elle-même, pas d'une hypothèse — une carte modifiée sans couple migré identifiable
       est une erreur, pas une approbation. */
    const dec = (l) => Object.fromEntries(l.split(" | ")[4].split(" ").map((x) => {
      const i = x.indexOf(":"); return [x.slice(0, i), x.slice(i + 1)];
    }));
    const dA = dec(ligneA), dB = dec(ligneB);
    const places = Object.keys({ ...dA, ...dB }).filter((pl) => dA[pl] !== dB[pl]);
    const couples = places.map((pl) => `${id(ligneB)}.${pl}`);
    for (const c of couples) {
      if (!migres.has(c)) throw new Error(`carte modifiée sans couple migré : ${k} ${c}`);
      couplesJustifiants.add(c);
    }
    cartes.push({ scenario: k, airline_id: id(ligneB), couples, avant: ligneA, apres: ligneB });
  }
  for (const ligneA of A.airlines || []) {
    if (!(B.airlines || []).some((l) => id(l) === id(ligneA))) throw new Error(`compagnie disparue : ${k} ${id(ligneA)}`);
  }
}

const rapport = {
  perimetre: "T0-B2 — différences APPROUVÉES du contrat public entre la baseline figée AVANT et la baseline figée APRÈS",
  regle: "bijection stricte dans les deux sens : aucune carte modifiée hors de cette liste, aucune entrée non observée",
  totaux: {
    scenarios_touches: new Set([...cartes.map((c) => c.scenario), ...tetes.map((t) => t.scenario)]).size,
    cartes: cartes.length,
    champs_de_tete: tetes.length,
    classements: classements.length,
    compagnies: new Set(cartes.map((c) => c.airline_id)).size,
    couples_justifiants: couplesJustifiants.size,
    couples_migres_total: migres.size,
  },
  couples_justifiants: [...couplesJustifiants].sort(),
  cartes,
  champs_de_tete: tetes,
  classements,
};
writeFileSync(OUT, JSON.stringify(rapport, null, 1) + "\n");
console.log("totaux :", rapport.totaux);
