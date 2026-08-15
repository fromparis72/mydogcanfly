#!/usr/bin/env node
/**
 * Harnais T0-B1 — la cause `legacy_unreviewed` traverse toute la chaîne, SANS toucher aux données.
 *
 *   npx tsx test-t0b-legacy-unreviewed.mjs
 *
 * T0-B1 est un lot NEUTRE : il installe le chemin complet — schéma d'auteur, projection, union
 * runtime, contrat moteur, moteur, agrégation Destinations — pour une cause que AUCUNE donnée
 * réelle n'émet encore. La bascule des 74 politiques héritées appartient à T0-B2, et elle passera
 * par la réécriture des fiches, l'ingestion et un diff approuvé.
 *
 * Ce harnais prouve donc DEUX choses opposées, et c'est le cœur du lot :
 *   1. le chemin existe et fonctionne de bout en bout — sur FIXTURES ;
 *   2. il ne s'allume pour personne — la base réelle est inchangée, et aucun interrupteur ne
 *      permet de la faire basculer sans réécrire les fiches (section 6).
 */
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { loadKB } from "./packages/knowledge/src/index.ts";
import {
  PlacementPolicy, PlacementPolicyAuthored, LegacyUnreviewedPlacementPolicyAuthored,
  projectPlacementPolicy,
} from "./packages/knowledge/src/objects.ts";
import { evaluate } from "./packages/engine/src/evaluate.ts";
import { explain } from "./packages/engine/src/explain.ts";
import { rankDestinations } from "./packages/engine/src/destinations.ts";
import {
  ConfirmationCause, PlacementDecision, makePlacementDecision, hasActiveClimateCause,
} from "./packages/engine/src/contracts.ts";

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};
const throws = (fn) => { try { fn(); return false; } catch { return true; } };

/* Dates dynamiques (patron des harnais T0-A) : le prochain 15 janvier / 15 juillet. */
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

const SRC = {
  url: "https://example.com/policy", source_type: "official_website",
  verified_date: "2026-08-14", review_due: "2027-08-14", confidence: 3, reviewer: "test", history: [],
};

console.log("=== 1. Schéma d'AUTEUR : une branche à part, pas une disponibilité de plus ===");
{
  const nonRevue = { review_state: "legacy_unreviewed", source: SRC };
  check("branche `review_state` acceptée par le schéma d'auteur", LegacyUnreviewedPlacementPolicyAuthored.safeParse(nonRevue).success);
  check("…et par l'union d'auteur", PlacementPolicyAuthored.safeParse(nonRevue).success);
  check("`review_state` + `allowed` → refusé (deux branches à la fois)",
    !PlacementPolicyAuthored.safeParse({ ...nonRevue, allowed: true }).success);
  check("`review_state` + `availability` → refusé",
    !PlacementPolicyAuthored.safeParse({ ...nonRevue, availability: "offered" }).success);
  check("valeur de `review_state` inventée → refusée",
    !PlacementPolicyAuthored.safeParse({ review_state: "en_cours", source: SRC }).success);
  check("clé inconnue sur la branche → refusée (.strict)",
    !PlacementPolicyAuthored.safeParse({ ...nonRevue, note: "x" }).success);
  check("branche sans source → refusée (la provenance reste obligatoire)",
    !PlacementPolicyAuthored.safeParse({ review_state: "legacy_unreviewed" }).success);
  /* `legacy_unreviewed` décrit l'état de NOTRE référentiel, jamais ce que propose la compagnie :
     l'enum métier `availability` doit l'ignorer. */
  check("`availability: \"legacy_unreviewed\"` → REFUSÉ (ce n'est pas une disponibilité)",
    !PlacementPolicyAuthored.safeParse({ availability: "legacy_unreviewed", source: SRC }).success);
}

console.log("=== 2. Projection : confirmation_required / legacy_unreviewed, champs communs intacts ===");
{
  const enrichie = {
    review_state: "legacy_unreviewed", derived_from_fiche: true,
    max_weight_kg: 8, carrier_dims_cm: { l: 55, w: 40, h: 23 },
    fee: "€125 (intra-Europe)", conditions: { en: "IATA crate" }, brachy_allowed: false, source: SRC,
  };
  const proj = projectPlacementPolicy(PlacementPolicyAuthored.parse(enrichie));
  check("projection → confirmation_required avec cause legacy_unreviewed",
    proj.status === "confirmation_required" && proj.status_cause === "legacy_unreviewed" && proj.allowed === false,
    JSON.stringify(proj));
  check("les champs communs TRAVERSENT sans perte (poids, dims, tarif, conditions, brachy, source, provenance)",
    proj.max_weight_kg === 8 && proj.carrier_dims_cm?.l === 55 && proj.fee === "€125 (intra-Europe)"
      && proj.conditions?.en === "IATA crate" && proj.brachy_allowed === false
      && proj.source?.url === SRC.url && proj.derived_from_fiche === true,
    JSON.stringify(proj));
}

