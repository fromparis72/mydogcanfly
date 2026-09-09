#!/usr/bin/env node
/**
 * CONTRE-ÉPREUVES DE L'IMPORT STRICT V3 — les 26 faits de Codex (08/09/2026), compagnie par compagnie.
 *
 *   npx tsx test-preuves-v3.mjs
 *
 * La notice d'import exige, pour chaque compagnie importée, une contre-épreuve qui traverse
 * « donnée sourcée → premium.policy / décision moteur → texte et source rendus ». Ce harnais
 * couvre les deux premiers étages sur la KB RÉELLE ; le troisième (DOM) vit dans les harnais
 * construits (`test-fiche-harness.cjs`, `test-flightfinder-harness.cjs`, `test-apercu-navigateur.mjs`).
 *
 * ÉTAGE 1 — la donnée. Pour chacun des 26 faits autorisés par le LISEZ_MOI : la politique
 * d'`objects.json` porte EXACTEMENT la phrase, l'URL, le localisateur, la langue et la date de
 * lecture du dossier, et `review_due` est celui que `reviewDueFrom` calcule (jamais recopié).
 * Le dossier est relu ici depuis `mesures/preuves/import-strict-v3-2026-09-08/` : le harnais ne
 * recopie aucune citation.
 *
 * ÉTAGE 2 — le moteur, sur des trajets réels. Ce que la notice demande au minimum :
 *   · un grand chien dépassant SEUL un plafond combiné → refus sûr, motif « poids » ;
 *   · un petit chien qui reste CONDITIONNEL (le poids du contenant manque) → jamais `allowed` ;
 *   · une restriction de race citée en portée (brachycéphale en soute) → jamais un oui ;
 *   · un refus cité (`not_offered`) → `denied`, pour tout chien ;
 *   · Ryanair, trois refus cités → « animaux refusés », jamais une piste.
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

const DOSSIER = "mesures/preuves/import-strict-v3-2026-09-08";
const AUTORISES = { A: [...Array(20).keys()], B: [0, 3], C: [0, 1, 2], F: [1] };
const faits = [];
for (const [coh, idx] of Object.entries(AUTORISES)) {
  const d = JSON.parse(readFileSync(`${DOSSIER}/PREUVES_POLITIQUES_COMPAGNIES_COHORTE_${coh}_2026-09-08.json`, "utf8"));
  for (const i of idx) faits.push({ cohorte: coh, index: i, verified_date: d.provenance_defaults.verified_date, ...d.facts[i] });
}
const objets = JSON.parse(readFileSync("packages/knowledge/raw/objects.json", "utf8"));
const kb = loadKB();
const JUILLET = (() => { const n = new Date(), y = n.getUTCFullYear(); return `${Date.UTC(y, n.getUTCMonth(), n.getUTCDate()) <= Date.UTC(y, 6, 15) ? y : y + 1}-07-15`; })();
const GOLDEN_32 = { breed_id: "breed_golden_retriever", weight_kg: 32 };
const CAVALIER_6 = { breed_id: "breed_cavalier_king_charles", weight_kg: 6 };
const CARLIN_8 = { breed_id: "breed_pug", weight_kg: 8 };
const decide = (o, d, dog) => evaluate(kb, FinderRequest.parse({ origin: o, destination: d, dog, date: JUILLET }));
const canal = (dec, id, pl) => dec.airlines.find((a) => a.airline_id === id)?.placements.find((p) => p.placement === pl);
const carte = (dec, id) => explain(dec, "fr").airlines.find((a) => a.airline_id === id);

console.log("=== Étage 1 — chaque fait autorisé est dans la donnée, à l'octet près, avec sa révision calculée ===");
{
  check("26 faits autorisés relus depuis le dossier", faits.length === 26);
  for (const f of faits) {
    const pol = objets.airlines.find((a) => a.id === f.airline_id)?.premium?.policy?.[f.placement];
    const s = pol?.source ?? {};
    const conserve = f.airline_id === "airline_british_airways";   // preuve du 05/09 conservée, non remplacée
    const memePhrase = s.quote === f.quote && s.locator === f.locator && s.quote_language === f.quote_language && s.url === f.url;
    const dateLecture = conserve ? s.verified_date === "2026-09-05" : s.verified_date === f.verified_date;
    check(`${f.airline_id}.${f.placement} (${f.cohorte}[${f.index}]) : phrase, URL, localisateur, langue${conserve ? " — preuve du 05/09 conservée" : ""}`,
      !!pol && memePhrase && dateLecture, JSON.stringify({ attendu: f.quote, lu: s.quote, url: s.url, loc: s.locator }));
    check(`  …review_due = reviewDueFrom(verified_date, "airline") — calculé, jamais recopié`,
      s.review_due === reviewDueFrom(s.verified_date ?? "", "airline"), `${s.verified_date} → ${s.review_due}`);
    check(`  …source officielle, jamais MyDogCanFly, confiance 4, relecteur nommé`,
      /^https:\/\//.test(s.url ?? "") && !/mydogcanfly/i.test(s.url ?? "") && s.source_type === "official_website" && s.confidence === 4 && /Codex/.test(s.reviewer ?? ""));
    /* Le fait décisif : `offered` → quatrième état, `not_offered` → refus. Jamais `allowed`. */
    const proj = kb.airlines.get(f.airline_id)?.premium?.policy?.[f.placement];
    const attendu = f.recommendation.startsWith("not_offered") ? "denied" : "accepted_with_conditions";
    check(`  …projeté ${attendu}`, proj?.status === attendu, JSON.stringify({ status: proj?.status, cause: proj?.status_cause }));
    const seuil = /^deny_when_dog_weight_kg_gt_(\d+)$/.exec(f.recommendation);
    if (seuil) check(`  …plafond ${seuil[1]} kg chien + contenant écrit sur la politique`,
      proj?.max_weight_kg === Number(seuil[1]) && proj?.weight_includes_carrier === true, JSON.stringify({ max: proj?.max_weight_kg, incl: proj?.weight_includes_carrier }));
  }
}

