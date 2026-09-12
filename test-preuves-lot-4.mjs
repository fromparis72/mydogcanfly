#!/usr/bin/env node
/**
 * CONTRE-ÉPREUVES DU LOT 4 DE L'IMPORT STRICT — 23 faits de Codex (09/09/2026), 22 importés, 1 refusé.
 *
 *   npx tsx test-preuves-lot-4.mjs
 *
 * Même méthode que `test-preuves-lots-2-3.mjs` : étage 1, chaque fait relu depuis son dossier est
 * dans la donnée à l'octet près, avec sa révision calculée ; étage 2, le moteur sur des trajets
 * réels. Ce que ce lot apporte de NEUF, et qui est éprouvé ici :
 *   · trois plafonds cabine de 8 kg chien + contenant (Austrian, SWISS, Brussels) : refus sûr
 *     au-dessus, jamais un oui en dessous ;
 *   · trois refus cabine pour TOUT chien de compagnie (Emirates, Qantas, Aer Lingus) ;
 *   · quatre lignes NON REVÉRIFIÉES réactivées sur citation, dont deux anciens POLICY_STALE
 *     (Qantas soute et fret) et deux lignes du manifeste (Emirates fret, Alaska fret) ;
 *   · ITA Airways cabine citée SANS plafond : 12 kg sur certains vols intérieurs italiens, 8 kg
 *     ailleurs — Codex refuse un seuil mondial, et la donnée n'en porte aucun ;
 *   · UN FAIT REFUSÉ par l'importeur, nommé : Aer Lingus soute. La fiche dit `not_offered` (sans
 *     source) ; la phrase citée dit « carried in the aircraft hold » via un agent animalier. Ce
 *     passage ressemble autant au fret qu'à la soute accompagnée : ce n'est pas une correction
 *     manifeste, c'est un arbitrage de vérité métier (Philippe + Codex). En attendant, la ligne
 *     reste « à confirmer », sans citation — jamais un refus prouvé, jamais un oui.
 */
import { readFileSync } from "node:fs";
import { loadKB, reviewDueFrom } from "./packages/knowledge/src/index.ts";
import { evaluate } from "./packages/engine/src/evaluate.ts";
import { explain } from "./packages/engine/src/explain.ts";
import { FinderRequest } from "./packages/engine/src/contracts.ts";

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};

const DOSSIER = "mesures/preuves/import-strict-lot-4-2026-09-09/PREUVES_POLITIQUES_COMPAGNIES_LOT_4_STRICT_2026-09-09.json";
const d = JSON.parse(readFileSync(DOSSIER, "utf8"));
const faits = d.facts.map((x, i) => ({ index: i, verified_date: d.provenance_defaults.verified_date, ...x }));
const objets = JSON.parse(readFileSync("packages/knowledge/raw/objects.json", "utf8"));
const kb = loadKB();
const JUILLET = (() => { const n = new Date(), y = n.getUTCFullYear(); return `${Date.UTC(y, n.getUTCMonth(), n.getUTCDate()) <= Date.UTC(y, 6, 15) ? y : y + 1}-07-15`; })();
const GOLDEN_32 = { breed_id: "breed_golden_retriever", weight_kg: 32 };
const CAVALIER_6 = { breed_id: "breed_cavalier_king_charles", weight_kg: 6 };
const CARLIN_8 = { breed_id: "breed_pug", weight_kg: 8 };
const decide = (o, dst, dog) => evaluate(kb, FinderRequest.parse({ origin: o, destination: dst, dog, date: JUILLET }));
const canal = (dec, id, pl) => dec.airlines.find((a) => a.airline_id === id)?.placements.find((p) => p.placement === pl);
const politique = (id, pl) => objets.airlines.find((a) => a.id === id)?.premium?.policy?.[pl];
/* Seuils attendus, TELS QUE la phrase citée les porte (jamais depuis `condition_scope`). */
const SEUILS = { "airline_austrian.cabin": [8, true], "airline_swiss.cabin": [8, true], "airline_brussels.cabin": [8, true] };
const REACTIVEES = ["airline_emirates.cargo", "airline_qantas.hold", "airline_qantas.cargo", "airline_alaska.cargo"];
const REFUSE = "airline_aer_lingus.hold";
const ficheAerLingusHoldASource = (() => {
  const l = readFileSync("content/airlines/aer_lingus.yml", "utf8").split("\n");
  const i = l.findIndex((x) => /^  hold:\s*$/.test(x)); const j = l.findIndex((x, k) => k > i && /^  [a-z_]+:\s*$/.test(x));
  return l.slice(i + 1, j < 0 ? undefined : j).some((x) => /^    source:/.test(x));
})();

