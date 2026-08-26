#!/usr/bin/env node
/**
 * LOT B — LE SCELLÉ VERSIONNÉ DU REGISTRE EXACT, et sa vérification.
 *
 *   node --import tsx fraicheur/sceller-registre.mjs             # VÉRIFIE : scellé ≡ registre recalculé
 *   node --import tsx fraicheur/sceller-registre.mjs --ecrire    # régénère fraicheur/registre-scelle.json
 *
 * POURQUOI (contre-revue du socle) : le registre exact était calculé mais confronté à AUCUN
 * scellé versionné — la garantie « une URL remplacée est nommée » ne vivait que dans le
 * harnais, jamais dans le système qui tourne. Le scellé porte les triplets triés
 * (famille, locator, empreinte de la Source canonique) plus les empreintes globale et par
 * famille : assez pour NOMMER toute entrée ajoutée, supprimée ou modifiée, sans dupliquer
 * les 1 508 objets.
 *
 * LE CONTRAT : toute PR qui change une source RESCELLE dans la même PR (`--ecrire`, le diff
 * du scellé rend le changement visible et revu) ; la CI de PR vérifie l'égalité ; le
 * contrôleur hebdomadaire la vérifie AUSSI avant tout run — un `main` qui ne respecte pas
 * son scellé est une panne structurelle, pas un état du monde.
 *
 * À la différence du scellé du lot A (l'instantané FIGÉ d'un état de départ), celui-ci est
 * FAIT pour être rescellé à chaque évolution légitime des sources — c'est le motif du
 * scellé de curation : le rescellement est un geste explicite, tracé par le diff, jamais
 * un réflexe silencieux de l'outil (le mode par défaut ne sait qu'échouer).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { z } from "zod";
import { lireRegistre, sha256De, jsonCanonique } from "./registre-fraicheur.mjs";

export const CHEMIN_SCELLE = "fraicheur/registre-scelle.json";

/* Le scellé a un SCHÉMA STRICT et se compare à ÉGALITÉ CANONIQUE TOTALE (contre-revue :
 * les empreintes globale et par famille étaient déclarées mais jamais confrontées — les
 * falsifier laissait « scellé tenu » ; et un doublon d'entrée était absorbé par une Map). */
const Sha256 = z.string().regex(/^[0-9a-f]{64}$/);
const TripletScelle = z.object({ famille: z.string().min(1), locator: z.string().min(1), empreinte_source: Sha256 }).strict();
const ScelleSchema = z.object({
  entrees: z.array(TripletScelle).min(1),
  empreintes: z.object({ globale: Sha256, par_famille: z.record(z.string(), Sha256) }).strict(),
}).strict();

/** Le contenu canonique du scellé pour un registre donné. */
export function scelleDe(registre) {
  return {
    entrees: registre.entrees.map((e) => ({
      famille: e.famille, locator: e.locator, empreinte_source: sha256De(jsonCanonique(e.source)),
    })),
    empreintes: registre.empreintes,
  };
}

/** Confronte un registre recalculé au scellé lu. Retourne la liste des écarts nommés —
 *  vide si et seulement si le scellé est STRICTEMENT valide, sans doublon, et CANONIQUEMENT
 *  ÉGAL à `scelleDe(registre)` (triplets ET empreintes : aucun champ du contrat n'est
 *  décoratif). */
export function ecartsAuScelle(registre, scelle) {
  const parse = ScelleSchema.safeParse(scelle);
  if (!parse.success) {
    return [{ type: "scelle_difforme", famille: "—",
      locator: parse.error.issues.slice(0, 2).map((i) => `${i.path.join(".") || "(racine)"} : ${i.message}`).join(" · ") }];
  }
  const vus = new Set();
  for (const e of scelle.entrees) {
    const cle = `${e.famille}#${e.locator}`;
    if (vus.has(cle)) return [{ type: "doublon", famille: e.famille, locator: e.locator }];
    vus.add(cle);
  }
  const canonique = scelleDe(registre);
  const courant = new Map(canonique.entrees.map((e) => [`${e.famille}#${e.locator}`, e]));
  const ecarts = [];
  for (const e of scelle.entrees) {
    const cle = `${e.famille}#${e.locator}`;
    if (!courant.has(cle)) ecarts.push({ type: "supprimee", famille: e.famille, locator: e.locator });
    else if (courant.get(cle).empreinte_source !== e.empreinte_source) ecarts.push({ type: "modifiee", famille: e.famille, locator: e.locator });
  }
  for (const [cle, e] of courant) {
    if (!vus.has(cle)) ecarts.push({ type: "ajoutee", famille: e.famille, locator: e.locator });
  }
  if (ecarts.length) return ecarts;
  /* triplets identiques : l'ÉGALITÉ CANONIQUE TOTALE juge le reste (empreintes, ordre) */
  if (jsonCanonique(scelle) !== jsonCanonique(canonique)) {
    return [{ type: "empreintes_falsifiees", famille: "—", locator: "empreintes globale/par_famille (ou ordre) ≠ recalculées — aucun champ du scellé n'est décoratif" }];
  }
  return [];
}

/* ---- exécution directe ----------------------------------------------------------------------- */
if (import.meta.url === `file://${process.argv[1]}`) {
  const registre = lireRegistre(".");
  if (process.argv.includes("--ecrire")) {
    writeFileSync(CHEMIN_SCELLE, JSON.stringify(scelleDe(registre), null, 2) + "\n");
    process.stdout.write(`[registre] scellé RÉGÉNÉRÉ : ${registre.entrees.length} entrées · empreinte ${registre.empreintes.globale.slice(0, 16)}… — le diff de ${CHEMIN_SCELLE} porte le changement, la PR le montre\n`);
    process.exit(0);
  }
  let scelle;
  try { scelle = JSON.parse(readFileSync(CHEMIN_SCELLE, "utf-8")); }
  catch { process.stderr.write(`[registre] ÉCHEC — ${CHEMIN_SCELLE} ABSENT ou illisible : le registre exact se scelle\n`); process.exit(1); }
  const ecarts = ecartsAuScelle(registre, scelle);
  if (ecarts.length) {
    process.stderr.write(`[registre] ÉCHEC — le registre recalculé ≠ scellé : ${ecarts.length} écart(s) — une source a changé SANS rescellement dans la même PR :\n`);
    for (const e of ecarts.slice(0, 20)) process.stderr.write(`  · ${e.type} — ${e.famille} : ${e.locator}\n`);
    if (ecarts.length > 20) process.stderr.write(`  … et ${ecarts.length - 20} autre(s).\n`);
    process.stderr.write(`  → si le changement est voulu : node --import tsx fraicheur/sceller-registre.mjs --ecrire (et committer le scellé avec la source)\n`);
    process.exit(1);
  }
  process.stdout.write(`[registre] scellé tenu : ${registre.entrees.length} entrées · empreinte ${registre.empreintes.globale.slice(0, 16)}…\n`);
}
