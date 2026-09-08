#!/usr/bin/env node
/**
 * CONTRE-ÉPREUVES DES LOTS 2 ET 3 DE L'IMPORT STRICT — 24 faits de Codex (08/09/2026).
 *
 *   npx tsx test-preuves-lots-2-3.mjs
 *
 * Même méthode que `test-preuves-v3.mjs` : étage 1, chaque fait relu depuis son dossier est dans
 * la donnée à l'octet près, avec sa révision calculée ; étage 2, le moteur sur des trajets réels.
 * Ce que ces deux lots apportent de NEUF, et qui est éprouvé ici :
 *   · trois lignes NON REVÉRIFIÉES réactivées sur citation (Cathay Pacific, Air India, Ethiopian
 *     fret) — la seule situation où l'importeur écrit une disponibilité ;
 *   · un plafond du CHIEN SEUL (Air Europa cabine, `weight_includes_carrier: false`) : refus sûr
 *     au-dessus, et la décision dit que le contenant s'ajoute ;
 *   · des plafonds de SOUTE cités (Avianca 70 kg, Ethiopian 45 kg, chien + contenant) : un chien
 *     de 50 kg est refusé en soute chez Ethiopian, accepté sous conditions chez Avianca ;
 *   · l'outil Destinations compte le quatrième état comme ouvert (Addis-Abeba ne disparaît plus).
 */
import { readFileSync } from "node:fs";
import { loadKB, reviewDueFrom } from "./packages/knowledge/src/index.ts";
import { evaluate } from "./packages/engine/src/evaluate.ts";
import { explain } from "./packages/engine/src/explain.ts";
import { rankDestinations } from "./packages/engine/src/destinations.ts";
import { FinderRequest } from "./packages/engine/src/contracts.ts";

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};

const LOTS = [
  ["lot2", "mesures/preuves/import-strict-lot-2-2026-09-08/PREUVES_POLITIQUES_COMPAGNIES_LOT_2_STRICT_2026-09-08.json"],
  ["lot3", "mesures/preuves/import-strict-lot-3-2026-09-08/PREUVES_POLITIQUES_COMPAGNIES_LOT_3_STRICT_2026-09-08.json"],
];
const faits = [];
for (const [lot, f] of LOTS) {
  const d = JSON.parse(readFileSync(f, "utf8"));
  d.facts.forEach((x, i) => faits.push({ lot, index: i, verified_date: d.provenance_defaults.verified_date, ...x }));
}
const objets = JSON.parse(readFileSync("packages/knowledge/raw/objects.json", "utf8"));
const kb = loadKB();
const JUILLET = (() => { const n = new Date(), y = n.getUTCFullYear(); return `${Date.UTC(y, n.getUTCMonth(), n.getUTCDate()) <= Date.UTC(y, 6, 15) ? y : y + 1}-07-15`; })();
const GOLDEN_32 = { breed_id: "breed_golden_retriever", weight_kg: 32 };
const BULLY_50 = { breed_id: "breed_american_bully_xl", weight_kg: 50 };
const CAVALIER_6 = { breed_id: "breed_cavalier_king_charles", weight_kg: 6 };
const NEUF = { breed_id: "breed_cavalier_king_charles", weight_kg: 9 };
const decide = (o, d, dog) => evaluate(kb, FinderRequest.parse({ origin: o, destination: d, dog, date: JUILLET }));
const canal = (dec, id, pl) => dec.airlines.find((a) => a.airline_id === id)?.placements.find((p) => p.placement === pl);
/* Seuils attendus, TELS QUE la phrase citée les porte (jamais depuis `condition_scope`). */
const SEUILS = { "airline_air_transat.cabin": [8, true], "airline_air_europa.cabin": [8, false], "airline_air_india.cabin": [10, true],
  "airline_avianca.cabin": [10, true], "airline_avianca.hold": [70, true], "airline_ethiopian.cabin": [8, true], "airline_ethiopian.hold": [45, true], "airline_etihad.cabin": [8, true] };
