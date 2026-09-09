#!/usr/bin/env node
/**
 * CONTRE-ÉPREUVES DU LOT 7 DE L'IMPORT STRICT — 23 faits de Codex (09/09/2026), 23 importés, 0 refusé.
 *
 *   npx tsx test-preuves-lot-7.mjs
 *
 * Même méthode que les lots précédents. Ce que ce lot apporte de NEUF, et qui est éprouvé ici :
 *   · RÈGLE PRÉCISÉE sur les seuils (importeur, table SEUILS) : un plafond n'est écrit que si la phrase
 *     citée porte le chiffre ET la base du poids (animal + contenant). Écrits : Air Austral 8, La
 *     Compagnie 8. Non écrits : Air Algérie 6 (« small pets under 6 kg » — base absente), Corsair
 *     8/50, Iberia Express 8/45, Luxair 8 (chiffre absent de la phrase). Air Algérie PERD son 6 kg
 *     jusque-là déduit de la grille tarifaire (cabine désormais citée) ;
 *   · quatre lignes non revérifiées réactivées sur citation, toutes en fret (Air Caraïbes, Air
 *     Tahiti Nui, Aircalin, Corsair) ;
 *   · deux compagnies « fret uniquement » ou « cabine seule » : Aircalin (cabine et soute refusées
 *     sur UNE phrase, fret sous conditions), La Compagnie (cabine 8 kg sac compris, soute refusée) ;
 *   · citations en FRANÇAIS et en ESPAGNOL conservées telles quelles ;
 *   · MESURÉ, et nommé comme dette : des règles de poids héritées non citées gardent un Golden de
 *     32 kg « à confirmer » en cabine chez Air Algérie, Air Caraïbes, Air Tahiti Nui, Corsair, French
 *     Bee (nommées) — jamais un refus prouvé, jamais un oui.
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

const DOSSIER = "mesures/preuves/import-strict-lot-7-2026-09-09/PREUVES_POLITIQUES_COMPAGNIES_LOT_7_STRICT_2026-09-09.json";
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
const projetee = (id, pl) => kb.airlines.get(id)?.premium?.policy?.[pl];
const SEUILS = { "airline_air_austral.cabin": [8, true], "airline_la_compagnie.cabin": [8, true] };
const REACTIVEES = ["airline_air_caraibes.cargo", "airline_air_tahiti_nui.cargo", "airline_aircalin.cargo", "airline_corsair.cargo"];

console.log("=== Étage 1 — 23 faits relus, 23 dans la donnée à l'octet près ===");
{
  check("23 faits relus depuis le dossier, 7 non-décisions déclarées", faits.length === 23 && d.intentionally_unset.length === 7);
  for (const f of faits) {
    const cle = `${f.airline_id}.${f.placement}`;
    const pol = politique(f.airline_id, f.placement);
    const s = pol?.source ?? {};
    const proj = projetee(f.airline_id, f.placement);
    check(`${cle} (LOT7[${f.index}]) : phrase, URL, localisateur, langue, date de lecture`,
      !!pol && s.quote === f.quote && s.locator === f.locator && s.quote_language === f.quote_language && s.url === f.url && s.verified_date === f.verified_date,
      JSON.stringify({ attendu: f.quote, lu: s.quote }));
    check(`  …review_due calculé par reviewDueFrom (2026-12-08)`, s.review_due === reviewDueFrom(s.verified_date ?? "", "airline") && s.review_due === "2026-12-08", `${s.verified_date} → ${s.review_due}`);
    const attendu = f.recommendation.startsWith("not_offered") ? "denied" : "accepted_with_conditions";
    check(`  …projeté ${attendu}${REACTIVEES.includes(cle) ? " — ligne non revérifiée RÉACTIVÉE sur citation" : ""}`, proj?.status === attendu, JSON.stringify({ status: proj?.status, cause: proj?.status_cause }));
    const seuil = SEUILS[cle];
    if (seuil) check(`  …plafond ${seuil[0]} kg, chien + contenant — écrit tel que la phrase le dit`,
      proj?.max_weight_kg === seuil[0] && proj?.weight_includes_carrier === seuil[1], JSON.stringify({ max: proj?.max_weight_kg, incl: proj?.weight_includes_carrier }));
    else check(`  …aucun plafond écrit (la phrase ne porte pas le chiffre ET la base du poids)`, pol?.weight_includes_carrier === undefined && pol?.max_weight_kg === undefined, JSON.stringify({ max: pol?.max_weight_kg, incl: pol?.weight_includes_carrier }));
  }
  for (const u of d.intentionally_unset) {
    const pol = politique(u.airline_id, u.placement);
    check(`non-décision ${u.airline_id}.${u.placement} : aucune citation écrite, « à confirmer »`,
      !pol?.source?.quote && (projetee(u.airline_id, u.placement)?.status ?? "confirmation_required") === "confirmation_required",
      JSON.stringify({ quote: pol?.source?.quote, status: projetee(u.airline_id, u.placement)?.status }));
  }
  const fr = ["airline_air_austral.cabin", "airline_aircalin.cargo", "airline_la_compagnie.cabin"].map((k) => politique(...k.split("."))?.source);
  check("citations en français conservées telles quelles (`quote_language: fr`) : Air Austral, Aircalin, La Compagnie",
    fr.every((s) => s?.quote_language === "fr") && fr[0].quote === "le poids de l'animal + son contenant doit être inférieur à 8 kg" && fr[1].quote === "Le transport des animaux s’effectue en fret uniquement." && fr[2].quote === "vos compagnons, jusqu’à 8kg, sac compris, (chiens et chats)");
  check("citations en espagnol conservées (`quote_language: es`) : Iberia Express cabine et soute",
    politique("airline_iberia_express", "cabin")?.source?.quote_language === "es" && politique("airline_iberia_express", "hold")?.source?.quote_language === "es");
  /* Air Algérie : la cabine était « offerte » sans phrase, avec un 6 kg DÉDUIT de la ligne tarifaire ;
     citée désormais (« only small pets under 6 kg are accepted on board »), la phrase porte le chiffre
     mais pas la base du poids : le seuil n'est pas écrit, et la dérivation tarifaire ne s'applique
     plus à un canal cité (erreur nommée au lot 5). */
  const aaC = projetee("airline_air_algerie", "cabin");
  check("Air Algérie cabine PROJETÉE : sous conditions, SANS plafond — le 6 kg n'est ni écrit ni déduit de la grille tarifaire",
    aaC?.status === "accepted_with_conditions" && aaC?.max_weight_kg === undefined && aaC?.weight_includes_carrier === undefined, JSON.stringify(aaC));
  check("Aircalin : une seule phrase fonde trois canaux — cabine et soute refusées, fret sous conditions",
    projetee("airline_aircalin", "cabin")?.status === "denied" && projetee("airline_aircalin", "hold")?.status === "denied" && projetee("airline_aircalin", "cargo")?.status === "accepted_with_conditions"
      && new Set(["cabin", "hold", "cargo"].map((c) => politique("airline_aircalin", c)?.source?.quote)).size === 1);
}