console.log("=== Étage 1 — 23 faits relus, 22 dans la donnée à l'octet près, 1 refusé et nommé ===");
{
  check("23 faits relus depuis le dossier, 7 non-décisions déclarées", faits.length === 23 && d.intentionally_unset.length === 7);
  for (const f of faits) {
    const cle = `${f.airline_id}.${f.placement}`;
    const pol = politique(f.airline_id, f.placement);
    const s = pol?.source ?? {};
    const proj = kb.airlines.get(f.airline_id)?.premium?.policy?.[f.placement];
    if (cle === REFUSE) {
      /* HISTOIRE : refusé à l'import du lot 4 (la fiche disait `not_offered` sans bloc source), porté à l'arbitrage.
         ARBITRAGE (09/09/2026, Codex, tranché par Philippe — correctif d'arbitrages) : « maintenu » — soute via agent
         animalier sous conditions d'opérateur, d'appareil et de route ; Aer Lingus Regional exclue. La disponibilité a
         été changée À LA MAIN, sur ordre (l'importeur ne la change jamais), puis la phrase écrite par l'importeur du
         correctif — la même phrase que celle du lot 4. */
      check(`${cle} (LOT4[${f.index}]) : ARBITRÉ — \`offered\` sur ordre, phrase, URL, localisateur, langue et date du correctif`,
        pol?.availability === "offered" && ficheAerLingusHoldASource && s.quote === f.quote && s.url === f.url && s.locator === f.locator && s.verified_date === "2026-09-09", JSON.stringify({ availability: pol?.availability, quote: s.quote }));
      check(`  …projeté « accepté sous conditions » — jamais \`allowed\``, proj?.status === "accepted_with_conditions", JSON.stringify({ status: proj?.status, cause: proj?.status_cause }));
      continue;
    }
    if (cle === "airline_brussels.hold") {
      /* MOUVEMENT NOMMÉ (12/09/2026, lot de 30 compagnies) : la preuve anglophone du lot 4
         est remplacée par la page nationale belge en néerlandais, lue le 12/09. */
      check(`${cle} : source nationale belge plus récente, phrase, URL, langue et date`,
        pol?.availability === "offered" && s.url === "https://www.brusselsairlines.com/be/nl/special-care/pets/cats-and-dogs-in-the-hold"
          && s.quote === "Je kat of hond wordt goed verzorgd en reist in een geventileerd deel van het vliegtuigruim."
          && s.quote_language === "nl" && s.verified_date === "2026-09-12", JSON.stringify(s));
      check(`  …review_due calculé par reviewDueFrom (2026-12-11) et projeté sous conditions`,
        s.review_due === reviewDueFrom(s.verified_date ?? "", "airline") && s.review_due === "2026-12-11"
          && proj?.status === "accepted_with_conditions", `${s.verified_date} → ${s.review_due}`);
      continue;
    }
    check(`${cle} (LOT4[${f.index}]) : phrase, URL, localisateur, langue, date de lecture`,
      !!pol && s.quote === f.quote && s.locator === f.locator && s.quote_language === f.quote_language && s.url === f.url && s.verified_date === f.verified_date,
      JSON.stringify({ attendu: f.quote, lu: s.quote }));
    check(`  …review_due calculé par reviewDueFrom (2026-12-08)`, s.review_due === reviewDueFrom(s.verified_date ?? "", "airline") && s.review_due === "2026-12-08", `${s.verified_date} → ${s.review_due}`);
    const attendu = f.recommendation.startsWith("not_offered") ? "denied" : "accepted_with_conditions";
    check(`  …projeté ${attendu}${REACTIVEES.includes(cle) ? " — ligne non revérifiée RÉACTIVÉE sur citation" : ""}`, proj?.status === attendu, JSON.stringify({ status: proj?.status, cause: proj?.status_cause }));
    const seuil = SEUILS[cle];
    if (seuil) check(`  …plafond ${seuil[0]} kg, chien + contenant — écrit tel que la phrase le dit`,
      proj?.max_weight_kg === seuil[0] && proj?.weight_includes_carrier === seuil[1], JSON.stringify({ max: proj?.max_weight_kg, incl: proj?.weight_includes_carrier }));
    else check(`  …aucun plafond écrit (la phrase n'en porte pas, ou Codex l'a refusé)`, pol?.weight_includes_carrier === undefined, JSON.stringify({ max: pol?.max_weight_kg, incl: pol?.weight_includes_carrier }));
  }
  for (const u of d.intentionally_unset) {
    const pol = politique(u.airline_id, u.placement);
    if (u.airline_id === "airline_american" && u.placement === "hold") {
      /* MOUVEMENT NOMMÉ (12/09/2026, lot de 30 compagnies) : American soute est désormais
         refusée pour le voyageur ordinaire sur la phrase officielle réservant le service aux
         militaires et diplomates éligibles. */
      check("American soute quitte la non-décision sur un refus officiel cité",
        !!pol?.source?.quote && kb.airlines.get(u.airline_id)?.premium?.policy?.[u.placement]?.status === "denied");
      continue;
    }
    check(`non-décision ${u.airline_id}.${u.placement} : aucune citation écrite, jamais convertie en oui ou en refus`,
      !pol?.source?.quote && kb.airlines.get(u.airline_id)?.premium?.policy?.[u.placement]?.status === "confirmation_required",
      JSON.stringify({ quote: pol?.source?.quote, status: kb.airlines.get(u.airline_id)?.premium?.policy?.[u.placement]?.status }));
  }
  check("ITA Airways cabine : citée SANS plafond — aucun seuil mondial n'est écrit (12 kg domestique / 8 kg ailleurs)",
    politique("airline_ita_airways", "cabin")?.max_weight_kg === undefined && politique("airline_ita_airways", "cabin")?.weight_includes_carrier === undefined);
  check("Emirates soute et fret portent la MÊME phrase (« either as cargo or as checked baggage in the hold ») : deux voies conditionnelles, jamais deux réservations ouvertes",
    politique("airline_emirates", "hold")?.source?.quote === politique("airline_emirates", "cargo")?.source?.quote);
}

