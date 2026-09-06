#!/usr/bin/env node
/**
 * Harnais T0-A — le statut porte sa cause (contre-revues des 13–14/08/2026).
 *
 *   npx tsx test-t0a-statut-cause.mjs
 *
 * Trois niveaux :
 *   1. le CONTRAT : union discriminée inconstructible en état incohérent, triplet complet validé,
 *      schémas d'auteur stricts, projection sans perte des champs communs ;
 *   2. le MOTEUR sur FIXTURES (restriction en mémoire de la base réelle, patron du harnais
 *      tri-state — jamais une réimplémentation, jamais un fichier touché) : les 4 contre-tests
 *      climatiques exigés + agrégation destination + `offers_pet_transport` + tarif ;
 *   3. la DOMINANCE : refus dur / entrée refusée éteignent les causes ; l'agrégation destination
 *      conserve les signaux avec compagnie et canal.
 */
import { loadKB } from "./packages/knowledge/src/index.ts";
import {
  PlacementPolicyAuthored, CanonicalPlacementPolicyAuthored,
  projectPlacementPolicy,
} from "./packages/knowledge/src/objects.ts";
import { evaluate } from "./packages/engine/src/evaluate.ts";
import { explain } from "./packages/engine/src/explain.ts";
import { rankDestinations } from "./packages/engine/src/destinations.ts";
import {
  ConfirmationCause, PlacementDecision, PlacementDecisionSet,
  makePlacementDecision, makePlacementDecisionSet, hasActiveClimateCause,
} from "./packages/engine/src/contracts.ts";

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};
const throws = (fn) => { try { fn(); return false; } catch { return true; } };

/* Dates dynamiques, comparées sur la date UTC complète (patron v7 du harnais tri-state). */
const _now = new Date();
const _y = _now.getUTCFullYear();
const _today = Date.UTC(_y, _now.getUTCMonth(), _now.getUTCDate());
const nextDate = (month, day) => {
  const target = Date.UTC(_y, month - 1, day);
  const y = _today <= target ? _y : _y + 1;
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};
const JUILLET = nextDate(7, 15);
const JANVIER = nextDate(1, 15);
const GOLDEN = { breed_id: "breed_golden_retriever", weight_kg: 8 };

console.log("=== 1. Union discriminée : les états incohérents sont INCONSTRUCTIBLES ===");
{
  const climCause = { code: "estimated_climate", rule_id: "rule_x" };
  check("allowed se construit (allowed=true imposé par la branche)",
    makePlacementDecision("cabin", "allowed").allowed === true);
  check("confirmation avec cause se construit, allowed=false imposé",
    makePlacementDecision("hold", "confirmation_required", [climCause]).allowed === false);
  check("confirmation SANS cause → refusée à la construction",
    throws(() => makePlacementDecision("hold", "confirmation_required")));
  check("confirmation avec tableau vide → refusée",
    throws(() => makePlacementDecision("hold", "confirmation_required", [])));
  check("cause sur un statut allowed → refusée (le constructeur ne la transmet pas, le schéma la refuse)",
    !PlacementDecision.safeParse({ placement: "hold", status: "allowed", allowed: true, confirmation_causes: [climCause] }).success);
  check("`allowed: true` avec statut denied → refusé",
    !PlacementDecision.safeParse({ placement: "hold", status: "denied", allowed: true }).success);
  check("`allowed: true` avec statut confirmation_required → refusé",
    !PlacementDecision.safeParse({ placement: "hold", status: "confirmation_required", allowed: true, confirmation_causes: [climCause] }).success);
  check("clé inconnue sur une décision → refusée (.strict)",
    !PlacementDecision.safeParse({ placement: "hold", status: "allowed", allowed: true, extra: 1 }).success);
  const d = (p) => makePlacementDecision(p, "allowed");
  check("triplet complet {cabin,hold,cargo} accepté",
    PlacementDecisionSet.safeParse([d("cabin"), d("hold"), d("cargo")]).success);
  check("canal ABSENT → triplet refusé",
    !PlacementDecisionSet.safeParse([d("cabin"), d("hold")]).success);
  check("canal DUPLIQUÉ → triplet refusé",
    !PlacementDecisionSet.safeParse([d("cabin"), d("hold"), d("hold")]).success);
  check("makePlacementDecisionSet est le chemin unique du triplet",
    throws(() => makePlacementDecisionSet([d("cabin"), d("cargo"), d("cargo")])));
  /* Causes structurées : format policy_ref validé, tri stable + déduplication. */
  check("policy_ref au mauvais format (id de règle) → refusé",
    !ConfirmationCause.safeParse({ code: "policy_unpublished", policy_ref: "rule_thai_brachy" }).success);
  check("policy_ref `airline_x#cargo` accepté",
    ConfirmationCause.safeParse({ code: "airline_approval", policy_ref: "airline_thai_airways#cargo" }).success);
  const dd = makePlacementDecision("cargo", "confirmation_required", [
    { code: "policy_unpublished", policy_ref: "airline_b#cargo" },
    { code: "estimated_climate", rule_id: "rule_a" },
    { code: "estimated_climate", rule_id: "rule_a" },
  ]);
  check("causes dédupliquées et triées en ordre stable (climat avant politique, doublon absorbé)",
    dd.confirmation_causes.length === 2 && dd.confirmation_causes[0].code === "estimated_climate",
    JSON.stringify(dd.confirmation_causes));
}