console.log("\n=== Étage 2 — Paris → Athènes : le grand chien, le petit chien, le brachycéphale ===");
{
  const golden = decide("airport_cdg", "airport_ath", GOLDEN_32);
  const cavalier = decide("airport_cdg", "airport_ath", CAVALIER_6);
  const carlin = decide("airport_cdg", "airport_ath", CARLIN_8);
  for (const id of ["airline_aegean", "airline_klm", "airline_lufthansa", "airline_iberia", "airline_turkish", "airline_sas"]) {
    const g = canal(golden, id, "cabin"), c = canal(cavalier, id, "cabin");
    check(`${id} cabine, Golden 32 kg : REFUS sûr, motif poids (32 > 8 kg chien + contenant)`,
      g?.status === "denied" && (golden.airlines.find((a) => a.airline_id === id)?.deny_reasons ?? []).includes("weight_limit") === (carte(golden, id)?.cabin_status === "denied"),
      JSON.stringify({ status: g?.status, motifs: golden.airlines.find((a) => a.airline_id === id)?.deny_reasons }));
    check(`${id} cabine, Cavalier 6 kg : accepté SOUS CONDITIONS, plafond 8 kg transporté, jamais allowed`,
      c?.status === "accepted_with_conditions" && c?.weight_limit_kg === 8, JSON.stringify(c));
  }
  for (const id of ["airline_aegean", "airline_klm", "airline_lufthansa", "airline_iberia", "airline_turkish"]) {
    const h = canal(golden, id, "hold");
    check(`${id} soute, Golden 32 kg : acceptée sous conditions (citée)`, h?.status === "accepted_with_conditions", JSON.stringify(h));
    const hc = canal(carlin, id, "hold");
    check(`${id} soute, Carlin 8 kg (brachycéphale) : JAMAIS accepté — à confirmer ou refusé, la cause nommée`,
      hc?.status !== "accepted_with_conditions" && hc?.status !== "allowed" && (hc?.status === "denied" || (hc?.confirmation_causes ?? []).length > 0), JSON.stringify(hc));
  }
  const afH = canal(golden, "airline_air_france", "hold");
  check("Air France soute, Golden 32 kg : acceptée sous conditions, plafond 75 kg chien + contenant transporté",
    afH?.status === "accepted_with_conditions" && afH?.weight_limit_kg === 75, JSON.stringify(afH));
  check("Air France cabine, Golden 32 kg : NON importée (pas de phrase cabine dans le dossier) → reste à confirmer, pas un refus inventé",
    canal(golden, "airline_air_france", "cabin")?.status === "confirmation_required");
  const tkH = canal(golden, "airline_turkish", "hold");
  check("Turkish soute : plafond 50 kg chien + contenant transporté", tkH?.weight_limit_kg === 50, JSON.stringify(tkH));
  for (const dog of [["Golden 32", golden], ["Cavalier 6", cavalier]]) {
    check(`easyJet, ${dog[0]} : cabine ET soute refusées sur citation, fret non déduit (à confirmer)`,
      canal(dog[1], "airline_easyjet", "cabin")?.status === "denied" && canal(dog[1], "airline_easyjet", "hold")?.status === "denied" && canal(dog[1], "airline_easyjet", "cargo")?.status === "confirmation_required");
  }
  check("easyJet, libellé : le refus documenté en tête, le fret à confirmer ensuite",
    /refus documenté/.test(carte(golden, "airline_easyjet")?.label ?? "") && /fret/.test(carte(golden, "airline_easyjet")?.label ?? ""), carte(golden, "airline_easyjet")?.label);
  check("Vueling, Golden 32 kg : soute refusée sur citation ; cabine NON importée (fait en attente) → à confirmer",
    canal(golden, "airline_vueling", "hold")?.status === "denied" && canal(golden, "airline_vueling", "cabin")?.status === "confirmation_required");
  check("British Airways cabine : refus du 05/09 intact", canal(golden, "airline_british_airways", "cabin")?.status === "denied");
  const rep = explain(golden, "fr");
  check("verdict Paris → Athènes, Golden 32 kg : « conditional » — jamais « compatible », jamais « unknown »", rep.verdict === "conditional", rep.verdict);
  /* Mesuré : pour le Golden, aucune cabine n'est ouverte, et le « pourquoi » le dit (« la soute
     uniquement ») ; la phrase des modes n'apparaît que quand une cabine est ouverte — c'est le
     Cavalier qui la porte. Dans les deux cas, plus jamais « Ton chien peut voyager ». */
  const repC = explain(cavalier, "fr");
  check("le « pourquoi » (Cavalier, cabine ouverte) dit ce que les compagnies PUBLIENT, sous conditions — jamais « ton chien peut voyager »",
    repC.positives.some((p) => /publient le transport/.test(p.text) && /jamais une place garantie/.test(p.text))
      && ![...rep.positives, ...repC.positives].some((p) => /Ton chien peut voyager/.test(p.text)),
    JSON.stringify(repC.positives.map((p) => p.text)));
}

