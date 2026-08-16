#!/usr/bin/env node
/**
 * Harnais T0-B3-a — le contrat de sortie de l'option H : causes de race et preuves.
 *
 *   npx tsx test-t0b3a-contrat-preuves.mjs
 *
 * POURQUOI CE FICHIER EXISTE. Les contrats de l'étape 1 (deux nouvelles causes, `RestrictionEvidence`
 * au pluriel, `SafetyAdvisory`, `safety_advisories` obligatoire) n'étaient éprouvés que par la
 * simulation `mesure:t0b3a`, que la CI n'exécute pas : une régression les aurait franchis sans
 * qu'aucun test ne rougisse. Ce harnais est leur garde PERMANENTE, dans `test:unit`.
 *
 * Il vérifie le CONTRAT et le MOTEUR RÉEL — jamais une seconde implémentation :
 *   1. les deux causes de race, leur clé, et `restriction_ref` obligatoire ;
 *   2. l'accord causes ↔ preuves : rien en trop, rien en moins, aucun doublon ;
 *   3. la provenance : `SourcedQuote` refuse l'auto-citation et les types de source non factuels ;
 *   4. les avis de sécurité : portée, unicité des canaux, clé de déduplication ;
 *   5. `explain()` : les preuves SURVIVENT à la reconstruction d'une décision dégradée ;
 *   6. `safety_advisories` est présent dans TOUS les rapports de la grille publique.
 */
import { loadKB } from "./packages/knowledge/src/index.ts";
import { evaluate } from "./packages/engine/src/evaluate.ts";
import { explain } from "./packages/engine/src/explain.ts";
import {
  ConfirmationCause, PlacementDecision, RestrictionEvidence, SafetyAdvisory,
  causeKey, advisoryKey, makePlacementDecision,
} from "./packages/engine/src/contracts.ts";

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};
const throws = (fn) => { try { fn(); return false; } catch { return true; } };

/* ---- Fixtures de provenance ------------------------------------------------------------------
   Une citation officielle complète : c'est le contrat `SourcedQuote` de knowledge, celui qui exige
   la phrase, sa langue, un type de source factuel et refuse nos propres pages. */
const QUOTE = {
  url: "https://exemple-compagnie.example/pets",
  source_type: "official_website",
  verified_date: "2026-08-16", review_due: "2027-02-12",
  confidence: 4, reviewer: "harnais T0-B3-a", history: [],
  quote: "Snub-nosed breeds are accepted with a veterinary fitness-to-fly certificate.",
  quote_language: "en",
};
const POLICY = "airline_turkish#hold";
const REQ = (ref, policy_ref = POLICY) => ({ code: "breed_requirement", policy_ref, restriction_ref: ref });
const EV = (ref, over = {}) => ({ restriction_ref: ref, source: { ...QUOTE, ...over } });
const UNREVIEWED = { code: "breed_policy_unreviewed", policy_ref: POLICY };

console.log("=== 1. Les deux causes de race, leur clé, et `restriction_ref` obligatoire ===");
{
  check("`breed_policy_unreviewed` est une cause valide (policy_ref obligatoire)",
    ConfirmationCause.safeParse(UNREVIEWED).success);
  check("`breed_policy_unreviewed` SANS policy_ref → refusée",
    !ConfirmationCause.safeParse({ code: "breed_policy_unreviewed" }).success);
  check("`breed_policy_unreviewed` avec un policy_ref mal formé → refusée",
    !ConfirmationCause.safeParse({ code: "breed_policy_unreviewed", policy_ref: "airline_turkish" }).success);
  check("`breed_requirement` complète est une cause valide",
    ConfirmationCause.safeParse(REQ("brest_vet_cert")).success);
  check("`breed_requirement` SANS restriction_ref → REFUSÉE (le champ est obligatoire)",
    !ConfirmationCause.safeParse({ code: "breed_requirement", policy_ref: POLICY }).success);
  check("`breed_requirement` avec une restriction_ref hors forme `brest_…` → refusée",
    !ConfirmationCause.safeParse(REQ("vet_cert")).success);
  check("clé : deux exigences du MÊME canal ont des clés DIFFÉRENTES (sinon une seule survivrait)",
    causeKey(REQ("brest_vet_cert")) !== causeKey(REQ("brest_crate")));
  check("clé : `breed_policy_unreviewed` ne porte pas de restriction et se dédupliquerait sur le canal",
    causeKey(UNREVIEWED) === `breed_policy_unreviewed|${POLICY}`);
  check("clé : une exigence et une politique non revérifiée sur le même canal restent distinctes",
    causeKey(REQ("brest_vet_cert")) !== causeKey(UNREVIEWED));
}

