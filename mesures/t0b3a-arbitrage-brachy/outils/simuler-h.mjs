/**
 * T0-B3-a · SIMULATION de l'option H — v2. Sans écrire une ligne de moteur.
 *
 *   node --import tsx mesures/t0b3a-arbitrage-brachy/outils/simuler-h.mjs
 *   → mesures/t0b3a-arbitrage-brachy/option-h-simulee.json
 *
 * ─── LES DEUX P0 DE LA v1, ET CE QUI LES CORRIGE ──────────────────────────────────────────────
 *
 * P0-1 · LA v1 EFFAÇAIT LES CAUSES EXISTANTES. Elle remplaçait une décision `confirmation_required`
 *   par un objet neuf ne portant que `breed_policy_unreviewed`. Mesuré : 452 causes supprimées sur
 *   la seule grille publique des carlins — 440 `legacy_unreviewed`, 8 `policy_unpublished`,
 *   4 `estimated_climate`. Sa « garantie climatique » passait donc pour une mauvaise raison : les
 *   quatre causes climatiques disparaissaient AVANT que le contrôle puisse les voir. Un test qui
 *   supprime son propre objet ne prouve rien.
 *   → v2 : les causes sont FUSIONNÉES, dédupliquées par `causeKey` (la fonction du moteur, pas une
 *     réimplémentation) et triées. Le dossier prouve ensuite que l'ensemble initial est un
 *     SOUS-ENSEMBLE EXACT de l'ensemble final, partout où le statut reste une confirmation.
 *
 * P0-2 · LA v1 LAISSAIT LES AUTO-CITATIONS NOTER LA COMPATIBILITÉ. Elle gardait les 41 règles en
 *   « warn » : invisibles comme sources, mais leur `confidence` continuait d'alimenter le score via
 *   `fired`. C'est exactement ce que T0-B3 a nommé — une auto-citation devenue preuve invisible.
 *   → v2 : les 42 règles sortent du calcul. L'état « politique brachycéphale non revérifiée » est
 *     porté par la POLITIQUE compagnie/canal, pas par une règle auto-citée. L'avertissement IATA est
 *     conservé À PART, avec l'URL vivante et la formulation « not recommended » — il ne prouve la
 *     politique d'aucune compagnie et ne note la fiabilité d'aucune fiche.
 *
 * ─── PORTÉE ──────────────────────────────────────────────────────────────────────────────────
 *
 * H s'applique aux 102 COMPAGNIES, pas aux 41 qui portaient une ancienne règle. Les 41 n'étaient
 * qu'un sous-ensemble arbitraire de notre documentation ; l'incertitude sur la politique
 * brachycéphale est générale.
 *
 * ─── COMMENT ON MESURE SANS IMPLÉMENTER ──────────────────────────────────────────────────────
 *
 * Le pipeline est `explain(evaluate(kb, req))`. H ne change que la couche décision : on évalue sur
 * une base SANS les 42, on applique la table de décision de H aux placements d'un chien
 * brachycéphale, puis on passe la décision au VRAI `explain`. Verdict, score, cartes et libellés
 * sont calculés par le moteur réel. Aucun fichier de `packages/` n'est écrit.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { normalize } from "../../../packages/knowledge/src/normalize.ts";
import { rawKB } from "../../../packages/knowledge/src/data.ts";
import { evaluate } from "../../../packages/engine/src/evaluate.ts";
import { explain } from "../../../packages/engine/src/explain.ts";
import { runFinder } from "../../../packages/engine/src/pipeline.ts";
import { FinderRequest, makePlacementDecision, causeKey } from "../../../packages/engine/src/contracts.ts";
import { preuveAuditee } from "../../../packages/knowledge/src/preuve.ts";
import { chargerReferentiel, estAutoCitee, ecrireJson } from "./lib-arbitrage.mjs";

const DOSSIER = "mesures/t0b3a-arbitrage-brachy";
const GLOBALE = "rule_global_brachy_hold";
const CAUSE_H = "breed_policy_unreviewed";
const AUTO = /(^|\.)mydogcanfly\.com$/i;
const URL_IATA_MORTE = "https://www.iata.org/en/youandiata/travelers/pets/";

const { sceau, regles } = chargerReferentiel();
const sha256Fichier = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

const brachyCompagnie = regles.filter((r) => r.category === "breed_ban" && estAutoCitee(r));
const IDS_42 = [...brachyCompagnie.map((r) => r.id), GLOBALE];

const kbA = normalize(rawKB);
/* Les 42 sortent DU CALCUL, pas seulement de l'affichage : leur confiance ne doit plus noter
   quoi que ce soit. C'est le sens du P0-2. */
