#!/usr/bin/env node
/**
 * CONTRE-ÉPREUVES DU LOT 5 DE L'IMPORT STRICT — 19 faits de Codex (09/09/2026), 18 importés, 1 refusé.
 *
 *   npx tsx test-preuves-lot-5.mjs
 *
 * Même méthode que les lots précédents. Ce que ce lot apporte de NEUF, et qui est éprouvé ici :
 *   · deux citations en CORÉEN (Korean Air), conservées à l'octet près, `quote_language: ko` ;
 *   · trois plafonds combinés écrits (Korean Air cabine 7 et soute 45, Asiana cabine 7) — déviation
 *     argumentée face à la règle 5 de Codex, nommée dans l'importeur : leur portée est générale ;
 *     Virgin Australia 8 (essai intérieur) et Philippine 10 (FurPAL intérieur) ne sont PAS écrits ;
 *   · quatre lignes NON REVÉRIFIÉES réactivées sur citation, toutes en fret (Virgin Australia,
 *     Philippine, Air Mauritius, Garuda) ;
 *   · trois refus cabine pour tout chien (Malaysia, China Eastern, Air Mauritius) ;
 *   · UN FAIT REFUSÉ par l'importeur : Virgin Australia cabine. La fiche dit `case_by_case` —
 *     l'arbitrage du 28/08 (option A-bis) — et l'importeur ne change jamais une disponibilité. La
 *     ligne reste « à confirmer » (airline_approval), ce que Codex demande lui-même (« Virgin
 *     cabine hors de son essai restée conditionnelle »).
 *   · MESURÉ, et nommé comme dette : Philippine cabine citée (FurPAL, vols intérieurs) reste « à
 *     confirmer » même sur un vol intérieur, parce qu'une RÈGLE héritée non citée
 *     (`rule_philippine_cabin_deny`) la ferme. Le moteur nomme la règle ; la citation ne l'efface
 *     pas ; la règle est à relire, hors de ce lot.
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

const DOSSIER = "mesures/preuves/import-strict-lot-5-2026-09-09/PREUVES_POLITIQUES_COMPAGNIES_LOT_5_STRICT_2026-09-09.json";
const d = JSON.parse(readFileSync(DOSSIER, "utf8"));
const faits = d.facts.map((x, i) => ({ index: i, verified_date: d.provenance_defaults.verified_date, ...x }));
const objets = JSON.parse(readFileSync("packages/knowledge/raw/objects.json", "utf8"));
const kb = loadKB();
const JUILLET = (() => { const n = new Date(), y = n.getUTCFullYear(); return `${Date.UTC(y, n.getUTCMonth(), n.getUTCDate()) <= Date.UTC(y, 6, 15) ? y : y + 1}-07-15`; })();
const GOLDEN_32 = { breed_id: "breed_golden_retriever", weight_kg: 32 };
const CAVALIER_6 = { breed_id: "breed_cavalier_king_charles", weight_kg: 6 };
const CARLIN_8 = { breed_id: "breed_pug", weight_kg: 8 };
const BULLY_50 = { breed_id: "breed_american_bully_xl", weight_kg: 50 };
const decide = (o, dst, dog) => evaluate(kb, FinderRequest.parse({ origin: o, destination: dst, dog, date: JUILLET }));
const canal = (dec, id, pl) => dec.airlines.find((a) => a.airline_id === id)?.placements.find((p) => p.placement === pl);
const politique = (id, pl) => objets.airlines.find((a) => a.id === id)?.premium?.policy?.[pl];
const SEUILS = { "airline_korean_air.cabin": [7, true], "airline_korean_air.hold": [45, true], "airline_asiana.cabin": [7, true] };
const REACTIVEES = ["airline_virgin_australia.cargo", "airline_philippine.cargo", "airline_air_mauritius.cargo", "airline_garuda_indonesia.cargo"];
const REFUSE = "airline_virgin_australia.cabin";

console.log("=== Étage 1 — 19 faits relus, 18 dans la donnée à l'octet près, 1 refusé et nommé ===");
{
  check("19 faits relus depuis le dossier, 11 non-décisions déclarées", faits.length === 19 && d.intentionally_unset.length === 11);
  for (const f of faits) {
    const cle = `${f.airline_id}.${f.placement}`;
    const pol = politique(f.airline_id, f.placement);
    const s = pol?.source ?? {};
    const proj = kb.airlines.get(f.airline_id)?.premium?.policy?.[f.placement];
    if (cle === REFUSE) {
      /* La fiche porte déjà, depuis le 28/08, la citation relue par PHILIPPE (« Be a small cat or
         dog, with a combined weight (pet + carrier) of no more than 8kg ») : elle est CONSERVÉE,
         et la phrase de Codex (« Pets in Cabin is available on selected domestic flights… ») n'est
         pas écrite — l'importeur a refusé sur la disponibilité avant même de comparer. */
      check(`${cle} (LOT5[${f.index}]) : REFUSÉ par l'importeur — la fiche garde \`case_by_case\` (arbitrage du 28/08) et la citation de Philippe ; celle de Codex n'est pas écrite`,
        pol?.availability === "case_by_case" && s.quote !== f.quote && s.reviewer?.startsWith("Philippe") && s.verified_date === "2026-08-28",
        JSON.stringify({ availability: pol?.availability, quote: s.quote, reviewer: s.reviewer }));
      check(`  …projeté « à confirmer », cause airline_approval — l'essai intérieur ne devient pas une offre`, proj?.status === "confirmation_required" && proj?.status_cause === "airline_approval", JSON.stringify({ status: proj?.status, cause: proj?.status_cause }));
      continue;
    }
    check(`${cle} (LOT5[${f.index}]) : phrase, URL, localisateur, langue, date de lecture`,
      !!pol && s.quote === f.quote && s.locator === f.locator && s.quote_language === f.quote_language && s.url === f.url && s.verified_date === f.verified_date,
      JSON.stringify({ attendu: f.quote, lu: s.quote }));
    check(`  …review_due calculé par reviewDueFrom (2026-12-08)`, s.review_due === reviewDueFrom(s.verified_date ?? "", "airline") && s.review_due === "2026-12-08", `${s.verified_date} → ${s.review_due}`);
    const attendu = f.recommendation.startsWith("not_offered") ? "denied" : "accepted_with_conditions";
    check(`  …projeté ${attendu}${REACTIVEES.includes(cle) ? " — ligne non revérifiée RÉACTIVÉE sur citation" : ""}`, proj?.status === attendu, JSON.stringify({ status: proj?.status, cause: proj?.status_cause }));
    const seuil = SEUILS[cle];
    if (seuil) check(`  …plafond ${seuil[0]} kg, chien + contenant — écrit tel que la phrase le dit`,
      proj?.max_weight_kg === seuil[0] && proj?.weight_includes_carrier === seuil[1], JSON.stringify({ max: proj?.max_weight_kg, incl: proj?.weight_includes_carrier }));
    else check(`  …aucun plafond écrit (la phrase n'en porte pas, ou sa portée est une route)`, pol?.weight_includes_carrier === undefined, JSON.stringify({ max: pol?.max_weight_kg, incl: pol?.weight_includes_carrier }));
  }
  for (const u of d.intentionally_unset) {
    const pol = politique(u.airline_id, u.placement);
    check(`non-décision ${u.airline_id}.${u.placement} : aucune citation écrite, « à confirmer »`,
      !pol?.source?.quote && kb.airlines.get(u.airline_id)?.premium?.policy?.[u.placement]?.status === "confirmation_required",
      JSON.stringify({ quote: pol?.source?.quote, status: kb.airlines.get(u.airline_id)?.premium?.policy?.[u.placement]?.status }));
  }
  const ko = politique("airline_korean_air", "cabin")?.source, koH = politique("airline_korean_air", "hold")?.source;
  check("Korean Air : les deux citations sont en coréen, à l'octet près, `quote_language: ko` — jamais traduites",
    ko?.quote === "반려동물과 운송용기 합한 총 무게가 7kg 이하" && ko?.quote_language === "ko" && koH?.quote === "반려동물과 운송용기 합한 총 무게가 45kg 이하" && koH?.quote_language === "ko");
  /* Lu dans les FICHES : un seuil n'existe que s'il y est ÉCRIT depuis une phrase citée. */
  const blocFiche = (slug, pl) => { const l = readFileSync(`content/airlines/${slug}.yml`, "utf8").split("\n"); const i = l.findIndex((x) => new RegExp(`^  ${pl}:\\s*$`).test(x)); const j = l.findIndex((x, k) => k > i && /^  [a-z_]+:\s*$/.test(x)); return l.slice(i + 1, j < 0 ? undefined : j).join("\n"); };
  check("Philippine 10 kg : plafond NON écrit dans la fiche (portée : les vols intérieurs, pas le monde)",
    !/max_weight_kg/.test(blocFiche("philippine", "cabin")));
  /* ERREUR NOMMÉE (09/09/2026) : le harnais des caisses a compté 21 limites cabine « citées » au lieu
     de 20 — la 21e était Philippine, dont le 10 kg n'avait PAS été écrit. L'ingestion le DÉDUISAIT
     de la ligne tarifaire « Cabin (FurPAL, ≤ 10 kg, domestic) », sur un canal désormais cité, et le
     calculateur publiait « ≤ 10 kg » comme limite mondiale. La dérivation tarifaire ne s'applique
     plus à un canal cabine cité (`ingest-airlines.mjs`, derivePolicy). Ces témoins lisent la DONNÉE
     PROJETÉE, pas la fiche : c'est là que la fuite vivait. */
  /* ERREUR NOMMÉE (même jour) : ma première rédaction lisait `objets` (données BRUTES, sans `status`)
     — les deux témoins échouaient sur un statut absent. La projection vit dans `loadKB()`. */
  const projetee = (id, pl) => kb.airlines.get(id)?.premium?.policy?.[pl];
  const phC = projetee("airline_philippine", "cabin");
  check("Philippine cabine PROJETÉE : accepté sous conditions, SANS plafond ni qualification du contenant — la grille tarifaire n'est pas une preuve",
    phC?.status === "accepted_with_conditions" && phC.max_weight_kg === undefined && phC.weight_includes_carrier === undefined, JSON.stringify(phC));
  /* Virgin Australia : ce même retrait de la dérivation faisait tomber le 8 kg que l'arbitrage du
     28/08 (option A-bis, `test-virgin-australia-cabine.mjs`) exige sur la politique. La citation de
     PHILIPPE du 28/08 porte « no more than 8kg » en toutes lettres : le seuil est désormais ÉCRIT dans
     la fiche depuis cette citation-là (pas depuis la phrase de Codex, non écrite). Inerte pour le
     moteur : `case_by_case` → `confirmation_required`, et le refus au seuil n'existe que sur
     « accepté sous conditions ». */
  const vaC = projetee("airline_virgin_australia", "cabin");
  check("Virgin Australia cabine : 8 kg chien + contenant ÉCRIT dans la fiche depuis la citation de Philippe (28/08), pas déduit de la grille tarifaire",
    /max_weight_kg:\s*8/.test(blocFiche("virgin_australia", "cabin")) && /weight_includes_carrier:\s*true/.test(blocFiche("virgin_australia", "cabin"))
      && vaC?.max_weight_kg === 8 && vaC?.weight_includes_carrier === true && vaC?.status === "confirmation_required" && vaC?.source?.verified_date === "2026-08-28", JSON.stringify(vaC));
}