console.log("\n=== Étage 2 — Paris → Doha : Qatar Airways et Finnair ===");
{
  const golden = decide("airport_cdg", "airport_doh", GOLDEN_32), cavalier = decide("airport_cdg", "airport_doh", CAVALIER_6);
  check("Qatar cabine : refusée sur citation (chien de compagnie), pour tout chien",
    canal(golden, "airline_qatar_airways", "cabin")?.status === "denied" && canal(cavalier, "airline_qatar_airways", "cabin")?.status === "denied");
  check("Qatar soute, Golden 32 kg : acceptée sous conditions (bagage enregistré cité)", canal(golden, "airline_qatar_airways", "hold")?.status === "accepted_with_conditions");
  check("Finnair cabine, Golden 32 kg : refus sûr au seuil 8 kg", canal(golden, "airline_finnair", "cabin")?.status === "denied");
  check("Finnair cabine, Cavalier 6 kg : sous conditions, plafond 8 kg", canal(cavalier, "airline_finnair", "cabin")?.status === "accepted_with_conditions" && canal(cavalier, "airline_finnair", "cabin")?.weight_limit_kg === 8);
  check("Finnair soute : NON importée (fait B[1] en attente) → à confirmer, pas un oui hérité", canal(golden, "airline_finnair", "hold")?.status === "confirmation_required");
}