console.log("\n=== Étage 2 — Paris → Alger, La Réunion ; Orly → Pointe-à-Pitre, Fort-de-France ===");
{
  const alg = decide("airport_cdg", "airport_alg", GOLDEN_32), algC = decide("airport_cdg", "airport_alg", CAVALIER_6), algP = decide("airport_cdg", "airport_alg", CARLIN_8);
  check("Air Algérie cabine, Cavalier 6 kg : sous conditions sans plafond ; soute, Golden 32 kg : sous conditions ; fret non décidé → à confirmer",
    canal(algC, "airline_air_algerie", "cabin")?.status === "accepted_with_conditions" && canal(algC, "airline_air_algerie", "cabin")?.weight_limit_kg === undefined && canal(alg, "airline_air_algerie", "hold")?.status === "accepted_with_conditions" && canal(alg, "airline_air_algerie", "cargo")?.status === "confirmation_required");
  const aaG = canal(alg, "airline_air_algerie", "cabin"), aaP = canal(algP, "airline_air_algerie", "cabin");
  check("Air Algérie cabine, Golden 32 kg et Carlin 8 kg : « à confirmer », règle héritée de poids NOMMÉE (`rule_air_algerie_cabin_weight`) — jamais un refus prouvé",
    aaG?.status === "confirmation_required" && aaP?.status === "confirmation_required" && [aaG, aaP].every((x) => (x?.confirmation_causes ?? []).some((c) => c.rule_id === "rule_air_algerie_cabin_weight")), JSON.stringify(aaP));
  const run = decide("airport_cdg", "airport_run", GOLDEN_32), runC = decide("airport_cdg", "airport_run", CAVALIER_6), runP = decide("airport_cdg", "airport_run", CARLIN_8), runB = decide("airport_cdg", "airport_run", BULLY_50);
  const auC = canal(runC, "airline_air_austral", "cabin");
  check("Air Austral cabine, Cavalier 6 kg et Carlin 8 kg : sous conditions, plafond 8 chien + contenant ; Golden 32 kg et Bully 50 kg : REFUS sûr",
    auC?.status === "accepted_with_conditions" && auC?.weight_limit_kg === 8 && auC?.weight_limit_includes_carrier === true && canal(runP, "airline_air_austral", "cabin")?.status === "accepted_with_conditions" && canal(run, "airline_air_austral", "cabin")?.status === "denied" && canal(runB, "airline_air_austral", "cabin")?.status === "denied", JSON.stringify(auC));
  check("Air Austral soute, Golden 32 kg : sous conditions (« Le transport en soute est obligatoire ») ; fret non décidé → à confirmer",
    canal(run, "airline_air_austral", "hold")?.status === "accepted_with_conditions" && canal(run, "airline_air_austral", "cargo")?.status === "confirmation_required");
  for (const [dst, nom] of [["airport_ptp", "Pointe-à-Pitre"], ["airport_fdf", "Fort-de-France"]]) {
    const g = decide("airport_ory", dst, GOLDEN_32), c = decide("airport_ory", dst, CAVALIER_6);
    check(`Air Caraïbes vers ${nom} : cabine Cavalier 6 kg sous conditions ; soute Golden 32 kg sous conditions ; fret RÉACTIVÉ → sous conditions`,
      canal(c, "airline_air_caraibes", "cabin")?.status === "accepted_with_conditions" && canal(g, "airline_air_caraibes", "hold")?.status === "accepted_with_conditions" && canal(g, "airline_air_caraibes", "cargo")?.status === "accepted_with_conditions");
    const cg = canal(g, "airline_air_caraibes", "cabin");
    check(`Air Caraïbes vers ${nom} : cabine Golden 32 kg « à confirmer », règle héritée NOMMÉE (\`rule_air_caraibes_cabin_weight\`)`,
      cg?.status === "confirmation_required" && (cg?.confirmation_causes ?? []).some((x) => x.rule_id === "rule_air_caraibes_cabin_weight"), JSON.stringify(cg));
  }
  const cor = decide("airport_ory", "airport_fdf", GOLDEN_32), corC = decide("airport_ory", "airport_fdf", CAVALIER_6);
  check("Corsair (Orly → Fort-de-France) : cabine Cavalier 6 kg sous conditions SANS plafond (8 kg absent de la phrase) ; soute Golden 32 kg sous conditions SANS plafond (50 kg absent) ; fret RÉACTIVÉ → sous conditions",
    canal(corC, "airline_corsair", "cabin")?.status === "accepted_with_conditions" && canal(corC, "airline_corsair", "cabin")?.weight_limit_kg === undefined && canal(cor, "airline_corsair", "hold")?.status === "accepted_with_conditions" && canal(cor, "airline_corsair", "hold")?.weight_limit_kg === undefined && canal(cor, "airline_corsair", "cargo")?.status === "accepted_with_conditions");
}