const kbH = normalize({ ...rawKB, rules: rawKB.rules.filter((r) => !IDS_42.includes(r.id)) });

/** L'avertissement IATA, conservé À PART du calcul. Il n'est ni une règle, ni une source de
 *  politique : il n'entre ni dans `fired`, ni dans `sources`, ni dans la confiance. */
const AVERTISSEMENT_IATA = {
  nature: "avertissement de sécurité, jamais une interdiction ni une preuve de politique",
  url: "https://www.iata.org/en/programs/cargo/live-animals/pets/",
  citation: "Transport of snub nose dogs, such as boxers, pugs, bulldogs and Pekinese, " +
    "in hot season is not recommended.",
  ne_fait_pas: [
    "il ne prouve la politique d'aucune compagnie",
    "il ne note la fiabilité d'aucune fiche — il n'entre pas dans le calcul de confiance",
    "il n'introduit ni période ni seuil de température : « hot season » n'en définit aucun",
  ],
};

const brachyParRace = new Map((rawKB.breeds ?? []).map((b) => [b.id, b.brachycephalic === true]));
const estBrachy = (req) => req.dog.brachycephalic === true || brachyParRace.get(req.dog.breed_id) === true;

/** L'état porté par la POLITIQUE compagnie/canal — pas par une règle auto-citée.
 *  Dans l'implémentation, ce serait un champ de `PlacementPolicy`. Ici on le DÉRIVE des mêmes
 *  données, pour que la simulation ne préjuge pas d'une écriture du référentiel. */
function etatBrachyDuCanal(airlineId, placement) {
  const pol = kbA.airlines.get(airlineId)?.premium?.policy?.[placement] ?? null;
  const preuve = preuveAuditee(pol);
  if (preuve && pol?.brachy_allowed === false) return { etat: "interdit_audite", pol };
  if (preuve && pol?.brachy_allowed === true) return { etat: "autorise_audite", pol };
  return { etat: "non_revu", pol };
}

/** LA TABLE DE DÉCISION DE H — quatre branches, écrites une fois. */
function brancheH(airlineId, placement, statutBase) {
  if (statutBase === "denied") return { branche: 1, statut: "denied", motif: "canal structurellement fermé" };
  const { etat } = etatBrachyDuCanal(airlineId, placement);
  if (etat === "interdit_audite") return { branche: 2, statut: "denied", motif: "interdiction auditée" };
  if (etat === "autorise_audite") return { branche: 3, statut: statutBase, motif: "autorisation auditée" };
  return { branche: 4, statut: "confirmation_required", motif: "politique brachycéphale non revérifiée" };
}

const branchesExercees = { 1: 0, 2: 0, 3: 0, 4: 0 };

/** Fusion dédupliquée et STABLE, avec la clé canonique du moteur. */
const fusionner = (existantes, ajout) => {
  const m = new Map();
  for (const c of [...(existantes ?? []), ...ajout]) m.set(causeKey(c), c);
  return [...m.values()].sort((a, b) => causeKey(a).localeCompare(causeKey(b)));
};

const journal = { avant: [], apres: [], sous_ensemble_viole: [], dominance_violee: [] };

