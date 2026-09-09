#!/usr/bin/env node
/**
 * CONTRE-ÉPREUVES DU MICRO-LOT « GABARIT INDICATIF DE CAGE » (09/09/2026, Philippe sur proposition de Codex).
 *
 *   npx tsx test-gabarit-indicatif.mjs
 *
 * Le contrat du module, éprouvé sans site construit : la table est VIDE tant que Codex ne l'a pas livrée (aucun
 * seuil inventé), les conseillées sont les minimales plus la marge MyDogCanFly, et — sur une table SYNTHÉTIQUE,
 * déclarée comme telle — la sélection respecte les limites entre deux gabarits, dans l'ordre S → XXL, sans
 * gabarit par défaut. Les séries 100–700 n'existent nulle part dans le module ni dans le composant.
 */
import { readFileSync } from "node:fs";
import { TABLE_GABARIT_INDICATIF, MARGE_CONSEILLEE_CM, dimensionsConseillees, gabaritPour, ORDRE_GABARITS } from "./packages/ui/src/lib/gabarit-indicatif.ts";

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => { console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`)); cond ? pass++ : fail++; };

console.log("=== 1. La table réelle : indicative, MyDogCanFly, VIDE — attendue de Codex ===");
{
  check("nature `indicatif`, auteur MyDogCanFly, version qui dit que la table est attendue", TABLE_GABARIT_INDICATIF.nature === "indicatif" && TABLE_GABARIT_INDICATIF.auteur === "MyDogCanFly" && /attendue/.test(TABLE_GABARIT_INDICATIF.version));
  check("aucune classe : aucun seuil n'a été inventé", TABLE_GABARIT_INDICATIF.classes.length === 0);
  check("table vide → aucun gabarit, quel que soit le chien", gabaritPour({ l: 60, w: 30, h: 40 }) === null && gabaritPour({ l: 120, w: 60, h: 90 }) === null);
  check("la marge MyDogCanFly vaut 3 cm — la borne haute du conseil déjà affiché (« 2–3 cm »)", MARGE_CONSEILLEE_CM === 3);
  const rec = dimensionsConseillees({ l: 60, w: 30, h: 40 });
  check("conseillées = minimales + 3 sur chaque dimension", rec.l === 63 && rec.w === 33 && rec.h === 43);
}

console.log("\n=== 2. Table SYNTHÉTIQUE : les limites entre deux gabarits, dans l'ordre, sans défaut ===");
{
  const synth = { nature: "indicatif", auteur: "MyDogCanFly", version: "synthétique — harnais", note: "", classes: [
    { code: "M", max_l_cm: 70, max_w_cm: 50, max_h_cm: 55 },
    { code: "S", max_l_cm: 55, max_w_cm: 40, max_h_cm: 45 },   // volontairement dans le désordre : le module trie
    { code: "XXL", max_l_cm: 120, max_w_cm: 80, max_h_cm: 90 },
    { code: "L", max_l_cm: 90, max_w_cm: 60, max_h_cm: 70 },
    { code: "XL", max_l_cm: 105, max_w_cm: 70, max_h_cm: 80 },
  ] };
  check("petit chien (50×35×40) → S", gabaritPour({ l: 50, w: 35, h: 40 }, synth) === "S");
  check("exactement à la limite haute de S (55×40×45) → S : la limite est INCLUSE", gabaritPour({ l: 55, w: 40, h: 45 }, synth) === "S");
  check("un centimètre au-delà sur UNE seule dimension (56×40×45) → M : la plus petite classe qui contient", gabaritPour({ l: 56, w: 40, h: 45 }, synth) === "M");
  check("grand chien (100×65×75) → XL", gabaritPour({ l: 100, w: 65, h: 75 }, synth) === "XL");
  check("au-delà de XXL (130×80×90) → null, jamais un gabarit « par défaut »", gabaritPour({ l: 130, w: 80, h: 90 }, synth) === null);
  check("l'ordre est S → XXL, et une classe mal formée invalide la table entière (null)",
    ORDRE_GABARITS.join() === "S,M,L,XL,XXL" && gabaritPour({ l: 50, w: 35, h: 40 }, { ...synth, classes: [...synth.classes, { code: "M", max_l_cm: 0, max_w_cm: 1, max_h_cm: 1 }] }) === null);
}

console.log("\n=== 3. Ce qui ne revient pas ===");
{
  const module = readFileSync("packages/ui/src/lib/gabarit-indicatif.ts", "utf8"), composant = readFileSync("packages/ui/src/components/CrateCalculator.astro", "utf8");
  const serie = /\b(100|200|300|400|500|700)\b\s*[\/(–-]\s*(XS|S|M|L|XL|XXL)\b|\b(XS|S|M|L|XL|XXL)\b\s*[\/(–-]\s*(100|200|300|400|500|700)\b/;
  // Les commentaires sont retirés avant la mesure : l'en-tête du composant NOMME la perte de l'ancien
  // couple « 500 / XL » (erreur nommée, jamais effacée) ; le témoin porte sur le code et les phrases livrées.
  const sansCommentaires = (t) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/<!--[\s\S]*?-->/g, "");
  check("aucun couple code 100–700 / taille dans le code ni les phrases (commentaires exclus, qui nomment l'ancienne perte)", !serie.test(sansCommentaires(module)) && !serie.test(sansCommentaires(composant)));
  check("le témoin détecterait bien un couple réintroduit (auto-contrôle)", serie.test("500 / XL") && serie.test("XL (500)"));
  check("aucune « cage approuvée/homologuée » dans les phrases nouvelles du composant", !/approved crate|homologu|certified crate|certifi/i.test(composant.split("gabaritTitle")[1]?.split("cabinTitle")[0] ?? ""));
  check("le module ne lit jamais la race : le gabarit dérive des dimensions calculées", !/breed|race/i.test(module.replace(/\/\*[\s\S]*?\*\//g, "")));
}

console.log(`\n=== SUMMARY ===\n${fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`}`);
process.exit(fail ? 1 : 0);