console.log("\n=== Étage 2 — Paris → Vienne, Zurich, Bruxelles : trois plafonds de 8 kg chien + contenant ===");
{
  const vieG = decide("airport_cdg", "airport_vie", GOLDEN_32), vieC = decide("airport_cdg", "airport_vie", CAVALIER_6);
  check("Austrian cabine, Golden 32 kg : REFUS sûr (8 kg chien + contenant) ; soute : sous conditions",
    canal(vieG, "airline_austrian", "cabin")?.status === "denied" && canal(vieG, "airline_austrian", "hold")?.status === "accepted_with_conditions", JSON.stringify(canal(vieG, "airline_austrian", "cabin")));
  const auC = canal(vieC, "airline_austrian", "cabin");
  check("Austrian cabine, Cavalier 6 kg : sous conditions, plafond 8 chien + contenant transporté — JAMAIS un oui absolu",
    auC?.status === "accepted_with_conditions" && auC?.weight_limit_kg === 8 && auC?.weight_limit_includes_carrier === true, JSON.stringify(auC));
  check("Austrian fret : volontairement NON décidé (« cargo hold » n'est pas le fret) → à confirmer", canal(vieG, "airline_austrian", "cargo")?.status === "confirmation_required");
  const zrhG = decide("airport_cdg", "airport_zrh", GOLDEN_32), zrhC = decide("airport_cdg", "airport_zrh", CAVALIER_6), zrhP = decide("airport_cdg", "airport_zrh", CARLIN_8);
  check("SWISS cabine, Golden 32 kg : refus sûr ; Cavalier 6 kg : sous conditions, plafond 8",
    canal(zrhG, "airline_swiss", "cabin")?.status === "denied" && canal(zrhC, "airline_swiss", "cabin")?.status === "accepted_with_conditions" && canal(zrhC, "airline_swiss", "cabin")?.weight_limit_kg === 8);
  check("SWISS soute, Golden 32 kg : sous conditions", canal(zrhG, "airline_swiss", "hold")?.status === "accepted_with_conditions");
  check("SWISS soute, Carlin 8 kg (brachycéphale, exclu en portée) : JAMAIS accepté",
    !["accepted_with_conditions", "allowed"].includes(canal(zrhP, "airline_swiss", "hold")?.status), JSON.stringify(canal(zrhP, "airline_swiss", "hold")));
  check("SWISS fret : volontairement NON décidé → à confirmer", canal(zrhG, "airline_swiss", "cargo")?.status === "confirmation_required");
  const bruG = decide("airport_cdg", "airport_bru", GOLDEN_32), bruC = decide("airport_cdg", "airport_bru", CAVALIER_6);
  check("Brussels cabine, Golden 32 kg : refus sûr ; Cavalier 6 kg : sous conditions, plafond 8 chien + contenant",
    canal(bruG, "airline_brussels", "cabin")?.status === "denied" && canal(bruC, "airline_brussels", "cabin")?.status === "accepted_with_conditions" && canal(bruC, "airline_brussels", "cabin")?.weight_limit_includes_carrier === true);
  /* MESURÉ : la soute Brussels est citée (sous conditions), mais une RÈGLE de poids non citée
     (`rule_brussels_hold_weight`) demande confirmation pour un Golden de 32 kg. Le moteur garde
     donc « à confirmer » et NOMME la règle : la citation n'efface pas une incertitude qu'elle ne
     couvre pas — et ce n'est jamais un refus inventé. */
  const bruH = canal(bruG, "airline_brussels", "hold");
  check("Brussels soute, Golden 32 kg : citée sous conditions MAIS règle de poids non citée → à confirmer, la règle nommée, jamais un refus",
    bruH?.status === "confirmation_required" && (bruH?.confirmation_causes ?? []).some((x) => x.rule_id === "rule_brussels_hold_weight"), JSON.stringify(bruH));
  check("Brussels fret : volontairement NON décidé (Royaume-Uni seulement) → à confirmer", canal(bruG, "airline_brussels", "cargo")?.status === "confirmation_required");
}

