/**
 * T0-B3-a · SIMULATION de l'option H — sans écrire une ligne de moteur.
 *
 *   node --import tsx mesures/t0b3a-arbitrage-brachy/outils/simuler-h.mjs
 *   → mesures/t0b3a-arbitrage-brachy/option-h-simulee.json
 *
 * ─── H, TEL QUE L'ARBITRAGE LE DÉFINIT ─────────────────────────────────────────────────────────
 *
 *   · le `deny` global IATA est retiré ; l'information IATA reste un AVERTISSEMENT de sécurité ;
 *   · une confirmation PROPRE À LA RACE apparaît, avec une cause structurée
 *     `breed_policy_unreviewed` ;
 *   · pour un brachycéphale : `denied` si le canal est structurellement fermé, sinon
 *     `confirmation_required` tant que la politique brachycéphale de la compagnie n'est pas auditée ;
 *   · un chien non brachycéphale n'est touché en RIEN ;
 *   · les 41 règles compagnie passent de refus à confirmation, à résorber une par une par audit.
 *
 * ─── COMMENT ON MESURE SANS IMPLÉMENTER ────────────────────────────────────────────────────────
 *
 * Le pipeline est `explain(evaluate(kb, req))`. H ne change QUE la couche décision. On peut donc :
 *   1. appeler `evaluate` sur une base où les 42 règles ne refusent plus (action « warn ») — elles
 *      restent chargées, donc leur confiance continue d'alimenter le score, exactement comme H le
 *      prévoit pour l'avertissement IATA ;
 *   2. appliquer À LA MAIN la table de décision de H sur les placements, et seulement pour un chien
 *      brachycéphale ;
 *   3. passer la décision ainsi modifiée au VRAI `explain`.
 *
 * Verdict, score, cartes et libellés sont donc calculés par le moteur d'explication réel, pas
 * estimés. Ce qui est modélisé à la main, c'est précisément ce que H changerait dans `evaluate` —
 * ni plus, ni moins. Aucun fichier de `packages/` n'est écrit.
 *
 * LIMITE ASSUMÉE : la cause `breed_policy_unreviewed` n'existe pas encore dans le contrat. Là où le
 * moteur reconstruit une décision (dégradation par `entry_allowed`), sa validation Zod la refuse.
 * Ces cas sont COMPTÉS et rapportés plutôt que contournés : ils chiffrent exactement le travail de
 * contrat que H demandera.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { normalize } from "../../../packages/knowledge/src/normalize.ts";
import { rawKB } from "../../../packages/knowledge/src/data.ts";
import { evaluate } from "../../../packages/engine/src/evaluate.ts";
import { explain } from "../../../packages/engine/src/explain.ts";
import { runFinder } from "../../../packages/engine/src/pipeline.ts";
import { FinderRequest, makePlacementDecision } from "../../../packages/engine/src/contracts.ts";
import { preuveAuditee } from "../../../packages/knowledge/src/preuve.ts";
import { chargerReferentiel, estAutoCitee, ecrireJson } from "./lib-arbitrage.mjs";

const DOSSIER = "mesures/t0b3a-arbitrage-brachy";
const GLOBALE = "rule_global_brachy_hold";
const CAUSE_H = "breed_policy_unreviewed";
const AUTO = /(^|\.)mydogcanfly\.com$/i;

const { sceau, regles } = chargerReferentiel();
const sha256Fichier = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

const brachyCompagnie = regles.filter((r) => r.category === "breed_ban" && estAutoCitee(r));
const IDS_42 = [...brachyCompagnie.map((r) => r.id), GLOBALE];

/* La base de H : les 42 restent CHARGÉES mais ne refusent plus. « warn » est ici un support de
   simulation, pas la forme finale — H demande une action propre. Ce qui compte pour la mesure,
   c'est que les règles restent dans `fired` : leur confiance pèse sur le score, et H veut
   précisément conserver l'avertissement IATA. */
const kbA = normalize(rawKB);
const kbH = normalize({ ...rawKB,
  rules: rawKB.rules.map((r) => IDS_42.includes(r.id) ? { ...r, effect: { ...r.effect, action: "warn" } } : r) });

const brachyParRace = new Map((rawKB.breeds ?? []).map((b) => [b.id, b.brachycephalic === true]));
const estBrachy = (req) => req.dog.brachycephalic === true || brachyParRace.get(req.dog.breed_id) === true;

