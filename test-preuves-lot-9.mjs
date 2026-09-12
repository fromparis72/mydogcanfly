#!/usr/bin/env node
/**
 * CONTRE-ÉPREUVES DU LOT 9 DE L'IMPORT STRICT — 18 faits de Codex (09/09/2026), 18 importés, 0 refusé.
 * LOT DE CLÔTURE : les 102 compagnies du référentiel ont été examinées au moins une fois dans les neuf
 * lots stricts. Couverture de l'EXAMEN, pas preuve sur les 306 canaux : une absence de preuve reste une
 * absence de preuve.
 *
 *   npx tsx test-preuves-lot-9.mjs
 *
 * Ce que ce lot apporte de NEUF, et qui est éprouvé ici :
 *   · citations en RUSSE (Air Astana, trois canaux) et en ESPAGNOL (Aerolíneas Argentinas), conservées
 *     à l'octet près ;
 *   · seuils, règle des lots 7 et 8 : Aerolíneas Argentinas 9, Edelweiss 8, TAROM 8 écrits (chiffre ET
 *     base du poids dans la phrase) ; Air Astana 8 et Neos 10 NON écrits (chiffre absent de la phrase) ;
 *   · deux compagnies entièrement « à confirmer » par DÉCISION de Codex (Batik Air Malaysia, EL AL) :
 *     rien n'est écrit, rien n'est propagé de Batik Air Indonesia vers Batik Air Malaysia ;
 *   · Croatia Airlines : deux sources de première partie DATÉES (manuel 2023, politique de service
 *     2019), importées par contrat, échéance calculée par reviewDueFrom (jamais copiée), priorité de
 *     relecture NOMMÉE dans l'annexe — pas convertie en refus ni en ignorance ;
 *   · cinq lignes non revérifiées réactivées sur citation (Aerolíneas Argentinas, Air Astana, Edelweiss
 *     fret ; TAROM soute et fret). Air Astana fret et TAROM fret ont une portée nommée (destinations où
 *     le bagage est interdit ; chiens > 40 kg) que le modèle ne porte pas — nommé, pas converti.
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

const DOSSIER = "mesures/preuves/import-strict-lot-9-2026-09-09/PREUVES_POLITIQUES_COMPAGNIES_LOT_9_STRICT_2026-09-09.json";
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
const SEUILS = { "airline_aerolineas_argentinas.cabin": [9, true], "airline_edelweiss.cabin": [8, true], "airline_tarom.cabin": [8, true] };
const REACTIVEES = ["airline_aerolineas_argentinas.cargo", "airline_air_astana.cargo", "airline_edelweiss.cargo", "airline_tarom.hold", "airline_tarom.cargo"];

console.log("=== Étage 1 — 18 faits relus, 18 dans la donnée à l'octet près ===");
{
  check("18 faits relus depuis le dossier, 9 non-décisions déclarées — 27 issues, une par compagnie × canal", faits.length === 18 && d.intentionally_unset.length === 9
    && new Set([...faits, ...d.intentionally_unset].map((x) => `${x.airline_id}.${x.placement}`)).size === 27);
  for (const f of faits) {
    const cle = `${f.airline_id}.${f.placement}`;
    const pol = politique(f.airline_id, f.placement);
    const s = pol?.source ?? {};
    const proj = projetee(f.airline_id, f.placement);
    check(`${cle} (LOT9[${f.index}]) : phrase, URL, localisateur, langue, date de lecture`,
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
  const ru = ["cabin", "hold", "cargo"].map((c) => politique("airline_air_astana", c)?.source);
  check("Air Astana : trois citations en russe, à l'octet près, `quote_language: ru` — jamais traduites",
    ru.every((s) => s?.quote_language === "ru") && ru[0].quote === "Перевозка домашних животных (кошек или собак) в салоне самолета разрешена" && ru[2].quote === "животные должны быть транспортированы исключительно по грузовой авианакладной");
  check("Aerolíneas Argentinas : citations en espagnol (`es`), le 9 kg « en el contenedor correspondiente » écrit chien + contenant",
    ["cabin", "hold", "cargo"].every((c) => politique("airline_aerolineas_argentinas", c)?.source?.quote_language === "es") && projetee("airline_aerolineas_argentinas", "cabin")?.max_weight_kg === 9);
  /* Batik Air Malaysia : trois non-décisions — RIEN ne vient de Batik Air Indonesia. */
  check("Batik Air Malaysia : trois canaux SANS citation, « à confirmer » (cause legacy_unreviewed) — aucune propagation depuis Batik Air Indonesia",
    ["cabin", "hold", "cargo"].every((c) => !politique("airline_batik_air_malaysia", c)?.source?.quote && projetee("airline_batik_air_malaysia", c)?.status === "confirmation_required" && projetee("airline_batik_air_malaysia", c)?.status_cause === "legacy_unreviewed"));
  check("Batik Air Indonesia : cabine et soute REFUSÉES sur citation ; fret volontairement non décidé (refus d'auteur sans phrase → à confirmer)",
    projetee("airline_batik_air_indonesia", "cabin")?.status === "denied" && projetee("airline_batik_air_indonesia", "hold")?.status === "denied" && projetee("airline_batik_air_indonesia", "cargo")?.status === "confirmation_required" && !politique("airline_batik_air_indonesia", "cargo")?.source?.quote);
  check("EL AL : trois canaux SANS citation (la checklist de cage ne décide aucun canal) — reste le témoin « carte sans canal sourcé » du harnais des entités",
    ["cabin", "hold", "cargo"].every((c) => !politique("airline_el_al", c)?.source?.quote && projetee("airline_el_al", c)?.status === "confirmation_required"));
  /* Croatia Airlines : sources DATÉES, importées par contrat, échéance calculée — la priorité de relecture est nommée, pas codée. */
  const cr = ["cabin", "hold"].map((c) => politique("airline_croatia_airlines", c)?.source);
  check("Croatia Airlines : les deux sources sont les documents de première partie DATÉS (manuel 24.01.2023, politique de service oct. 2019), URL intactes, échéance calculée et non copiée",
    /24\.01\.2023\.pdf$/.test(cr[0]?.url ?? "") && /oct19\.pdf\.pdf$/.test(cr[1]?.url ?? "") && cr.every((s) => s?.review_due === reviewDueFrom("2026-09-09", "airline")));
  const ne = projetee("airline_neos", "cabin"), aa = projetee("airline_air_astana", "cabin");
  check("Neos 10 kg et Air Astana 8 kg : cabines PROJETÉES sous conditions SANS plafond — chiffres absents des phrases citées",
    ne?.status === "accepted_with_conditions" && ne?.max_weight_kg === undefined && aa?.status === "accepted_with_conditions" && aa?.max_weight_kg === undefined, JSON.stringify({ ne, aa }));
}

