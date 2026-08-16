#!/usr/bin/env node
/**
 * Harnais T0-B3-a — le CÂBLAGE : `evaluate` consomme le registre `BreedRestriction`,
 * `explain` publie les avis de sécurité.
 *
 *   node --import tsx test-t0b3a-moteur-race.mjs
 *
 * Étape 1-bis avait verrouillé les CONTRATS ; celui-ci verrouille le COMPORTEMENT. Il passe par le
 * chemin réel — `normalize()` puis `evaluate()` puis `explain()` — et n'implémente aucune table de
 * décision de son côté : un harnais qui recalcule ce qu'il vérifie ne vérifie que lui-même.
 *
 *   1. le registre : chargé, validé, et les invariants d'ENSEMBLE refusés au chargement ;
 *   2. les quatre branches décisives, avec leurs preuves et leurs causes ;
 *   3. `warn` : un avis, et RIEN d'autre — ni statut, ni score, ni `fired`, ni preuve ;
 *   4. les avis : dédupliqués par (restriction, portée), triés, canaux triés, localisés ;
 *   5. le périmètre de « nous ne savons pas » : ni cabine, ni chien hors race visée ;
 *   6. le registre RÉEL est vide : le câblage ne déplace aucun statut publié aujourd'hui.
 */
import { normalize, rawKB, loadKB } from "./packages/knowledge/src/index.ts";
import { evaluate } from "./packages/engine/src/evaluate.ts";
import { explain } from "./packages/engine/src/explain.ts";

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};
const throws = (fn) => { try { fn(); return false; } catch { return true; } };

const AIRLINE = "airline_turkish";
const GOLDEN = "breed_golden_retriever";
const PUG = "breed_pug";

const SRC = (url, quote) => ({
  url, source_type: "official_website", verified_date: "2026-08-16", review_due: "2027-02-12",
  confidence: 4, reviewer: "harnais T0-B3-a", history: [],
  quote, quote_language: "en",
});
const DETAIL = {
  en: "A veterinary fitness-to-fly certificate is required.",
  fr: "Un certificat vétérinaire d'aptitude au vol est exigé.",
  es: "Se exige un certificado veterinario de aptitud para volar.",
  pt: "É exigido um certificado veterinário de aptidão para voar.",
};

/** Une KB normalisée par le CHEMIN RÉEL, restrictions injectées, règles éventuellement filtrées. */
const kbAvec = (restrictions, dropRule = () => false) => {
  const kb = normalize({ ...rawKB, breed_restrictions: restrictions });
  return { ...kb, rules: kb.rules.filter((r) => !dropRule(r)) };
};
/* Les 42 règles de l'ensemble brachycéphale : tant qu'elles sont là, toute soute brachycéphale est
   refusée et H n'ouvre rien (branche « canal structurellement fermé »). Les retirer EN MÉMOIRE est
   la seule façon d'éprouver les branches que l'option H fera vivre — aucun fichier n'est touché. */
const SANS_LES_42 = (r) => r.category === "breed_ban" || r.id === "rule_global_brachy_hold";

const req = (over = {}) => ({
  origin: "airport_cdg", destination: "airport_ist", dog: { breed_id: GOLDEN, weight_kg: 8 },
  travel_type: "pet", placement: "any", locale: "en", date: "2027-01-15", ...over,
});
const canal = (rep, placement) => rep.airlines.find((a) => a.airline_id === AIRLINE)
  ?.placement_decisions.find((d) => d.placement === placement);
const rapport = (kb, r) => explain(evaluate(kb, r), r.locale ?? "en");

console.log("=== 1. Le registre : chargé et VALIDÉ au chargement ===");
{
  const kb = loadKB();
  check("`breedRestrictions` existe toujours, même vide — jamais absent",
    Array.isArray(kb.breedRestrictions));
  check("le registre versionné est vide aujourd'hui (l'entrée IATA est un lot distinct)",
    kb.breedRestrictions.length === 0, JSON.stringify(kb.breedRestrictions.map((r) => r.id)));

  const base = { applies_to: { trait: "brachycephalic" }, placements: ["hold"],
    source: SRC("https://exemple.example/a", "Snub-nosed breeds are accepted in the hold.") };
  check("une restriction bien formée se charge",
    kbAvec([{ ...base, id: "brest_ok", action: "allow" }]).breedRestrictions.length === 1);
  check("CONTRADICTION `allow` + `deny` sur le même canal → REFUSÉE au chargement",
    throws(() => kbAvec([
      { ...base, id: "brest_a", action: "allow" },
      { ...base, id: "brest_b", action: "deny" },
    ])));
  check("`deny` + `require` (exigence inatteignable) → refusés au chargement",
    throws(() => kbAvec([
      { ...base, id: "brest_a", action: "deny" },
      { ...base, id: "brest_b", action: "require", detail: DETAIL },
    ])));
  check("compagnie inconnue → refusée au chargement",
    throws(() => kbAvec([{ ...base, id: "brest_a", action: "allow", airline_id: "airline_inexistante" }])));
  check("race inconnue → refusée au chargement",
    throws(() => kbAvec([{ ...base, id: "brest_a", action: "allow",
      applies_to: { breed_ids: ["breed_inexistante"] } }])));
  check("identifiant en double → refusé au chargement",
    throws(() => kbAvec([
      { ...base, id: "brest_a", action: "allow" },
      { ...base, id: "brest_a", action: "allow", placements: ["cargo"] },
    ])));
  check("auto-citation MyDogCanFly dans la source → refusée au chargement",
    throws(() => kbAvec([{ ...base, id: "brest_a", action: "allow",
      source: SRC("https://www.mydogcanfly.com/turkish", "Snub-nosed breeds are accepted.") }])));
  check("`require` sans `detail` → refusé (il faut dire de quoi il s'agit)",
    throws(() => kbAvec([{ ...base, id: "brest_a", action: "require" }])));
}

