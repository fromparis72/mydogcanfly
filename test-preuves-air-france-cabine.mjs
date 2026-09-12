#!/usr/bin/env node
/**
 * CONTRE-ÉPREUVES DU COMPLÉMENT AIR FRANCE CABINE — un fait de Codex (10/09/2026), importé.
 *
 *   npx tsx test-preuves-air-france-cabine.mjs
 *
 * MESURÉ AVANT D'ÉCRIRE (10/09/2026) : la politique cabine d'Air France portait un plafond de 8 kg et une
 * source SANS phrase (héritage `objects.json`, cause `official_source_unquoted`) — un chihuahua de 3 kg
 * lisait « à confirmer », et à 9 kg la règle héritée `rule_af_cabin_weight` ajoutait `rule_official_unquoted`.
 * Ce que le complément apporte, et qui est éprouvé ici :
 *   · la phrase française de la page officielle, à l'octet près, avec son localisateur et sa date de lecture ;
 *   · une BORNE STRICTE : « moins de 8 kg, sac de transport compris » — 8,0 kg exactement est HORS de la
 *     phrase (Codex : « ne pas convertir en ≤ 8 kg ») ; 7,9 kg sous conditions, 8 kg refusé ;
 *   · rien d'autre : disponibilité inchangée, aucun tarif prouvé, aucun `allowed` créé, et la règle héritée
 *     non citée ne décide plus rien (le refus au-dessus du seuil vient de la politique citée).
 */
import { readFileSync } from "node:fs";
import { loadKB, reviewDueFrom } from "./packages/knowledge/src/index.ts";
import { evaluate } from "./packages/engine/src/evaluate.ts";
import { FinderRequest } from "./packages/engine/src/contracts.ts";

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};

const DOSSIER = "mesures/preuves/complement-air-france-cabine-2026-09-10";
const lot = JSON.parse(readFileSync(`${DOSSIER}/PREUVES_POLITIQUES_COMPAGNIES_AIR_FRANCE_CABINE_2026-09-10.json`, "utf8"));
const original = JSON.parse(readFileSync(`${DOSSIER}/COMPLEMENT_POLITIQUE_AIR_FRANCE_CABINE_2026-09-10.json`, "utf8"));
const objets = JSON.parse(readFileSync("packages/knowledge/raw/objects.json", "utf8"));
const kb = loadKB();
const f = { verified_date: lot.provenance_defaults.verified_date, ...lot.facts[0] };
const pol = objets.airlines.find((a) => a.id === "airline_air_france")?.premium?.policy?.cabin;
const s = pol?.source ?? {};
const proj = kb.airlines.get("airline_air_france")?.premium?.policy?.cabin;
const MARS = (() => { const n = new Date(), y = n.getUTCFullYear(); return `${Date.UTC(y, n.getUTCMonth(), n.getUTCDate()) <= Date.UTC(y, 2, 15) ? y : y + 1}-03-15`; })();
const chihuahua = (kg) => ({ breed_id: "breed_chihuahua", weight_kg: kg });
const decide = (dog) => evaluate(kb, FinderRequest.parse({ origin: "airport_cdg", destination: "airport_jfk", dog, date: MARS }));
const canal = (dec, pl) => dec.airlines.find((a) => a.airline_id === "airline_air_france")?.placements.find((p) => p.placement === pl);