console.log("\n=== Étage 2 — Madrid → Buenos Aires ; Francfort → Almaty ; Zurich → Palma ; Bucarest → Paris ===");
{
  const eze = decide("airport_mad", "airport_eze", GOLDEN_32), ezeC = decide("airport_mad", "airport_eze", CAVALIER_6), ezeP = decide("airport_mad", "airport_eze", CARLIN_8);
  const arC = canal(ezeC, "airline_aerolineas_argentinas", "cabin");
  check("Aerolíneas Argentinas cabine, Cavalier 6 kg et Carlin 8 kg : sous conditions, plafond 9 chien + contenant ; Golden 32 kg : refus sûr",
    arC?.status === "accepted_with_conditions" && arC?.weight_limit_kg === 9 && arC?.weight_limit_includes_carrier === true && canal(ezeP, "airline_aerolineas_argentinas", "cabin")?.status === "accepted_with_conditions" && canal(eze, "airline_aerolineas_argentinas", "cabin")?.status === "denied", JSON.stringify(arC));
  check("Aerolíneas Argentinas, Golden 32 kg : soute sous conditions (« se trasporta en bodega ») et fret RÉACTIVÉ → sous conditions",
    canal(eze, "airline_aerolineas_argentinas", "hold")?.status === "accepted_with_conditions" && canal(eze, "airline_aerolineas_argentinas", "cargo")?.status === "accepted_with_conditions");
  const ala = decide("airport_fra", "airport_ala", GOLDEN_32), alaC = decide("airport_fra", "airport_ala", CAVALIER_6);
  check("Air Astana (Francfort → Almaty) : cabine Cavalier 6 kg sous conditions SANS plafond ; soute et fret Golden 32 kg sous conditions (fret RÉACTIVÉ, portée nommée : destinations où le bagage est interdit)",
    canal(alaC, "airline_air_astana", "cabin")?.status === "accepted_with_conditions" && canal(alaC, "airline_air_astana", "cabin")?.weight_limit_kg === undefined && canal(ala, "airline_air_astana", "hold")?.status === "accepted_with_conditions" && canal(ala, "airline_air_astana", "cargo")?.status === "accepted_with_conditions");
  const ag = canal(ala, "airline_air_astana", "cabin");
  check("Air Astana cabine, Golden 32 kg : « à confirmer », règle globale héritée NOMMÉE (`rule_global_cabin_weight_cap`) — jamais un refus prouvé",
    ag?.status === "confirmation_required" && (ag?.confirmation_causes ?? []).some((x) => x.rule_id === "rule_global_cabin_weight_cap"), JSON.stringify(ag));
  const pmi = decide("airport_zrh", "airport_pmi", GOLDEN_32), pmiC = decide("airport_zrh", "airport_pmi", CAVALIER_6);
  const edC = canal(pmiC, "airline_edelweiss", "cabin");
  check("Edelweiss (Zurich → Palma) : cabine Cavalier 6 kg sous conditions, plafond 8 contenant compris ; Golden 32 kg : cabine refusée, soute sous conditions, fret RÉACTIVÉ (SWISS WorldCargo) → sous conditions",
    edC?.status === "accepted_with_conditions" && edC?.weight_limit_kg === 8 && edC?.weight_limit_includes_carrier === true && canal(pmi, "airline_edelweiss", "cabin")?.status === "denied" && canal(pmi, "airline_edelweiss", "hold")?.status === "accepted_with_conditions" && canal(pmi, "airline_edelweiss", "cargo")?.status === "accepted_with_conditions", JSON.stringify(edC));
  const otp = decide("airport_otp", "airport_cdg", GOLDEN_32), otpC = decide("airport_otp", "airport_cdg", CAVALIER_6), otpB = decide("airport_otp", "airport_cdg", BULLY_50);
  const taC = canal(otpC, "airline_tarom", "cabin");
  check("TAROM (Bucarest → Paris) : cabine Cavalier 6 kg sous conditions, plafond 8 cage comprise ; Golden 32 kg : cabine refusée, soute RÉACTIVÉE → sous conditions ; fret RÉACTIVÉ → sous conditions",
    taC?.status === "accepted_with_conditions" && taC?.weight_limit_kg === 8 && taC?.weight_limit_includes_carrier === true && canal(otp, "airline_tarom", "cabin")?.status === "denied" && canal(otp, "airline_tarom", "hold")?.status === "accepted_with_conditions" && canal(otp, "airline_tarom", "cargo")?.status === "accepted_with_conditions", JSON.stringify(taC));
  check("TAROM, Bully 50 kg : soute sous conditions SANS plafond (le seuil de 40 kg du fret n'est pas dans la phrase) — le fret reste « sous conditions », jamais un renvoi automatique",
    canal(otpB, "airline_tarom", "hold")?.status === "accepted_with_conditions" && canal(otpB, "airline_tarom", "hold")?.weight_limit_kg === undefined && canal(otpB, "airline_tarom", "cargo")?.status === "accepted_with_conditions");
}