const REACTIVEES = ["airline_cathay_pacific.cargo", "airline_air_india.cargo", "airline_ethiopian.cargo"];

console.log("=== Étage 1 — 24 faits dans la donnée, à l'octet près ===");
{
  check("24 faits relus depuis les deux dossiers", faits.length === 24);
  for (const f of faits) {
    const cle = `${f.airline_id}.${f.placement}`;
    const pol = objets.airlines.find((a) => a.id === f.airline_id)?.premium?.policy?.[f.placement];
    const s = pol?.source ?? {};
    check(`${cle} (${f.lot}[${f.index}]) : phrase, URL, localisateur, langue, date de lecture`,
      !!pol && s.quote === f.quote && s.locator === f.locator && s.quote_language === f.quote_language && s.url === f.url && s.verified_date === f.verified_date,
      JSON.stringify({ attendu: f.quote, lu: s.quote }));
    check(`  …review_due calculé par reviewDueFrom`, s.review_due === reviewDueFrom(s.verified_date ?? "", "airline"), `${s.verified_date} → ${s.review_due}`);
    const proj = kb.airlines.get(f.airline_id)?.premium?.policy?.[f.placement];
    const attendu = f.recommendation.startsWith("not_offered") ? "denied" : "accepted_with_conditions";
    check(`  …projeté ${attendu}${REACTIVEES.includes(cle) ? " — ligne non revérifiée RÉACTIVÉE sur citation" : ""}`, proj?.status === attendu, JSON.stringify({ status: proj?.status, cause: proj?.status_cause }));
    const seuil = SEUILS[cle];
    if (seuil) check(`  …plafond ${seuil[0]} kg, ${seuil[1] ? "chien + contenant" : "CHIEN SEUL"} — écrit tel que la phrase le dit`,
      proj?.max_weight_kg === seuil[0] && proj?.weight_includes_carrier === seuil[1], JSON.stringify({ max: proj?.max_weight_kg, incl: proj?.weight_includes_carrier }));
    else check(`  …aucun plafond écrit (la phrase n'en porte pas, ou pas pour ce canal)`, proj?.weight_includes_carrier === undefined || pol?.weight_includes_carrier === undefined, JSON.stringify({ max: proj?.max_weight_kg, incl: proj?.weight_includes_carrier }));
  }
  check("Air India soute : le seuil de 32 kg (phrase du FRET) n'est PAS écrit sur la soute", kb.airlines.get("airline_air_india")?.premium?.policy?.hold?.weight_includes_carrier === undefined);
}

