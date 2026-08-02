#!/usr/bin/env node
/* Ajoute les trois types de chiens les plus restreints au monde, absents du catalogue :
   Tosa, American Pit Bull Terrier, American Bully (XL).

   Choix de modélisation documentés, car ils ne sont pas évidents :

   1. brachycephalic — le champ ne décrit PAS l'anatomie mais la manière dont les compagnies
      traitent la race, puisque c'est lui qui déclenche l'interdiction de soute.
      • Tosa      → false. Le standard FCI 260 décrit un museau « modérément long » ; le Tosa
                    n'apparaît sur aucune liste « nez court » de compagnie vérifiée (Lufthansa).
                    Son problème de voyage est l'interdiction légale, pas la respiration.
      • Pit Bull  → true. Anatomiquement mésocéphale (ratio museau/crâne 2:3 au standard UKC),
                    MAIS Lufthansa le nomme explicitement sur sa liste « nez court » et le refuse
                    en soute depuis le 1er janvier 2020. C'est le traitement réel qui compte.
      • Bully XL  → true. Lufthansa le porte sur ses DEUX listes (chiens dangereux ET nez court),
                    avec la mention « interdit par principe en raison de possibles
                    caractéristiques brachycéphales ».

   2. weight_kg — ni la FCI (Tosa) ni l'ABKC (Bully) ne publient de poids ; l'ABKC écrit
      explicitement « il n'y a pas de poids particulier pour la race ». Les valeurs retenues
      sont des médianes d'usage, pas des chiffres de standard. Seul le Pit Bull a une
      fourchette officielle (UKC : 15,9–27,2 kg pour les mâles).
*/
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const OBJ = resolve(dirname(fileURLToPath(import.meta.url)), "..", "raw", "objects.json");

const src = (url, confidence) => ({
  url, source_type: "other", verified_date: "2026-07-28",
  review_due: "2027-07-28", confidence, reviewer: "research", history: [],
});

const BREEDS = [
  {
    id: "breed_tosa_inu",
    name: "Tosa Inu",
    size: "giant",
    weight_kg: 60,              // estimation : la FCI ne fixe qu'une taille minimale (60 cm mâle)
    brachycephalic: false,
    name_i18n: { fr: "Tosa Inu", es: "Tosa Inu" },
    travel: {
      adaptability: 2, sensitivity: 3, tolerates_alone: 3,
      cold_tolerance: 3, heat_tolerance: 2, energy: 2,
      source: src("https://www.fci.be/Nomenclature/Standards/260g02-en.pdf", 4),
    },
  },
  {
    id: "breed_american_pit_bull_terrier",
    name: "American Pit Bull Terrier",
    size: "medium",
    weight_kg: 20,              // UKC : mâles 15,9–27,2 kg
    brachycephalic: true,       // traitement compagnie, pas anatomie — voir en-tête
    name_i18n: { fr: "American Pit Bull Terrier", es: "American Pit Bull Terrier" },
    travel: {
      adaptability: 3, sensitivity: 4, tolerates_alone: 2,
      cold_tolerance: 2, heat_tolerance: 3, energy: 5,
      source: src("https://www.ukcdogs.com/docs/breeds/american-pit-bull-terrier.pdf", 4),
    },
  },
  {
    id: "breed_american_bully_xl",
    name: "American Bully (XL)",
    size: "large",
    weight_kg: 50,              // estimation : l'ABKC ne publie aucun poids
    brachycephalic: true,
    name_i18n: { fr: "American Bully (XL)", es: "American Bully (XL)" },
    travel: {
      adaptability: 3, sensitivity: 3, tolerates_alone: 2,
      cold_tolerance: 2, heat_tolerance: 2, energy: 3,
      source: src("https://www.ukcdogs.com/docs/breeds/american-bully.pdf", 4),
    },
  },
];

const o = JSON.parse(readFileSync(OBJ, "utf8"));
const have = new Set(o.breeds.map((b) => b.id));
let added = 0;
for (const b of BREEDS) {
  if (have.has(b.id)) { console.log(`déjà présent : ${b.id}`); continue; }
  o.breeds.push(b); added++;
}
o.breeds.sort((a, b) => a.name.localeCompare(b.name));
writeFileSync(OBJ, JSON.stringify(o, null, 2) + "\n");
console.log(`races ajoutées : ${added} — total ${o.breeds.length}`);
console.log("slugs :", BREEDS.map((b) => b.id.split("_").slice(1).join("-")).join(", "));