console.log("=== 2. Schémas d'auteur : stricts, union exclusive, projection SANS PERTE ===");
{
  /* SRC = page officielle SANS phrase citée. Depuis la frontière de confiance (04/09/2026), elle
     ne suffit plus à produire un verdict : elle accompagne, elle ne décide pas. SRC_CITEE ajoute
     ce qui manque — la phrase, sa langue, son emplacement — et redevient décisive. Les deux
     existent côte à côte pour que la DIFFÉRENCE soit testée, et pas seulement l'un des deux cas. */
  const SRC = { url: "https://example.com/policy", source_type: "official_website", verified_date: "2026-08-14", review_due: "2027-08-14", confidence: 3, reviewer: "test", history: [] };
  const SRC_CITEE = { ...SRC, quote: "Dogs are accepted in the cabin up to 8 kg.", quote_language: "en", locator: "section « Pets »" };
  const enriched = {
    availability: "offered", derived_from_fiche: true,
    max_weight_kg: 8, carrier_dims_cm: { l: 55, w: 40, h: 23 },
    fee: "€125 (intra-Europe)", conditions: { en: "IATA crate" }, brachy_allowed: false, source: SRC_CITEE,
  };
  check("politique canonique ENRICHIE acceptée par le schéma d'auteur",
    CanonicalPlacementPolicyAuthored.safeParse(enriched).success);
  check("clé décisionnelle inconnue (`brachy_alowed`) → ÉCHEC de validation",
    !PlacementPolicyAuthored.safeParse({ ...enriched, brachy_alowed: true }).success);
  /* T0-B2 — la forme héritée `{allowed, conditional}` n'est plus une branche de l'union : ces
     deux contrôles ne disent plus « la faute de frappe est refusée » mais « la forme entière
     l'est ». C'est plus fort, et c'est ce qui empêche un artefact régénéré par un outil ancien
     d'être accepté puis projeté en ignorant `conditional`. */
  check("forme héritée `{allowed, conditional}` → ÉCHEC (schéma supprimé en T0-B2)",
    !PlacementPolicyAuthored.safeParse({ allowed: true, conditional: true, source: SRC }).success);
  check("faute `conditionnal` → ÉCHEC (le test qui aurait attrapé les 3 récidives)",
    !PlacementPolicyAuthored.safeParse({ allowed: true, conditionnal: true, source: SRC }).success);
  check("`allowed` ET `availability` simultanés → ÉCHEC (union exclusive)",
    !PlacementPolicyAuthored.safeParse({ allowed: true, availability: "offered", source: SRC }).success);
  const proj = projectPlacementPolicy(CanonicalPlacementPolicyAuthored.parse(enriched));
  check("projection canonique : offered AVEC phrase citée → status allowed",
    proj.status === "allowed" && proj.allowed === true, JSON.stringify(proj));
  check("les champs communs TRAVERSENT sans perte (poids, dims, tarif, conditions, brachy, source, provenance)",
    proj.max_weight_kg === 8 && proj.carrier_dims_cm?.l === 55 && proj.fee === "€125 (intra-Europe)"
      && proj.conditions?.en === "IATA crate" && proj.brachy_allowed === false
      && proj.source?.url === SRC_CITEE.url && proj.source?.quote === SRC_CITEE.quote
      && proj.derived_from_fiche === true,
    JSON.stringify(proj));
  const can = (availability) => projectPlacementPolicy(CanonicalPlacementPolicyAuthored.parse({ availability, source: SRC_CITEE }));
  /* AVEC la phrase : la disponibilité décide, exactement comme avant ce lot. */
  check("canonical offered + phrase citée → allowed", can("offered").status === "allowed");
  check("canonical not_offered + phrase citée → denied", can("not_offered").status === "denied");
  /* SANS la phrase : elle ne décide plus, et dit pourquoi. C'est LA propriété du lot, et elle
     est testée ici sur les deux sens — une acceptation non prouvée ne devient pas un refus, et
     un refus non prouvé ne devient pas une acceptation : les deux deviennent « à confirmer ». */
  const sansPhrase = (availability) => projectPlacementPolicy(CanonicalPlacementPolicyAuthored.parse({ availability, source: SRC }));
  check("canonical offered SANS phrase → à confirmer, cause official_source_unquoted",
    sansPhrase("offered").status === "confirmation_required"
      && sansPhrase("offered").status_cause === "official_source_unquoted", JSON.stringify(sansPhrase("offered")));
  check("canonical not_offered SANS phrase → à confirmer, jamais un refus maintenu",
    sansPhrase("not_offered").status === "confirmation_required"
      && sansPhrase("not_offered").allowed === false, JSON.stringify(sansPhrase("not_offered")));
  /* Provenance FABRIQUÉE depuis notre propre fiche : ni preuve, ni page à montrer. */
  const derivee = projectPlacementPolicy(CanonicalPlacementPolicyAuthored.parse({
    availability: "offered", source: SRC, source_derived: true }));
  check("canonical offered + provenance dérivée → à confirmer, cause legacy_unreviewed",
    derivee.status === "confirmation_required" && derivee.status_cause === "legacy_unreviewed",
    JSON.stringify(derivee));
  check("canonical case_by_case → confirmation + airline_approval",
    can("case_by_case").status === "confirmation_required" && can("case_by_case").status_cause === "airline_approval");
  check("canonical undocumented → confirmation + policy_unpublished",
    can("undocumented").status === "confirmation_required" && can("undocumented").status_cause === "policy_unpublished");

  /* Contre-revue v1, P0-1 : le RUNTIME est lui aussi une union discriminée — les cinq
     combinaisons contradictoires qu'acceptait l'objet plat sont désormais refusées. */
  const { PlacementPolicy } = await import("./packages/knowledge/src/objects.ts");
  const rt = (o) => PlacementPolicy.safeParse({ source: SRC, ...o }).success;
  check("runtime : status allowed + allowed:false → refusé", !rt({ status: "allowed", allowed: false }));
  check("runtime : status denied + allowed:true → refusé", !rt({ status: "denied", allowed: true }));
  check("runtime : confirmation SANS status_cause → refusé", !rt({ status: "confirmation_required", allowed: false }));
  check("runtime : allowed AVEC status_cause → refusé", !rt({ status: "allowed", allowed: true, status_cause: "policy_unpublished" }));
  check("runtime : denied AVEC status_cause → refusé", !rt({ status: "denied", allowed: false, status_cause: "airline_approval" }));
  /* Contre-revue v2 : les CONTENEURS sont stricts eux aussi — un canal ou un bloc mal
     orthographié est refusé, plus jamais accepté puis supprimé en silence. */
  const { Airline } = await import("./packages/knowledge/src/objects.ts");
  const kb0 = (await import("./packages/knowledge/src/index.ts")).loadKB;
  const rawA = JSON.parse((await import("node:fs")).readFileSync("packages/knowledge/raw/objects.json", "utf8")).airlines[0];
  const polOk = { allowed: true, source: SRC };
  check("conteneur policy : `holdd` → refusé",
    !Airline.safeParse({ ...rawA, premium: { policy: { holdd: polOk } } }).success);
  check("conteneur policy : `carog` → refusé",
    !Airline.safeParse({ ...rawA, premium: { policy: { carog: polOk } } }).success);
  check("conteneur premium : `polciy` → refusé",
    !Airline.safeParse({ ...rawA, premium: { polciy: { hold: polOk } } }).success);
  check("conteneur Airline : `premiun` → refusé",
    !Airline.safeParse({ ...rawA, premiun: {} }).success);
  check("conteneur fees : `hodl` → refusé",
    !Airline.safeParse({ ...rawA, fees: { hodl: "$100" } }).success);
  check("conteneur fees : `carog` → refusé",
    !Airline.safeParse({ ...rawA, fees: { carog: "$100" } }).success);
  check("le premier objet compagnie RÉEL passe toujours", Airline.safeParse(rawA).success);
  check("runtime : les trois formes cohérentes passent",
    rt({ status: "allowed", allowed: true }) && rt({ status: "denied", allowed: false })
      && rt({ status: "confirmation_required", allowed: false, status_cause: "airline_approval" }));
}