console.log("\n=== Étage 2 — Paris → Séoul : Korean Air et Asiana, plafonds combinés de 7 kg ===");
{
  const g = decide("airport_cdg", "airport_icn", GOLDEN_32), c = decide("airport_cdg", "airport_icn", CAVALIER_6), p = decide("airport_cdg", "airport_icn", CARLIN_8), b = decide("airport_cdg", "airport_icn", BULLY_50);
  const keC = canal(c, "airline_korean_air", "cabin");
  check("Korean Air cabine, Cavalier 6 kg : sous conditions, plafond 7 chien + contenant transporté", keC?.status === "accepted_with_conditions" && keC?.weight_limit_kg === 7 && keC?.weight_limit_includes_carrier === true, JSON.stringify(keC));
  check("Korean Air cabine, Carlin 8 kg : REFUS sûr — 8 kg de chien seul dépassent déjà 7 kg chien + contenant", canal(p, "airline_korean_air", "cabin")?.status === "denied", JSON.stringify(canal(p, "airline_korean_air", "cabin")));
  check("Korean Air cabine, Golden 32 kg : refus sûr ; soute : sous conditions, plafond 45", canal(g, "airline_korean_air", "cabin")?.status === "denied" && canal(g, "airline_korean_air", "hold")?.status === "accepted_with_conditions" && canal(g, "airline_korean_air", "hold")?.weight_limit_kg === 45);
  check("Korean Air soute, Bully 50 kg : REFUS sûr — 50 kg de chien seul dépassent 45 kg chien + contenant", canal(b, "airline_korean_air", "hold")?.status === "denied", JSON.stringify(canal(b, "airline_korean_air", "hold")));
  check("Korean Air fret : volontairement NON décidé → à confirmer", canal(g, "airline_korean_air", "cargo")?.status === "confirmation_required");
  const asC = canal(c, "airline_asiana", "cabin");
  check("Asiana cabine, Cavalier 6 kg : sous conditions, plafond 7 ; Carlin 8 kg et Golden 32 kg : refus sûr",
    asC?.status === "accepted_with_conditions" && asC?.weight_limit_kg === 7 && canal(p, "airline_asiana", "cabin")?.status === "denied" && canal(g, "airline_asiana", "cabin")?.status === "denied");
  check("Asiana soute, Golden 32 kg et Bully 50 kg : sous conditions SANS plafond ; fret non décidé → à confirmer",
    canal(g, "airline_asiana", "hold")?.status === "accepted_with_conditions" && canal(b, "airline_asiana", "hold")?.status === "accepted_with_conditions" && canal(g, "airline_asiana", "hold")?.weight_limit_kg === undefined && canal(g, "airline_asiana", "cargo")?.status === "confirmation_required");
}