console.log("=== 3. Union RUNTIME : la cause est inconstructible hors confirmation ===");
{
  const rt = (o) => PlacementPolicy.safeParse({ source: SRC, ...o }).success;
  check("confirmation + legacy_unreviewed → accepté", rt({ status: "confirmation_required", allowed: false, status_cause: "legacy_unreviewed" }));
  check("status ALLOWED + cause legacy_unreviewed → REFUSÉ",
    !rt({ status: "allowed", allowed: true, status_cause: "legacy_unreviewed" }));
  check("status DENIED + cause legacy_unreviewed → REFUSÉ",
    !rt({ status: "denied", allowed: false, status_cause: "legacy_unreviewed" }));
  check("confirmation + legacy_unreviewed + allowed:true → refusé (booléen imposé par la branche)",
    !rt({ status: "confirmation_required", allowed: true, status_cause: "legacy_unreviewed" }));
}

console.log("=== 4. Contrat MOTEUR : cause structurée, policy_ref obligatoire, tri stable ===");
{
  const bonne = { code: "legacy_unreviewed", policy_ref: "airline_thai_airways#cargo" };
  check("cause avec policy_ref bien formé → acceptée", ConfirmationCause.safeParse(bonne).success);
  check("cause SANS policy_ref → refusée", !ConfirmationCause.safeParse({ code: "legacy_unreviewed" }).success);
  check("policy_ref au format d'un id de règle → refusé",
    !ConfirmationCause.safeParse({ code: "legacy_unreviewed", policy_ref: "rule_x" }).success);
  check("policy_ref sans canal → refusé",
    !ConfirmationCause.safeParse({ code: "legacy_unreviewed", policy_ref: "airline_thai_airways" }).success);
  check("clé supplémentaire sur la cause → refusée",
    !ConfirmationCause.safeParse({ ...bonne, rule_id: "rule_x" }).success);
  /* Inconstructible sur un statut ferme, aux DEUX bouts (patron T0-A) : le constructeur ne
     transmet pas la cause, et le schéma refuse le littéral qui la porterait. Une décision
     `allowed` porteuse d'une cause de confirmation n'existe donc dans aucun chemin. */
  const surAllowed = makePlacementDecision("cargo", "allowed", [bonne]);
  const surDenied = makePlacementDecision("cargo", "denied", [bonne]);
  check("constructeur : la cause n'est PAS transmise sur un statut allowed",
    !("confirmation_causes" in surAllowed) && surAllowed.allowed === true, JSON.stringify(surAllowed));
  check("constructeur : la cause n'est PAS transmise sur un statut denied",
    !("confirmation_causes" in surDenied) && surDenied.allowed === false, JSON.stringify(surDenied));
  check("confirmation SANS cause → LÈVE (la branche exige au moins une cause)",
    throws(() => makePlacementDecision("cargo", "confirmation_required", [])));
  check("schéma : allowed porteur de la cause → refusé",
    !PlacementDecision.safeParse({ placement: "cargo", status: "allowed", allowed: true, confirmation_causes: [bonne] }).success);
  check("schéma : denied porteur de la cause → refusé",
    !PlacementDecision.safeParse({ placement: "cargo", status: "denied", allowed: false, confirmation_causes: [bonne] }).success);
  /* Tri et déduplication : l'ordre canonique reste climat → legacy_unreviewed → policy. */
  const d = makePlacementDecision("cargo", "confirmation_required", [
    { code: "policy_unpublished", policy_ref: "airline_b#cargo" },
    bonne, bonne,
    { code: "estimated_climate", rule_id: "rule_a" },
  ]);
  check("doublon absorbé (3 causes distinctes sur 4 entrées)", d.confirmation_causes.length === 3, JSON.stringify(d.confirmation_causes));
  check("ordre stable : climat, puis donnée non revérifiée, puis politique",
    d.confirmation_causes.map((c) => c.code).join(",") === "estimated_climate,legacy_unreviewed,policy_unpublished",
    JSON.stringify(d.confirmation_causes.map((c) => c.code)));
  check("une cause non revérifiée n'est PAS une cause climatique", !hasActiveClimateCause(
    makePlacementDecision("cargo", "confirmation_required", [bonne])));
}