console.log("\n=== Étage 2 — Paris → Dubaï, Londres → Sydney, Paris → Dublin : trois cabines refusées pour tout chien ===");
{
  for (const [o, dst, id, nom] of [["airport_cdg", "airport_dxb", "airline_emirates", "Emirates"], ["airport_lhr", "airport_syd", "airline_qantas", "Qantas"], ["airport_cdg", "airport_dub", "airline_aer_lingus", "Aer Lingus"]]) {
    const g = decide(o, dst, GOLDEN_32), c = decide(o, dst, CAVALIER_6), p = decide(o, dst, CARLIN_8);
    check(`${nom} cabine : refusée sur citation pour TOUT chien de compagnie (Golden, Cavalier 6 kg, Carlin 8 kg)`,
      [g, c, p].every((x) => canal(x, id, "cabin")?.status === "denied"), JSON.stringify([g, c, p].map((x) => canal(x, id, "cabin")?.status)));
  }
  const dxb = decide("airport_cdg", "airport_dxb", GOLDEN_32);
  check("Emirates soute ET fret, Golden 32 kg : sous conditions l'une et l'autre (fret RÉACTIVÉ sur citation) — la compagnie choisit",
    canal(dxb, "airline_emirates", "hold")?.status === "accepted_with_conditions" && canal(dxb, "airline_emirates", "cargo")?.status === "accepted_with_conditions");
  const carteEK = explain(dxb, "fr").airlines.find((a) => a.airline_id === "airline_emirates");
  check("la carte Emirates (fr) dit « sous conditions », jamais « OK » ni « Autorisé »",
    /sous conditions/.test(carteEK?.label ?? "") && !/\bOK\b|Autoris/.test(carteEK?.label ?? ""), carteEK?.label);
  const syd = decide("airport_lhr", "airport_syd", GOLDEN_32);
  check("Qantas soute ET fret, Golden 32 kg : deux anciens POLICY_STALE RÉACTIVÉS sur citation → sous conditions",
    canal(syd, "airline_qantas", "hold")?.status === "accepted_with_conditions" && canal(syd, "airline_qantas", "cargo")?.status === "accepted_with_conditions");
  const dub = decide("airport_cdg", "airport_dub", GOLDEN_32);
  /* HISTOIRE : après l'arbitrage, la règle héritée non citée `rule_aer_lingus_no_hold` gardait encore le canal « à
     confirmer ». RÉCONCILIATION CIBLÉE (Philippe, 09/09/2026, sur décision de Codex) : « une règle historique non
     citée ne peut pas avoir priorité sur une politique officielle plus récente et citée » — la règle est RETIRÉE, ses
     seules restrictions sourcées vivent en conditions. Le verdict cité atteint le Finder. */
  const alH = canal(dub, "airline_aer_lingus", "hold");
  check("Aer Lingus soute (Paris → Dublin), Golden 32 kg : SOUS CONDITIONS dans le Finder — la règle héritée est retirée ; fret non décidé → à confirmer",
    alH?.status === "accepted_with_conditions" && canal(dub, "airline_aer_lingus", "cargo")?.status === "confirmation_required", JSON.stringify(alH));
}