console.log("=== 2. Les branches décisives — statut, cause et PREUVE ===");
{
  /* Un golden retriever, visé nommément : les branches décisives ne dépendent pas du trait
     brachycéphale, elles suivent ce que la restriction déclare. */
  const cible = { breed_ids: [GOLDEN] };
  const r = (id, action, over = {}) => ({
    id, applies_to: cible, action, placements: ["hold"],
    source: SRC(`https://exemple.example/${id}`, `Official sentence for ${id}, long enough.`), ...over });

  const avant = canal(rapport(kbAvec([]), req()), "hold");
  check("témoin : sans restriction, la soute a son statut de base", !!avant, JSON.stringify(avant));

  /* deny */
  {
    const rep = rapport(kbAvec([r("brest_deny_a", "deny")]), req());
    const d = canal(rep, "hold");
    const carte = rep.airlines.find((a) => a.airline_id === AIRLINE);
    check("`deny` ferme la soute, éteint les causes, et transporte SA preuve",
      d.status === "denied" && !("confirmation_causes" in d)
        && d.evidence?.length === 1 && d.evidence[0].restriction_ref === "brest_deny_a"
        && d.evidence[0].source.quote.startsWith("Official sentence"),
      JSON.stringify(d));
    check("la source publiée est celle de la RESTRICTION, pas la provenance du canal",
      d.source?.url === "https://exemple.example/brest_deny_a", JSON.stringify(d.source));
    check("le refus porte un motif lisible (`breed_restricted`), jamais un refus muet",
      (carte.deny_reasons ?? []).includes("breed_restricted") || carte.hold === false,
      JSON.stringify({ deny_reasons: carte.deny_reasons, hold: carte.hold }));
  }
  /* require — DEUX exigences, DEUX preuves */
  {
    const rep = rapport(kbAvec([
      r("brest_req_vet", "require", { detail: DETAIL }),
      r("brest_req_crate", "require", { detail: DETAIL }),
    ]), req());
    const d = canal(rep, "hold");
    const exigences = d.confirmation_causes.filter((c) => c.code === "breed_requirement");
    check("DEUX `require` → deux causes `breed_requirement` et DEUX preuves, jamais réduites à une",
      d.status === "confirmation_required" && exigences.length === 2 && d.evidence?.length === 2
        && new Set(exigences.map((c) => c.restriction_ref)).size === 2,
      JSON.stringify({ causes: d.confirmation_causes, preuves: d.evidence?.map((e) => e.restriction_ref) }));
    check("chaque cause désigne la restriction qui la fonde, et son canal",
      exigences.every((c) => c.policy_ref === `${AIRLINE}#hold`)
        && exigences.map((c) => c.restriction_ref).sort().join(",") === "brest_req_crate,brest_req_vet");
  }
  /* allow */
  {
    const rep = rapport(kbAvec([r("brest_allow_a", "allow")]), req());
    const d = canal(rep, "hold");
    check("`allow` ne change pas le statut de base et transporte sa preuve",
      d.status === avant.status && d.evidence?.length === 1
        && d.evidence[0].restriction_ref === "brest_allow_a",
      JSON.stringify(d));
  }
  /* Un canal structurellement fermé ne se rouvre pas. */
  {
    const rep = rapport(kbAvec([{ ...r("brest_allow_cargo", "allow"), placements: ["cargo"] }]), req());
    const cargoTemoin = canal(rapport(kbAvec([]), req()), "cargo");
    const d = canal(rep, "cargo");
    check("un canal fermé le reste : `allow` ne crée pas un fret qui n'existe pas",
      cargoTemoin.status !== "denied" || d.status === "denied",
      JSON.stringify({ temoin: cargoTemoin.status, apres: d.status }));
  }
  /* `when` : le moteur l'ÉVALUE — la simulation, elle, n'avait pas d'évaluateur. */
  {
    const cond = (value) => r("brest_cond", "deny", { when: { all: [{ fact: "dog.weight_kg", op: "gt", value }] } });
    const lourd = canal(rapport(kbAvec([cond(5)]), req({ dog: { breed_id: GOLDEN, weight_kg: 8 } })), "hold");
    const leger = canal(rapport(kbAvec([cond(20)]), req({ dog: { breed_id: GOLDEN, weight_kg: 8 } })), "hold");
    check("condition VRAIE → la restriction agit ; condition FAUSSE → elle n'agit pas",
      lourd.status === "denied" && leger.status === avant.status,
      JSON.stringify({ condition_vraie: lourd.status, condition_fausse: leger.status }));
  }
}