console.log("\n=== Étage 2 — Amsterdam → Málaga et Amsterdam → Lisbonne : Ryanair, Transavia, TAP ===");
{
  const golden = decide("airport_ams", "airport_agp", GOLDEN_32), cavalier = decide("airport_ams", "airport_agp", CAVALIER_6), carlin = decide("airport_ams", "airport_agp", CARLIN_8);
  const ry = golden.airlines.find((a) => a.airline_id === "airline_ryanair");
  check("Ryanair est candidate sur Amsterdam → Málaga", !!ry);
  check("Ryanair : cabine, soute ET fret refusés sur trois citations — pour tout chien",
    ["cabin", "hold", "cargo"].every((pl) => canal(golden, "airline_ryanair", pl)?.status === "denied" && canal(cavalier, "airline_ryanair", pl)?.status === "denied"));
  check("Ryanair : « ne transporte pas d'animaux » — établi, plus une piste", ry?.offers_pet_transport === "no", JSON.stringify(ry?.offers_pet_transport));
  check("Ryanair, libellé : « Animaux refusés »", carte(golden, "airline_ryanair")?.label === "Animaux refusés", carte(golden, "airline_ryanair")?.label);
  check("Transavia cabine, Golden 32 kg : refus sûr (8 kg sac compris) ; Cavalier 6 kg : sous conditions",
    canal(golden, "airline_transavia", "cabin")?.status === "denied" && canal(cavalier, "airline_transavia", "cabin")?.status === "accepted_with_conditions");
  check("Transavia soute, Golden 32 kg : acceptée sous conditions", canal(golden, "airline_transavia", "hold")?.status === "accepted_with_conditions");
  check("Transavia soute, Carlin 8 kg (brachycéphale, exclu en portée) : JAMAIS accepté",
    !["accepted_with_conditions", "allowed"].includes(canal(carlin, "airline_transavia", "hold")?.status), JSON.stringify(canal(carlin, "airline_transavia", "hold")));
  const lis = decide("airport_ams", "airport_lis", GOLDEN_32), lisC = decide("airport_ams", "airport_lis", CAVALIER_6);
  check("TAP cabine, Golden 32 kg : refus sûr (8 kg pets + carrier) ; Cavalier 6 kg : sous conditions",
    canal(lis, "airline_tap", "cabin")?.status === "denied" && canal(lisC, "airline_tap", "cabin")?.status === "accepted_with_conditions");
  const tapH = canal(lis, "airline_tap", "hold");
  check("TAP soute, Golden 32 kg : acceptée sous conditions SANS plafond écrit (32/45 kg selon la route : portée nommée, pas un seuil global)",
    tapH?.status === "accepted_with_conditions" && tapH?.weight_limit_kg === undefined, JSON.stringify(tapH));
}

console.log("\n=== Ce que l'import n'a PAS fait ===");
{
  let allowed = 0;
  for (const a of kb.airlines.values()) for (const p of Object.values(a.premium?.policy ?? {})) if (p.status === "allowed") allowed++;
  check("aucune politique réelle n'est `allowed` — « sous conditions » n'est jamais devenu une acceptation catégorique", allowed === 0, String(allowed));
  /* MOUVEMENT NOMMÉ (09/09/2026, lot 4) : Brussels cabine SORT de la liste d'attente — citée au lot 4
     (« The total weight of the transport container, including the animal, must not exceed 8 kg. »).
     American soute y RESTE : Codex l'a volontairement laissée non décidée au lot 4 (réservée aux
     militaires et diplomates en mission). */
  const attente = [["airline_finnair", "hold"], ["airline_finnair", "cargo"], ["airline_sas", "hold"], ["airline_american", "hold"], ["airline_singapore_airlines", "hold"], ["airline_vueling", "cabin"]];
  check("les faits EN ATTENTE du LISEZ_MOI (B partielle, D, E, F cabine) ne sont pas importés : aucune citation sur ces canaux",
    attente.every(([id, pl]) => !(objets.airlines.find((a) => a.id === id)?.premium?.policy?.[pl]?.source?.quote)), JSON.stringify(attente.filter(([id, pl]) => objets.airlines.find((a) => a.id === id)?.premium?.policy?.[pl]?.source?.quote)));
}

console.log(`\n=== SUMMARY ===\n${fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`}`);
process.exit(fail ? 1 : 0);