console.log("=== Étage 1 — le fait de Codex, dans la donnée à l'octet près ===");
{
  check("un seul fait, aucune non-décision ; le fichier au format des lots recopie l'original de Codex sans rien ajouter",
    lot.facts.length === 1 && lot.intentionally_unset.length === 0
      && f.url === original.source.url && f.quote === original.source.quote && f.quote_language === original.source.quote_language
      && f.locator === original.source.locator && f.verified_date === original.verified_date && lot.provenance_defaults.confidence === original.source.confidence);
  check("phrase, URL, localisateur, langue (fr), date de lecture 2026-09-10 — dans la fiche projetée",
    !!pol && s.quote === f.quote && s.locator === f.locator && s.quote_language === "fr" && s.url === f.url && s.verified_date === "2026-09-10",
    JSON.stringify({ attendu: f.quote, lu: s.quote }));
  check("review_due calculé par reviewDueFrom (2026-12-09), égal à celui que Codex annonce — jamais recopié",
    s.review_due === reviewDueFrom("2026-09-10", "airline") && s.review_due === "2026-12-09" && original.review_due === s.review_due, `${s.verified_date} → ${s.review_due}`);
  check("confiance 4, relecteur nommé, historique vide", s.confidence === 4 && /Codex/.test(s.reviewer ?? "") && Array.isArray(s.history) && s.history.length === 0);
  check("plafond 8 kg, chien + sac (contenant compris), BORNE STRICTE `lt` — tels que Codex les a lus",
    pol?.max_weight_kg === 8 && pol?.weight_includes_carrier === true && pol?.weight_limit_bound === "lt"
      && original.max_weight_kg === 8 && original.weight_includes_carrier === true && original.weight_limit_bound === "lt",
    JSON.stringify({ max: pol?.max_weight_kg, incl: pol?.weight_includes_carrier, bound: pol?.weight_limit_bound }));
  check("projeté `accepted_with_conditions` (jamais `allowed`), disponibilité `offered` inchangée",
    proj?.status === "accepted_with_conditions" && pol?.availability === "offered" && original.target_status === proj?.status, JSON.stringify({ status: proj?.status, cause: proj?.status_cause }));
  check("aucun tarif n'est prouvé par ce complément (`fare_proven: false`) — la phrase citée ne porte aucun montant",
    original.fare_proven === false && !/\d/.test(f.quote.replace("8 kg", "")));
  let allowed = 0, citees = 0, politiques = 0;
  for (const a of objets.airlines) for (const p of Object.values(a.premium?.policy ?? {})) { politiques++; if (p.source?.quote && p.source?.locator && p.source?.quote_language) citees++; }
  for (const a of kb.airlines.values()) for (const p of Object.values(a.premium?.policy ?? {})) if (p.status === "allowed") allowed++;
  check("aucune politique réelle n'est `allowed`", allowed === 0, String(allowed));
  /* MOUVEMENT NOMMÉ (10/09/2026, complément Air France cabine) : 178 → 179 politiques citées sur 302. */
  /* MOUVEMENT NOMMÉ (10/09/2026, plus tard — retrait de la preuve Saudia, surface de test) : 179 → 177. Air France cabine
     reste citée : ce témoin le vérifie nominativement juste au-dessus, le compte global bouge pour une autre raison. */
  /* MOUVEMENT NOMMÉ (12/09/2026, SAS soute) : 177 → 178 politiques citées. */
  /* MOUVEMENT NOMMÉ (12/09/2026, lot de 30 compagnies) : 178 → 189. */
  check("189 politiques citées sur 302 — Air France cabine et SAS soute en font partie", citees === 189 && politiques === 302, `${citees} / ${politiques}`);
}

console.log("\n=== Étage 2 — Paris CDG → New York JFK, chihuahua de 3 kg, 7,9 kg, 8 kg, 9 kg ; Golden 32 kg ===");
{
  const c3 = canal(decide(chihuahua(3)), "cabin");
  check("chihuahua 3 kg : cabine SOUS CONDITIONS, plafond 8 kg chien + sac, borne stricte, source citée — plus « à confirmer »",
    c3?.status === "accepted_with_conditions" && c3?.weight_limit_kg === 8 && c3?.weight_limit_includes_carrier === true && c3?.weight_limit_bound === "lt" && c3?.source?.url === f.url && !(c3?.confirmation_causes ?? []).length, JSON.stringify(c3));
  const c79 = canal(decide(chihuahua(7.9)), "cabin");
  check("chihuahua 7,9 kg : sous conditions (sous la borne)", c79?.status === "accepted_with_conditions" && c79?.weight_limit_kg === 8, JSON.stringify(c79));
  const c8 = canal(decide(chihuahua(8)), "cabin");
  check("chihuahua 8,0 kg exactement : REFUSÉ — « moins de 8 kg » exclut la valeur, jamais converti en ≤ 8 kg", c8?.status === "denied" && c8?.source?.url === f.url, JSON.stringify(c8));
  const c9 = canal(decide(chihuahua(9)), "cabin");
  check("chihuahua 9 kg : refusé sur la politique citée ; la règle héritée non citée `rule_af_cabin_weight` n'ajoute plus aucune cause « à confirmer »",
    c9?.status === "denied" && !(c9?.confirmation_causes ?? []).some((x) => x.rule_id === "rule_af_cabin_weight"), JSON.stringify(c9));
  const g = decide({ breed_id: "breed_golden_retriever", weight_kg: 32 });
  check("Golden 32 kg : cabine refusée, soute sous conditions à 75 kg (import V3, inchangé)",
    canal(g, "cabin")?.status === "denied" && canal(g, "hold")?.status === "accepted_with_conditions" && canal(g, "hold")?.weight_limit_kg === 75, JSON.stringify({ cabin: canal(g, "cabin")?.status, hold: canal(g, "hold") }));
}

console.log(`\n=== SUMMARY ===\n${fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`}`);
process.exit(fail === 0 ? 0 : 1);
