#!/usr/bin/env node
/**
 * Harnais T0-B3-a — le CÂBLAGE : `evaluate` consomme le registre `BreedRestriction`,
 * `explain` publie les avis de sécurité et les preuves.
 *
 *   node --import tsx test-t0b3a-moteur-race.mjs
 *
 * Étape 1-bis avait verrouillé les CONTRATS ; celui-ci verrouille le COMPORTEMENT. Il passe par le
 * chemin réel — `normalize()` puis `evaluate()` puis `explain()` — et n'implémente aucune table de
 * décision de son côté : un harnais qui recalcule ce qu'il vérifie ne vérifie que lui-même.
 *
 *   1. le registre : obligatoire, chargé, et ses invariants d'ENSEMBLE refusés au chargement ;
 *   2. les branches décisives : statut, causes, preuves — et les preuves qui atteignent le RAPPORT ;
 *   3. `warn` : un avis, et RIEN d'autre — ni statut, ni score, ni `fired`, ni preuve, ni source ;
 *   4. les avis : dédupliqués, triés, localisés, et JAMAIS orphelins de leur compagnie ;
 *   5. le périmètre de « nous ne savons pas » ;
 *   6. les rôles de preuve admis par statut ;
 *   7. le motif de refus `breed_restricted` ;
 *   8. le registre RÉEL est vide : le câblage ne déplace aucun statut publié aujourd'hui.
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
const FERMEE = "airline_air_serbia";   // soute ET fret `denied` sur CDG→IST, cabine ouverte
const GOLDEN = "breed_golden_retriever";
const PUG = "breed_pug";

const SRC = (url, quote, confidence = 4) => ({
  url, source_type: "official_website", verified_date: "2026-08-16", review_due: "2027-02-12",
  confidence, reviewer: "harnais T0-B3-a", history: [],
  quote, quote_language: "en",
});
const DETAIL = {
  en: "A veterinary fitness-to-fly certificate is required.",
  fr: "Un certificat vétérinaire d'aptitude au vol est exigé.",
  es: "Se exige un certificado veterinario de aptitud para volar.",
  pt: "É exigido um certificado veterinário de aptidão para voar.",
};

/** Une KB normalisée par le CHEMIN RÉEL : restrictions injectées, règles filtrées, compagnies
 *  éventuellement restreintes (pour isoler la contribution d'UNE preuve au score). */
const kbAvec = (restrictions, dropRule = () => false, seulement = null) => {
  const kb = normalize({ ...rawKB, breed_restrictions: restrictions });
  const airlines = seulement
    ? new Map(seulement.map((id) => {
        const a = kb.airlines.get(id);
        if (!a) throw new Error(`fixture : ${id} absent de la KB`);
        return [id, a];
      }))
    : kb.airlines;
  return { ...kb, airlines, rules: kb.rules.filter((r) => !dropRule(r)) };
};
/* Les 42 règles de l'ensemble brachycéphale : tant qu'elles sont là, toute soute brachycéphale est
   refusée et la table n'ouvre rien (branche « canal structurellement fermé »). Les retirer EN
   MÉMOIRE est la seule façon d'éprouver les branches que l'option H fera vivre. */
const SANS_LES_42 = (r) => r.category === "breed_ban" || r.id === "rule_global_brachy_hold";

const req = (over = {}) => ({
  origin: "airport_cdg", destination: "airport_ist", dog: { breed_id: GOLDEN, weight_kg: 8 },
  travel_type: "pet", placement: "any", locale: "en", date: "2027-01-15", ...over,
});
const carte = (rep, id = AIRLINE) => rep.airlines.find((a) => a.airline_id === id);
const canal = (rep, placement, id = AIRLINE) =>
  carte(rep, id)?.placement_decisions.find((d) => d.placement === placement);
const rapport = (kb, r) => explain(evaluate(kb, r), r.locale ?? "en");