/* ---- Fixtures moteur : restriction en mémoire de la base réelle ---------------------------- */
const kb = loadKB();
const AIRLINE = "airline_turkish";
const base = kb.airlines.get(AIRLINE);
if (!base) throw new Error("fixture: airline_turkish absent de la KB");
const SRCFIX = base.premium?.policy?.hold?.source ?? base.premium?.policy?.cabin?.source;

/** KB restreinte à des compagnies choisies, avec politiques éventuellement patchées et règles filtrées. */
function fixtureKB({ airlines, patchPolicy = {}, dropRules = () => false, addRules = [], extraAirlines = [] }) {
  const m = new Map();
  for (const id of airlines) {
    const a = kb.airlines.get(id);
    if (!a) throw new Error(`fixture: ${id} absent`);
    const patched = patchPolicy[id]
      ? { ...a, premium: { ...a.premium, policy: { ...a.premium?.policy, ...patchPolicy[id] } } }
      : a;
    m.set(id, patched);
  }
  for (const a of extraAirlines) m.set(a.id, a);
  return { ...kb, airlines: m, rules: [...kb.rules.filter((r) => !dropRules(r)), ...addRules] };
}
const CONFIRM_POLICY = { status: "confirmation_required", status_cause: "policy_unpublished", allowed: false, source: SRCFIX };
/* SOUTE AUTORISÉE, EXPLICITE (frontière de confiance, 04/09/2026). La soute réelle de Turkish
   est passée « à confirmer » — sa politique ne porte aucune phrase citée —, ce qui privait de
   témoin deux contrôles qui ne parlent PAS de provenance : la confirmation climatique (cas 3) et
   la dominance d'agrégation côté destinations (cas 5). Ces deux propriétés se testent sur un
   canal AUTORISÉ ; on le pose donc en fixture, avec une provenance citée, plutôt que de
   l'emprunter à une donnée réelle qui ne le dit plus. */