console.log("=== 2. L'accord causes ↔ preuves ===");
{
  /* Le cas nominal : une exigence, sa preuve. */
  const d1 = makePlacementDecision("hold", "confirmation_required", [REQ("brest_vet_cert")], undefined, [EV("brest_vet_cert")]);
  check("une exigence + sa preuve → se construit, la preuve est transportée entière",
    d1.status === "confirmation_required" && d1.evidence?.length === 1
      && d1.evidence[0].restriction_ref === "brest_vet_cert"
      && d1.evidence[0].source.quote === QUOTE.quote && d1.evidence[0].source.quote_language === "en",
    JSON.stringify(d1.evidence));

  /* DEUX exigences, DEUX preuves : le pluriel est la raison d'être du contrat. */
  const d2 = makePlacementDecision("hold", "confirmation_required",
    [REQ("brest_vet_cert"), REQ("brest_crate")], undefined,
    [EV("brest_vet_cert"), EV("brest_crate", { url: "https://exemple-compagnie.example/crates" })]);
  check("DEUX exigences et DEUX preuves survivent — ni causes ni preuves écrasées",
    d2.confirmation_causes.length === 2 && d2.evidence?.length === 2
      && new Set(d2.evidence.map((e) => e.restriction_ref)).size === 2
      && new Set(d2.evidence.map((e) => e.source.url)).size === 2,
    JSON.stringify({ causes: d2.confirmation_causes.length, preuves: d2.evidence?.length }));

  check("exigence SANS preuve → REFUSÉE (« la compagnie exige ceci » sans dire d'où ça sort)",
    throws(() => makePlacementDecision("hold", "confirmation_required", [REQ("brest_vet_cert")])));
  check("DEUX exigences, UNE seule preuve → refusée (la seconde exigence reste sans preuve)",
    throws(() => makePlacementDecision("hold", "confirmation_required",
      [REQ("brest_vet_cert"), REQ("brest_crate")], undefined, [EV("brest_vet_cert")])));
  check("preuve SANS exigence correspondante → refusée (une citation qui ne motive rien)",
    throws(() => makePlacementDecision("hold", "confirmation_required",
      [REQ("brest_vet_cert")], undefined, [EV("brest_vet_cert"), EV("brest_crate")])));
  check("preuve DUPLIQUÉE (même restriction_ref deux fois) → refusée",
    throws(() => makePlacementDecision("hold", "confirmation_required",
      [REQ("brest_vet_cert")], undefined, [EV("brest_vet_cert"), EV("brest_vet_cert")])));
  check("preuve dupliquée avec des sources DIFFÉRENTES → refusée aussi (l'unicité porte sur la restriction)",
    throws(() => makePlacementDecision("hold", "confirmation_required",
      [REQ("brest_vet_cert")], undefined,
      [EV("brest_vet_cert"), EV("brest_vet_cert", { url: "https://exemple-compagnie.example/autre" })])));
  check("`evidence: []` → refusé (« des preuves, aucune » masquerait un chemin qui les a perdues)",
    throws(() => makePlacementDecision("hold", "confirmation_required", [REQ("brest_vet_cert")], undefined, [])));

  /* Le cas autonome : une absence de fait n'a pas de preuve. */
  const d3 = makePlacementDecision("hold", "confirmation_required", [UNREVIEWED]);
  check("`breed_policy_unreviewed` SEULE se construit, et ne porte aucune preuve",
    d3.confirmation_causes.length === 1 && d3.evidence === undefined);
  check("`breed_policy_unreviewed` ACCOMPAGNÉE d'une preuve de race → refusée",
    throws(() => makePlacementDecision("hold", "confirmation_required", [UNREVIEWED], undefined, [EV("brest_vet_cert")])));
  check("exigence + politique non revérifiée sur le même canal : les DEUX causes, UNE preuve → valide",
    makePlacementDecision("hold", "confirmation_required", [REQ("brest_vet_cert"), UNREVIEWED],
      undefined, [EV("brest_vet_cert")]).confirmation_causes.length === 2);

  /* `allowed` / `denied` : pas de causes, donc des preuves facultatives — mais jamais vides ni doublées. */
  check("`denied` avec une preuve de race → valide (une interdiction documentée reste affichable)",
    makePlacementDecision("hold", "denied", undefined, undefined, [EV("brest_deny_snub")]).evidence?.length === 1);
  check("`allowed` sans preuve → valide", makePlacementDecision("cabin", "allowed").evidence === undefined);
  check("`denied` avec une preuve DUPLIQUÉE → refusée",
    throws(() => makePlacementDecision("hold", "denied", undefined, undefined, [EV("brest_x"), EV("brest_x")])));
  check("`allowed` avec `evidence: []` → refusé",
    throws(() => makePlacementDecision("cabin", "allowed", undefined, undefined, [])));

  /* Le schéma tient sans passer par le constructeur : aucun appelant ne le contourne. */
  check("le SCHÉMA lui-même refuse une exigence sans preuve (littéral libre)",
    !PlacementDecision.safeParse({ placement: "hold", status: "confirmation_required", allowed: false,
      confirmation_causes: [REQ("brest_vet_cert")] }).success);
  check("le SCHÉMA lui-même refuse une preuve sans exigence (littéral libre)",
    !PlacementDecision.safeParse({ placement: "hold", status: "confirmation_required", allowed: false,
      confirmation_causes: [UNREVIEWED], evidence: [EV("brest_vet_cert")] }).success);

  /* Ordre stable : deux constructions des mêmes preuves donnent la même sérialisation. */
  const ordre = (evs) => makePlacementDecision("hold", "confirmation_required",
    [REQ("brest_vet_cert"), REQ("brest_crate")], undefined, evs).evidence.map((e) => e.restriction_ref);
  check("les preuves sont TRIÉES : l'ordre d'entrée ne change pas la sortie",
    JSON.stringify(ordre([EV("brest_vet_cert"), EV("brest_crate")]))
      === JSON.stringify(ordre([EV("brest_crate"), EV("brest_vet_cert")])),
    JSON.stringify(ordre([EV("brest_vet_cert"), EV("brest_crate")])));
}

