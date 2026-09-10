#!/usr/bin/env node
/**
 * BANGKOK AIRWAYS FRET — RÈGLE GÉOGRAPHIQUE (lot ouvert le 10/09/2026, annexe 37).
 *
 *   node test-bangkok-fret-geographie.mjs
 *
 * Décision de Philippe (10/09) : les aéroports de Krabi (KBV) et Chiang Mai (CNX) ne sont PAS ajoutés au
 * référentiel. Les exclusions « Bangkok–Krabi » et « Chiang Mai–Krabi » de la page officielle restent dans le
 * texte des conditions, et cette GARDE surveille la dette : le jour où l'un de ces aéroports entre dans le
 * référentiel, une règle citée `rule_bangkok_airways_cargo_krabi_excluded` doit exister d'abord — sinon le
 * Finder proposerait le fret « sous conditions » sur une liaison que la compagnie exclut.
 *
 * Mesuré le 10/09 avant d'écrire : Thaïlande = airport_bkk, airport_dmk, airport_hkt (268 aéroports au
 * total) ; aucun fait `route.origin_airport_id` dans le moteur ; Bangkok Airways candidate sur BKK ↔ HKT.
 */
import { readFileSync } from "node:fs";
import { regleDecisive } from "./packages/knowledge/src/preuve.ts";

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => { console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`)); cond ? pass++ : fail++; };

const objects = JSON.parse(readFileSync("packages/knowledge/raw/objects.json", "utf8"));
const rules = JSON.parse(readFileSync("packages/knowledge/raw/rules.json", "utf8"));

export const AEROPORTS_EXCLUS_KRABI = ["airport_kbv", "airport_cnx"];
export const REGLE_KRABI = "rule_bangkok_airways_cargo_krabi_excluded";

/** La garde : présence d'un aéroport exclu sans règle citée → écart(s) nommé(s). */
export function gardeKrabi(objs, rgls) {
  const presents = AEROPORTS_EXCLUS_KRABI.filter((id) => (objs.airports ?? []).some((a) => a.id === id));
  if (presents.length === 0) return [];
  const regle = (rgls ?? []).find((r) => r.id === REGLE_KRABI);
  if (!regle) return presents.map((id) => `${id} est dans le référentiel, et ${REGLE_KRABI} n'existe pas`);
  if (!regleDecisive(regle)) return presents.map((id) => `${id} est dans le référentiel, et ${REGLE_KRABI} n'est pas citée (non décisive)`);
  return [];
}

console.log("=== 1. La garde Krabi : la dette est bornée et surveillée ===");
{
  const th = objects.airports.filter((a) => a.country_id === "country_th").map((a) => a.id).sort();
  check("état mesuré : la Thaïlande du référentiel est exactement BKK, DMK, HKT", th.join() === "airport_bkk,airport_dmk,airport_hkt", th.join());
  check("ni Krabi ni Chiang Mai dans le référentiel — la garde est silencieuse", gardeKrabi(objects, rules).length === 0);
  check("la règle Krabi n'existe pas encore : dette OUVERTE, nommée", !rules.some((r) => r.id === REGLE_KRABI));

  /* AUTO-CONTRÔLE : la garde mord sur un référentiel synthétique. */
  const avecKrabi = { airports: [...objects.airports, { id: "airport_kbv", iata: "KBV", country_id: "country_th" }] };
  const e1 = gardeKrabi(avecKrabi, rules);
  check("Krabi ajouté sans règle → 1 écart nommé", e1.length === 1 && /airport_kbv/.test(e1[0]) && /n'existe pas/.test(e1[0]), e1.join(" | "));
  const nonCitee = { id: REGLE_KRABI, scope: { type: "airline", id: "airline_bangkok_airways" }, applies_when: { all: [] }, effect: { action: "deny", placement: ["cargo"] },
    source: { url: "https://www.bangkokair.com/cargo-service/pet_carriage", source_type: "official_website", verified_date: "2026-09-10", review_due: "2026-12-09", confidence: 4, reviewer: "x", history: [] } };
  const e2 = gardeKrabi(avecKrabi, [...rules, nonCitee]);
  check("Krabi ajouté avec une règle NON citée → 1 écart (non décisive)", e2.length === 1 && /non décisive/.test(e2[0]), e2.join(" | "));
  const citee = { ...nonCitee, source: { ...nonCitee.source, quote: "phrase verbatim de la page, à livrer par Codex", quote_language: "en", locator: "Cargo Service → Pet Carriage Service" } };
  check("Krabi ajouté avec une règle citée → aucun écart", gardeKrabi(avecKrabi, [...rules, citee]).length === 0);
  const avecCnx = { airports: [...objects.airports, { id: "airport_cnx", iata: "CNX", country_id: "country_th" }] };
  check("Chiang Mai seul, sans règle → 1 écart nommé sur airport_cnx", gardeKrabi(avecCnx, rules).length === 1 && /airport_cnx/.test(gardeKrabi(avecCnx, rules)[0]));
}

console.log(`\n=== SUMMARY ===\n${fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`}`);
process.exit(fail ? 1 : 0);