function appliquerH(decision, tracer = false) {
  if (!estBrachy(decision.request)) return decision;
  const airlines = decision.airlines.map((a) => {
    const placements = a.placements.map((d) => {
      if (d.placement === "cabin") return d; // les 42 règles n'ont jamais visé la cabine
      const { branche, statut, motif } = brancheH(a.airline_id, d.placement, d.status);
      branchesExercees[branche]++;
      const causesAvant = d.status === "confirmation_required" ? (d.confirmation_causes ?? []) : [];
      const ref = `${a.airline_id}#${d.placement}`;

      /* DOMINANCE : un refus dur éteint toutes les causes — la règle du moteur, respectée ici. */
      if (statut === "denied") {
        if (tracer && causesAvant.length) journal.dominance_violee.push({ ref, eteintes: causesAvant.map(causeKey) });
        return { placement: d.placement, status: "denied", allowed: false, ...(d.source ? { source: d.source } : {}) };
      }
      if (statut === "allowed") return d; // branche 3 sur un canal ouvert : rien à ajouter

      const causesApres = branche === 4
        ? fusionner(causesAvant, [{ code: CAUSE_H, policy_ref: ref }])
        : fusionner(causesAvant, []);
      if (tracer) {
        journal.avant.push(...causesAvant.map((c) => `${ref}|${causeKey(c)}`));
        journal.apres.push(...causesApres.map((c) => `${ref}|${causeKey(c)}`));
      }
      return {
        placement: d.placement, status: "confirmation_required", allowed: false,
        confirmation_causes: causesApres, ...(d.source ? { source: d.source } : {}),
      };
    });
    return { ...a, placements };
  });
  return { ...decision, airlines };
}

const compteurs = { rapports_refuses: 0 };
function rapportH(req, tracer = false) {
  const dec = appliquerH(evaluate(kbH, req), tracer);
  try {
    return explain(dec, req.locale);
  } catch {
    compteurs.rapports_refuses++;
    return null;
  }
}

/* ---- Les grilles ------------------------------------------------------------------------------- */
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

/* ---- Garanties ---------------------------------------------------------------------------------- */
const g = {
  g1_aucun_chien_non_brachycephale_touche: { compagnies: 0, placements: 0, scenarios_publics: 0, exemples: [] },
  g2_aucun_canal_non_propose_rouvert: { violations: 0, exemples: [] },
  g3_aucune_confirmation_devenue_message_climatique: { violations: 0, climat_observes: 0, exemples: [] },
  g4_aucune_auto_citation_presentee_comme_preuve: { violations: 0, exemples: [] },
  g5_causes_preexistantes_conservees: { avant: 0, apres: 0, perdues: 0, exemples: [] },
  g6_dominance_respectee: { refus_avec_causes_restantes: 0 },
  g7_les_42_hors_du_calcul: { occurrences: 0, exemples: [] },
  g7bis_dette_auto_citee_residuelle_hors_perimetre: { occurrences: 0, regles_distinctes: [], exemples: [] },
};

for (const s of grilleTemoin) {
  const av = carte(runFinder(kbA, s.req), s.airline_id);
  const ap = carte(rapportH(s.req), s.airline_id);
  const n = PL.filter((p) => (av?.[p] ?? null) !== (ap?.[p] ?? null)).length;
  if (n) {
    g.g1_aucun_chien_non_brachycephale_touche.compagnies++;
    g.g1_aucun_chien_non_brachycephale_touche.placements += n;
    if (g.g1_aucun_chien_non_brachycephale_touche.exemples.length < 4)
      g.g1_aucun_chien_non_brachycephale_touche.exemples.push(`${s.airline_id} ${trip(av)} → ${trip(ap)}`);
  }
}

const compact = (r) => ({ verdict: r.verdict, score: r.score,
  airlines: (r.airlines ?? []).map((a) => `${a.airline_id}|${trip(a)}`) });

const diffPublic = { scenarios: publique.length, verdicts: 0, cartes: 0, placements: 0,
  ecart_score: [0, 0], echecs: 0, golden_affectes: 0 };
const causesFinales = {};
const coexistence = { par_combinaison: {}, exemples: [] };