console.log("=== 1. Le registre : OBLIGATOIRE, chargé et validé ===");
{
  const kb = loadKB();
  check("`breedRestrictions` existe toujours, même vide — jamais absent",
    Array.isArray(kb.breedRestrictions));
  check("le registre versionné est vide aujourd'hui (l'entrée IATA est un lot distinct)",
    kb.breedRestrictions.length === 0, JSON.stringify(kb.breedRestrictions.map((r) => r.id)));

  /* « Registre vide » et « registre oublié » sont deux états différents. Les confondre republierait
     des décisions de race sans leur référentiel. */
  check("registre ABSENT (`undefined`) → REFUSÉ au chargement",
    throws(() => normalize({ ...rawKB, breed_restrictions: undefined })));
  check("clé carrément absente de l'objet brut → refusée aussi",
    throws(() => { const { breed_restrictions, ...sans } = { ...rawKB, breed_restrictions: [] }; return normalize(sans); }));
  check("registre d'un autre type (objet) → refusé", throws(() => normalize({ ...rawKB, breed_restrictions: {} })));
  check("registre VIDE (`[]`) → accepté, et il dit « aucun fait de race audité »",
    normalize({ ...rawKB, breed_restrictions: [] }).breedRestrictions.length === 0);

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

console.log("=== 2. Les branches décisives — statut, causes, PREUVES, et le rapport ===");
{
  const cible = { breed_ids: [GOLDEN] };
  const r = (id, action, over = {}) => ({
    id, applies_to: cible, action, placements: ["hold"],
    source: SRC(`https://exemple.example/${id}`, `Official sentence for ${id}, long enough.`), ...over });

  const temoin = rapport(kbAvec([]), req());
  const avant = canal(temoin, "hold");
  check("témoin : sans restriction, la soute a son statut de base", !!avant, JSON.stringify(avant));
  const sourceCanalAvant = avant.source?.url ?? null;

  /* deny */
  {
    const rep = rapport(kbAvec([r("brest_deny_a", "deny")]), req());
    const d = canal(rep, "hold");
    check("`deny` ferme la soute, éteint les causes, et transporte SA preuve",
      d.status === "denied" && !("confirmation_causes" in d)
        && d.evidence?.length === 1 && d.evidence[0].restriction_ref === "brest_deny_a"
        && d.evidence[0].role === "refusal"
        && d.evidence[0].source.quote.startsWith("Official sentence"),
      JSON.stringify(d));
    /* `DecisionSource` reste la provenance GÉNÉRALE du canal. La v1 du câblage la remplaçait par
       celle de la restriction : le pluriel du contrat redevenait singulier à la sortie publique. */
    check("`source` reste la provenance générale du canal, pas celle de la restriction",
      (d.source?.url ?? null) === sourceCanalAvant, JSON.stringify(d.source));
    check("la page de la restriction est tout de même citée dans les sources du RAPPORT",
      rep.sources.some((s) => s.url === "https://exemple.example/brest_deny_a"),
      JSON.stringify(rep.sources.map((s) => s.url)));
  }
  /* require — DEUX exigences, DEUX preuves, DEUX pages citées */
  {
    const rep = rapport(kbAvec([
      r("brest_req_vet", "require", { detail: DETAIL }),
      r("brest_req_crate", "require", { detail: DETAIL }),
    ]), req());
    const d = canal(rep, "hold");
    const exigences = d.confirmation_causes.filter((c) => c.code === "breed_requirement");
    check("DEUX `require` → deux causes `breed_requirement` et DEUX preuves, jamais réduites à une",
      d.status === "confirmation_required" && exigences.length === 2 && d.evidence?.length === 2
        && new Set(exigences.map((c) => c.restriction_ref)).size === 2
        && d.evidence.every((e) => e.role === "requirement"),
      JSON.stringify({ causes: d.confirmation_causes, preuves: d.evidence?.map((e) => e.restriction_ref) }));
    check("chaque cause désigne la restriction qui la fonde, et son canal",
      exigences.every((c) => c.policy_ref === `${AIRLINE}#hold`)
        && exigences.map((c) => c.restriction_ref).sort().join(",") === "brest_req_crate,brest_req_vet");
    check("LES DEUX pages atteignent `report.sources` — deux exigences, deux preuves citées",
      ["brest_req_vet", "brest_req_crate"].every((id) =>
        rep.sources.some((s) => s.url === `https://exemple.example/${id}`)),
      JSON.stringify(rep.sources.map((s) => s.url)));
  }
  /* ---- LA CONFIANCE D'UNE PREUVE : elle compte, et elle ne compte QU'UNE FOIS ---------------
     Deux épreuves distinctes, et deux conjonctions strictes. La v1 écrivait `||` entre la
     confiance publiée et le score : neutraliser entièrement `confidenceRatio` dans `computeScore`
     laissait le test vert, puisque le ★ bougeait encore. Un `||` entre deux effets attendus ne
     teste que le plus facile des deux. */
  {
    /* 1 · ELLE COMPTE. Une seule compagnie, pour que la contribution ne soit pas noyée. */
    const seule = [AIRLINE];
    const avec = (confidence) => rapport(kbAvec([{
      id: "brest_conf", applies_to: cible, action: "require", placements: ["hold"], detail: DETAIL,
      source: SRC("https://exemple.example/brest_conf", "Official sentence, long enough here.", confidence),
    }], () => false, seule), req());
    const basse = avec(1), haute = avec(5);
    check("1★ → 5★ : la confiance publiée ET le score se déplacent — les DEUX, pas l'un ou l'autre",
      basse.confidence !== haute.confidence && basse.score !== haute.score,
      JSON.stringify({ conf1: [basse.confidence, basse.score], conf5: [haute.confidence, haute.score] }));

    /* 2 · ELLE NE COMPTE QU'UNE FOIS. Une restriction `allow` ne déplace aucun statut : le choix,
       la qualité d'itinéraire et les pénalités sont donc identiques dans les deux montages, et
       seule la contribution à la confiance peut expliquer un écart. La même preuve est portée par
       50 décisions dans l'un et par UNE dans l'autre. */
    const allow = (over) => ({ id: "brest_card", applies_to: cible, action: "allow",
      source: SRC("https://exemple.example/brest_card", "Official acceptance sentence here.", 1), ...over });
    const large = rapport(kbAvec([allow({ placements: ["cabin", "hold", "cargo"] })]), req());
    const etroit = rapport(kbAvec([allow({ placements: ["hold"], airline_id: AIRLINE })]), req());
    const vierge = rapport(kbAvec([]), req());
    const porteuses = (rep) => rep.airlines
      .reduce((n, a) => n + a.placement_decisions.reduce((m, d) => m + (d.evidence?.length ?? 0), 0), 0);
    check("montage : la même preuve est portée par BEAUCOUP de décisions d'un côté, par UNE de l'autre",
      porteuses(large) > 10 && porteuses(etroit) === 1,
      JSON.stringify({ large: porteuses(large), etroit: porteuses(etroit) }));
    check("… et pourtant confiance et score sont STRICTEMENT identiques — une restriction, un vote",
      large.confidence === etroit.confidence && large.score === etroit.score,
      JSON.stringify({ large: [large.confidence, large.score], etroit: [etroit.confidence, etroit.score] }));
    check("… tout en étant bien COMPTÉE : le score diffère de celui d'un référentiel sans elle",
      large.score !== vierge.score,
      JSON.stringify({ avec: large.score, sans: vierge.score }));
  }
  /* allow */
  {
    const rep = rapport(kbAvec([r("brest_allow_a", "allow")]), req());
    const d = canal(rep, "hold");
    check("`allow` ne change pas le statut de base et transporte sa preuve d'autorisation",
      d.status === avant.status && d.evidence?.length === 1
        && d.evidence[0].restriction_ref === "brest_allow_a" && d.evidence[0].role === "authorisation",
      JSON.stringify(d));
  }
  /* Un canal structurellement fermé ne se rouvre pas — sur une compagnie RÉELLEMENT fermée. */
  {
    const ferme = canal(rapport(kbAvec([]), req()), "hold", FERMEE);
    check(`témoin : la soute de ${FERMEE} est bien \`denied\` avant toute restriction`,
      ferme?.status === "denied", JSON.stringify(ferme));
    const d = canal(rapport(kbAvec([{ ...r("brest_allow_ferme", "allow"), airline_id: FERMEE }]), req()), "hold", FERMEE);
    check("un canal fermé le reste : `allow` ne crée pas une soute qui n'existe pas",
      d.status === "denied" && d.evidence === undefined, JSON.stringify(d));
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
  check("la CONFIANCE publiée ne bouge pas", sans.confidence === avec.confidence,
    `${sans.confidence} → ${avec.confidence}`);
  check("aucun STATUT ne bouge sur les trois canaux",
    ["cabin", "hold", "cargo"].every((p) => canal(sans, p).status === canal(avec, p).status),
    JSON.stringify(["cabin", "hold", "cargo"].map((p) => `${p}:${canal(sans, p).status}→${canal(avec, p).status}`)));
  check("aucune PREUVE de race n'est produite par un `warn`",
    ["cabin", "hold", "cargo"].every((p) => canal(avec, p).evidence === undefined));
  check("la page de l'avis n'entre PAS dans les sources probantes du rapport",
    !avec.sources.some((s) => s.url.includes("iata.org")),
    JSON.stringify(avec.sources.map((s) => s.url)));
  check("la restriction n'entre PAS dans `fired` (le score se calcule sur les règles déclenchées)",
    evaluate(kbWarn, r0).airlines.every((a) => a.fired.every((f) => !f.rule_id.startsWith("brest_"))));
  check("… mais l'avis, lui, EST publié", avec.safety_advisories.length === 1
    && avec.safety_advisories[0].restriction_ref === "brest_iata_fixture",
    JSON.stringify(avec.safety_advisories.map((a) => a.restriction_ref)));
  check("un avis ne porte AUCUNE gravité — rien ne la fonde",
    !("criticality" in avec.safety_advisories[0]),
    JSON.stringify(avec.safety_advisories[0]));
  check("un chien NON visé ne reçoit aucun avis",
    rapport(kbWarn, req({ dog: { breed_id: GOLDEN, weight_kg: 8 } })).safety_advisories.length === 0);
}

console.log("=== 4. Les avis : déduplication, tri, canaux, langue, et pas d'orphelins ===");
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

  /* AUCUN AVIS ORPHELIN. Les avis étaient collectés AVANT le filtre des itinéraires
     invraisemblables : sur un long-courrier, des compagnies retirées des résultats laissaient
     leur avis dans le rapport — un conseil attribué à une compagnie invisible. */
  {
    const toutes = [...loadKB().airlines.keys()];
    const parCompagnie = toutes.map((id) => avis(`brest_cie_${id.replace(/^airline_/, "")}`,
      { airline_id: id, placements: ["hold"] }));
    const kbC = kbAvec(parCompagnie, SANS_LES_42);
    const long = rapport(kbC, req({ destination: "airport_bkk", dog: { breed_id: PUG, weight_kg: 8 } }));
    const idsCartes = new Set(long.airlines.map((a) => a.airline_id));
    const orphelins = long.safety_advisories.filter((a) => a.scope !== "global" && !idsCartes.has(a.scope));
    check(`aucun avis de compagnie ne survit à sa compagnie (${long.airlines.length} cartes, `
      + `${long.safety_advisories.length} avis, ${orphelins.length} orphelin(s))`,
      orphelins.length === 0, JSON.stringify(orphelins.map((a) => a.scope)));
    check("… et chaque compagnie retenue porte bien le sien",
      long.safety_advisories.length === long.airlines.length,
      JSON.stringify({ avis: long.safety_advisories.length, cartes: long.airlines.length }));
  }
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
    causeRace(brachy, "cabin").length === 0, JSON.stringify(canal(brachy, "cabin")));
  check("un chien NON brachycéphale ne reçoit aucune cause de race",
    ["cabin", "hold", "cargo"].every((p) => causeRace(temoin, p).length === 0));
  const causesTemoin = (canal(temoin, "hold").confirmation_causes ?? []).map((c) => c.code).sort();
  const causesBrachy = (canal(brachy, "hold").confirmation_causes ?? [])
    .filter((c) => c.code !== "breed_policy_unreviewed").map((c) => c.code).sort();
  check("les causes préexistantes du canal SURVIVENT à l'ajout de la cause de race",
    JSON.stringify(causesTemoin) === JSON.stringify(causesBrachy),
    JSON.stringify({ temoin: causesTemoin, brachy: causesBrachy }));
}