const ALLOWED_POLICY = { status: "allowed", allowed: true,
  source: { ...SRCFIX, quote: "Dogs are accepted in the hold on this route.", quote_language: "en", locator: "section « Pets »" } };
const req = (over = {}) => ({
  origin: "airport_cdg", destination: "airport_ist", dog: GOLDEN,
  travel_type: "pet", placement: "any", locale: "en", ...over,
});

console.log("=== 3. Cas 1 — politique à confirmer, température MODÉRÉE → zéro message chaleur ===");
{
  const fkb = fixtureKB({ airlines: [AIRLINE], patchPolicy: { [AIRLINE]: { cargo: CONFIRM_POLICY } } });
  const rep = explain(evaluate(fkb, req({ date: JANVIER })), "en");
  const card = rep.airlines.find((a) => a.airline_id === AIRLINE);
  const cargoDec = card.placement_decisions.find((d) => d.placement === "cargo");
  check("le fret est à confirmer, cause policy_unpublished AVEC policy_ref",
    card.cargo_status === "confirmation_required"
      && cargoDec.confirmation_causes.length === 1
      && cargoDec.confirmation_causes[0].code === "policy_unpublished"
      && cargoDec.confirmation_causes[0].policy_ref === `${AIRLINE}#cargo`,
    JSON.stringify(cargoDec));
  check("AUCUN drapeau chaleur sur la carte (cause non climatique)", card.heat_confirmation_required === false);
  check("AUCUNE confirmation climatique au bandeau", (rep.climate?.confirmation_required ?? false) === false,
    JSON.stringify(rep.climate));
  const dst = rankDestinations(fixtureKB({ airlines: [AIRLINE], patchPolicy: { [AIRLINE]: { cargo: CONFIRM_POLICY } } }),
    { origin: "airport_cdg", dog: GOLDEN, date: JANVIER, locale: "en", placement: "any" });
  const ist = dst.matches.find((mm) => mm.iata === "IST");
  check("Destinations : signal conservé AVEC compagnie et canal, drapeau chaleur ÉTEINT",
    !!ist && ist.heat_confirmation_required === false
      && ist.confirmation_signals.some((s) => s.airline_id === AIRLINE && s.placement === "cargo" && s.cause.code === "policy_unpublished"),
    JSON.stringify(ist?.confirmation_signals));
}