for (const s of publique) {
  const rA = runFinder(kbA, s.req), rH = rapportH(s.req, s.chien === "pug");
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
  const e = cH.score - cA.score;
  diffPublic.ecart_score = [Math.min(diffPublic.ecart_score[0], e), Math.max(diffPublic.ecart_score[1], e)];
  if (s.chien === "golden" && (cartes > 0 || cA.score !== cH.score)) diffPublic.golden_affectes++;

  for (const a of rH.airlines ?? []) {
    /* G3 — le message climatique ne doit jamais s'allumer sur une cause de RACE seule. Le contrôle
       ne vaut que parce que les causes climatiques SURVIVENT désormais à la fusion : on compte
       aussi combien on en a réellement observées, pour qu'un « 0 violation » sur 0 observation
       saute aux yeux. */
    for (const d of a.placement_decisions ?? []) {
      const codes = (d.confirmation_causes ?? []).map((c) => c.code);
      if (!codes.length) continue;
      for (const c of codes) causesFinales[c] = (causesFinales[c] ?? 0) + 1;
      if (codes.includes("estimated_climate")) g.g3_aucune_confirmation_devenue_message_climatique.climat_observes++;
      if (codes.length > 1) {
        const k = [...new Set(codes)].sort().join(" + ");
        coexistence.par_combinaison[k] = (coexistence.par_combinaison[k] ?? 0) + 1;
        if (coexistence.exemples.length < 6 && codes.includes(CAUSE_H))
          coexistence.exemples.push(`${s.cle} · ${a.airline_id}#${d.placement} : ${k}`);
      }
    }
    if (a.heat_confirmation_required) {
      const race = (a.placement_decisions ?? []).some((d) => (d.confirmation_causes ?? []).some((c) => c.code === CAUSE_H));
      const climat = (a.placement_decisions ?? []).some((d) => (d.confirmation_causes ?? []).some((c) => c.code === "estimated_climate"));
      if (race && !climat) {
        g.g3_aucune_confirmation_devenue_message_climatique.violations++;
        if (g.g3_aucune_confirmation_devenue_message_climatique.exemples.length < 4)
          g.g3_aucune_confirmation_devenue_message_climatique.exemples.push(`${s.cle} · ${a.airline_id}`);
      }
    }
    /* G7 — aucune règle auto-citée ne doit plus entrer dans le calcul. `fired` est retiré du
       rapport public : on l'observe donc sur la décision, plus bas. */
  }
  const urls = [...(rH.sources ?? []).map((x) => x.url),
    ...(rH.airlines ?? []).flatMap((a) => (a.placement_decisions ?? []).map((d) => d.source?.url).filter(Boolean))];
  for (const u of urls) {
    let h = ""; try { h = new URL(u).hostname; } catch { /* ignore */ }
    if (AUTO.test(h) || u === URL_IATA_MORTE) {
      g.g4_aucune_auto_citation_presentee_comme_preuve.violations++;
      if (g.g4_aucune_auto_citation_presentee_comme_preuve.exemples.length < 4)
        g.g4_aucune_auto_citation_presentee_comme_preuve.exemples.push(`${s.cle} · ${u}`);
    }
  }
}

/* G5 — l'ensemble initial est-il un SOUS-ENSEMBLE EXACT de l'ensemble final ? */
{
  const apres = new Set(journal.apres);
  const perdues = journal.avant.filter((x) => !apres.has(x));
  g.g5_causes_preexistantes_conservees = {
    avant: journal.avant.length, apres: journal.apres.length, perdues: perdues.length,
    exemples: perdues.slice(0, 5),
    lecture: perdues.length === 0
      ? "toute cause préexistante se retrouve dans l'ensemble final — inclusion stricte vérifiée"
      : "DES CAUSES ONT DISPARU — la fusion est fautive",
  };
  g.g6_dominance_respectee = {
    refus_avec_causes_restantes: 0,
    causes_eteintes_par_un_refus_dur: journal.dominance_violee.length,
    lecture: "un refus dur éteint toutes les causes : c'est la règle du moteur, appliquée ici. " +
      "Le compteur dit combien de fois elle a joué, pas combien de fois elle a été violée.",
  };
}

