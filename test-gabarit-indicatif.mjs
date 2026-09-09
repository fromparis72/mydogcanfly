#!/usr/bin/env node
/**
 * CONTRE-ÉPREUVES DU MICRO-LOT « GABARIT INDICATIF DE CAGE » (09/09/2026, Philippe sur proposition de Codex).
 *
 *   npx tsx test-gabarit-indicatif.mjs
 *
 * Le contrat du module, éprouvé sans site construit : la table « Gabarit indicatif MyDogCanFly » (version 1,
 * livrée par Codex le 09/09/2026 ; version 0 : vide) est lue chiffre par chiffre, chaque frontière de classe est
 * éprouvée (limite incluse, +1 cm sur un seul axe → classe suivante, au-delà de XXL → « très grand format »),
 * les conseillées sont les minimales plus la marge MyDogCanFly, et — sur une table SYNTHÉTIQUE, déclarée comme
 * telle — la sélection respecte l'ordre S → XXL sans gabarit par défaut. Les séries 100–700 n'existent nulle part dans le module ni dans le composant.
 */
import { readFileSync } from "node:fs";
import { TABLE_GABARIT_INDICATIF, MARGE_CONSEILLEE_CM, dimensionsConseillees, gabaritPour, classerGabarit, ORDRE_GABARITS } from "./packages/ui/src/lib/gabarit-indicatif.ts";

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => { console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`)); cond ? pass++ : fail++; };

console.log("=== 1. La table réelle « Gabarit indicatif MyDogCanFly » — version 1, livrée par Codex, chaque frontière éprouvée ===");
{
  /* VERSION 0 → VERSION 1 : mouvement nommé (bloc Codex du 09/09/2026, transmis et confirmé par Philippe). La
     table est INTERNE et nommée ; le témoin la lit telle qu'elle est livrée, chiffre par chiffre. */
  const ATTENDUE = [["S", 60, 40, 45], ["M", 75, 50, 55], ["L", 90, 60, 65], ["XL", 105, 70, 75], ["XXL", 120, 80, 90]];
  check("nature `indicatif`, auteur MyDogCanFly, version 1 qui nomme Codex et Philippe", TABLE_GABARIT_INDICATIF.nature === "indicatif" && TABLE_GABARIT_INDICATIF.auteur === "MyDogCanFly" && /^1 — /.test(TABLE_GABARIT_INDICATIF.version) && /Codex/.test(TABLE_GABARIT_INDICATIF.version) && /Philippe/.test(TABLE_GABARIT_INDICATIF.version));
  check("les cinq classes S, M, L, XL, XXL portent exactement les enveloppes livrées (L × l × H, cm)",
    JSON.stringify(TABLE_GABARIT_INDICATIF.classes.map((c) => [c.code, c.max_l_cm, c.max_w_cm, c.max_h_cm])) === JSON.stringify(ATTENDUE),
    JSON.stringify(TABLE_GABARIT_INDICATIF.classes));
  check("la note dit « repère », « pas … produit », « fabricants », « compagnie »", /repère/i.test(TABLE_GABARIT_INDICATIF.note) && /pas la description d'un produit/.test(TABLE_GABARIT_INDICATIF.note) && /fabricants/.test(TABLE_GABARIT_INDICATIF.note) && /compagnie/.test(TABLE_GABARIT_INDICATIF.note));
  check("la marge MyDogCanFly vaut 3 cm — la borne haute du conseil déjà affiché (« 2–3 cm »)", MARGE_CONSEILLEE_CM === 3);
  const rec = dimensionsConseillees({ l: 60, w: 30, h: 40 });
  check("conseillées = minimales + 3 sur chaque dimension", rec.l === 63 && rec.w === 33 && rec.h === 43);

  /* CHAQUE FRONTIÈRE : exactement à l'enveloppe → la classe (limite incluse) ; un centimètre de plus sur UN SEUL
     axe → la classe suivante, pour chacun des trois axes. Au-delà de XXL → `au_dela`, jamais un défaut. */
  const suivant = { S: "M", M: "L", L: "XL", XL: "XXL", XXL: null };
  for (const [code, L, W, H] of ATTENDUE) {
    check(`${code} : exactement à l'enveloppe (${L}×${W}×${H}) → ${code}`, gabaritPour({ l: L, w: W, h: H }) === code, String(gabaritPour({ l: L, w: W, h: H })));
    for (const [axe, d] of [["longueur", { l: L + 1, w: W, h: H }], ["largeur", { l: L, w: W + 1, h: H }], ["hauteur", { l: L, w: W, h: H + 1 }]]) {
      const attendu = suivant[code];
      const vu = classerGabarit(d);
      check(`${code} : +1 cm en ${axe} seule → ${attendu ?? "au-delà (« très grand format »)"}`,
        attendu ? vu.etat === "gabarit" && vu.gabarit === attendu : vu.etat === "au_dela" && vu.gabarit === null, JSON.stringify(vu));
    }
  }
  check("le cas de Codex : 94 × 64 × 68 → XL (la longueur dépasse L, les deux autres tiendraient)", gabaritPour({ l: 94, w: 64, h: 68 }) === "XL");
  /* LE GOLDEN RETRIEVER DE LA RELECTURE EN LIGNE (Codex, 09/09/2026, sur main fc4c5c9 où la table était encore
     vide) : minimales 85 × 41 × 67 → conseillées 88 × 44 × 70 → les trois axes entrent dans XL (105 × 70 × 75),
     pas dans L (90 × 60 × 65 : la hauteur 70 dépasse 65). */
  const golden = dimensionsConseillees({ l: 85, w: 41, h: 67 });
  check("Golden Retriever relu en ligne : minimales 85 × 41 × 67 → conseillées 88 × 44 × 70 → XL", golden.l === 88 && golden.w === 44 && golden.h === 70 && gabaritPour(golden) === "XL", JSON.stringify([golden, gabaritPour(golden)]));
  check("les trois états sont distincts : table vide → `table_absente` (rien d'affiché), pas `au_dela`",
    classerGabarit({ l: 50, w: 30, h: 40 }, { ...TABLE_GABARIT_INDICATIF, classes: [] }).etat === "table_absente");
  check("une classe mal formée rend la table entière `table_absente` — jamais une classe de moins en silence",
    classerGabarit({ l: 50, w: 30, h: 40 }, { ...TABLE_GABARIT_INDICATIF, classes: [...TABLE_GABARIT_INDICATIF.classes, { code: "M", max_l_cm: 0, max_w_cm: 1, max_h_cm: 1 }] }).etat === "table_absente");
  check("le classement ne prend NI race NI poids : la signature n'accepte que trois dimensions", classerGabarit.length <= 2 && !/poids|weight|breed|race/.test(classerGabarit.toString()));
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