/** LA TABLE DE DÉCISION DE H, écrite une fois, appliquée partout. */
function statutH(airlineId, placement, statutBase) {
  const pol = kbA.airlines.get(airlineId)?.premium?.policy?.[placement] ?? null;
  /* 1. Canal structurellement fermé : H n'ouvre rien. Une compagnie qui ne propose pas de soute
        n'a pas une soute « à confirmer », elle n'en a pas. */
  if (statutBase === "denied") return { statut: "denied", motif: "canal structurellement fermé" };
  /* 2. Interdiction PROUVÉE : une preuve auditée qui dit `brachy_allowed = false` reste un refus. */
  const preuve = preuveAuditee(pol);
  if (preuve && pol?.brachy_allowed === false) return { statut: "denied", motif: "interdiction auditée" };
  /* 3. Autorisation PROUVÉE : on n'ajoute pas de doute là où une source auditée tranche. */
  if (preuve && pol?.brachy_allowed === true) return { statut: statutBase, motif: "autorisation auditée" };
  /* 4. Tout le reste : notre politique brachycéphale n'est pas auditée — c'est NOTRE incertitude,
        et elle se dit « à confirmer », jamais « interdit ». */
  return { statut: "confirmation_required", motif: "politique brachycéphale non auditée" };
}

const compteurs = { causes_refusees_par_zod: 0, placements_reecrits: 0 };

/** Applique H à une décision, en place sur une copie. Ne touche RIEN si le chien n'est pas
 *  brachycéphale : c'est la garantie n° 1, obtenue par construction et vérifiée ensuite. */
function appliquerH(decision) {
  if (!estBrachy(decision.request)) return decision;
  const airlines = decision.airlines.map((a) => {
    const placements = a.placements.map((d) => {
      if (d.placement === "cabin") return d; // les 42 règles n'ont jamais visé la cabine
      const { statut, motif } = statutH(a.airline_id, d.placement, d.status);
      if (statut === d.status && statut !== "confirmation_required") return d;
      compteurs.placements_reecrits++;
      if (statut === "denied") return { placement: d.placement, status: "denied", allowed: false, ...(d.source ? { source: d.source } : {}) };
      if (statut === "allowed") return { placement: d.placement, status: "allowed", allowed: true, ...(d.source ? { source: d.source } : {}) };
      return {
        placement: d.placement, status: "confirmation_required", allowed: false,
        confirmation_causes: [{ code: CAUSE_H, policy_ref: `${a.airline_id}#${d.placement}`, motif }],
        ...(d.source ? { source: d.source } : {}),
      };
    });
    return { ...a, placements };
  });
  return { ...decision, airlines };
}

function rapportH(req) {
  const dec = appliquerH(evaluate(kbH, req));
  try {
    return explain(dec, req.locale);
  } catch (e) {
    /* Le contrat refuse la cause inconnue là où il reconstruit une décision. On le COMPTE. */
    compteurs.causes_refusees_par_zod++;
    return null;
  }
}

/* ---- Les trois grilles, identiques à celles de l'arbitrage ------------------------------------ */
const ROUTES = [
  ["airport_cdg", "airport_bkk"], ["airport_cdg", "airport_jfk"], ["airport_cdg", "airport_dxb"],
  ["airport_lhr", "airport_mia"], ["airport_fra", "airport_sin"], ["airport_mad", "airport_mex"],
  ["airport_cdg", "airport_lhr"], ["airport_jfk", "airport_cdg"], ["airport_mxp", "airport_jfk"],
];
const _y = new Date().getUTCFullYear() + 1;
const publique = [];
for (const [o, d] of ROUTES)
  for (const [nom, breed] of [["golden", "breed_golden_retriever"], ["pug", "breed_pug"]])
    for (const m of [1, 7])
      for (const pl of ["any", "hold"])
        publique.push({ cle: `${o.slice(8)}-${d.slice(8)}|${nom}|${String(m).padStart(2, "0")}-15|${pl}`,
          chien: nom,
          req: FinderRequest.parse({ origin: o, destination: d, dog: { breed_id: breed, weight_kg: 8 },
            placement: pl, date: `${_y}-${String(m).padStart(2, "0")}-15`, locale: "en" }) });