console.log("\n=== Étage 2 — Zagreb → Francfort, Londres ; Kuala Lumpur → Penang ; Tel-Aviv → Paris ===");
{
  const fra = decide("airport_zag", "airport_fra", GOLDEN_32), fraC = decide("airport_zag", "airport_fra", CAVALIER_6);
  check("Croatia Airlines (Zagreb → Francfort) : cabine Cavalier 6 kg sous conditions ; soute Golden 32 kg sous conditions ; fret non décidé → à confirmer",
    canal(fraC, "airline_croatia_airlines", "cabin")?.status === "accepted_with_conditions" && canal(fra, "airline_croatia_airlines", "hold")?.status === "accepted_with_conditions" && canal(fra, "airline_croatia_airlines", "cargo")?.status === "confirmation_required");
  const lhr = decide("airport_zag", "airport_lhr", CAVALIER_6);
  const cl = canal(lhr, "airline_croatia_airlines", "cabin"), ch = canal(lhr, "airline_croatia_airlines", "hold");
  check("Croatia Airlines (Zagreb → Londres), Cavalier 6 kg : cabine et soute « à confirmer », règles Royaume-Uni NOMMÉES — la restriction de route reste opposable",
    cl?.status === "confirmation_required" && (cl?.confirmation_causes ?? []).some((x) => x.rule_id === "rule_gb_no_cabin_pets") && ch?.status === "confirmation_required" && (ch?.confirmation_causes ?? []).some((x) => x.rule_id === "rule_croatia_airlines_gb_not_approved"), JSON.stringify({ cl, ch }));
  const pen = decide("airport_kul", "airport_pen", GOLDEN_32), penC = decide("airport_kul", "airport_pen", CAVALIER_6);
  check("Batik Air Malaysia (Kuala Lumpur → Penang), Golden et Cavalier : les trois canaux « à confirmer », cause legacy_unreviewed — jamais un refus, jamais un oui",
    [pen, penC].every((x) => ["cabin", "hold", "cargo"].every((c) => canal(x, "airline_batik_air_malaysia", c)?.status === "confirmation_required" && (canal(x, "airline_batik_air_malaysia", c)?.confirmation_causes ?? []).some((k) => k.code === "legacy_unreviewed"))));
  const tlv = decide("airport_tlv", "airport_cdg", GOLDEN_32), tlvC = decide("airport_tlv", "airport_cdg", CAVALIER_6);
  check("EL AL (Tel-Aviv → Paris), Golden et Cavalier : les trois canaux « à confirmer », cause legacy_unreviewed",
    [tlv, tlvC].every((x) => ["cabin", "hold", "cargo"].every((c) => canal(x, "airline_el_al", c)?.status === "confirmation_required")));
  /* Batik Air Indonesia et Neos ne desservent aucun des trajets essayés : éprouvés à l'étage 1 sur la donnée projetée. */
}