console.log("=== 6. Les rôles de preuve admis par statut ===");
{
  const { makePlacementDecision } = await import("./packages/engine/src/contracts.ts");
  const EV = (role) => ({ restriction_ref: "brest_x", role,
    source: SRC("https://exemple.example/x", "Official sentence, long enough here.") });
  const CAUSE = { code: "policy_unpublished", policy_ref: `${AIRLINE}#hold` };
  const ok = (statut, role, causes) => !throws(() =>
    makePlacementDecision("hold", statut, causes, undefined, [EV(role)]));

  check("`allowed` n'admet qu'une AUTORISATION", ok("allowed", "authorisation"));
  check("`allowed` + refus → refusé", !ok("allowed", "refusal"));
  check("`allowed` + exigence → refusé (un canal ouvert sans condition n'exige rien)",
    !ok("allowed", "requirement"));
  check("`confirmation_required` admet une autorisation", ok("confirmation_required", "authorisation", [CAUSE]));
  check("`confirmation_required` + refus → refusé (un refus aurait fermé le canal)",
    !ok("confirmation_required", "refusal", [CAUSE]));
  check("`denied` admet les TROIS rôles — une confirmation dégradée garde ses preuves",
    ["authorisation", "requirement", "refusal"].every((role) => ok("denied", role)));
}