const toutes = rawKB.airlines.map((a) => a.id).sort();
const grilleBrachy = [], grilleTemoin = [];
for (const id of toutes) {
  const route = [...(rawKB.airlines.find((a) => a.id === id)?.direct_routes ?? [])].sort()[0];
  if (!route) continue;
  const [o, d] = route.split("|");
  const base = { origin: o, destination: d, placement: "hold", date: `${_y}-01-15`, locale: "en" };
  grilleBrachy.push({ cle: id, airline_id: id,
    req: FinderRequest.parse({ ...base, dog: { breed_id: "breed_pug", weight_kg: 8, brachycephalic: true } }) });
  grilleTemoin.push({ cle: id, airline_id: id,
    req: FinderRequest.parse({ ...base, dog: { breed_id: "breed_golden_retriever", weight_kg: 8 } }) });
}

const PL = ["cabin_status", "hold_status", "cargo_status"];
const carte = (r, id) => (r?.airlines ?? []).find((x) => x.airline_id === id) ?? null;
const trip = (a) => (a ? PL.map((p) => a[p]).join("/") : "absente");

/* ---- Les cinq garanties exigées avant tout code ------------------------------------------------ */
const garanties = {
  g1_aucun_chien_non_brachycephale_touche: { compagnies: 0, placements: 0, exemples: [], scenarios_publics: 0 },
  g2_aucun_canal_non_propose_rouvert: { violations: 0, exemples: [] },
  g3_aucune_confirmation_devenue_message_climatique: { violations: 0, exemples: [] },
  g4_aucune_auto_citation_presentee_comme_preuve: { violations: 0, exemples: [] },
  g5_toutes_les_confirmations_de_race_portent_la_cause_dediee: { conformes: 0, violations: 0, exemples: [] },
};

/* G1 — le témoin golden, comparé au STATU QUO (A), pas à une variante intermédiaire. */
for (const s of grilleTemoin) {
  const av = carte(runFinder(kbA, s.req), s.airline_id);
  const ap = carte(rapportH(s.req), s.airline_id);
  const n = PL.filter((p) => (av?.[p] ?? null) !== (ap?.[p] ?? null)).length;
  if (n > 0) {
    garanties.g1_aucun_chien_non_brachycephale_touche.compagnies++;
    garanties.g1_aucun_chien_non_brachycephale_touche.placements += n;
    if (garanties.g1_aucun_chien_non_brachycephale_touche.exemples.length < 4)
      garanties.g1_aucun_chien_non_brachycephale_touche.exemples.push(`${s.airline_id} ${trip(av)} → ${trip(ap)}`);
  }
}

/* ---- Le diff exhaustif contre A ---------------------------------------------------------------- */
const compact = (r) => ({ verdict: r.verdict, score: r.score,
  airlines: (r.airlines ?? []).map((a) => `${a.airline_id}|${trip(a)}`) });

const diffPublic = { scenarios: publique.length, verdicts: 0, cartes: 0, placements: 0,
  score_seul: 0, ecart_score: [0, 0], echecs: 0, par_chien: { golden: 0, pug: 0 } };
for (const s of publique) {
  const rA = runFinder(kbA, s.req), rH = rapportH(s.req);
  if (!rH) { diffPublic.echecs++; continue; }
  const cA = compact(rA), cH = compact(rH);
  const mA = new Map((rA.airlines ?? []).map((a) => [a.airline_id, a]));
  const mH = new Map((rH.airlines ?? []).map((a) => [a.airline_id, a]));
  let cartes = 0, places = 0;
  for (const [id, a] of mA) {
    const b = mH.get(id);
    const n = PL.filter((p) => (a?.[p] ?? null) !== (b?.[p] ?? null)).length;
    if (n) { cartes++; places += n; }
  }
  diffPublic.cartes += cartes; diffPublic.placements += places;
  if (cA.verdict !== cH.verdict) diffPublic.verdicts++;
  else if (cartes === 0 && cA.score !== cH.score) diffPublic.score_seul++;
  const e = cH.score - cA.score;
  diffPublic.ecart_score = [Math.min(diffPublic.ecart_score[0], e), Math.max(diffPublic.ecart_score[1], e)];
  if (cartes > 0 || cA.score !== cH.score) diffPublic.par_chien[s.chien]++;

  /* G3 — une confirmation de race ne doit JAMAIS allumer le message climatique. */
  for (const a of rH.airlines ?? []) {
    if (a.heat_confirmation_required) {
      const causesRace = (a.placement_decisions ?? []).some((d) =>
        (d.confirmation_causes ?? []).some((c) => c.code === CAUSE_H));
      const causesClimat = (a.placement_decisions ?? []).some((d) =>
        (d.confirmation_causes ?? []).some((c) => c.code === "estimated_climate"));
      if (causesRace && !causesClimat) {
        garanties.g3_aucune_confirmation_devenue_message_climatique.violations++;
        if (garanties.g3_aucune_confirmation_devenue_message_climatique.exemples.length < 4)
          garanties.g3_aucune_confirmation_devenue_message_climatique.exemples.push(`${s.cle} · ${a.airline_id}`);
      }
    }
  }
  /* G4 — aucune auto-citation présentée comme preuve, ni en carte ni en rapport. */
  const urls = [...(rH.sources ?? []).map((x) => x.url),
    ...(rH.airlines ?? []).flatMap((a) => (a.placement_decisions ?? []).map((d) => d.source?.url).filter(Boolean))];
  for (const u of urls) {
    let h = ""; try { h = new URL(u).hostname; } catch { /* ignore */ }
    if (AUTO.test(h)) {
      garanties.g4_aucune_auto_citation_presentee_comme_preuve.violations++;
      if (garanties.g4_aucune_auto_citation_presentee_comme_preuve.exemples.length < 4)
        garanties.g4_aucune_auto_citation_presentee_comme_preuve.exemples.push(`${s.cle} · ${u}`);
    }
  }
}
garanties.g1_aucun_chien_non_brachycephale_touche.scenarios_publics = diffPublic.par_chien.golden;

