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
import { loadKB } from "./packages/knowledge/src/index.ts";
import { evaluate } from "./packages/engine/src/evaluate.ts";
import { FinderRequest } from "./packages/engine/src/contracts.ts";

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => { console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`)); cond ? pass++ : fail++; };

const objects = JSON.parse(readFileSync("packages/knowledge/raw/objects.json", "utf8"));
const rules = JSON.parse(readFileSync("packages/knowledge/raw/rules.json", "utf8"));

export const AEROPORTS_EXCLUS_KRABI = ["airport_kbv", "airport_cnx"];
/* RE-FONDÉ le 10/09 (même jour) : Codex a livré la phrase des exclusions, et les règles existent DÉJÀ, citées,
   dormantes — une par paire, dans les deux sens. La garde exige désormais les deux, et non plus une règle à
   créer le jour venu. */
export const R1 = "rule_bangkok_airways_cargo_international_denied";
export const REGLES_KRABI = ["rule_bangkok_airways_cargo_bkk_kbv_excluded", "rule_bangkok_airways_cargo_cnx_kbv_excluded"];

/** La garde : présence d'un aéroport exclu sans les règles Krabi citées → écart(s) nommé(s). */
export function gardeKrabi(objs, rgls) {
  const presents = AEROPORTS_EXCLUS_KRABI.filter((id) => (objs.airports ?? []).some((a) => a.id === id));
  if (presents.length === 0) return [];
  const ecarts = [];
  for (const id of REGLES_KRABI) {
    const regle = (rgls ?? []).find((r) => r.id === id);
    if (!regle) ecarts.push(...presents.map((a) => `${a} est dans le référentiel, et ${id} n'existe pas`));
    else if (!regleDecisive(regle)) ecarts.push(...presents.map((a) => `${a} est dans le référentiel, et ${id} n'est pas citée (non décisive)`));
  }
  return ecarts;
}