console.log("\n=== Étage 2 — Paris → Rome, New York → Los Angeles, Londres → Los Angeles, Seattle → Los Angeles ===");
{
  const fcoG = decide("airport_cdg", "airport_fco", GOLDEN_32), fcoC = decide("airport_cdg", "airport_fco", CAVALIER_6);
  const itaC = canal(fcoC, "airline_ita_airways", "cabin"), itaG = canal(fcoG, "airline_ita_airways", "cabin");
  check("ITA cabine, Cavalier 6 kg : sous conditions SANS plafond transporté (aucun seuil mondial écrit)", itaC?.status === "accepted_with_conditions" && itaC?.weight_limit_kg === undefined, JSON.stringify(itaC));
  check("ITA cabine, Golden 32 kg : JAMAIS un refus inventé par le poids — à confirmer (règles de poids non citées)", itaG?.status === "confirmation_required", JSON.stringify(itaG));
  check("ITA soute, Golden 32 kg : sous conditions ; fret non décidé → à confirmer",
    canal(fcoG, "airline_ita_airways", "hold")?.status === "accepted_with_conditions" && canal(fcoG, "airline_ita_airways", "cargo")?.status === "confirmation_required");
  const laxG = decide("airport_jfk", "airport_lax", GOLDEN_32), laxC = decide("airport_jfk", "airport_lax", CAVALIER_6);
  check("American cabine, Cavalier 6 kg : sous conditions ; Golden 32 kg : à confirmer, jamais refusé",
    canal(laxC, "airline_american", "cabin")?.status === "accepted_with_conditions" && canal(laxG, "airline_american", "cabin")?.status === "confirmation_required");
  check("American fret (PetEmbark), Golden 32 kg : sous conditions ; soute refusée aux voyageurs ordinaires sur citation",
    canal(laxG, "airline_american", "cargo")?.status === "accepted_with_conditions" && canal(laxG, "airline_american", "hold")?.status === "denied");
  const lhrG = decide("airport_lhr", "airport_lax", GOLDEN_32), lhrC = decide("airport_lhr", "airport_lax", CAVALIER_6);
  check("WestJet soute, Golden 32 kg : sous conditions (« most international flights » — jamais une réponse absolue) ; cabine 32 kg à confirmer",
    canal(lhrG, "airline_westjet", "hold")?.status === "accepted_with_conditions" && canal(lhrG, "airline_westjet", "cabin")?.status === "confirmation_required");
  check("WestJet cabine, Cavalier 6 kg : sous conditions ; fret non décidé → à confirmer",
    canal(lhrC, "airline_westjet", "cabin")?.status === "accepted_with_conditions" && canal(lhrC, "airline_westjet", "cargo")?.status === "confirmation_required", JSON.stringify(canal(lhrC, "airline_westjet", "cabin")));
  const seaG = decide("airport_sea", "airport_lax", GOLDEN_32), seaC = decide("airport_sea", "airport_lax", CAVALIER_6);
  check("Alaska soute et fret (Pet Connect, RÉACTIVÉ), Golden 32 kg : sous conditions ; cabine Cavalier 6 kg : sous conditions",
    canal(seaG, "airline_alaska", "hold")?.status === "accepted_with_conditions" && canal(seaG, "airline_alaska", "cargo")?.status === "accepted_with_conditions" && canal(seaC, "airline_alaska", "cabin")?.status === "accepted_with_conditions");
}

console.log("\n=== Ce que l'import n'a PAS fait ===");
{
  let allowed = 0;
  for (const a of kb.airlines.values()) for (const p of Object.values(a.premium?.policy ?? {})) if (p.status === "allowed") allowed++;
  check("aucune politique réelle n'est `allowed` — « sous conditions » n'est jamais devenu une acceptation catégorique", allowed === 0, String(allowed));
  check("Aer Lingus soute a été basculée SUR ARBITRAGE (Codex 09/09, tranché par Philippe), et le dit dans la fiche",
    politique("airline_aer_lingus", "hold")?.availability === "offered" && /ARBITRAGE \(Codex, 09\/09\/2026/.test(readFileSync("content/airlines/aer_lingus.yml", "utf8")));
}

console.log(`\n=== SUMMARY ===\n${fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`}`);
process.exit(fail ? 1 : 0);