console.log("\n=== Étage 2 — Paris → Hô Chi Minh-Ville, Kuala Lumpur, Shanghai, Maurice ===");
{
  const sgnG = decide("airport_cdg", "airport_sgn", GOLDEN_32), sgnC = decide("airport_cdg", "airport_sgn", CAVALIER_6);
  check("Vietnam Airlines cabine, Cavalier 6 kg : sous conditions sans plafond ; Golden 32 kg : à confirmer, jamais refusé ; soute 32 kg : sous conditions",
    canal(sgnC, "airline_vietnam_airlines", "cabin")?.status === "accepted_with_conditions" && canal(sgnG, "airline_vietnam_airlines", "cabin")?.status === "confirmation_required" && canal(sgnG, "airline_vietnam_airlines", "hold")?.status === "accepted_with_conditions");
  for (const [o, dst, id, nom] of [["airport_cdg", "airport_kul", "airline_malaysia_airlines", "Malaysia Airlines"], ["airport_cdg", "airport_pvg", "airline_china_eastern", "China Eastern"], ["airport_cdg", "airport_mru", "airline_air_mauritius", "Air Mauritius"]]) {
    const g = decide(o, dst, GOLDEN_32), c = decide(o, dst, CAVALIER_6), p = decide(o, dst, CARLIN_8);
    check(`${nom} cabine : refusée sur citation pour TOUT chien de compagnie (Golden, Cavalier 6 kg, Carlin 8 kg)`,
      [g, c, p].every((x) => canal(x, id, "cabin")?.status === "denied"), JSON.stringify([g, c, p].map((x) => canal(x, id, "cabin")?.status)));
    check(`${nom} soute, Golden 32 kg : sous conditions (« cargo compartment » / « cargo cabin » = la soute accompagnée, pas le fret)`,
      canal(g, id, "hold")?.status === "accepted_with_conditions", JSON.stringify(canal(g, id, "hold")));
  }
  const mru = decide("airport_cdg", "airport_mru", GOLDEN_32);
  check("Air Mauritius fret, Golden 32 kg : RÉACTIVÉ sur citation → sous conditions (« contactez Cargo » n'est jamais « fret accepté »)", canal(mru, "airline_air_mauritius", "cargo")?.status === "accepted_with_conditions");
  check("Malaysia et China Eastern fret : volontairement NON décidés → à confirmer",
    canal(decide("airport_cdg", "airport_kul", GOLDEN_32), "airline_malaysia_airlines", "cargo")?.status === "confirmation_required" && canal(decide("airport_cdg", "airport_pvg", GOLDEN_32), "airline_china_eastern", "cargo")?.status === "confirmation_required");
}