console.log("=== 1. La garde Krabi : la dette est bornée et surveillée ===");
{
  const th = objects.airports.filter((a) => a.country_id === "country_th").map((a) => a.id).sort();
  check("état mesuré : la Thaïlande du référentiel est exactement BKK, DMK, HKT", th.join() === "airport_bkk,airport_dmk,airport_hkt", th.join());
  check("ni Krabi ni Chiang Mai dans le référentiel — la garde est silencieuse", gardeKrabi(objects, rules).length === 0);
  const r2r3 = REGLES_KRABI.map((id) => rules.find((r) => r.id === id));
  check("R2 et R3 existent, CITÉES (« Accept all domestic route Except Bangkok – Krabi v.v. and Chiang Mai – Krabi v.v. »), dormantes",
    r2r3.every((r) => r && regleDecisive(r) && r.source.quote === "Accept all domestic route Except Bangkok – Krabi v.v. and Chiang Mai – Krabi v.v."));
  const r1 = rules.find((r) => r.id === R1);
  check("R1 existe, CITÉE (« International Routes: All station: Not Accept »), portée compagnie, effet deny fret",
    !!r1 && regleDecisive(r1) && r1.source.quote === "International Routes: All station: Not Accept" && r1.scope.id === "airline_bangkok_airways" && r1.effect.action === "deny" && r1.effect.placement.join() === "cargo");
  check("les trois règles portent la même source, relue le 10/09, revue due le 09/12 (90 jours), confiance 4",
    [r1, ...r2r3].every((r) => r.source.url === "https://www.bangkokair.com/cargo-service/pet_carriage" && r.source.verified_date === "2026-09-10" && r.source.review_due === "2026-12-09" && r.source.confidence === 4));
  check("Krabi ajouté au référentiel → aucun écart : les règles sont déjà là", gardeKrabi({ airports: [...objects.airports, { id: "airport_kbv", iata: "KBV", country_id: "country_th" }] }, rules).length === 0);

  /* AUTO-CONTRÔLE : la garde mord si, Krabi présent, une règle manque ou n'est plus citée. */
  const avecKrabi = { airports: [...objects.airports, { id: "airport_kbv", iata: "KBV", country_id: "country_th" }] };
  const sansR2 = rules.filter((r) => r.id !== REGLES_KRABI[0]);
  const e1 = gardeKrabi(avecKrabi, sansR2);
  check("Krabi présent et R2 retirée → 1 écart nommé (« n'existe pas »)", e1.length === 1 && /bkk_kbv/.test(e1[0]) && /n'existe pas/.test(e1[0]), e1.join(" | "));
  const r3Muette = rules.map((r) => r.id === REGLES_KRABI[1] ? { ...r, source: { ...r.source, quote: undefined } } : r);
  const e2 = gardeKrabi(avecKrabi, r3Muette);
  check("Krabi présent et R3 décitée → 1 écart (non décisive)", e2.length === 1 && /cnx_kbv/.test(e2[0]) && /non décisive/.test(e2[0]), e2.join(" | "));
  const avecCnx = { airports: [...objects.airports, { id: "airport_cnx", iata: "CNX", country_id: "country_th" }] };
  check("Chiang Mai présent, R2 et R3 retirées → 2 écarts nommés sur airport_cnx", gardeKrabi(avecCnx, rules.filter((r) => !REGLES_KRABI.includes(r.id))).length === 2);
}

console.log("\n=== 2. Le moteur : réseau intérieur sous conditions, international refusé, règle non citée muette ===");
{
  const kb = loadKB();
  const JUILLET = (() => { const n = new Date(), y = n.getUTCFullYear(); return `${Date.UTC(y, n.getUTCMonth(), n.getUTCDate()) <= Date.UTC(y, 6, 15) ? y : y + 1}-07-15`; })();
  const GOLDEN = { breed_id: "breed_golden_retriever", weight_kg: 30 };
  const decide = (base, o, d) => evaluate(base, FinderRequest.parse({ origin: o, destination: d, dog: GOLDEN, date: JUILLET }));
  /* ERREUR NOMMÉE (10/09) : la première version cherchait l'identifiant de la règle dans la décision du canal,
     qui ne porte que le statut et la source de la fiche ; les règles tirées vivent dans `fired`, au niveau de la
     compagnie. Six témoins rougissaient sur un moteur juste. */
  const compagnie = (dec) => dec.airlines.find((a) => a.airline_id === "airline_bangkok_airways");
  const canal = (dec, pl = "cargo") => compagnie(dec)?.placements.find((p) => p.placement === pl);
  const tiree = (dec, id) => !!compagnie(dec)?.fired?.some((f) => f.rule_id === id);

  check("fiche fret : `offered`, citée, projetée « sous conditions » (plus « à confirmer »)",
    kb.airlines.get("airline_bangkok_airways")?.premium?.policy?.cargo?.status === "accepted_with_conditions");
  const dom = canal(decide(kb, "airport_bkk", "airport_hkt"));
  check("Bangkok → Phuket (intérieur) : fret SOUS CONDITIONS", dom?.status === "accepted_with_conditions", JSON.stringify(dom));
  const retour = canal(decide(kb, "airport_hkt", "airport_bkk"));
  check("Phuket → Bangkok : sous conditions aussi", retour?.status === "accepted_with_conditions");
  const intl = decide(kb, "airport_bkk", "airport_kti");
  check("Bangkok → Techo (Cambodge, desservi) : fret REFUSÉ par R1, la règle est nommée dans `fired`", canal(intl)?.status === "denied" && tiree(intl, R1), JSON.stringify(canal(intl)));
  const intl2 = decide(kb, "airport_sai", "airport_bkk");
  check("Siem Reap → Bangkok : REFUSÉ par R1 (origine hors Thaïlande)", canal(intl2)?.status === "denied" && tiree(intl2, R1));
  check("Bangkok → Singapour : Bangkok Airways n'est PAS candidate (SIN hors de son graphe) — aucune carte, donc aucune fausse réponse",
    !decide(kb, "airport_bkk", "airport_sin").airlines.some((a) => a.airline_id === "airline_bangkok_airways"));
  check("la cabine et la soute ne bougent pas sur l'international (R1 ne vise que le fret)",
    canal(decide(kb, "airport_bkk", "airport_kti"), "cabin")?.status === canal(decide(kb, "airport_bkk", "airport_hkt"), "cabin")?.status);

  /* TÉMOIN NÉGATIF : R1 sans citation ne refuse rien — le principe du 09/09 (une règle non citée n'est pas décisive). */
  const kbMuet = { ...kb, rules: kb.rules.map((r) => r.id === R1 ? { ...r, source: { ...r.source, quote: undefined, locator: undefined } } : r) };
  const muet = canal(decide(kbMuet, "airport_bkk", "airport_kti"));
  check("R1 DÉCITÉE → Bangkok → Techo n'est plus refusé (à confirmer), jamais un refus par règle non citée", muet?.status === "confirmation_required", JSON.stringify(muet));
  check("…et, citée, R1 est une des règles tirées ; décitée, elle ne l'est plus comme refus", tiree(intl, R1) && !(compagnie(decide(kbMuet, "airport_bkk", "airport_kti"))?.fired ?? []).some((f) => f.rule_id === R1 && f.action === "deny" && f.decisive !== false && canal(decide(kbMuet, "airport_bkk", "airport_kti"))?.status === "denied"));

  /* KRABI SYNTHÉTIQUE : le jour où l'aéroport entrerait, R2 et R3 mordent déjà. */
  const synth = structuredClone(kb);
  const modele = synth.airports.get("airport_hkt");
  for (const [id, iata] of [["airport_kbv", "KBV"], ["airport_cnx", "CNX"]]) synth.airports.set(id, { ...modele, id, iata });
  const bkk = synth.airlines.get("airline_bangkok_airways");
  bkk.served_airport_ids = [...bkk.served_airport_ids, "airport_kbv", "airport_cnx"];
  /* Clés de route TRIÉES (contrat du graphe : « airport_a|airport_b » dans l'ordre) — seconde erreur nommée du
     premier jet, qui écrivait « airport_cnx|airport_bkk ». */
  bkk.direct_routes = [...bkk.direct_routes, "airport_bkk|airport_kbv", "airport_cnx|airport_kbv", "airport_bkk|airport_cnx"];
  const k1 = decide(synth, "airport_bkk", "airport_kbv");
  check("Krabi synthétique — Bangkok → Krabi : REFUSÉ par R2", canal(k1)?.status === "denied" && tiree(k1, REGLES_KRABI[0]), JSON.stringify(canal(k1)));
  const k2 = decide(synth, "airport_kbv", "airport_bkk");
  check("Krabi → Bangkok : REFUSÉ par R2 (v.v.)", canal(k2)?.status === "denied" && tiree(k2, REGLES_KRABI[0]));
  const k3 = decide(synth, "airport_cnx", "airport_kbv");
  check("Chiang Mai → Krabi : REFUSÉ par R3", canal(k3)?.status === "denied" && tiree(k3, REGLES_KRABI[1]));
  check("Chiang Mai → Bangkok (intérieur, hors exclusions) : sous conditions — R2 et R3 ne débordent pas", canal(decide(synth, "airport_cnx", "airport_bkk"))?.status === "accepted_with_conditions");
}

console.log(`\n=== SUMMARY ===\n${fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`}`);
process.exit(fail ? 1 : 0);