/* ---- Fixtures moteur : restriction en mémoire de la base réelle (patron T0-A) --------------- */
const kb = loadKB();
const AIRLINE = "airline_turkish";
const base = kb.airlines.get(AIRLINE);
if (!base) throw new Error("fixture: airline_turkish absent de la KB");
const SRCFIX = base.premium?.policy?.hold?.source ?? base.premium?.policy?.cabin?.source;

/** La politique de fixture est PROJETÉE depuis la branche d'auteur — jamais écrite à la main en
 *  forme runtime : c'est la chaîne complète auteur → projection → moteur qui est testée. */
const NON_REVUE = projectPlacementPolicy(PlacementPolicyAuthored.parse({
  review_state: "legacy_unreviewed", source: SRCFIX,
}));

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
const req = (over = {}) => ({
  origin: "airport_cdg", destination: "airport_ist", dog: GOLDEN,
  travel_type: "pet", placement: "any", locale: "en", ...over,
});

console.log("=== 5. Moteur sur fixture : la cause remonte jusqu'à la carte ===");
{
  const fkb = fixtureKB({ airlines: [AIRLINE], patchPolicy: { [AIRLINE]: { cargo: NON_REVUE } } });
  const rep = explain(evaluate(fkb, req({ date: JANVIER })), "en");
  const card = rep.airlines.find((a) => a.airline_id === AIRLINE);
  const cargo = card.placement_decisions.find((d) => d.placement === "cargo");
  check("le fret est à confirmer, cause legacy_unreviewed AVEC policy_ref",
    card.cargo_status === "confirmation_required"
      && cargo.confirmation_causes.length === 1
      && cargo.confirmation_causes[0].code === "legacy_unreviewed"
      && cargo.confirmation_causes[0].policy_ref === `${AIRLINE}#cargo`,
    JSON.stringify(cargo));
  check("le canal n'est PAS présenté comme disponible", card.cargo === false && cargo.allowed === false);
  check("AUCUN drapeau chaleur (la cause n'est pas climatique)", card.heat_confirmation_required === false);
  check("AUCUNE confirmation climatique au bandeau", (rep.climate?.confirmation_required ?? false) === false);
  check("le fret figure dans `to_confirm`", (card.to_confirm ?? []).includes("cargo"), JSON.stringify(card.to_confirm));
  /* Une donnée non revérifiée n'est pas une compagnie qui refuse les animaux. */
  const onlyUnreviewed = {
    cabin: { status: "denied", allowed: false, source: SRCFIX },
    hold: { status: "denied", allowed: false, source: SRCFIX },
    cargo: NON_REVUE,
  };
  const dec = evaluate(fixtureKB({ airlines: [AIRLINE], patchPolicy: { [AIRLINE]: onlyUnreviewed } }), req({ date: JANVIER }));
  const a = dec.airlines.find((x) => x.airline_id === AIRLINE);
  check("seul canal non revérifié → offers_pet_transport reste true (jamais « aucun animal »)",
    a.offers_pet_transport === true && a.carries_pets === true);
  check("aucun placement allowed → aucun tarif emprunté", a.fee === undefined, JSON.stringify({ fee: a.fee }));

  console.log("--- coexistence avec le climat, et dominance d'un refus dur ---");
  const chaud = explain(evaluate(fixtureKB({ airlines: [AIRLINE], patchPolicy: { [AIRLINE]: { cargo: NON_REVUE } } }), req({ date: JUILLET })), "en");
  const cardChaud = chaud.airlines.find((x) => x.airline_id === AIRLINE);
  const codes = cardChaud.placement_decisions.find((d) => d.placement === "cargo").confirmation_causes.map((c) => c.code);
  check("climat ET donnée non revérifiée coexistent sur le même canal, aucune ne masque l'autre",
    codes.includes("estimated_climate") && codes.includes("legacy_unreviewed"), JSON.stringify(codes));
  check("ordre stable sur la carte : climat d'abord", codes[0] === "estimated_climate", JSON.stringify(codes));
  check("le drapeau chaleur reste allumé (la cause climatique est bien active)", cardChaud.heat_confirmation_required === true);

  const denyEntry = {
    id: "rule_fixture_t0b_entry_deny", scope: { type: "country", id: "country_tr" }, category: "import_rules",
    criticality: "critical",
    applies_when: { all: [{ fact: "route.dest_country_id", op: "eq", value: "country_tr" }] },
    effect: { action: "deny" }, params: {}, rationale: "fixture",
    source: { url: "https://example.com", source_type: "government", verified_date: "2026-08-14", review_due: "2027-08-14", confidence: 4, reviewer: "test", history: [] },
  };
  const refus = explain(evaluate(fixtureKB({
    airlines: [AIRLINE], patchPolicy: { [AIRLINE]: { cargo: NON_REVUE } }, addRules: [denyEntry],
  }), req({ date: JUILLET })), "en");
  const cardRefus = refus.airlines.find((x) => x.airline_id === AIRLINE);
  check("un refus dur ÉTEINT la cause non revérifiée (dominance intra-compagnie)",
    refus.verdict === "incompatible"
      && cardRefus.placement_decisions.every((d) => d.status === "denied" && !("confirmation_causes" in d)),
    JSON.stringify(cardRefus.placement_decisions));
}