console.log("=== 3. La provenance d'une preuve — `SourcedQuote`, pas une provenance réduite ===");
{
  check("une preuve complète passe", RestrictionEvidence.safeParse(EV("brest_vet_cert")).success);
  check("AUTO-CITATION MyDogCanFly → refusée",
    !RestrictionEvidence.safeParse(EV("brest_x", { url: "https://www.mydogcanfly.com/airlines/turkish" })).success);
  check("auto-citation refusée AUSSI à la construction de la décision",
    throws(() => makePlacementDecision("hold", "confirmation_required", [REQ("brest_x")], undefined,
      [EV("brest_x", { url: "https://mydogcanfly.com/a" })])));
  check("type de source non factuel (`other`) → refusé",
    !RestrictionEvidence.safeParse(EV("brest_x", { source_type: "other" })).success);
  check("citation ABSENTE → refusée (c'est ce que la provenance réduite laissait passer)",
    !RestrictionEvidence.safeParse({ restriction_ref: "brest_x",
      source: (({ quote, ...r }) => r)(QUOTE) }).success);
  check("langue de citation ABSENTE → refusée",
    !RestrictionEvidence.safeParse({ restriction_ref: "brest_x",
      source: (({ quote_language, ...r }) => r)(QUOTE) }).success);
  check("champ inconnu dans la preuve → refusé (`.strict()`)",
    !RestrictionEvidence.safeParse({ ...EV("brest_x"), restriction_id: "brest_x" }).success);
}