/* ---- La grille brachycéphale : où vont les placements, et sous quelle cause -------------------- */
const brachy = { compagnies: 0, placements: 0, par_statut_cible: {}, transitions: {}, exemples: [] };
for (const s of grilleBrachy) {
  const rA = runFinder(kbA, s.req), rH = rapportH(s.req);
  if (!rH) continue;
  const av = carte(rA, s.airline_id), ap = carte(rH, s.airline_id);
  const bouges = PL.filter((p) => (av?.[p] ?? null) !== (ap?.[p] ?? null));
  if (bouges.length) {
    brachy.compagnies++; brachy.placements += bouges.length;
    for (const p of bouges) {
      const cible = ap?.[p] ?? "absente";
      brachy.par_statut_cible[cible] = (brachy.par_statut_cible[cible] ?? 0) + 1;
      const t = `${p.replace("_status", "")} ${av?.[p]} → ${cible}`;
      brachy.transitions[t] = (brachy.transitions[t] ?? 0) + 1;
    }
    if (brachy.exemples.length < 4) brachy.exemples.push(`${s.airline_id} ${trip(av)} → ${trip(ap)}`);
  }
  /* G2 — un canal que la compagnie ne propose pas ne doit jamais finir ouvert. */
  for (const p of ["hold", "cargo"]) {
    const pol = kbA.airlines.get(s.airline_id)?.premium?.policy?.[p];
    const statutFinal = ap?.[`${p}_status`];
    const proposé = pol?.status === "allowed" || pol?.status === "confirmation_required";
    if (!proposé && statutFinal && statutFinal !== "denied") {
      garanties.g2_aucun_canal_non_propose_rouvert.violations++;
      if (garanties.g2_aucun_canal_non_propose_rouvert.exemples.length < 4)
        garanties.g2_aucun_canal_non_propose_rouvert.exemples.push(
          `${s.airline_id}#${p} politique=${pol?.status ?? "absente"} → ${statutFinal}`);
    }
  }
  /* G5 — toute confirmation NOUVELLE porte bien la cause dédiée. */
  for (const d of ap?.placement_decisions ?? []) {
    if (d.status !== "confirmation_required" || d.placement === "cabin") continue;
    const avantStatut = (rA.airlines ?? []).find((x) => x.airline_id === s.airline_id)
      ?.placement_decisions?.find((x) => x.placement === d.placement)?.status;
    if (avantStatut === "confirmation_required") continue; // confirmation préexistante, pas de H
    const ok = (d.confirmation_causes ?? []).some((c) => c.code === CAUSE_H);
    if (ok) garanties.g5_toutes_les_confirmations_de_race_portent_la_cause_dediee.conformes++;
    else {
      garanties.g5_toutes_les_confirmations_de_race_portent_la_cause_dediee.violations++;
      if (garanties.g5_toutes_les_confirmations_de_race_portent_la_cause_dediee.exemples.length < 4)
        garanties.g5_toutes_les_confirmations_de_race_portent_la_cause_dediee.exemples.push(
          `${s.airline_id}#${d.placement} causes=${JSON.stringify(d.confirmation_causes ?? [])}`);
    }
  }
}