console.log("\n=== Étage 2 — Madrid → Bogotá : Air Europa (chien seul), Avianca (70 kg soute) ===");
{
  const g = decide("airport_mad", "airport_bog", GOLDEN_32), c = decide("airport_mad", "airport_bog", CAVALIER_6), n9 = decide("airport_mad", "airport_bog", NEUF), b = decide("airport_mad", "airport_bog", BULLY_50);
  const aeG = canal(g, "airline_air_europa", "cabin"), aeC = canal(c, "airline_air_europa", "cabin"), ae9 = canal(n9, "airline_air_europa", "cabin");
  check("Air Europa cabine, Golden 32 kg : REFUS sûr — le chien seul dépasse 8 kg", aeG?.status === "denied", JSON.stringify(aeG));
  check("Air Europa cabine, 9 kg : REFUS sûr — plafond du CHIEN SEUL à 8 kg (10 kg avec le sac ne le sauve pas)", ae9?.status === "denied", JSON.stringify(ae9));
  check("Air Europa cabine, Cavalier 6 kg : sous conditions, la décision dit que le contenant s'ajoute",
    aeC?.status === "accepted_with_conditions" && aeC?.weight_limit_kg === 8 && aeC?.weight_limit_includes_carrier === false, JSON.stringify(aeC));
  const avG = canal(g, "airline_avianca", "cabin"), avC = canal(c, "airline_avianca", "cabin");
  check("Avianca cabine, Golden 32 kg : refus sûr (10 kg contenant compris) ; Cavalier 6 kg : sous conditions, plafond 10",
    avG?.status === "denied" && avC?.status === "accepted_with_conditions" && avC?.weight_limit_kg === 10 && avC?.weight_limit_includes_carrier === true, JSON.stringify({ avG, avC }));
  const avH = canal(g, "airline_avianca", "hold"), avHb = canal(b, "airline_avianca", "hold");
  check("Avianca soute, Golden 32 kg et Bully 50 kg : sous conditions, plafond 70 kg chien + contenant transporté",
    avH?.status === "accepted_with_conditions" && avH?.weight_limit_kg === 70 && avHb?.status === "accepted_with_conditions", JSON.stringify({ avH, avHb }));
  /* MESURÉ : la politique citée d'Air Canada cabine n'a pas de plafond ; pour 32 kg, ce sont deux
     RÈGLES de poids non citées (`rule_ac_cabin_weight`, `rule_global_cabin_weight_cap`) qui
     demandent confirmation. Jamais un refus inventé ; pour un petit chien, sous conditions. */
  const acG = canal(g, "airline_air_canada", "cabin"), acC = canal(c, "airline_air_canada", "cabin");
  check("Air Canada cabine (citée sans plafond chiffré), Golden 32 kg : JAMAIS un refus inventé par le poids — à confirmer, règles de poids non citées nommées",
    acG?.status === "confirmation_required" && (acG?.confirmation_causes ?? []).some((x) => x.rule_id === "rule_ac_cabin_weight"), JSON.stringify(acG));
  check("Air Canada cabine, Cavalier 6 kg : sous conditions SANS plafond transporté", acC?.status === "accepted_with_conditions" && acC?.weight_limit_kg === undefined, JSON.stringify(acC));
  const rep = explain(c, "fr");
  const carteAE = rep.airlines.find((a) => a.airline_id === "airline_air_europa");
  check("la carte Air Europa (Cavalier) porte la décision cabine avec `weight_limit_includes_carrier: false`",
    carteAE?.placement_decisions?.some((d) => d.placement === "cabin" && d.weight_limit_includes_carrier === false), JSON.stringify(carteAE?.placement_decisions));
}