console.log("=== 4. Cas 2 — politique à confirmer + estimation CHAUDE sans règle d'embargo ===");
{
  const fkb = fixtureKB({
    airlines: [AIRLINE],
    patchPolicy: { [AIRLINE]: { cargo: CONFIRM_POLICY } },
    dropRules: (r) => r.category === "summer_embargo",
  });
  const rep = explain(evaluate(fkb, req({ date: JUILLET })), "en");
  const card = rep.airlines.find((a) => a.airline_id === AIRLINE);
  check("le signal de température PEUT exister (indicateur brut)…",
    rep.climate?.estimated_heat_signal === true, JSON.stringify(rep.climate));
  check("…mais AUCUNE confirmation climatique : ni carte ni bandeau",
    card.heat_confirmation_required === false && rep.climate?.confirmation_required === false);
  check("la confirmation de POLITIQUE, elle, reste visible sur le fret",
    card.cargo_status === "confirmation_required"
      && card.placement_decisions.find((d) => d.placement === "cargo").confirmation_causes[0].code === "policy_unpublished");
}

console.log("=== 5. Cas 3 — véritable embargo estimé → confirmation climatique INCHANGÉE ===");
{
  const rep = explain(evaluate(fixtureKB({ airlines: [AIRLINE], patchPolicy: { [AIRLINE]: { hold: ALLOWED_POLICY } } }), req({ date: JUILLET })), "en");
  const card = rep.airlines.find((a) => a.airline_id === AIRLINE);
  const holdDec = card.placement_decisions.find((d) => d.placement === "hold");
  check("soute à confirmer, cause estimated_climate avec rule_id",
    card.hold_status === "confirmation_required" && hasActiveClimateCause(holdDec)
      && holdDec.confirmation_causes.every((c) => c.code === "estimated_climate" && c.rule_id.length > 0),
    JSON.stringify(holdDec));
  check("drapeau chaleur carte + bandeau ALLUMÉS, comme avant T0-A",
    card.heat_confirmation_required === true && rep.climate?.confirmation_required === true);
}