console.log("=== 6. Agrégation Destinations : le signal survit, avec compagnie et canal ===");
{
  const fkb = fixtureKB({ airlines: [AIRLINE], patchPolicy: { [AIRLINE]: { cargo: NON_REVUE } } });
  const dst = rankDestinations(fkb, { origin: "airport_cdg", dog: GOLDEN, date: JANVIER, locale: "en", placement: "any" });
  const ist = dst.matches.find((m) => m.iata === "IST");
  check("signal conservé AVEC compagnie et canal",
    !!ist && ist.confirmation_signals.some((s) => s.airline_id === AIRLINE && s.placement === "cargo" && s.cause.code === "legacy_unreviewed"),
    JSON.stringify(ist?.confirmation_signals));
  check("drapeau chaleur ÉTEINT sur la destination", ist?.heat_confirmation_required === false);
  /* Une seconde compagnie ouverte ne doit pas effacer le signal de la première. */
  const OTHER = "airline_fixture_t0b_two";
  const clone2 = { ...base, id: OTHER, name: "Fixture T0B Two", premium: { ...base.premium, policy: { ...base.premium?.policy, hold: NON_REVUE } } };
  const dst2 = rankDestinations(fixtureKB({
    airlines: [AIRLINE], dropRules: (r) => r.category === "summer_embargo", extraAirlines: [clone2],
  }), { origin: "airport_cdg", dog: GOLDEN, date: JANVIER, locale: "en", placement: "any" });
  const ist2 = dst2.matches.find((m) => m.iata === "IST");
  check("hold agrégé = allowed (dominance destination) MAIS le signal de l'autre compagnie survit",
    !!ist2 && ist2.hold_status === "allowed"
      && ist2.confirmation_signals.some((s) => s.airline_id === OTHER && s.placement === "hold" && s.cause.code === "legacy_unreviewed"),
    JSON.stringify({ hold: ist2?.hold_status, sig: ist2?.confirmation_signals }));
}