console.log("=== 4. Les avis de sécurité ===");
{
  const AVIS = {
    restriction_ref: "brest_iata_snub_nose_hot_season", scope: "global",
    placements: ["cabin", "hold", "cargo"],
    text: "L'IATA déconseille le transport des chiens au museau écrasé en saison chaude.",
    criticality: "high",
    source: { ...QUOTE, url: "https://www.iata.org/en/programs/cargo/live-animals/pets/",
      quote: "Transport of snub nose dogs, such as boxers, pugs, bulldogs and Pekinese, in hot season is not recommended." },
  };
  check("un avis global complet passe", SafetyAdvisory.safeParse(AVIS).success);
  check("portée compagnie acceptée", SafetyAdvisory.safeParse({ ...AVIS, scope: "airline_turkish" }).success);
  check("portée inventée (`iata`) → refusée", !SafetyAdvisory.safeParse({ ...AVIS, scope: "iata" }).success);
  check("canaux VIDES → refusés", !SafetyAdvisory.safeParse({ ...AVIS, placements: [] }).success);
  check("canaux DUPLIQUÉS (`hold` deux fois) → refusés",
    !SafetyAdvisory.safeParse({ ...AVIS, placements: ["hold", "hold"] }).success);
  check("un avis se fonde sur une citation, jamais sur notre page",
    !SafetyAdvisory.safeParse({ ...AVIS, source: { ...AVIS.source, url: "https://mydogcanfly.com/iata" } }).success);
  check("clé de déduplication = (restriction, portée) — un avis global vaut pour le RAPPORT",
    advisoryKey(SafetyAdvisory.parse(AVIS)) === "brest_iata_snub_nose_hot_season|global"
      && advisoryKey(SafetyAdvisory.parse({ ...AVIS, scope: "airline_turkish" })) !== advisoryKey(SafetyAdvisory.parse(AVIS)));
}

/* ---- Fixtures moteur ------------------------------------------------------------------------- */
const kb = loadKB();
const AIRLINE = "airline_turkish";
if (!kb.airlines.get(AIRLINE)) throw new Error("fixture : airline_turkish absent de la KB");
const ENTRY_DENY = {
  id: "rule_fixture_entry_deny_preuves", scope: { type: "country", id: "country_tr" }, category: "import_rules",
  criticality: "critical",
  applies_when: { all: [{ fact: "route.dest_country_id", op: "eq", value: "country_tr" }] },
  effect: { action: "deny" }, params: {}, rationale: "fixture",
  source: { url: "https://example.com", source_type: "government", verified_date: "2026-08-16",
    review_due: "2027-02-12", confidence: 4, reviewer: "harnais", history: [] },
};
const fixtureKB = (addRules = []) => ({
  ...kb,
  airlines: new Map([[AIRLINE, kb.airlines.get(AIRLINE)]]),
  rules: [...kb.rules, ...addRules],
});
const req = (over = {}) => ({
  origin: "airport_cdg", destination: "airport_ist",
  dog: { breed_id: "breed_golden_retriever", weight_kg: 8 },
  travel_type: "pet", placement: "any", locale: "en", ...over,
});