/* ---- SONDE DE CONTRAT : ce que ferait une VRAIE implémentation ---------------------------------
   Ma simulation construit l'objet de décision LITTÉRALEMENT. Une implémentation réelle, elle,
   passerait par `makePlacementDecision`, qui valide contre l'union stricte `ConfirmationCause`.
   Ne pas poser cette question aurait laissé lire « 0 refus » comme « rien à faire au contrat » —
   alors que ma simulation contourne simplement le point de contrôle. */
const sondeContrat = (() => {
  try {
    makePlacementDecision("hold", "confirmation_required",
      [{ code: CAUSE_H, policy_ref: "airline_aegean#hold" }], undefined);
    return { cause_acceptee_par_le_contrat: true,
      lecture: "INATTENDU : la cause passe déjà la validation — vérifier l'union ConfirmationCause" };
  } catch (e) {
    return { cause_acceptee_par_le_contrat: false,
      erreur: String(e).split("\n")[0].slice(0, 160),
      lecture: "attendu : `ConfirmationCause` est une union STRICTE et ne connaît pas cette cause. " +
        "Toute implémentation de H doit d'abord l'y ajouter, avec son libellé dans les quatre " +
        "langues. La simulation contourne ce point de contrôle en construisant l'objet à la main ; " +
        "elle ne prouve donc RIEN sur le contrat, et c'est cette sonde qui le dit." };
  }
})();

/* ---- SONDE DE DÉGRADATION : le chemin où l'entrée est refusée -----------------------------------
   « 0 rapport refusé » ne prouve rien si le chemin de dégradation n'a jamais été emprunté. Il ne
   l'est que lorsque le PAYS refuse l'entrée : `explain` reconstruit alors chaque décision, et sa
   validation rencontre la cause inconnue. Il faut donc un chien à la fois BRACHYCÉPHALE et de type
   réglementé — le référentiel en contient exactement un couple : le dogue canarien vers l'Australie.
   Sans cette sonde, la simulation aurait affiché « aucun problème de contrat » en n'ayant jamais
   posé la question. */
const sondeDegradation = (() => {
  const req = FinderRequest.parse({ origin: "airport_jfk", destination: "airport_syd",
    dog: { breed_id: "breed_presa_canario_dogo_canario", weight_kg: 8 },
    placement: "hold", date: `${_y}-01-15`, locale: "en" });
  const dec = evaluate(kbH, req);
  const entree = dec.destination.entry_allowed;
  const avantEchecs = compteurs.causes_refusees_par_zod;
  const rapport = rapportH(req);
  return {
    cas: "chien brachycéphale ET de type réglementé — dogue canarien vers l'Australie",
    entree_refusee_par_le_pays: entree === false,
    chemin_de_degradation_emprunte: entree === false,
    rapport_produit: rapport !== null,
    refuse_par_la_validation: compteurs.causes_refusees_par_zod > avantEchecs,
    lecture: entree !== false
      ? "ATTENTION : ce cas n'a PAS refusé l'entrée — la sonde ne prouve rien, à revoir"
      : rapport === null
        ? "le contrat refuse la cause sur ce chemin"
        : "le rapport passe — mais NON parce que la cause serait valide : `explain` ÉTEINT les " +
          "causes quand il dégrade une confirmation en refus, si bien que la validation ne la voit " +
          "jamais. Le besoin de contrat est établi par `sonde_de_contrat`, pas par ce chemin.",
  };
})();

const intact = sha256Fichier("packages/knowledge/raw/rules.json") === sceau.raw_rules_sha256 &&
  sha256Fichier("packages/knowledge/raw/objects.json") === sceau.raw_objects_sha256;