/* G7 — les 42 règles ne doivent plus apparaître dans `fired` d'AUCUNE décision. */
const reglesResiduelles = new Set();
for (const s of publique) {
  for (const a of evaluate(kbH, s.req).airlines) {
    for (const f of a.fired ?? []) {
      const hote = (() => { try { return new URL(f.source_url).hostname; } catch { return ""; } })();
      if (IDS_42.includes(f.rule_id)) {
        /* PÉRIMÈTRE DE H : aucune des 42 ne doit plus peser sur quoi que ce soit. */
        g.g7_les_42_hors_du_calcul.occurrences++;
        if (g.g7_les_42_hors_du_calcul.exemples.length < 4)
          g.g7_les_42_hors_du_calcul.exemples.push(`${s.cle} · ${a.airline_id} · ${f.rule_id}`);
      } else if (AUTO.test(hote)) {
        /* HORS PÉRIMÈTRE : les 130 AUTRES règles auto-citées de T0-B3 (poids de cabine, de soute,
           placement…) continuent d'alimenter la confiance. H ne les traite pas, et le taire ferait
           lire « 0 auto-citation dans le calcul » comme un état atteint alors qu'il ne l'est pas. */
        g.g7bis_dette_auto_citee_residuelle_hors_perimetre.occurrences++;
        reglesResiduelles.add(f.rule_id);
        if (g.g7bis_dette_auto_citee_residuelle_hors_perimetre.exemples.length < 4)
          g.g7bis_dette_auto_citee_residuelle_hors_perimetre.exemples.push(`${a.airline_id} · ${f.rule_id}`);
      }
    }
  }
}
g.g7bis_dette_auto_citee_residuelle_hors_perimetre.regles_distinctes = [...reglesResiduelles].sort();
g.g7bis_dette_auto_citee_residuelle_hors_perimetre.lecture =
  "Ces règles ne relèvent PAS de H : ce sont les autres auto-citations mesurées en T0-B3 " +
  "(cabin_weight, hold_weight, placement, import_rules). Elles restent dans le calcul de confiance " +
  "après H, et leur résorption est le lot suivant. Les compter à part évite de lire la garantie de " +
  "H comme une propreté générale qui n'est pas atteinte.";

/* ---- Grille brachycéphale ----------------------------------------------------------------------- */
const brachy = { compagnies: 0, placements: 0, par_statut_cible: {}, exemples: [] };
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
    }
    if (brachy.exemples.length < 4) brachy.exemples.push(`${s.airline_id} ${trip(av)} → ${trip(ap)}`);
  }
  for (const p of ["hold", "cargo"]) {
    const pol = kbA.airlines.get(s.airline_id)?.premium?.policy?.[p];
    const fin = ap?.[`${p}_status`];
    const proposé = pol?.status === "allowed" || pol?.status === "confirmation_required";
    if (!proposé && fin && fin !== "denied") {
      g.g2_aucun_canal_non_propose_rouvert.violations++;
      if (g.g2_aucun_canal_non_propose_rouvert.exemples.length < 4)
        g.g2_aucun_canal_non_propose_rouvert.exemples.push(`${s.airline_id}#${p} politique=${pol?.status ?? "absente"} → ${fin}`);
    }
  }
}

/* ---- FIXTURES : les quatre branches, dont deux qu'AUCUNE donnée réelle n'exerce ------------------
   Le référentiel contient zéro interdiction et zéro autorisation brachycéphale auditées. Les
   branches 2 et 3 de la table ne sont donc jamais empruntées par les grilles ci-dessus : les
   déclarer « vérifiées » serait une illusion. On fabrique donc quatre compagnies de test, une par
   branche, dans une base SYNTHÉTIQUE — jamais écrite sur le disque. */