console.log("\n=== Étage 2 — Londres → Taipei, Sydney → Manille, Singapour → Jakarta, Sydney → Melbourne ===");
{
  const tpe = decide("airport_lhr", "airport_tpe", GOLDEN_32);
  check("China Airlines soute (AVIH bagage enregistré), Golden 32 kg : sous conditions ; cabine et fret volontairement NON décidés → à confirmer",
    canal(tpe, "airline_china_airlines", "hold")?.status === "accepted_with_conditions" && canal(tpe, "airline_china_airlines", "cabin")?.status === "confirmation_required" && canal(tpe, "airline_china_airlines", "cargo")?.status === "confirmation_required");
  const mnl = decide("airport_syd", "airport_mnl", GOLDEN_32), ceb = decide("airport_mnl", "airport_ceb", CAVALIER_6);
  check("Philippine fret (AVIH), Golden 32 kg : RÉACTIVÉ sur citation → sous conditions ; soute volontairement NON décidée → à confirmer",
    canal(mnl, "airline_philippine", "cargo")?.status === "accepted_with_conditions" && canal(mnl, "airline_philippine", "hold")?.status === "confirmation_required");
  /* MESURÉ : la cabine FurPAL est citée (vols intérieurs), mais une règle héritée non citée la
     ferme (`rule_philippine_cabin_deny`) : le moteur garde « à confirmer » et nomme la règle,
     même sur Manille → Cebu. Dette nommée : cette règle contredit la citation, elle est à relire. */
  const pc = canal(ceb, "airline_philippine", "cabin");
  check("Philippine cabine, Cavalier 6 kg sur Manille → Cebu : citée, mais fermée par une règle héritée non citée → à confirmer, la règle NOMMÉE (jamais un oui, jamais un refus prouvé)",
    pc?.status === "confirmation_required" && (pc?.confirmation_causes ?? []).some((x) => x.rule_id === "rule_philippine_cabin_deny"), JSON.stringify(pc));
  const cgk = decide("airport_sin", "airport_cgk", GOLDEN_32);
  check("Garuda fret (CargoWeb), Golden 32 kg : RÉACTIVÉ sur citation → sous conditions ; cabine et soute restent non revérifiées → à confirmer (cause legacy_unreviewed)",
    canal(cgk, "airline_garuda_indonesia", "cargo")?.status === "accepted_with_conditions" && canal(cgk, "airline_garuda_indonesia", "cabin")?.status === "confirmation_required" && canal(cgk, "airline_garuda_indonesia", "hold")?.status === "confirmation_required");
  const mel = decide("airport_syd", "airport_mel", GOLDEN_32), melC = decide("airport_syd", "airport_mel", CAVALIER_6);
  check("Virgin Australia cabine, Cavalier 6 kg sur Sydney → Melbourne : « à confirmer » (case_by_case, fait refusé) — l'essai intérieur ne devient pas une offre",
    canal(melC, "airline_virgin_australia", "cabin")?.status === "confirmation_required", JSON.stringify(canal(melC, "airline_virgin_australia", "cabin")));
  check("Virgin Australia fret, Golden 32 kg : RÉACTIVÉ sur citation → sous conditions ; soute volontairement NON décidée → à confirmer",
    canal(mel, "airline_virgin_australia", "cargo")?.status === "accepted_with_conditions" && canal(mel, "airline_virgin_australia", "hold")?.status === "confirmation_required");
}

console.log("\n=== Ce que l'import n'a PAS fait ===");
{
  let allowed = 0;
  for (const a of kb.airlines.values()) for (const p of Object.values(a.premium?.policy ?? {})) if (p.status === "allowed") allowed++;
  check("aucune politique réelle n'est `allowed`", allowed === 0, String(allowed));
  check("Virgin Australia cabine n'a PAS été basculée à la main : `case_by_case` intact", politique("airline_virgin_australia", "cabin")?.availability === "case_by_case");
}

console.log(`\n=== SUMMARY ===\n${fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`}`);
process.exit(fail ? 1 : 0);