const doc = {
  lot: "T0-B3-a — simulation de l'option H",
  nature: "SIMULATION — aucun code moteur écrit, aucun fichier de packages/ modifié",
  sceau, referentiel_intact: intact,
  definition_de_H: {
    deny_global_iata: "retiré — l'information IATA reste un avertissement de sécurité",
    confirmation_propre_a_la_race: `cause structurée « ${CAUSE_H} »`,
    table_de_decision: [
      "canal structurellement fermé → denied (H n'ouvre rien)",
      "preuve auditée disant brachy_allowed = false → denied (interdiction prouvée)",
      "preuve auditée disant brachy_allowed = true → statut inchangé (autorisation prouvée)",
      "tout le reste → confirmation_required, cause « politique brachycéphale non auditée »",
    ],
    chien_non_brachycephale: "aucune modification, par construction — vérifié par la garantie 1",
    les_41_regles: "conservées, chargées, ne refusent plus ; à résorber une par une par audit officiel",
  },
  methode:
    "H ne change que la couche décision. On appelle donc `evaluate` sur une base où les 42 ne " +
    "refusent plus mais restent chargées (leur confiance pèse toujours sur le score), on applique " +
    "la table de décision de H aux placements d'un chien brachycéphale, puis on passe la décision " +
    "au VRAI `explain`. Verdict, score, cartes et libellés sont calculés par le moteur réel.",
  garanties,
  diff_contre_le_statu_quo: {
    grille_publique: diffPublic,
    grille_brachycephale: brachy,
  },
  sonde_de_contrat: sondeContrat,
  sonde_de_degradation: sondeDegradation,
  contrat_a_faire_evoluer: {
    cause_manquante: CAUSE_H,
    placements_reecrits_par_la_simulation: compteurs.placements_reecrits,
    rapports_refuses_par_la_validation: compteurs.causes_refusees_par_zod,
    lecture:
      "Le compteur porte sur les grilles ci-dessus ; la sonde de dégradation traite à part le seul " +
      "chemin où le contrat est réellement mis à l'épreuve. " +
      "La cause n'existe pas encore dans `ConfirmationCause`. Là où le moteur RECONSTRUIT une " +
      "décision — dégradation par `entry_allowed` — sa validation la refuse. Le compteur ci-dessus " +
      "chiffre exactement le travail de contrat que H demandera : ajouter la cause à l'union " +
      "stricte, son libellé dans les quatre langues, et sa prise en compte partout où les causes " +
      "sont rendues.",
  },
};
ecrireJson(`${DOSSIER}/option-h-simulee.json`, doc);

console.log(`simulation écrite : ${DOSSIER}/option-h-simulee.json`);
console.log("\n  GARANTIES");
console.log(`    1 · aucun chien non brachycéphale touché : ${garanties.g1_aucun_chien_non_brachycephale_touche.compagnies} compagnie(s), ` +
  `${garanties.g1_aucun_chien_non_brachycephale_touche.placements} placement(s), ${garanties.g1_aucun_chien_non_brachycephale_touche.scenarios_publics} scénario(s) golden`);
console.log(`    2 · aucun canal non proposé rouvert      : ${garanties.g2_aucun_canal_non_propose_rouvert.violations} violation(s)`);
console.log(`    3 · aucune confirmation → message climat : ${garanties.g3_aucune_confirmation_devenue_message_climatique.violations} violation(s)`);
console.log(`    4 · aucune auto-citation comme preuve    : ${garanties.g4_aucune_auto_citation_presentee_comme_preuve.violations} violation(s)`);
console.log(`    5 · cause dédiée sur les confirmations   : ${garanties.g5_toutes_les_confirmations_de_race_portent_la_cause_dediee.conformes} conforme(s), ` +
  `${garanties.g5_toutes_les_confirmations_de_race_portent_la_cause_dediee.violations} violation(s)`);
console.log("\n  DIFF CONTRE LE STATU QUO");
console.log(`    publique : ${diffPublic.verdicts} verdict(s) · ${diffPublic.cartes} carte(s) · ${diffPublic.placements} placement(s) · ` +
  `score ${diffPublic.ecart_score[0]}…${diffPublic.ecart_score[1]} · ${diffPublic.echecs} échec(s)`);
console.log(`    brachy   : ${brachy.compagnies} compagnies, ${brachy.placements} placements → ${JSON.stringify(brachy.par_statut_cible)}`);
console.log(`\n  SONDE DE DÉGRADATION (${sondeDegradation.cas})`);
console.log(`    entrée refusée par le pays : ${sondeDegradation.entree_refusee_par_le_pays ? "OUI" : "NON"}` +
  ` · rapport produit : ${sondeDegradation.rapport_produit ? "OUI" : "NON"}` +
  ` · refusé par la validation : ${sondeDegradation.refuse_par_la_validation ? "OUI" : "NON"}`);
console.log(`    → ${sondeDegradation.lecture}`);
console.log(`\n  SONDE DE CONTRAT`);
console.log(`    la cause « ${CAUSE_H} » est-elle acceptée par makePlacementDecision ? ` +
  `${sondeContrat.cause_acceptee_par_le_contrat ? "OUI" : "NON"}`);
console.log(`    → ${sondeContrat.lecture.slice(0, 120)}…`);
console.log(`\n  contrat : ${compteurs.causes_refusees_par_zod} rapport(s) refusé(s) par la validation (cause « ${CAUSE_H} » absente)`);
console.log(`  référentiel intact : ${intact ? "OUI" : "NON"}`);
if (!intact) process.exit(1);