const SOURCE_AUDITEE = {
  url: "https://exemple-compagnie-test.example/pets", source_type: "official_website",
  verified_date: "2026-08-01", review_due: "2026-10-30", confidence: 4, reviewer: "fixture", history: [],
};
/* `PlacementPolicyCommon.source` est OBLIGATOIRE : une politique sans source ne se normalise pas.
   La branche « non revue » a donc besoin d'une source qui NE passe PAS `preuveAuditee` — une
   auto-citation fait exactement cela, et c'est aussi l'état réel de nos 41 compagnies. */
const SOURCE_AUTO_CITEE = {
  url: "https://mydogcanfly.com/fixture-dog-policy/", source_type: "other",
  verified_date: "2026-08-01", review_due: "2026-10-30", confidence: 3, reviewer: "fixture", history: [],
};
const modele = rawKB.airlines.find((a) => a.premium?.policy?.hold);
const fixtureAirline = (id, hold) => ({
  ...modele, id, iata: id.slice(-2).toUpperCase(), name: id,
  direct_routes: ["airport_cdg|airport_jfk"], served_airport_ids: ["airport_cdg", "airport_jfk"],
  hub_airport_ids: ["airport_cdg"],
  premium: { ...modele.premium, policy: {
    cabin: { availability: "not_offered", source: SOURCE_AUTO_CITEE },
    hold,
    cargo: { availability: "not_offered", source: SOURCE_AUTO_CITEE } } },
});
const FIXTURES = [
  { branche: 1, id: "airline_fx_ferme", hold: { availability: "not_offered", source: SOURCE_AUTO_CITEE }, attendu: "denied" },
  { branche: 2, id: "airline_fx_interdit", hold: { availability: "offered", brachy_allowed: false, source: SOURCE_AUDITEE }, attendu: "denied" },
  { branche: 3, id: "airline_fx_autorise", hold: { availability: "offered", brachy_allowed: true, source: SOURCE_AUDITEE }, attendu: "allowed" },
  { branche: 4, id: "airline_fx_non_revu", hold: { availability: "offered", source: SOURCE_AUTO_CITEE }, attendu: "confirmation_required" },
];
const fixtures = (() => {
  const airlines = [...rawKB.airlines, ...FIXTURES.map((f) => fixtureAirline(f.id, f.hold))];
  const brut = { ...rawKB, airlines, rules: rawKB.rules.filter((r) => !IDS_42.includes(r.id)) };
  let kbFx;
  try { kbFx = normalize(brut); } catch (e) { return { erreur: String(e).slice(0, 200) }; }
  const req = FinderRequest.parse({ origin: "airport_cdg", destination: "airport_jfk",
    dog: { breed_id: "breed_pug", weight_kg: 8, brachycephalic: true }, placement: "hold",
    date: `${_y}-01-15`, locale: "en" });
  const polDe = (id, p) => kbFx.airlines.get(id)?.premium?.policy?.[p] ?? null;
  const brancheFx = (id, statutBase) => {
    if (statutBase === "denied") return { branche: 1, statut: "denied" };
    const pol = polDe(id, "hold"), preuve = preuveAuditee(pol);
    if (preuve && pol?.brachy_allowed === false) return { branche: 2, statut: "denied" };
    if (preuve && pol?.brachy_allowed === true) return { branche: 3, statut: statutBase };
    return { branche: 4, statut: "confirmation_required" };
  };
  const dec = evaluate(kbFx, req);
  return FIXTURES.map((f) => {
    const a = dec.airlines.find((x) => x.airline_id === f.id);
    const base = a?.placements.find((p) => p.placement === "hold")?.status ?? "absente";
    const r = a ? brancheFx(f.id, base) : { branche: null, statut: "absente" };
    return { branche: f.branche, compagnie: f.id, statut_base: base, statut_H: r.statut,
      attendu: f.attendu, conforme: r.statut === f.attendu, branche_empruntee: r.branche };
  });
})();

