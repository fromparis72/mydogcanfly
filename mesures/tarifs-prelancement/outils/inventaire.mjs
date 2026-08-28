#!/usr/bin/env node
/**
 * L'INVENTAIRE DES TARIFS PUBLIABLES — mesure d'abord, décision ensuite.
 *
 *   node mesures/tarifs-prelancement/outils/inventaire.mjs            relevé lisible
 *   node mesures/tarifs-prelancement/outils/inventaire.mjs --json     le relevé complet
 *
 * POURQUOI. Le Flight Finder donne l'apparence d'un tarif calculé pour le trajet alors qu'il
 * recopie une chaîne générique : `evaluate.ts` retient « policy?.[canal]?.fee ?? fees?.[canal] »
 * pour le PREMIER canal accepté, et l'expose sous un unique champ `fee` — un montant, sans canal,
 * sans devise garantie, sans route. Avant de changer quoi que ce soit, on compte ce qui est
 * réellement publiable et d'où ça vient.
 *
 * Ce script ne modifie rien. Il classe chaque valeur, et la classification est faite pour être
 * discutée : « inconnu » est une réponse, pas un échec.
 */
import { readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RACINE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const objets = JSON.parse(readFileSync(join(RACINE, "packages/knowledge/raw/objects.json"), "utf8"));
const CANAUX = ["cabin", "hold", "cargo"];

/**
 * CE QU'UNE CHAÎNE TARIFAIRE DIT VRAIMENT. Les motifs sont volontairement larges et l'ordre
 * compte : une fourchette qui mentionne aussi un devis reste une fourchette pour l'affichage,
 * mais « devis » l'emporte quand aucun nombre n'est donné.
 */
export function classer(valeur) {
  if (valeur == null || String(valeur).trim() === "") return "absent";
  const v = String(valeur).trim();
  /* Un montant réduit à un symbole monétaire et un tiret n'est pas un montant : c'est un champ
     laissé vide (mesuré : « A$— » chez Virgin Australia). */
  if (/^[^\d]*[—–-]\s*$/.test(v)) return "absent";
  const nombres = v.match(/\d[\d\s.,]*/g) ?? [];
  /* UN FRET CONFIÉ À UN SERVICE CARGO EST UN DEVIS, que le mot « quote » y soit ou non. La
     première rédaction exigeait le mot et comptait 10 devis là où la contre-revue en comptait 11 :
     « via Virgin Australia Cargo » a exactement la même nature que ses dix jumelles, sans le mot.
     Classer sur la forme du texte plutôt que sur ce qu'il décrit, c'est la faute que ce lot
     existe pour corriger. */
  if (/\bvia\b[^.]*\b(cargo|freight|petsafe|petembark|pets cargo)\b/i.test(v) && nombres.length === 0) return "devis";
  if (/\b(quote|devis|contact|cotiz|orçament|sur demande|on request)\b/i.test(v) && nombres.length === 0) return "devis";
  /* Un renvoi vers une grille tarifaire externe (bagage excédentaire) n'est pas un prix : il faut
     aller la consulter. Mesuré : « excess-baggage rate » chez EVA Air. */
  if (/excess[- ]baggage|bagage[s]? excédentaire/i.test(v)) return "calculateur externe";
  if (/(calculat|calcul|tool|outil|barème en ligne|website)/i.test(v) && nombres.length === 0) return "calculateur externe";
  if (nombres.length >= 2 && /[-–—]|to |à |a |até /i.test(v)) return "fourchette publiée";
  if (/\bper\s*(kg|km|segment|leg|zone)|\/\s*kg|par\s*(kg|segment|zone)/i.test(v)) return "barème par poids/dimensions";
  if (/\b(zone|route|region|région|destination|domestic|international)\b/i.test(v)) return "barème par route";
  if (nombres.length === 1) return "montant fixe";
  if (nombres.length === 0) return "inconnu";
  return "inconnu";
}

const lignes = [];
for (const a of objets.airlines) {
  const policy = a.premium?.policy ?? {};
  const fees = a.fees ?? {};
  for (const canal of CANAUX) {
    const dePolicy = policy?.[canal]?.fee;
    const deFees = fees?.[canal];
    const valeur = dePolicy ?? deFees;
    if (valeur == null || String(valeur).trim() === "") continue;
    lignes.push({
      compagnie: a.id,
      nom: a.name ?? a.id,
      canal,
      valeur: String(valeur),
      origine: dePolicy != null ? `premium.policy.${canal}.fee` : `fees.${canal}`,
      source: policy?.[canal]?.source?.url ?? a.source?.url ?? null,
      verifiee_le: policy?.[canal]?.source?.verified_date ?? null,
      classification: classer(valeur),
      /* La page publique consommatrice : la fiche compagnie rend le tarif de chaque canal, et le
         Flight Finder rend le champ `fee` du moteur — c'est ce dernier qui invente le « prix ». */
      pages: [`/airlines/${a.id.replace(/^airline_/, "").replace(/_/g, "-")}/`, "/ (Flight Finder)"],
    });
  }
}

const avecTarif = new Set(lignes.map((l) => l.compagnie));
const parOrigine = {}, parClasse = {}, parCanal = {};
for (const l of lignes) {
  parOrigine[l.origine.startsWith("premium") ? "premium.policy" : "ancien fees"] = (parOrigine[l.origine.startsWith("premium") ? "premium.policy" : "ancien fees"] ?? 0) + 1;
  parClasse[l.classification] = (parClasse[l.classification] ?? 0) + 1;
  parCanal[l.canal] = (parCanal[l.canal] ?? 0) + 1;
}

if (process.argv.includes("--json")) {
  console.log(JSON.stringify({ compagnies: objets.airlines.length, avecTarif: avecTarif.size, lignes }, null, 2));
} else {
  console.log(`compagnies                      : ${objets.airlines.length}`);
  console.log(`compagnies avec un tarif affichable : ${avecTarif.size}`);
  console.log(`champs tarifaires               : ${lignes.length}`);
  console.log(`\npar origine   : ${JSON.stringify(parOrigine)}`);
  console.log(`par canal     : ${JSON.stringify(parCanal)}`);
  console.log(`par classification :`);
  for (const [k, v] of Object.entries(parClasse).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(4)}  ${k}`);
  console.log(`\nles valeurs les plus fréquentes :`);
  const freq = {};
  for (const l of lignes) freq[l.valeur] = (freq[l.valeur] ?? 0) + 1;
  for (const [v, n] of Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`  ${String(n).padStart(3)}×  ${JSON.stringify(v)}`);
}