console.log("\n=== Étage 2 — Paris → Addis-Abeba : Ethiopian (8 / 45 / fret réactivé) et l'outil Destinations ===");
{
  const g = decide("airport_cdg", "airport_add", GOLDEN_32), b = decide("airport_cdg", "airport_add", BULLY_50), c = decide("airport_cdg", "airport_add", CAVALIER_6);
  check("Ethiopian cabine, Golden 32 kg : refus sûr (8 kg contenant compris)", canal(g, "airline_ethiopian", "cabin")?.status === "denied");
  check("Ethiopian soute, Golden 32 kg : sous conditions, plafond 45 kg chien + contenant", canal(g, "airline_ethiopian", "hold")?.status === "accepted_with_conditions" && canal(g, "airline_ethiopian", "hold")?.weight_limit_kg === 45);
  check("Ethiopian soute, Bully 50 kg : REFUS sûr — 50 kg de chien seul dépassent 45 kg chien + contenant", canal(b, "airline_ethiopian", "hold")?.status === "denied", JSON.stringify(canal(b, "airline_ethiopian", "hold")));
  check("Ethiopian fret, Bully 50 kg : RÉACTIVÉ sur citation → sous conditions (jamais « fret accepté »)", canal(b, "airline_ethiopian", "cargo")?.status === "accepted_with_conditions");
  check("Ethiopian cabine, Cavalier 6 kg : sous conditions, plafond 8", canal(c, "airline_ethiopian", "cabin")?.status === "accepted_with_conditions" && canal(c, "airline_ethiopian", "cabin")?.weight_limit_kg === 8);
  check("Etihad cabine, Golden 32 kg refusé ; Cavalier 6 kg sous conditions (8 kg contenant compris)",
    canal(g, "airline_etihad", "cabin")?.status === "denied" && canal(c, "airline_etihad", "cabin")?.status === "accepted_with_conditions");
  check("Etihad soute et fret : volontairement NON décidés → à confirmer, pas un oui hérité",
    canal(g, "airline_etihad", "hold")?.status === "confirmation_required" && canal(g, "airline_etihad", "cargo")?.status === "confirmation_required");
  /* L'outil Destinations : Addis-Abeba est restée dans la liste pour le Bully de 50 kg — c'est le
     compteur de `test-frontiere-confiance` (139 destinations) qui a révélé sa disparition. */
  const dest = rankDestinations(kb, { origin: "airport_cdg", dog: BULLY_50, locale: "fr" });
  const add = dest.matches.find((m) => m.airport_id === "airport_add");
  check("Destinations, Bully 50 kg depuis Paris : Addis-Abeba est PRÉSENTE (fret Ethiopian sous conditions)", !!add, `${dest.matches.length} destinations`);
  check("…ouverte SOUS CONDITIONS seulement : placement_ok ET placement_conditional, fret ouvert, cabine et soute refusées",
    add?.placement_ok === true && add?.placement_conditional === true && add?.cargo_status === "accepted_with_conditions" && add?.cabin_ok === false, JSON.stringify(add && { cabin: add.cabin_status, hold: add.hold_status, cargo: add.cargo_status, ok: add.placement_ok, cond: add.placement_conditional }));
  check("Destinations : AUCUNE destination n'est « ok » sans être conditionnelle (aucun `allowed` n'existe)",
    dest.matches.every((m) => !m.placement_ok || m.placement_conditional));
}

console.log("\n=== Étage 2 — Paris → Tokyo et Londres → Hong Kong : ANA, JAL, Cathay, EVA Air, Air India ===");
{
  const nrt = decide("airport_cdg", "airport_nrt", GOLDEN_32), nrtC = decide("airport_cdg", "airport_nrt", CAVALIER_6);
  check("ANA cabine : refusée sur citation (ligne de tableau « Mammals | ○ | × »), pour tout chien", canal(nrt, "airline_ana", "cabin")?.status === "denied" && canal(nrtC, "airline_ana", "cabin")?.status === "denied");
  check("ANA soute, Golden 32 kg : sous conditions", canal(nrt, "airline_ana", "hold")?.status === "accepted_with_conditions");
  check("JAL soute : sous conditions ; JAL cabine et fret volontairement NON décidés → à confirmer",
    canal(nrt, "airline_jal", "hold")?.status === "accepted_with_conditions" && canal(nrt, "airline_jal", "cabin")?.status === "confirmation_required" && canal(nrt, "airline_jal", "cargo")?.status === "confirmation_required");
  check("Cathay cabine refusée ; fret RÉACTIVÉ sur citation → sous conditions ; soute à confirmer",
    canal(nrt, "airline_cathay_pacific", "cabin")?.status === "denied" && canal(nrt, "airline_cathay_pacific", "cargo")?.status === "accepted_with_conditions" && canal(nrt, "airline_cathay_pacific", "hold")?.status === "confirmation_required");
  check("EVA Air cabine refusée ; soute sous conditions", canal(nrt, "airline_eva_air", "cabin")?.status === "denied" && canal(nrt, "airline_eva_air", "hold")?.status === "accepted_with_conditions");
  const hkg = decide("airport_lhr", "airport_hkg", GOLDEN_32), hkgC = decide("airport_lhr", "airport_hkg", { breed_id: "breed_cavalier_king_charles", weight_kg: 9 });
  check("Air India cabine, Golden 32 kg : refus sûr (10 kg contenant compris) ; 9 kg : sous conditions, plafond 10",
    canal(hkg, "airline_air_india", "cabin")?.status === "denied" && canal(hkgC, "airline_air_india", "cabin")?.status === "accepted_with_conditions" && canal(hkgC, "airline_air_india", "cabin")?.weight_limit_kg === 10);
  check("Air India soute : sous conditions SANS plafond (32 kg est dans la phrase du fret, pas de la soute) ; fret RÉACTIVÉ → sous conditions",
    canal(hkg, "airline_air_india", "hold")?.status === "accepted_with_conditions" && canal(hkg, "airline_air_india", "hold")?.weight_limit_kg === undefined && canal(hkg, "airline_air_india", "cargo")?.status === "accepted_with_conditions");
}