console.log("\n=== Étage 2 — Los Angeles → Papeete ; Sydney → Nouméa ; Orly → San Francisco, Newark ; Luxembourg → Paris ===");
{
  const ppt = decide("airport_lax", "airport_ppt", GOLDEN_32), pptC = decide("airport_lax", "airport_ppt", CAVALIER_6);
  check("Air Tahiti Nui (Los Angeles → Papeete) : cabine Cavalier 6 kg sous conditions ; fret RÉACTIVÉ → sous conditions ; soute volontairement NON décidée (Air Tahiti Nui Cargo n'est pas de l'AVIH) → à confirmer",
    canal(pptC, "airline_air_tahiti_nui", "cabin")?.status === "accepted_with_conditions" && canal(ppt, "airline_air_tahiti_nui", "cargo")?.status === "accepted_with_conditions" && canal(ppt, "airline_air_tahiti_nui", "hold")?.status === "confirmation_required");
  const nou = decide("airport_syd", "airport_nou", GOLDEN_32), nouC = decide("airport_syd", "airport_nou", CAVALIER_6);
  check("Aircalin (Sydney → Nouméa), Golden 32 kg et Cavalier 6 kg : cabine ET soute refusées sur citation ; fret, Golden : sous conditions",
    [nou, nouC].every((x) => canal(x, "airline_aircalin", "cabin")?.status === "denied" && canal(x, "airline_aircalin", "hold")?.status === "denied") && canal(nou, "airline_aircalin", "cargo")?.status === "accepted_with_conditions");
  const sfo = decide("airport_ory", "airport_sfo", GOLDEN_32), sfoC = decide("airport_ory", "airport_sfo", CAVALIER_6), sfoP = decide("airport_ory", "airport_sfo", CARLIN_8);
  check("French Bee (Orly → San Francisco) : cabine Cavalier 6 kg sous conditions ; soute Golden 32 kg sous conditions ; fret non décidé → à confirmer",
    canal(sfoC, "airline_french_bee", "cabin")?.status === "accepted_with_conditions" && canal(sfo, "airline_french_bee", "hold")?.status === "accepted_with_conditions" && canal(sfo, "airline_french_bee", "cargo")?.status === "confirmation_required");
  const fbP = canal(sfoP, "airline_french_bee", "hold");
  check("French Bee soute, Carlin 8 kg (brachycéphale) : « à confirmer », jamais un oui — la restriction de race n'est pas citée, elle reste une incertitude nommée",
    fbP?.status === "confirmation_required" && (fbP?.confirmation_causes ?? []).some((x) => x.code === "breed_policy_unreviewed"), JSON.stringify(fbP));
  const ewr = decide("airport_ory", "airport_ewr", GOLDEN_32), ewrC = decide("airport_ory", "airport_ewr", CAVALIER_6);
  const lcC = canal(ewrC, "airline_la_compagnie", "cabin");
  check("La Compagnie (Orly → Newark) : cabine Cavalier 6 kg sous conditions, plafond 8 sac compris ; Golden 32 kg : cabine REFUSÉE au seuil ET soute refusée sur citation",
    lcC?.status === "accepted_with_conditions" && lcC?.weight_limit_kg === 8 && lcC?.weight_limit_includes_carrier === true && canal(ewr, "airline_la_compagnie", "cabin")?.status === "denied" && canal(ewr, "airline_la_compagnie", "hold")?.status === "denied", JSON.stringify(lcC));
  check("La Compagnie fret : aucune politique (canal absent de la fiche) → à confirmer, cause `policy_absent`",
    canal(ewr, "airline_la_compagnie", "cargo")?.status === "confirmation_required" && (canal(ewr, "airline_la_compagnie", "cargo")?.confirmation_causes ?? []).some((x) => x.code === "policy_absent"));
  const lux = decide("airport_lux", "airport_cdg", GOLDEN_32), luxC = decide("airport_lux", "airport_cdg", CAVALIER_6);
  check("Luxair (Luxembourg → Paris) : cabine Cavalier 6 kg sous conditions SANS plafond (8 kg absent de la phrase) ; soute Golden 32 kg sous conditions ; fret non décidé → à confirmer",
    canal(luxC, "airline_luxair", "cabin")?.status === "accepted_with_conditions" && canal(luxC, "airline_luxair", "cabin")?.weight_limit_kg === undefined && canal(lux, "airline_luxair", "hold")?.status === "accepted_with_conditions" && canal(lux, "airline_luxair", "cargo")?.status === "confirmation_required");
  /* Iberia Express ne dessert aucun des trajets essayés (MAD→LIS, MAD→BCN) : ses deux canaux sont éprouvés à l'étage 1 sur la donnée projetée. */
  check("Iberia Express : cabine et soute projetées sous conditions, SANS plafond (8 et 45 kg absents des phrases)",
    projetee("airline_iberia_express", "cabin")?.status === "accepted_with_conditions" && projetee("airline_iberia_express", "hold")?.status === "accepted_with_conditions" && projetee("airline_iberia_express", "cabin")?.max_weight_kg === undefined && projetee("airline_iberia_express", "hold")?.max_weight_kg === undefined);
}

console.log("\n=== Ce que l'import n'a PAS fait ===");
{
  let allowed = 0;
  for (const a of kb.airlines.values()) for (const p of Object.values(a.premium?.policy ?? {})) if (p.status === "allowed") allowed++;
  check("aucune politique réelle n'est `allowed`", allowed === 0, String(allowed));
  check("Air Tahiti Nui soute : aucune politique créée (le canal reste absent de la fiche)", politique("airline_air_tahiti_nui", "hold") === undefined);
}

console.log(`\n=== SUMMARY ===\n${fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`}`);
process.exit(fail ? 1 : 0);