console.log("=== 7. Le motif de refus `breed_restricted` ===");
{
  const cible = { breed_ids: [GOLDEN] };
  const deny = (placements) => ({ id: "brest_deny_motif", applies_to: cible, action: "deny", placements,
    source: SRC("https://exemple.example/deny", "Official refusal sentence, long enough.") });

  /* Au niveau MOTEUR : le motif est produit dès qu'un canal est fermé par un fait de race. */
  const dec = evaluate(kbAvec([deny(["hold"])]), req());
  const a = dec.airlines.find((x) => x.airline_id === AIRLINE);
  check("`evaluate` : une soute fermée par un fait de race porte le motif `breed_restricted`",
    (a.deny_reasons ?? []).includes("breed_restricted"), JSON.stringify(a.deny_reasons));
  const sans = evaluate(kbAvec([]), req()).airlines.find((x) => x.airline_id === AIRLINE);
  check("témoin : sans restriction, ce motif n'apparaît pas",
    !(sans.deny_reasons ?? []).includes("breed_restricted"), JSON.stringify(sans.deny_reasons));

  /* Au niveau RAPPORT : la carte ne publie ses motifs que si plus rien n'est ouvert. On ferme donc
     les trois canaux de la compagnie déjà fermée en soute et en fret. */
  const rep = rapport(kbAvec([{ ...deny(["cabin", "hold", "cargo"]), airline_id: FERMEE }]), req());
  const c = carte(rep, FERMEE);
  check("`explain` : compagnie entièrement fermée par la race → motif publié, sans `||` complaisant",
    (c.deny_reasons ?? []).includes("breed_restricted"),
    JSON.stringify({ deny_reasons: c.deny_reasons, statuts: c.placement_decisions.map((d) => d.status) }));
}

console.log("=== 8. Sur le référentiel RÉEL, le câblage ne déplace rien ===");
{
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