console.log("=== 5. `explain()` — les preuves survivent à la reconstruction ===");
{
  /* Le moteur n'émet pas encore de preuves (le câblage est l'étape suivante) : on en INJECTE une
     dans la décision produite par `evaluate()`, puis on lit ce qu'`explain()` publie. C'est bien le
     chemin réel du moteur qui est éprouvé — `explain` n'est pas réimplémenté ici. */
  const injecter = (decision, statut, causes, preuves) => {
    const a = decision.airlines.find((x) => x.airline_id === AIRLINE);
    if (!a) throw new Error("fixture : la compagnie n'est pas dans la décision");
    a.placements = a.placements.map((d) => d.placement === "hold"
      ? makePlacementDecision("hold", statut, causes, undefined, preuves) : d);
    return decision;
  };
  const preuves = [EV("brest_vet_cert")];

  /* 5a — statut INCHANGÉ : la décision traverse telle quelle. */
  {
    const rep = explain(injecter(evaluate(fixtureKB(), req()), "confirmation_required", [REQ("brest_vet_cert")], preuves), "en");
    const dec = rep.airlines.find((a) => a.airline_id === AIRLINE)?.placement_decisions.find((d) => d.placement === "hold");
    check("statut inchangé : la preuve est publiée avec sa citation",
      dec?.status === "confirmation_required" && dec.evidence?.length === 1
        && dec.evidence[0].restriction_ref === "brest_vet_cert" && dec.evidence[0].source.quote === QUOTE.quote,
      JSON.stringify(dec));
  }

  /* 5b — statut DÉGRADÉ par `entryAllowed` : c'est là que les preuves disparaissaient. */
  {
    const rep = explain(injecter(evaluate(fixtureKB([ENTRY_DENY]), req()), "confirmation_required", [REQ("brest_vet_cert")], preuves), "en");
    const card = rep.airlines.find((a) => a.airline_id === AIRLINE);
    const dec = card?.placement_decisions.find((d) => d.placement === "hold");
    check("entrée refusée : le canal retombe en `denied` et les causes s'éteignent",
      rep.verdict === "incompatible" && dec?.status === "denied" && !("confirmation_causes" in dec),
      JSON.stringify(dec));
    check("… et la PREUVE DE RACE survit à la reconstruction, entière",
      dec?.evidence?.length === 1 && dec.evidence[0].restriction_ref === "brest_vet_cert"
        && dec.evidence[0].source.quote === QUOTE.quote,
      JSON.stringify(dec?.evidence));
  }

  /* 5c — une décision `denied` dégradée qui portait DEUX preuves les garde toutes les deux. */
  {
    const deux = [EV("brest_vet_cert"), EV("brest_crate", { url: "https://exemple-compagnie.example/crates" })];
    const rep = explain(injecter(evaluate(fixtureKB([ENTRY_DENY]), req()), "confirmation_required",
      [REQ("brest_vet_cert"), REQ("brest_crate")], deux), "en");
    const dec = rep.airlines.find((a) => a.airline_id === AIRLINE)?.placement_decisions.find((d) => d.placement === "hold");
    check("DEUX preuves dégradées : les deux survivent (aucune réduction à la première)",
      dec?.evidence?.length === 2 && new Set(dec.evidence.map((e) => e.restriction_ref)).size === 2,
      JSON.stringify(dec?.evidence?.map((e) => e.restriction_ref)));
  }
}

console.log("=== 6. `safety_advisories` — présent dans TOUS les rapports ===");
{
  /* La grille publique de la baseline T0-A : 9 routes × 2 chiens × 2 saisons × 2 placements. */
  const ROUTES = [
    ["airport_cdg", "airport_bkk"], ["airport_cdg", "airport_jfk"], ["airport_cdg", "airport_dxb"],
    ["airport_lhr", "airport_mia"], ["airport_fra", "airport_sin"], ["airport_mad", "airport_mex"],
    ["airport_cdg", "airport_lhr"], ["airport_jfk", "airport_cdg"], ["airport_mxp", "airport_jfk"],
  ];
  const _y = new Date().getUTCFullYear() + 1;
  let total = 0, absent = 0, nonTableau = 0, avis = 0;
  for (const [origin, destination] of ROUTES) {
    for (const breed_id of ["breed_golden_retriever", "breed_pug"]) {
      for (const mois of ["01-15", "07-15"]) {
        for (const placement of ["any", "hold"]) {
          const rep = explain(evaluate(kb, {
            origin, destination, dog: { breed_id }, travel_type: "pet",
            placement, date: `${_y}-${mois}`, locale: "en",
          }), "en");
          total++;
          if (!("safety_advisories" in rep)) absent++;
          else if (!Array.isArray(rep.safety_advisories)) nonTableau++;
          else avis += rep.safety_advisories.length;
        }
      }
    }
  }
  check(`les ${total} rapports de la grille publique portent tous \`safety_advisories\``,
    total === 72 && absent === 0 && nonTableau === 0,
    `${total} rapports, ${absent} sans le champ, ${nonTableau} d'un autre type`);
  /* Information, PAS une assertion : le champ est vide tant que le câblage n'a pas eu lieu, et
     exiger « 0 » ici ferait rougir la CI exactement quand le moteur commencera à émettre des avis. */
  console.log(`  info  avis émis aujourd'hui sur la grille : ${avis} (le câblage est l'étape suivante)`);
}

console.log(`\n${pass} OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