console.log("=== 6. Cas 4 — politique + climat sur le MÊME canal → deux causes visibles, ordre stable ===");
{
  const fkb = fixtureKB({ airlines: [AIRLINE], patchPolicy: { [AIRLINE]: { cargo: CONFIRM_POLICY } } });
  const rep = explain(evaluate(fkb, req({ date: JUILLET })), "en");
  const card = rep.airlines.find((a) => a.airline_id === AIRLINE);
  const cargoDec = card.placement_decisions.find((d) => d.placement === "cargo");
  const codes = cargoDec.confirmation_causes.map((c) => c.code);
  check("les DEUX familles coexistent sur le fret — aucune ne masque l'autre",
    codes.includes("estimated_climate") && codes.includes("policy_unpublished"), JSON.stringify(codes));
  check("ordre stable : climat avant politique (tri par clé canonique)",
    codes[0] === "estimated_climate" && codes[codes.length - 1] === "policy_unpublished");
  check("le drapeau chaleur reste allumé (la cause climatique est réellement active)",
    card.heat_confirmation_required === true);
}

console.log("=== 7. Cas 5 — agrégation destination : allowed d'une compagnie + signal d'une autre ===");
{
  /* Turkish garde sa soute ; une SECONDE compagnie directe CDG→IST (clone de fixture, aucune
     compagnie réelle n'a cette paire en double dans le graphe) a sa soute « à confirmer ». */
  const OTHER = "airline_fixture_two";
  const clone = {
    ...base, id: OTHER, name: "Fixture Two",
    premium: { ...base.premium, policy: { ...base.premium?.policy, hold: CONFIRM_POLICY } },
  };
  const fkb = fixtureKB({
    airlines: [AIRLINE],
    patchPolicy: { [AIRLINE]: { hold: ALLOWED_POLICY } },
    dropRules: (r) => r.category === "summer_embargo",
    extraAirlines: [clone],
  });
  const dst = rankDestinations(fkb, { origin: "airport_cdg", dog: GOLDEN, date: JANVIER, locale: "en", placement: "any" });
  const ist = dst.matches.find((mm) => mm.iata === "IST");
  check("hold_status agrégé = allowed (dominance destination : allowed > confirmation > denied)",
    !!ist && ist.hold_status === "allowed", JSON.stringify({ hold: ist?.hold_status }));
  check("le signal de l'autre compagnie SURVIT, avec compagnie + canal",
    !!ist && ist.confirmation_signals.some((s) => s.airline_id === OTHER && s.placement === "hold" && s.cause.code === "policy_unpublished"),
    JSON.stringify(ist?.confirmation_signals));
}

console.log("=== 8. offers_pet_transport : structurel, jamais éteint par une estimation ===");
{
  const onlyConfirm = {
    cabin: { status: "denied", allowed: false, source: SRCFIX },
    hold: { status: "denied", allowed: false, source: SRCFIX },
    cargo: CONFIRM_POLICY,
  };
  const fkb = fixtureKB({ airlines: [AIRLINE], patchPolicy: { [AIRLINE]: onlyConfirm } });
  const dec = evaluate(fkb, req({ date: JANVIER }));
  const a = dec.airlines.find((x) => x.airline_id === AIRLINE);
  /* MOUVEMENT NOMMÉ (05/09/2026) — le champ est TERNAIRE. Ce contrôle exigeait `true` sur une
     compagnie dont le seul canal ouvert est « à confirmer » : il défendait la bonne moitié de la
     propriété (« jamais aucun animal »), mais il affirmait l'autre sans preuve. Un canal à
     confirmer ne prouve pas que la compagnie transporte des animaux — il dit qu'on ne sait pas.
     La propriété défendue devient donc : ce n'est PAS « non », et ce n'est pas « oui » non plus. */
  check("compagnie au SEUL canal à confirmer → « on ne sait pas », jamais « aucun animal »",
    a.offers_pet_transport === "unknown", String(a.offers_pet_transport));
  const july = evaluate(fixtureKB({ airlines: [AIRLINE] }), req({ date: JUILLET })).airlines.find((x) => x.airline_id === AIRLINE);
  const january = evaluate(fixtureKB({ airlines: [AIRLINE] }), req({ date: JANVIER })).airlines.find((x) => x.airline_id === AIRLINE);
  check("une estimation climatique ne change JAMAIS la valeur (juillet = janvier)",
    july.offers_pet_transport === january.offers_pet_transport);
  const allClosed = {
    cabin: { status: "denied", allowed: false, source: SRCFIX },
    hold: { status: "denied", allowed: false, source: SRCFIX },
    cargo: { status: "denied", allowed: false, source: SRCFIX },
  };
  const closed = evaluate(fixtureKB({ airlines: [AIRLINE], patchPolicy: { [AIRLINE]: allClosed } }), req({ date: JANVIER }))
    .airlines.find((x) => x.airline_id === AIRLINE);
  check("compagnie fermée sur les trois canaux (refus PROUVÉS) → « non »",
    closed.offers_pet_transport === "no", String(closed.offers_pet_transport));
  /* Et le troisième état, qui n'existait pas : une politique ABSENTE ne dit pas « non ». */
  const absente = evaluate(fixtureKB({ airlines: [AIRLINE], patchPolicy: { [AIRLINE]: {} } }), req({ date: JANVIER }))
    .airlines.find((x) => x.airline_id === AIRLINE);
  check("compagnie sans aucune politique → « on ne sait pas », jamais « non »",
    absente.offers_pet_transport === "unknown", String(absente.offers_pet_transport));
}