console.log("\n=== Étage 2 — Paris → Montréal et New York → Los Angeles : Air Transat, Delta, JetBlue ===");
{
  const yul = decide("airport_cdg", "airport_yul", GOLDEN_32), yulC = decide("airport_cdg", "airport_yul", CAVALIER_6);
  check("Air Transat cabine, Golden 32 kg refusé ; Cavalier 6 kg sous conditions (8 kg contenant compris) ; soute sous conditions",
    canal(yul, "airline_air_transat", "cabin")?.status === "denied" && canal(yulC, "airline_air_transat", "cabin")?.status === "accepted_with_conditions" && canal(yul, "airline_air_transat", "hold")?.status === "accepted_with_conditions");
  check("Air Transat fret : volontairement NON décidé → à confirmer", canal(yul, "airline_air_transat", "cargo")?.status === "confirmation_required");
  const lax = decide("airport_jfk", "airport_lax", GOLDEN_32), laxC = decide("airport_jfk", "airport_lax", CAVALIER_6);
  check("Delta cabine, Golden 32 kg : jamais un refus inventé (aucun seuil dans la phrase) — à confirmer par les règles de poids non citées",
    canal(lax, "airline_delta", "cabin")?.status === "confirmation_required", JSON.stringify(canal(lax, "airline_delta", "cabin")));
  check("Delta cabine, Cavalier 6 kg : sous conditions SANS plafond", canal(laxC, "airline_delta", "cabin")?.status === "accepted_with_conditions" && canal(laxC, "airline_delta", "cabin")?.weight_limit_kg === undefined);
  check("Delta soute : volontairement NON décidée → à confirmer", canal(lax, "airline_delta", "hold")?.status === "confirmation_required");
  check("JetBlue cabine, Cavalier 6 kg : sous conditions sans plafond ; Golden 32 kg : à confirmer, jamais refusé ; soute NON décidée → à confirmer",
    canal(laxC, "airline_jetblue", "cabin")?.status === "accepted_with_conditions" && canal(lax, "airline_jetblue", "cabin")?.status === "confirmation_required" && canal(lax, "airline_jetblue", "hold")?.status === "confirmation_required");
}

console.log("\n=== Ce que les lots n'ont PAS fait ===");
{
  let allowed = 0;
  for (const a of kb.airlines.values()) for (const p of Object.values(a.premium?.policy ?? {})) if (p.status === "allowed") allowed++;
  check("aucune politique réelle n'est `allowed`", allowed === 0, String(allowed));
  const unset = [["airline_delta", "hold"], ["airline_jetblue", "hold"], ["airline_air_transat", "cargo"], ["airline_air_europa", "cargo"], ["airline_avianca", "cargo"], ["airline_ana", "cargo"], ["airline_jal", "cabin"], ["airline_jal", "cargo"], ["airline_etihad", "hold"], ["airline_etihad", "cargo"]];
  check("les 10 canaux `intentionally_unset` des deux lots n'ont reçu aucune citation",
    unset.every(([id, pl]) => !(objets.airlines.find((a) => a.id === id)?.premium?.policy?.[pl]?.source?.quote)), JSON.stringify(unset.filter(([id, pl]) => objets.airlines.find((a) => a.id === id)?.premium?.policy?.[pl]?.source?.quote)));
}

console.log(`\n=== SUMMARY ===\n${fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`}`);
process.exit(fail ? 1 : 0);
