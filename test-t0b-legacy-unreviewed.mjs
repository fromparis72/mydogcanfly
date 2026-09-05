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
import YAML from "yaml";
import { createHash } from "node:crypto";
import { loadKB, preuveAuditee, estAutoCitation } from "./packages/knowledge/src/index.ts";
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
  /* MOUVEMENT NOMMÉ (05/09/2026) — statut ternaire. Une donnée non revérifiée ne prouve pas
     davantage que la compagnie transporte des animaux qu'elle ne prouve le contraire. Ce que ce
     contrôle défend reste entier : elle ne bascule PAS vers « aucun animal ». */
  check("seul canal non revérifié → « on ne sait pas », jamais « aucun animal »",
    a.offers_pet_transport === "unknown", String(a.offers_pet_transport));
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
    /* CITÉE (05/09/2026) : depuis que la frontière atteint l'entrée dans le pays, une interdiction
       non citée demande confirmation au lieu de fermer. Ce témoin éprouve la DOMINANCE d'un refus
       sur une cause non revérifiée — il lui faut un refus qui a le droit d'exister. */
    source: { url: "https://example.gov/import", source_type: "government", verified_date: "2026-08-14",
      review_due: "2027-08-14", confidence: 4, reviewer: "test",
      quote: "Dogs of this description may not be imported.", quote_language: "en",
      locator: "section « fixture »", history: [] },
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
  /* La soute de la compagnie de référence est POSÉE `allowed` en fixture, avec une provenance
     citée : depuis la frontière de confiance (04/09/2026), aucune politique réelle ne l'est, et
     le témoin de dominance — « un canal agrégé `allowed` n'efface pas le signal d'une autre
     compagnie » — n'avait plus de canal autorisé à agréger. La propriété testée ne parle pas de
     provenance ; on lui rend donc son cas, sans emprunter à une donnée qui ne le dit plus. */
  const SOUTE_AUTORISEE = { status: "allowed", allowed: true,
    source: { ...(base.premium?.policy?.hold?.source ?? base.premium?.policy?.cabin?.source),
      quote: "Dogs are accepted in the hold on this route.", quote_language: "en", locator: "section « Pets »" } };
  const dst2 = rankDestinations(fixtureKB({
    airlines: [AIRLINE], patchPolicy: { [AIRLINE]: { hold: SOUTE_AUTORISEE } },
    dropRules: (r) => r.category === "summer_embargo", extraAirlines: [clone2],
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
     elles seules. En T0-B1 ce compte valait 0 : la bascule est ce lot, et rien d'autre.
     28/08/2026 (2e passe de contre-revue Codex) — 84 : la cabine Garuda Indonesia rejoint
     l'héritage non re-vérifié (« not_offered » affirmait une interdiction qu'aucune page
     officielle lisible ne prouve), décision nommée dans DECISIONS_POST_MIGRATION de
     test-t0b-matrice.mjs. 73 manifeste + 10 stale + 1 décision post-migration. */
  let porteuses = 0, canaux = 0, nonPubliee = 0, nonCitee = 0;
  for (const a of kb.airlines.values()) {
    for (const ch of ["cabin", "hold", "cargo"]) {
      const p = a.premium?.policy?.[ch];
      if (!p) continue;
      canaux++;
      if (p.status_cause === "legacy_unreviewed") porteuses++;
      if (p.status_cause === "policy_unpublished") nonPubliee++;
      if (p.status_cause === "official_source_unquoted") nonCitee++;
    }
  }
  check(`les ${canaux} politiques réelles sont au complet`, canaux === 302, String(canaux));
  /* 04/09/2026 — FRONTIÈRE DE CONFIANCE. 84 → 267. Les 84 d'origine restent ce qu'elles étaient
     (73 manifeste + 10 stale + Garuda cabine) ; s'y ajoutent les 183 décisions catégoriques dont
     la provenance est fabriquée depuis notre propre fiche, auto-citée, ou absente — elles ne
     peuvent ni décider ni montrer quoi que ce soit. Les 33 qui gardent une page officielle à
     montrer portent `official_source_unquoted` et sont comptées à part, ci-dessous : 267 + 33
     = les 300 politiques sans preuve citée, les 2 dernières étant Thai fret et Virgin cabine. */
  check("267 politiques émettent legacy_unreviewed (84 d'origine + 183 sans page à montrer)",
    porteuses === 267, String(porteuses));
  /* 05/09/2026 — 33 → 32. British Airways cabine quitte ce groupe : sa page officielle porte
     désormais la phrase, et la politique devient le premier `denied` prouvé du dépôt. Chaque
     citation suivante fera baisser ce compte, et devra le nommer comme celle-ci. */
  check("32 politiques émettent official_source_unquoted — une page officielle, aucune phrase citée",
    nonCitee === 32, String(nonCitee));
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

console.log("=== 7 bis. La décision AUDITÉE arrive avec sa PREUVE (Thai Cargo) ===");
{
  /* Une décision auditée migrée sans sa provenance n'est pas migrée, elle est recopiée : la
     fiche disait `availability: undocumented` et la politique canonique recevait la page
     d'accueil de la compagnie, une date antérieure et une confiance moindre (contre-revue du
     15/08/2026). On compare donc les TROIS représentations à la source approuvée du manifeste :
     ce que la fiche écrit, ce que l'artefact porte, ce que le runtime sert. */
  const manifeste = JSON.parse(readFileSync("test-baselines/t0b-migration-matrice.json", "utf8"));
  const approuvee = manifeste.rows.find(
    (r) => r.identity.airline_id === "airline_thai_airways" && r.identity.placement === "cargo",
  ).decision.source;

  const fiche = YAML.parse(readFileSync("content/airlines/thai_airways.yml", "utf8"));
  const yamlSource = fiche.policies?.cargo?.source;
  check("la FICHE porte une source auditée sur thai/cargo", !!yamlSource);

  const CHAMPS = ["url", "source_type", "verified_date", "review_due", "confidence", "reviewer", "quote", "quote_language", "locator"];
  const ecarts = (src) => CHAMPS.filter((c) => JSON.stringify(src?.[c]) !== JSON.stringify(approuvee[c]));
  check("fiche ≡ source APPROUVÉE du manifeste, champ par champ", ecarts(yamlSource).length === 0,
    `écarts : ${ecarts(yamlSource).join(", ")}`);

  const artefact = JSON.parse(readFileSync("packages/knowledge/raw/objects.json", "utf8"))
    .airlines.find((a) => a.id === "airline_thai_airways").premium.policy.cargo.source;
  check("objects.json ≡ source APPROUVÉE, champ par champ", ecarts(artefact).length === 0,
    `écarts : ${ecarts(artefact).join(", ")}`);

  const runtime = kb.airlines.get("airline_thai_airways")?.premium?.policy?.cargo;
  check("le RUNTIME sert l'URL, la date, l'échéance et la confiance approuvées",
    runtime?.source?.url === approuvee.url && runtime?.source?.verified_date === approuvee.verified_date
    && runtime?.source?.review_due === approuvee.review_due && runtime?.source?.confidence === approuvee.confidence,
    JSON.stringify(runtime?.source));
  /* La preuve accompagne la décision, elle ne la remplace pas : le statut reste celui du registre. */
  check("et la décision reste `confirmation_required` / `policy_unpublished`",
    runtime?.status === "confirmation_required" && runtime?.status_cause === "policy_unpublished",
    `${runtime?.status} / ${runtime?.status_cause}`);
}

console.log("=== 7 ter. Une politique NON REVUE reste sans preuve, même avec une source officielle ===");
{
  /* LE TÉMOIN QUI MANQUAIT (contre-revue du 15/08/2026).
   *
   * `preuveAuditee` écarte une politique non revérifiée AVANT de regarder sa source. Tant que la
   * garde ne rencontre que des politiques sans source, elle passe au vert sans rien démontrer :
   * `source_derived` suffirait à expliquer chaque `null`.
   *
   * Or DIX politiques `legacy_unreviewed` portent une source OFFICIELLE, précise, non dérivée —
   * les anciens POLICY_STALE, dont la provenance a été affinée à la main (URL de fret dédiée,
   * confiance 4). Ce sont exactement celles qu'un affaiblissement de la garde présenterait comme
   * AUDITÉES : page officielle, date récente, confiance élevée, tout pour convaincre. La règle
   * dit l'inverse — « une politique non revue reste sans source plutôt qu'avec une auto-source ».
   *
   * Le témoin est scellé PAR IDENTITÉ, jamais par cardinal : une politique qui sortirait de la
   * liste et une autre qui y entrerait ne peuvent pas s'annuler. Et chaque ligne doit RÉUNIR les
   * trois conditions — non revue, source présente, `source_derived` absent — sans quoi le
   * contrôle passerait sur une politique qui n'a jamais rien eu à cacher. */
  const NON_REVUES_A_SOURCE_OFFICIELLE = [
    "airline_asiana.cargo", "airline_condor.cargo", "airline_eva_air.cargo",
    "airline_french_bee.cargo", "airline_korean_air.cargo", "airline_malaysia_airlines.cargo",
    "airline_norwegian.cargo", "airline_qantas.cargo", "airline_qantas.hold",
    "airline_virgin_australia.hold",
  ];
  /* L'ensemble OBSERVÉ, recalculé sur la base — pas relu de la liste ci-dessus. */
  const observees = [];
  for (const a of kb.airlines.values()) {
    for (const [canal, pol] of Object.entries(a.premium?.policy ?? {})) {
      if (!pol) continue;
      if (pol.status_cause === "legacy_unreviewed" && pol.source && !pol.source_derived) observees.push(`${a.id}.${canal}`);
    }
  }
  const memeEnsemble = (x, y) => JSON.stringify([...x].sort()) === JSON.stringify([...y].sort());
  check("l'ensemble des politiques non revues à source officielle NON dérivée est celui attendu",
    memeEnsemble(observees, NON_REVUES_A_SOURCE_OFFICIELLE),
    `observées ${observees.length} : ${[...observees].sort().join(", ")}`);

  let sansPreuve = 0, defauts = [];
  for (const cle of NON_REVUES_A_SOURCE_OFFICIELLE) {
    const [id, canal] = cle.split(".");
    const pol = kb.airlines.get(id)?.premium?.policy?.[canal];
    /* Les trois conditions AVANT le verdict : sans elles, un `null` ne prouverait rien. */
    if (!pol) { defauts.push(`${cle} : politique absente`); continue; }
    if (pol.status_cause !== "legacy_unreviewed") { defauts.push(`${cle} : cause ${pol.status_cause}`); continue; }
    if (!pol.source?.url) { defauts.push(`${cle} : aucune source`); continue; }
    if (pol.source_derived) { defauts.push(`${cle} : source dérivée — le témoin ne mord pas`); continue; }
    if (estAutoCitation(pol.source.url)) { defauts.push(`${cle} : auto-citation — le témoin ne mord pas`); continue; }
    if (preuveAuditee(pol) !== null) { defauts.push(`${cle} : présentée comme AUDITÉE (${pol.source.url})`); continue; }
    sansPreuve++;
  }
  check(`les ${NON_REVUES_A_SOURCE_OFFICIELLE.length} politiques non revues restent SANS preuve auditée`,
    sansPreuve === NON_REVUES_A_SOURCE_OFFICIELLE.length && defauts.length === 0,
    defauts.slice(0, 4).join(" | "));

  /* Contre-épreuve du témoin lui-même : la MÊME source, sur une politique canonique, EST une
     preuve. Sans cela, `preuveAuditee` pourrait retourner `null` pour une raison quelconque. */
  const qantas = kb.airlines.get("airline_qantas")?.premium?.policy?.hold;
  const memeSourceMaisCanonique = { ...qantas, status: "confirmation_required", status_cause: "policy_unpublished" };
  check("la MÊME source, sur une politique canonique, EST bien une preuve auditée",
    preuveAuditee(memeSourceMaisCanonique)?.url === qantas?.source?.url,
    JSON.stringify(preuveAuditee(memeSourceMaisCanonique)));
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
  check("empreinte de la baseline figée APRÈS T0-B2 = 5dad5396527c…",
    createHash("sha256").update(readFileSync("test-baselines/t0b2-finder-baseline-apres.json")).digest("hex")
      === "5dad5396527c94bcb1a0fc2bb2c79b94052c26ca32d92fb47cfecd43a205d2e7");
  /* T0-B2-UI : la baseline vivante ne vaut plus la figée de T0-B2 — le lot d'interface a retiré
     les auto-citations de la liste `sources`. Ce n'était PAS une mutation métier : `test-t0a-
     baseline.mjs` exige champ par champ que verdict, score, statuts, décisions, libellés et
     classement soient rigoureusement identiques entre les deux figées, et verrouille l'écart
     `sources` par identité d'URL dans `t0b2ui-approved-diff.json`.
     La borne de T0-B2 reste scellée à son empreinte ci-dessus : elle ne bougera plus jamais, et
     le point de comparaison vivant devient la figée de T0-B2-UI. */
  check("T0-B2-UI : la figée APRÈS diffère de celle de T0-B2 (le lot a bien changé quelque chose)",
    !readFileSync("test-baselines/t0b2ui-finder-baseline-apres.json")
      .equals(readFileSync("test-baselines/t0b2-finder-baseline-apres.json")));
  /* T0-B3-b : même mécanique, un cran plus loin — et cette fois le lot est MÉTIER. Le retrait des
     42 règles brachycéphales auto-citées a déplacé 36 des 72 scénarios, tous carlins. La borne de
     T0-B2-UI est donc scellée à son empreinte, comme l'a été celle de T0-B2 : elle ne bougera plus
     jamais. Le point de comparaison vivant devient la figée de T0-B3-b.
     Ce qui rend la chaîne vérifiable plutôt que déclarative : l'« avant » de T0-B3-b est
     OCTET POUR OCTET l'« après » de T0-B2-UI. Aucun état intermédiaire n'a disparu entre les deux
     lots, et un artefact fabriqué à la main s'y casserait. */
  check("empreinte de la baseline figée APRÈS T0-B2-UI = 5ed39d4de782… (scellée, elle ne bouge plus)",
    createHash("sha256").update(readFileSync("test-baselines/t0b2ui-finder-baseline-apres.json")).digest("hex")
      === "5ed39d4de782a51e837f09d34f54911daceec08de0bc3d4003cd8b199502f3b2");
  /* La chaîne se vérifie CHAMP PAR CHAMP, plus par égalité d'octets : T0-B3-b a ajouté
     `safety_advisories` à la projection canonique, et les figées antérieures sont nées avant ce
     champ. L'affirmation devient donc plus précise, et plus forte — l'AVANT de T0-B3-b est
     l'APRÈS de T0-B2-UI augmenté de ce seul champ, VIDE partout, ce qui est exactement l'état du
     registre de race à ce commit. Elle a été établie en régénérant l'AVANT dans un worktree
     détaché au commit d'origine, jamais en éditant le fichier. */
  {
    const av = JSON.parse(readFileSync("test-baselines/t0b3b-finder-baseline-avant.json", "utf8"));
    const b2 = JSON.parse(readFileSync("test-baselines/t0b2ui-finder-baseline-apres.json", "utf8"));
    const cles = Object.keys(b2);
    const memeMetier = cles.length === Object.keys(av).length && cles.every((k) => {
      const { safety_advisories, ...reste } = av[k] ?? {};
      return JSON.stringify(reste) === JSON.stringify(b2[k]);
    });
    check("chaîne ininterrompue : l'AVANT de T0-B3-b est l'APRÈS de T0-B2-UI, champ pour champ",
      memeMetier, cles.filter((k) => {
        const { safety_advisories, ...reste } = av[k] ?? {};
        return JSON.stringify(reste) !== JSON.stringify(b2[k]);
      }).slice(0, 3).join(", "));
    check("… et le seul champ ajouté y est VIDE partout : aucun avis avant l'entrée IATA",
      cles.every((k) => (av[k].safety_advisories ?? []).length === 0),
      cles.filter((k) => (av[k].safety_advisories ?? []).length).slice(0, 3).join(", "));
    check("l'APRÈS de T0-B3-b, lui, publie l'avis IATA sur les 36 scénarios carlin",
      (() => {
        const ap = JSON.parse(readFileSync("test-baselines/t0b3b-finder-baseline-apres.json", "utf8"));
        const avec = Object.keys(ap).filter((k) => (ap[k].safety_advisories ?? []).length > 0);
        return avec.length === 36 && avec.every((k) => k.includes("pug"))
          && avec.every((k) => ap[k].safety_advisories[0].startsWith("brest_iata_snub_nose_hot_season|global|cabin+hold+cargo|"));
      })());
  }
  /* 28/08/2026 — la figée la plus récente est désormais celle du lot RC (lecture directe
   * Codex : cinq règles non prouvées supprimées, avis IAG conditionnel à la place ; 36
   * scénarios carlin bougent par leurs avis publiés, aucun statut ne change). La figée
   * T0-B3-b reste intouchable et comparée ci-dessus — c'est le principe roulant. */
  /* 29/08/2026 — LA PLUS RÉCENTE EST CELLE DU MICRO-LOT TARIFS. Le principe roulant est le même
   * qu'au-dessus : la figée précédente (RC) n'est pas écrasée, elle reste comparable, et la preuve
   * permanente RC → Tarifs de test-t0a-baseline.mjs établit que SEUL le segment tarifaire les
   * sépare — 72 scénarios, 1 560 cartes, 1 560 segments remplacés, zéro divergence ailleurs. */
  /* 30/08/2026 — LA PLUS RÉCENTE EST CELLE DE L'ÉTAPE 3 DU MICRO-LOT TARIFS. Même principe
   * roulant : ni la RC ni l'étape 2 ne sont écrasées, et la preuve permanente « étape 2 → 3 » de
   * test-t0a-baseline.mjs établit que SEUL le libellé de canal les sépare — 430 cartes sur 1 560,
   * toutes multicanales, 1 130 inchangées, rien d'autre nulle part. */
  /* 04/09/2026 — LA PLUS RÉCENTE EST CELLE DE LA FRONTIÈRE DE CONFIANCE. Même principe roulant :
   * celle de l'étape 3 des Tarifs n'est pas écrasée, elle devient l'AVANT de ce lot, et la preuve
   * permanente de test-t0a-baseline.mjs établit ce qui sépare la paire — 1 948 bascules, toutes
   * vers « à confirmer », aucune vers `allowed`, aucune vers `denied`. */
  /* 05/09/2026 — la plus récente est celle de la première citation ; celle de la frontière reste
     intacte à côté comme AVANT de la paire. */
  /* 05/09/2026, plus tard le même jour — LA PLUS RÉCENTE EST CELLE DE LA FRONTIÈRE DES RÈGLES.
   * Même principe roulant : celle de la première citation n'est pas écrasée, elle devient l'AVANT
   * de la nouvelle paire, et la preuve permanente de test-t0a-baseline.mjs établit ce qui les
   * sépare — 1 168 canaux passent de `denied` à « à confirmer », aucun ne se referme, aucun ne va
   * jusqu'à `allowed`, et British Airways cabine reste refusée sur sa phrase citée. */
  /* 05/09/2026, troisième figée du jour — LA PLUS RÉCENTE EST CELLE DES ARBITRAGES D'INTERFACE
   * (statut ternaire, quatrième réponse, jauge masquée). Même principe roulant : celle de la
   * frontière des règles devient l'AVANT de la paire, et la preuve permanente de
   * test-t0a-baseline.mjs établit ce qui les sépare — 72 verdicts, 1 560 segments `pets:`, et
   * AUCUN statut, AUCUNE cause, AUCUN rang, AUCUN score. */
  check("Arbitrages d'interface : la baseline vivante est identique à la figée la plus récente",
    vivante.equals(readFileSync("test-baselines/arbitrages-interface-apres.json")));
  check("Frontière des règles : sa figée reste intacte à côté (elle n'a pas été écrasée)",
    !readFileSync("test-baselines/frontiere-regles-apres.json")
      .equals(readFileSync("test-baselines/arbitrages-interface-apres.json")));
  check("Citation 1 : sa figée reste intacte à côté (elle n'a pas été écrasée)",
    !readFileSync("test-baselines/citation-ba-cabine-apres.json")
      .equals(readFileSync("test-baselines/frontiere-regles-apres.json")));
  check("Tarifs étape 3 : la figée de l'étape 2 reste intacte à côté (elle n'a pas été écrasée)",
    !readFileSync("test-baselines/tarifs-finder-baseline-apres.json")
      .equals(readFileSync("test-baselines/tarifs-etape3-finder-baseline-apres.json")));
  check("Tarifs : la figée RC reste intacte à côté (elle n'a pas été écrasée)",
    !readFileSync("test-baselines/rc-finder-baseline-apres.json")
      .equals(readFileSync("test-baselines/tarifs-finder-baseline-apres.json")));
  check("T0-B3-b : la figée APRÈS diffère de celle de T0-B2-UI (le retrait des 42 a bien déplacé le métier)",
    !readFileSync("test-baselines/t0b3b-finder-baseline-apres.json")
      .equals(readFileSync("test-baselines/t0b2ui-finder-baseline-apres.json")));
}

console.log(`\n${pass} OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