console.log("\n=== Clôture : les 102 compagnies examinées, ce que cela veut dire et ne veut pas dire ===");
{
  let allowed = 0, citees = 0, politiques = 0;
  for (const a of objets.airlines) for (const p of Object.values(a.premium?.policy ?? {})) { politiques++; if (p.source?.quote && p.source?.locator && p.source?.quote_language) citees++; }
  for (const a of kb.airlines.values()) for (const p of Object.values(a.premium?.policy ?? {})) if (p.status === "allowed") allowed++;
  check("aucune politique réelle n'est `allowed`", allowed === 0, String(allowed));
  /* MOUVEMENT NOMMÉ (correctif d'arbitrages, même jour) : 176 → 178 (Aer Lingus soute, Air China cabine citées sur ordre). */
  /* MOUVEMENT NOMMÉ (10/09/2026, complément Air France cabine — Codex) : 178 → 179 ; 124 → 123 sans phrase. */
  /* MOUVEMENT NOMMÉ (10/09/2026, Saudia — preuve de test retirée sur contre-lecture de l'audit de Codex, tranchée par Philippe) : 179 → 177 ; 123 → 125 sans phrase. */
  /* MOUVEMENT NOMMÉ (12/09/2026, SAS soute) : 177 → 178 citées, 125 → 124 sans phrase. */
  check("178 politiques citées sur 302 — couverture de l'EXAMEN, pas preuve sur les 306 canaux : 124 politiques restent sans phrase", citees === 178 && politiques === 302, `${citees} / ${politiques}`);
  const neufLots = ["v3", "lots-2-3", "lot-4", "lot-5", "lot-6", "lot-7", "lot-8", "lot-9"].map((l) => `test-baselines/import-strict-${l}-apres.json`);
  check("la chaîne des baselines figées est complète, de l'import V3 au lot 9", neufLots.every((f) => { try { readFileSync(f); return true; } catch { return false; } }), neufLots.join(", "));
}

console.log(`\n=== SUMMARY ===\n${fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`}`);
process.exit(fail ? 1 : 0);