console.log("=== 3. `warn` n'agit sur RIEN d'autre que l'avis ===");
{
  const WARN = {
    id: "brest_iata_fixture", applies_to: { trait: "brachycephalic" }, action: "warn",
    placements: ["cabin", "hold", "cargo"], detail: DETAIL,
    source: SRC("https://www.iata.org/en/programs/cargo/live-animals/pets/",
      "Transport of snub nose dogs, such as boxers, pugs, bulldogs and Pekinese, in hot season is not recommended."),
  };
  const r0 = req({ dog: { breed_id: PUG, weight_kg: 8 } });
  const sans = rapport(kbAvec([], SANS_LES_42), r0);
  const kbWarn = kbAvec([WARN], SANS_LES_42);
  const avec = rapport(kbWarn, r0);

  check("le VERDICT ne bouge pas", sans.verdict === avec.verdict, `${sans.verdict} → ${avec.verdict}`);
  check("le SCORE ne bouge pas", sans.score === avec.score, `${sans.score} → ${avec.score}`);
  check("aucun STATUT ne bouge sur les trois canaux",
    ["cabin", "hold", "cargo"].every((p) => canal(sans, p).status === canal(avec, p).status),
    JSON.stringify(["cabin", "hold", "cargo"].map((p) => `${p}:${canal(sans, p).status}→${canal(avec, p).status}`)));
  check("aucune PREUVE de race n'est produite par un `warn`",
    ["cabin", "hold", "cargo"].every((p) => canal(avec, p).evidence === undefined));
  check("la restriction n'entre PAS dans `fired` (le score se calcule sur les règles déclenchées)",
    evaluate(kbWarn, r0).airlines.every((a) => a.fired.every((f) => !f.rule_id.startsWith("brest_"))));
  check("… mais l'avis, lui, EST publié", avec.safety_advisories.length === 1
    && avec.safety_advisories[0].restriction_ref === "brest_iata_fixture",
    JSON.stringify(avec.safety_advisories.map((a) => a.restriction_ref)));
  check("un chien NON visé ne reçoit aucun avis",
    rapport(kbWarn, req({ dog: { breed_id: GOLDEN, weight_kg: 8 } })).safety_advisories.length === 0);
}

console.log("=== 4. Les avis : déduplication, tri, canaux, langue ===");
{
  const avis = (id, over = {}) => ({
    id, applies_to: { trait: "brachycephalic" }, action: "warn", placements: ["cabin", "hold", "cargo"],
    detail: DETAIL, source: SRC(`https://exemple.example/${id}`, `Official advisory sentence for ${id}.`), ...over });
  const kb = kbAvec([
    avis("brest_zzz_global"),
    avis("brest_aaa_global"),
    avis("brest_aaa_cie", { airline_id: AIRLINE, placements: ["hold"] }),
  ], SANS_LES_42);
  const r0 = req({ dog: { breed_id: PUG, weight_kg: 8 } });
  const rep = rapport(kb, r0);
  const cles = rep.safety_advisories.map((a) => `${a.restriction_ref}|${a.scope}`);

  check("UN avis global levé sur toutes les compagnies et tous les canaux ne paraît QU'UNE fois",
    cles.filter((c) => c === "brest_zzz_global|global").length === 1,
    JSON.stringify(cles));
  check("la portée fait partie de l'identité : même restriction, deux portées → deux avis",
    cles.includes("brest_aaa_global|global") && cles.includes(`brest_aaa_cie|${AIRLINE}`));
  check("les avis sont TRIÉS par (restriction, portée)",
    JSON.stringify(cles) === JSON.stringify([...cles].sort()), JSON.stringify(cles));
  const global = rep.safety_advisories.find((a) => a.restriction_ref === "brest_zzz_global");
  check("les canaux sont réunis et dans l'ordre canonique cabine/soute/fret",
    JSON.stringify(global.placements) === JSON.stringify(["cabin", "hold", "cargo"]),
    JSON.stringify(global.placements));
  check("un avis de compagnie ne réunit que SES canaux",
    JSON.stringify(rep.safety_advisories.find((a) => a.restriction_ref === "brest_aaa_cie").placements) === '["hold"]');
  check("l'avis porte sa CITATION complète, pas une provenance réduite",
    global.source.quote.length > 10 && global.source.quote_language === "en"
      && global.source.source_type === "official_website");

  for (const [locale, attendu] of Object.entries(DETAIL)) {
    const loc = rapport(kb, req({ dog: { breed_id: PUG, weight_kg: 8 }, locale }));
    check(`langue « ${locale} » : le texte publié est celui de la restriction, déjà localisé`,
      loc.safety_advisories[0].text === attendu, loc.safety_advisories[0].text);
  }
  const inconnue = rapport(kb, req({ dog: { breed_id: PUG, weight_kg: 8 }, locale: "en" }));
  check("le texte n'est JAMAIS vide (repli anglais garanti par le contrat)",
    inconnue.safety_advisories.every((a) => a.text.length > 0));
}