console.log("=== 9. Tarif : jamais emprunté à un autre canal quand le premier est à confirmer ===");
{
  const onlyConfirm = {
    cabin: { status: "denied", allowed: false, source: SRCFIX },
    hold: { status: "denied", allowed: false, source: SRCFIX },
    cargo: CONFIRM_POLICY,
  };
  const fkb = fixtureKB({ airlines: [AIRLINE], patchPolicy: { [AIRLINE]: onlyConfirm } });
  const a = evaluate(fkb, req({ date: JANVIER })).airlines.find((x) => x.airline_id === AIRLINE);
  check("aucun placement allowed → aucun tarif publié repris (fee absent)",
    a.fee === undefined, JSON.stringify({ fee: a.fee }));
}

console.log("=== 10. Dominance intra-compagnie : un refus dur ÉTEINT les causes ===");
{
  /* Entrée refusée au pays : les confirmations tombent en denied et AUCUNE cause ne survit
     dans le triplet public. */
  const denyEntry = {
    id: "rule_fixture_entry_deny", scope: { type: "country", id: "country_tr" }, category: "import_rules",
    criticality: "critical",
    applies_when: { all: [{ fact: "route.dest_country_id", op: "eq", value: "country_tr" }] },
    effect: { action: "deny" }, params: {},
    /* CITÉE (05/09/2026) : la frontière atteint l'entrée dans le pays, et une interdiction non
       citée ne ferme plus rien. Ce paragraphe éprouve la DOMINANCE d'un refus sur les causes de
       confirmation, pas le droit d'interdire — il lui faut donc une interdiction recevable. */
    rationale: "fixture", source: { url: "https://example.gov/import", source_type: "government",
      verified_date: "2026-08-14", review_due: "2027-08-14", confidence: 4, reviewer: "test",
      quote: "Dogs of this description may not be imported.", quote_language: "en",
      locator: "section « fixture »", history: [] },
  };
  const fkb = fixtureKB({ airlines: [AIRLINE], patchPolicy: { [AIRLINE]: { cargo: CONFIRM_POLICY } }, addRules: [denyEntry] });
  const rep = explain(evaluate(fkb, req({ date: JUILLET })), "en");
  const card = rep.airlines.find((a) => a.airline_id === AIRLINE);
  check("entrée refusée → tous les canaux publics denied, ZÉRO cause survivante, verdict incompatible",
    rep.verdict === "incompatible"
      && card.placement_decisions.every((d) => d.status === "denied" && !("confirmation_causes" in d))
      && card.heat_confirmation_required === false,
    JSON.stringify(card.placement_decisions));
}

console.log(`\n${pass} OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
