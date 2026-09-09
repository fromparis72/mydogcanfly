#!/usr/bin/env node
/**
 * CONTRE-ÉPREUVES DU LOT 8 DE L'IMPORT STRICT — 23 faits de Codex (09/09/2026), 22 importés, 1 refusé.
 *
 *   npx tsx test-preuves-lot-8.mjs
 *
 * Même méthode que les lots précédents. Ce que ce lot apporte de NEUF, et qui est éprouvé ici :
 *   · IndiGo : DEUXIÈME compagnie au refus total PROUVÉ (cabine, soute, fret cités), après Ryanair —
 *     trois témoins figés sur « une seule » avancent par mouvement nommé ;
 *   · Copa : cabine sous conditions (10 kg contenant compris), soute passager REFUSÉE sur le contrat de
 *     transport, fret RÉACTIVÉ — deux états qu'il serait faux de fusionner ;
 *   · UN FAIT REFUSÉ par l'importeur : Thai Airways fret. La fiche dit `undocumented` et porte la
 *     citation AUDITÉE du 13/08 (Claude+Codex, lecture intégrale ; « contactez Cargo », jamais convertie en fret accepté — règle de
 *     Codex lui-même). Le fait de Codex cite la même phrase avec « sous conditions » : contradiction
 *     nommée, à arbitrer ; la disponibilité n'a pas bougé ;
 *   · cinq lignes non revérifiées réactivées sur citation (Bangkok Airways, Copa, KM Malta fret ; SKY
 *     express, SunExpress soute). Bangkok Airways fret est cité sur des routes INTÉRIEURES seulement :
 *     la portée nommée ne tient pas dans le modèle (même classe que Philippine cabine) — nommé ;
 *   · seuils, règle précisée au lot 7 : Copa 10, Tunisair 8, SunExpress 8 écrits (chiffre ET base du
 *     poids dans la phrase) ; SKY express 8/25, KM Malta 10/32, Smartwings 8/32 NON écrits ; KM Malta et
 *     Smartwings perdent leur plafond déduit de la grille tarifaire ;
 *   · deux citations FRAGMENTAIRES, signalées pour Codex sans être réécrites : China Southern soute
 *     (« you can check it »), IndiGo fret (« pets or animals on its aircraft »).
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

const DOSSIER = "mesures/preuves/import-strict-lot-8-2026-09-09/PREUVES_POLITIQUES_COMPAGNIES_LOT_8_STRICT_2026-09-09.json";
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
const SEUILS = { "airline_copa.cabin": [10, true], "airline_tunisair.cabin": [8, true], "airline_sunexpress.cabin": [8, true] };
const REACTIVEES = ["airline_bangkok_airways.cargo", "airline_copa.cargo", "airline_km_malta.cargo", "airline_sky_express.hold", "airline_sunexpress.hold"];
const REFUSE = "airline_thai_airways.cargo";

console.log("=== Étage 1 — 23 faits relus, 22 dans la donnée à l'octet près, 1 refusé et nommé ===");
{
  check("23 faits relus depuis le dossier, 7 non-décisions déclarées", faits.length === 23 && d.intentionally_unset.length === 7);
  for (const f of faits) {
    const cle = `${f.airline_id}.${f.placement}`;
    const pol = politique(f.airline_id, f.placement);
    const s = pol?.source ?? {};
    const proj = projetee(f.airline_id, f.placement);
    if (cle === REFUSE) {
      check(`${cle} (LOT8[${f.index}]) : REFUSÉ par l'importeur — la fiche garde \`undocumented\` et la citation AUDITÉE du 13/08 ; la phrase de Codex n'est pas écrite`,
        pol?.availability === "undocumented" && s.quote !== f.quote && !!s.quote && s.verified_date !== f.verified_date, JSON.stringify({ availability: pol?.availability, quote: s.quote, verified: s.verified_date }));
      check(`  …projeté « à confirmer », cause policy_unpublished — « contactez Cargo » n'est jamais « fret accepté »`, proj?.status === "confirmation_required" && proj?.status_cause === "policy_unpublished", JSON.stringify({ status: proj?.status, cause: proj?.status_cause }));
      continue;
    }
    check(`${cle} (LOT8[${f.index}]) : phrase, URL, localisateur, langue, date de lecture`,
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
  check("Tunisair : citations en français conservées (`quote_language: fr`), le « 08 kg » de la source y compris",
    politique("airline_tunisair", "cabin")?.source?.quote === "les chiens d’un poids maximal de 08 kg y compris le contenant et la nourriture" && politique("airline_tunisair", "cabin")?.source?.quote_language === "fr" && politique("airline_tunisair", "hold")?.source?.quote_language === "fr");
  check("citations FRAGMENTAIRES signalées, écrites telles quelles : China Southern soute « you can check it », IndiGo fret « pets or animals on its aircraft »",
    politique("airline_china_southern", "hold")?.source?.quote === "you can check it" && politique("airline_indigo", "cargo")?.source?.quote === "pets or animals on its aircraft");
  const km = projetee("airline_km_malta", "cabin"), sw = projetee("airline_smartwings", "cabin"), sk = projetee("airline_sky_express", "cabin");
  check("KM Malta, Smartwings, SKY express cabines PROJETÉES : sous conditions, SANS plafond — 10, 8 et 8 kg ni écrits (base absente de la phrase) ni déduits de la grille tarifaire",
    [km, sw, sk].every((p) => p?.status === "accepted_with_conditions" && p?.max_weight_kg === undefined && p?.weight_includes_carrier === undefined), JSON.stringify({ km, sw, sk }));
  check("IndiGo : trois refus PROUVÉS (cabine, soute, fret) — deuxième refus total du dépôt, après Ryanair",
    ["cabin", "hold", "cargo"].every((c) => projetee("airline_indigo", c)?.status === "denied"));
  check("Bangkok Airways fret RÉACTIVÉ : la portée nommée est INTÉRIEURE (« on the following routes ») — le modèle ne la porte pas, c'est nommé, pas converti",
    projetee("airline_bangkok_airways", "cargo")?.status === "accepted_with_conditions" && /following routes:$/.test(politique("airline_bangkok_airways", "cargo")?.source?.quote ?? ""));
}

console.log("\n=== Étage 2 — Miami → Panama : Copa, trois états distincts ===");
{
  const g = decide("airport_mia", "airport_pty", GOLDEN_32), c = decide("airport_mia", "airport_pty", CAVALIER_6), p = decide("airport_mia", "airport_pty", CARLIN_8), b = decide("airport_mia", "airport_pty", BULLY_50);
  const cc = canal(c, "airline_copa", "cabin");
  check("Copa cabine, Cavalier 6 kg et Carlin 8 kg : sous conditions, plafond 10 chien + contenant ; Golden 32 kg et Bully 50 kg : REFUS sûr",
    cc?.status === "accepted_with_conditions" && cc?.weight_limit_kg === 10 && cc?.weight_limit_includes_carrier === true && canal(p, "airline_copa", "cabin")?.status === "accepted_with_conditions" && canal(g, "airline_copa", "cabin")?.status === "denied" && canal(b, "airline_copa", "cabin")?.status === "denied", JSON.stringify(cc));
  check("Copa soute passager : REFUSÉE sur le contrat de transport pour tout chien (« shall no longer offer any transportation services for pets as checked baggage »)",
    [g, c, p, b].every((x) => canal(x, "airline_copa", "hold")?.status === "denied"));
  check("Copa fret, Golden 32 kg : RÉACTIVÉ sur citation → sous conditions (« must be arranged through Copa Cargo ») — jamais fusionné avec la soute",
    canal(g, "airline_copa", "cargo")?.status === "accepted_with_conditions" && canal(b, "airline_copa", "cargo")?.status === "accepted_with_conditions");
}

console.log("\n=== Étage 2 — Delhi → Bombay, Dubaï → Delhi : IndiGo, refus total prouvé ===");
{
  for (const [o, dst] of [["airport_del", "airport_bom"], ["airport_dxb", "airport_del"]]) {
    const decs = [GOLDEN_32, CAVALIER_6, CARLIN_8, BULLY_50].map((dog) => decide(o, dst, dog));
    check(`IndiGo ${o.slice(8).toUpperCase()} → ${dst.slice(8).toUpperCase()} : cabine, soute ET fret refusés pour les quatre chiens — un refus prouvé, jamais « à confirmer »`,
      decs.every((x) => ["cabin", "hold", "cargo"].every((c) => canal(x, "airline_indigo", c)?.status === "denied")));
  }
}

console.log("\n=== Étage 2 — Paris → Canton, Bangkok, Tunis ; Athènes → Héraklion ; Malte → Paris, Londres ; Francfort → Antalya ; Prague → Barcelone ===");
{
  const can = decide("airport_cdg", "airport_can", GOLDEN_32), canC = decide("airport_cdg", "airport_can", CAVALIER_6);
  check("China Southern cabine : refusée sur citation pour tout chien ; soute, Golden 32 kg : sous conditions ; fret non décidé → à confirmer",
    canal(can, "airline_china_southern", "cabin")?.status === "denied" && canal(canC, "airline_china_southern", "cabin")?.status === "denied" && canal(can, "airline_china_southern", "hold")?.status === "accepted_with_conditions" && canal(can, "airline_china_southern", "cargo")?.status === "confirmation_required");
  const bkk = decide("airport_cdg", "airport_bkk", GOLDEN_32), bkkC = decide("airport_cdg", "airport_bkk", CAVALIER_6);
  check("Thai Airways cabine : refusée sur citation pour tout chien ; soute, Golden 32 kg : sous conditions (AVIH)",
    canal(bkk, "airline_thai_airways", "cabin")?.status === "denied" && canal(bkkC, "airline_thai_airways", "cabin")?.status === "denied" && canal(bkk, "airline_thai_airways", "hold")?.status === "accepted_with_conditions");
  check("Thai Airways fret : REFUSÉ à l'import → reste « à confirmer », cause policy_unpublished (« contactez Cargo » n'est pas une offre)",
    canal(bkk, "airline_thai_airways", "cargo")?.status === "confirmation_required" && (canal(bkk, "airline_thai_airways", "cargo")?.confirmation_causes ?? []).some((x) => x.code === "policy_unpublished"), JSON.stringify(canal(bkk, "airline_thai_airways", "cargo")));
  const tun = decide("airport_cdg", "airport_tun", GOLDEN_32), tunC = decide("airport_cdg", "airport_tun", CAVALIER_6);
  const tc = canal(tunC, "airline_tunisair", "cabin");
  check("Tunisair cabine, Cavalier 6 kg : sous conditions, plafond 8 (contenant et nourriture compris) ; Golden 32 kg : refus sûr ; soute Golden : sous conditions ; fret non décidé",
    tc?.status === "accepted_with_conditions" && tc?.weight_limit_kg === 8 && tc?.weight_limit_includes_carrier === true && canal(tun, "airline_tunisair", "cabin")?.status === "denied" && canal(tun, "airline_tunisair", "hold")?.status === "accepted_with_conditions" && canal(tun, "airline_tunisair", "cargo")?.status === "confirmation_required", JSON.stringify(tc));
  const her = decide("airport_ath", "airport_her", GOLDEN_32), herC = decide("airport_ath", "airport_her", CAVALIER_6);
  check("SKY express (Athènes → Héraklion) : cabine Cavalier 6 kg sous conditions SANS plafond ; soute Golden 32 kg RÉACTIVÉE → sous conditions SANS plafond (25 kg absent de la phrase)",
    canal(herC, "airline_sky_express", "cabin")?.status === "accepted_with_conditions" && canal(herC, "airline_sky_express", "cabin")?.weight_limit_kg === undefined && canal(her, "airline_sky_express", "hold")?.status === "accepted_with_conditions" && canal(her, "airline_sky_express", "hold")?.weight_limit_kg === undefined);
  const mla = decide("airport_mla", "airport_cdg", GOLDEN_32), mlaC = decide("airport_mla", "airport_cdg", CAVALIER_6), lhr = decide("airport_mla", "airport_lhr", CAVALIER_6);
  check("KM Malta (Malte → Paris) : cabine Cavalier 6 kg sous conditions SANS plafond ; soute Golden 32 kg sous conditions ; fret RÉACTIVÉ → sous conditions",
    canal(mlaC, "airline_km_malta", "cabin")?.status === "accepted_with_conditions" && canal(mlaC, "airline_km_malta", "cabin")?.weight_limit_kg === undefined && canal(mla, "airline_km_malta", "hold")?.status === "accepted_with_conditions" && canal(mla, "airline_km_malta", "cargo")?.status === "accepted_with_conditions");
  const kl = canal(lhr, "airline_km_malta", "cabin"), kh = canal(lhr, "airline_km_malta", "hold");
  check("KM Malta (Malte → Londres), Cavalier 6 kg : cabine et soute « à confirmer », règles Royaume-Uni NOMMÉES (`rule_gb_no_cabin_pets`, `rule_km_malta_gb_not_approved`) — la restriction de route reste opposable",
    kl?.status === "confirmation_required" && (kl?.confirmation_causes ?? []).some((x) => x.rule_id === "rule_gb_no_cabin_pets") && kh?.status === "confirmation_required" && (kh?.confirmation_causes ?? []).some((x) => x.rule_id === "rule_km_malta_gb_not_approved"), JSON.stringify({ kl, kh }));
  const ayt = decide("airport_fra", "airport_ayt", GOLDEN_32), aytC = decide("airport_fra", "airport_ayt", CAVALIER_6);
  const sc = canal(aytC, "airline_sunexpress", "cabin");
  check("SunExpress (Francfort → Antalya) : cabine Cavalier 6 kg sous conditions, plafond 8 contenant compris ; Golden 32 kg : cabine refusée, soute RÉACTIVÉE → sous conditions",
    sc?.status === "accepted_with_conditions" && sc?.weight_limit_kg === 8 && sc?.weight_limit_includes_carrier === true && canal(ayt, "airline_sunexpress", "cabin")?.status === "denied" && canal(ayt, "airline_sunexpress", "hold")?.status === "accepted_with_conditions", JSON.stringify(sc));
  const prg = decide("airport_prg", "airport_bcn", GOLDEN_32), prgC = decide("airport_prg", "airport_bcn", CAVALIER_6);
  check("Smartwings (Prague → Barcelone) : cabine Cavalier 6 kg sous conditions SANS plafond ; soute Golden 32 kg sous conditions SANS plafond ; fret absent de la fiche → à confirmer",
    canal(prgC, "airline_smartwings", "cabin")?.status === "accepted_with_conditions" && canal(prgC, "airline_smartwings", "cabin")?.weight_limit_kg === undefined && canal(prg, "airline_smartwings", "hold")?.status === "accepted_with_conditions" && canal(prg, "airline_smartwings", "hold")?.weight_limit_kg === undefined && canal(prg, "airline_smartwings", "cargo")?.status === "confirmation_required");
  const sg = canal(prg, "airline_smartwings", "cabin");
  check("Smartwings cabine, Golden 32 kg : « à confirmer », règle héritée de poids NOMMÉE (`rule_smartwings_cabin_weight`) — aucun plafond cité",
    sg?.status === "confirmation_required" && (sg?.confirmation_causes ?? []).some((x) => x.rule_id === "rule_smartwings_cabin_weight"), JSON.stringify(sg));
  /* Bangkok Airways ne dessert aucun des aéroports du référentiel essayés (CNX, USM absents) : éprouvée à l'étage 1 sur la donnée projetée. */
  check("Bangkok Airways cabine et soute : volontairement NON décidées → « à confirmer »",
    projetee("airline_bangkok_airways", "cabin")?.status === "confirmation_required" && projetee("airline_bangkok_airways", "hold")?.status === "confirmation_required");
}

console.log("\n=== Ce que l'import n'a PAS fait ===");
{
  let allowed = 0;
  for (const a of kb.airlines.values()) for (const p of Object.values(a.premium?.policy ?? {})) if (p.status === "allowed") allowed++;
  check("aucune politique réelle n'est `allowed`", allowed === 0, String(allowed));
  check("Thai Airways fret n'a PAS été basculé à la main : `undocumented` intact, citation auditée du 13/08 intacte",
    politique("airline_thai_airways", "cargo")?.availability === "undocumented" && politique("airline_thai_airways", "cargo")?.source?.verified_date === "2026-08-13" && politique("airline_thai_airways", "cargo")?.source?.quote === "(For cargo acceptance, please contact directly to Cargo Department)");
}

console.log(`\n=== SUMMARY ===\n${fail === 0 ? `ALL CHECKS PASSED (${pass})` : `${fail} CHECK(S) FAILED sur ${pass + fail}`}`);
process.exit(fail ? 1 : 0);