console.log("=== 7. T0-B2 : la migration est FAITE, et la forme héritée est inconstructible ===");
{
  /* 7.1 — la cause est désormais PORTÉE par la base réelle, à l'effectif exact du registre
     approuvé : 83 politiques non revérifiées (73 du manifeste + 10 anciens POLICY_STALE), et
     elles seules. En T0-B1 ce compte valait 0 : la bascule est ce lot, et rien d'autre. */
  let porteuses = 0, canaux = 0, nonPubliee = 0;
  for (const a of kb.airlines.values()) {
    for (const ch of ["cabin", "hold", "cargo"]) {
      const p = a.premium?.policy?.[ch];
      if (!p) continue;
      canaux++;
      if (p.status_cause === "legacy_unreviewed") porteuses++;
      if (p.status_cause === "policy_unpublished") nonPubliee++;
    }
  }
  check(`les ${canaux} politiques réelles sont au complet`, canaux === 302, String(canaux));
  check("83 politiques émettent legacy_unreviewed (73 manifeste + 10 stale)", porteuses === 83, String(porteuses));
  check("1 seule émet policy_unpublished (Thai Cargo)", nonPubliee === 1, String(nonPubliee));

  /* 7.2 — l'artefact ne porte plus AUCUNE forme d'auteur héritée. C'est la contrepartie
     matérielle de la suppression du schéma : si un `allowed` ou un `conditional` réapparaissait
     dans objects.json, la validation le refuserait — ce contrôle le voit avant même le moteur. */
  const objets = JSON.parse(readFileSync("packages/knowledge/raw/objects.json", "utf8"));
  let herites = 0, decidees = 0;
  for (const a of objets.airlines) {
    const pol = a.premium?.policy ?? {};
    for (const ch of ["cabin", "hold", "cargo"]) {
      if (!pol[ch]) continue;
      decidees++;
      if ("allowed" in pol[ch] || "conditional" in pol[ch]) herites++;
    }
  }
  check("302 politiques d'auteur dans l'artefact", decidees === 302, String(decidees));
  check("ZÉRO forme héritée `{allowed}` / `conditional` subsistante", herites === 0, `${herites} résiduelle(s)`);

  /* 7.3 — la forme héritée n'est plus seulement absente : elle est INCONSTRUCTIBLE. Tant que la
     branche existait, un artefact régénéré par un outil ancien aurait été validé sans bruit, puis
     projeté en ignorant `conditional`. L'union ne la connaît plus. */
  const heritee = { allowed: true, conditional: true, source: SRC };
  check("legacy { allowed:true, conditional:true } → REFUSÉ (schéma supprimé en T0-B2)",
    !PlacementPolicyAuthored.safeParse(heritee).success);
  check("legacy { allowed:false } seul → REFUSÉ",
    !PlacementPolicyAuthored.safeParse({ allowed: false, source: SRC }).success);
  check("legacy + `review_state` dans le même objet → REFUSÉ (pas d'objet hybride)",
    !PlacementPolicyAuthored.safeParse({ ...heritee, review_state: "legacy_unreviewed" }).success);
  check("`availability` + `review_state` → REFUSÉ (union exclusive, inchangé)",
    !PlacementPolicyAuthored.safeParse({ availability: "offered", review_state: "legacy_unreviewed", source: SRC }).success);
}

console.log("=== 8. Baseline FIGÉE : le point de comparaison de T0-B2 est scellé ===");
{
  /* La baseline « avant » de T0-B est une COPIE distincte, prise au SHA 18ea425, avant toute
     mutation métier. Son empreinte est scellée ici : c'est elle, et rien d'autre, qui servira de
     référence au diff exhaustif de T0-B2. La baseline T0-A vivra sa vie ; celle-ci ne bouge plus. */
  const AVANT = "test-baselines/t0b-finder-baseline-avant.json";
  const EMPREINTE = "bc10c594831b662933dcba7835dfe78872ebfb4dd5a884e2faaaf6256045b7bb";
  const octets = readFileSync(AVANT);
  check(`empreinte SHA-256 de la baseline figée = ${EMPREINTE.slice(0, 12)}…`,
    createHash("sha256").update(octets).digest("hex") === EMPREINTE,
    createHash("sha256").update(octets).digest("hex"));
  check("72 scénarios, comme la matrice T0-A", Object.keys(JSON.parse(octets.toString("utf8"))).length === 72);
  /* Le contrôle temporaire de T0-B1 a joué son rôle : il exigeait que la baseline T0-A soit
     identique à la figée « tant qu'aucune mutation métier n'a eu lieu », et prévenait qu'il
     échouerait en T0-B2 pour forcer un constat explicite plutôt qu'un remplacement silencieux.
     Le constat est fait ici, et il est retourné : la baseline vivante a MAINTENANT bougé, elle
     vaut exactement la baseline figée APRÈS T0-B2, et la figée AVANT — dont l'empreinte est
     revérifiée juste au-dessus — n'a pas bougé d'un octet. Les deux bornes du diff approuvé sont
     donc scellées, et leur écart est verrouillé carte par carte dans `t0b2-approved-diff.json`
     (harnais `test-t0a-baseline.mjs`). */
  const vivante = readFileSync("test-baselines/t0a-finder-baseline.json");
  check("T0-B2 : la baseline vivante a bougé — elle DIFFÈRE de la figée AVANT",
    !vivante.equals(octets));
  check("T0-B2 : la baseline vivante est identique à la figée APRÈS",
    vivante.equals(readFileSync("test-baselines/t0b2-finder-baseline-apres.json")));
  check("empreinte de la baseline figée APRÈS = 5dad5396527c…",
    createHash("sha256").update(readFileSync("test-baselines/t0b2-finder-baseline-apres.json")).digest("hex")
      === "5dad5396527c94bcb1a0fc2bb2c79b94052c26ca32d92fb47cfecd43a205d2e7");
}

console.log(`\n${pass} OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