console.log("=== 5. Le périmètre de « nous ne savons pas » ===");
{
  const kb = kbAvec([], SANS_LES_42);
  const brachy = rapport(kb, req({ dog: { breed_id: PUG, weight_kg: 8 } }));
  const temoin = rapport(kb, req({ dog: { breed_id: GOLDEN, weight_kg: 8 } }));
  const causeRace = (rep, p) => (canal(rep, p).confirmation_causes ?? [])
    .filter((c) => c.code === "breed_policy_unreviewed");

  check("chien brachycéphale, aucun fait audité : la SOUTE passe à « à confirmer », cause de RACE",
    canal(brachy, "hold").status === "confirmation_required" && causeRace(brachy, "hold").length === 1
      && causeRace(brachy, "hold")[0].policy_ref === `${AIRLINE}#hold`,
    JSON.stringify(canal(brachy, "hold")));
  check("… sans AUCUNE preuve : une absence de fait n'en a pas",
    canal(brachy, "hold").evidence === undefined);
  check("la CABINE n'est jamais touchée par cette incertitude",
    causeRace(brachy, "cabin").length === 0,
    JSON.stringify(canal(brachy, "cabin")));
  check("un chien NON brachycéphale ne reçoit aucune cause de race",
    ["cabin", "hold", "cargo"].every((p) => causeRace(temoin, p).length === 0));
  /* Les causes préexistantes ne sont pas écrasées : c'est le défaut « 452 causes effacées ». */
  const cabineTemoinCauses = (canal(temoin, "hold").confirmation_causes ?? []).map((c) => c.code).sort();
  const cabineBrachyCauses = (canal(brachy, "hold").confirmation_causes ?? [])
    .filter((c) => c.code !== "breed_policy_unreviewed").map((c) => c.code).sort();
  check("les causes préexistantes du canal SURVIVENT à l'ajout de la cause de race",
    JSON.stringify(cabineTemoinCauses) === JSON.stringify(cabineBrachyCauses),
    JSON.stringify({ temoin: cabineTemoinCauses, brachy: cabineBrachyCauses }));
}

console.log("=== 6. Sur le référentiel RÉEL, le câblage ne déplace rien ===");
{
  /* Le registre versionné est vide et les 42 règles sont toujours en place : toute soute
     brachycéphale est refusée par les règles, donc H n'ouvre rien. Ce contrôle dit que le câblage
     est aujourd'hui un NO-OP publié — l'arbitrage se jouera au lot suivant, pas ici par surprise. */
  const kb = loadKB();
  const ROUTES = [["airport_cdg", "airport_bkk"], ["airport_cdg", "airport_jfk"],
    ["airport_lhr", "airport_mia"], ["airport_fra", "airport_sin"]];
  let cartes = 0, causesRace = 0, preuves = 0, avis = 0;
  for (const [origin, destination] of ROUTES) {
    for (const breed_id of [GOLDEN, PUG]) {
      for (const mois of ["01-15", "07-15"]) {
        const rep = explain(evaluate(kb, { origin, destination, dog: { breed_id },
          travel_type: "pet", placement: "any", date: `2027-${mois}`, locale: "en" }), "en");
        avis += rep.safety_advisories.length;
        for (const a of rep.airlines) {
          cartes++;
          for (const d of a.placement_decisions) {
            causesRace += (d.confirmation_causes ?? []).filter((c) =>
              c.code === "breed_policy_unreviewed" || c.code === "breed_requirement").length;
            preuves += d.evidence?.length ?? 0;
          }
        }
      }
    }
  }
  check(`sur ${cartes} cartes réelles : 0 cause de race, 0 preuve, 0 avis`,
    causesRace === 0 && preuves === 0 && avis === 0,
    JSON.stringify({ causesRace, preuves, avis }));
}

console.log(`\n${pass} OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