/* ---- SONDE DE COEXISTENCE : climat + politique générale + politique brachycéphale --------------- */
const sondeCoexistence = (() => {
  /* On cherche, dans la grille publique des carlins, un placement portant À LA FOIS une cause
     climatique, une cause de politique générale et la cause de race. S'il n'en existe aucun
     naturellement, on le DIT plutôt que de conclure au succès. */
  const trouves = Object.entries(coexistence.par_combinaison)
    .filter(([k]) => k.includes(CAUSE_H) && k.includes("estimated_climate"));
  const avecPolitique = Object.entries(coexistence.par_combinaison)
    .filter(([k]) => k.includes(CAUSE_H) && (k.includes("legacy_unreviewed") || k.includes("policy_unpublished")));
  return {
    combinaisons_observees: coexistence.par_combinaison,
    race_plus_climat: trouves.length ? Object.fromEntries(trouves) : null,
    race_plus_politique_generale: avecPolitique.length ? Object.fromEntries(avecPolitique) : null,
    exemples: coexistence.exemples,
    lecture: trouves.length
      ? "la coexistence climat + race est OBSERVÉE : les deux causes cohabitent sur le même canal"
      : "aucune coexistence climat + race sur cette grille — à ne PAS lire comme une garantie",
  };
})();

/* ---- Sonde de contrat ---------------------------------------------------------------------------- */
const sondeContrat = (() => {
  try {
    makePlacementDecision("hold", "confirmation_required", [{ code: CAUSE_H, policy_ref: "airline_aegean#hold" }], undefined);
    return { cause_acceptee: true, lecture: "INATTENDU — vérifier l'union ConfirmationCause" };
  } catch (e) {
    return { cause_acceptee: false, erreur: String(e).split("\n")[0].slice(0, 140),
      lecture: "attendu : l'union est STRICTE. Toute implémentation de H doit d'abord y ajouter la " +
        "cause, avec son libellé dans les quatre langues. La simulation construit ses objets à la " +
        "main et CONTOURNE ce contrôle : elle ne prouve rien sur le contrat, cette sonde si." };
  }
})();

const intact = sha256Fichier("packages/knowledge/raw/rules.json") === sceau.raw_rules_sha256 &&
  sha256Fichier("packages/knowledge/raw/objects.json") === sceau.raw_objects_sha256;

const doc = {
  lot: "T0-B3-a — simulation de l'option H (v2)",
  nature: "SIMULATION — aucun code moteur écrit, aucun fichier de packages/ modifié",
  sceau, referentiel_intact: intact,
  portee: "H s'applique aux 102 COMPAGNIES, pas aux 41 qui portaient une ancienne règle : celles-ci " +
    "n'étaient qu'un sous-ensemble arbitraire de notre documentation.",
  corrections_de_la_v1: {
    p0_1_causes_effacees: {
      constat: "la v1 remplaçait la décision et supprimait 452 causes préexistantes sur la grille " +
        "publique des carlins — 440 legacy_unreviewed, 8 policy_unpublished, 4 estimated_climate",
      consequence: "sa garantie climatique passait pour une mauvaise raison : les causes " +
        "climatiques disparaissaient avant que le contrôle puisse les voir",
      correction: "fusion dédupliquée par `causeKey` (la fonction du moteur), ordre stable, et " +
        "preuve d'inclusion de l'ensemble initial dans l'ensemble final",
    },
    p0_2_auto_citations_dans_le_score: {
      constat: "la v1 gardait les 41 règles en « warn » : invisibles comme sources, mais leur " +
        "confiance alimentait encore le score via `fired`",
      correction: "les 42 sortent du CALCUL. L'état brachycéphale est porté par la politique " +
        "compagnie/canal ; l'avertissement IATA est conservé à part et n'entre ni dans `fired`, " +
        "ni dans `sources`, ni dans la confiance",
    },
  },
  avertissement_iata: AVERTISSEMENT_IATA,
  table_de_decision: [
    "1 · canal structurellement fermé → denied (H n'ouvre rien)",
    "2 · preuve auditée disant brachy_allowed = false → denied",
    "3 · preuve auditée disant brachy_allowed = true → statut inchangé",
    "4 · politique brachycéphale non revérifiée → confirmation_required, cause fusionnée",
  ],
  branches_exercees_par_les_donnees_reelles: branchesExercees,
  fixtures_des_quatre_branches: fixtures,
  garanties: g,
  causes_finales_par_code: causesFinales,
  sonde_de_coexistence: sondeCoexistence,
  sonde_de_contrat: sondeContrat,
  diff_contre_le_statu_quo: { grille_publique: diffPublic, grille_brachycephale: brachy },
};
ecrireJson(`${DOSSIER}/option-h-simulee.json`, doc);

console.log(`simulation v2 écrite : ${DOSSIER}/option-h-simulee.json`);
console.log("\n  GARANTIES");
console.log(`    1 · aucun chien non brachycéphale touché : ${g.g1_aucun_chien_non_brachycephale_touche.compagnies} compagnie(s), ${g.g1_aucun_chien_non_brachycephale_touche.placements} placement(s)`);
console.log(`    2 · aucun canal non proposé rouvert      : ${g.g2_aucun_canal_non_propose_rouvert.violations}`);
console.log(`    3 · aucun message climatique usurpé      : ${g.g3_aucune_confirmation_devenue_message_climatique.violations} violation(s) · ${g.g3_aucune_confirmation_devenue_message_climatique.climat_observes} cause(s) climatique(s) RÉELLEMENT observées`);
console.log(`    4 · aucune auto-citation comme preuve    : ${g.g4_aucune_auto_citation_presentee_comme_preuve.violations}`);
console.log(`    5 · causes préexistantes conservées      : ${g.g5_causes_preexistantes_conservees.avant} avant → ${g.g5_causes_preexistantes_conservees.apres} après · ${g.g5_causes_preexistantes_conservees.perdues} perdue(s)`);
console.log(`    6 · dominance                            : ${g.g6_dominance_respectee.causes_eteintes_par_un_refus_dur} refus dur(s) éteignant des causes`);
console.log(`    7 · les 42 hors du calcul                : ${g.g7_les_42_hors_du_calcul.occurrences} occurrence(s)`);
console.log(`    7bis · dette auto-citée RÉSIDUELLE (hors H) : ${g.g7bis_dette_auto_citee_residuelle_hors_perimetre.occurrences} occurrence(s), ` +
  `${g.g7bis_dette_auto_citee_residuelle_hors_perimetre.regles_distinctes.length} règle(s) distincte(s)`);
console.log("\n  BRANCHES DE LA TABLE");
console.log(`    exercées par les données réelles : ${JSON.stringify(branchesExercees)}`);
for (const f of fixtures) console.log(`    fixture branche ${f.branche} · ${f.compagnie} : base=${f.statut_base} → H=${f.statut_H} (attendu ${f.attendu}) ${f.conforme ? "OK" : "ÉCART"}`);
console.log("\n  COEXISTENCE DES CAUSES");
console.log(`    ${JSON.stringify(sondeCoexistence.combinaisons_observees)}`);
console.log(`    → ${sondeCoexistence.lecture}`);
console.log("\n  DIFF CONTRE LE STATU QUO");
console.log(`    publique : ${diffPublic.verdicts} verdict(s) · ${diffPublic.cartes} carte(s) · ${diffPublic.placements} placement(s) · score ${diffPublic.ecart_score[0]}…${diffPublic.ecart_score[1]} · golden affectés ${diffPublic.golden_affectes}`);
console.log(`    brachy   : ${brachy.compagnies} compagnies, ${brachy.placements} placements → ${JSON.stringify(brachy.par_statut_cible)}`);
console.log(`\n  contrat : cause acceptée ? ${sondeContrat.cause_acceptee ? "OUI" : "NON"} · rapports refusés : ${compteurs.rapports_refuses}`);
console.log(`  référentiel intact : ${intact ? "OUI" : "NON"}`);
if (!intact) process.exit(1);
