/**
 * T0-B3 · outil 5 — les STRATES mesurées, et ce qu'elles permettent de proposer.
 *
 *   node --import tsx mesures/t0b3-regles-autosourcees/outils/sous-lot.mjs
 *   → mesures/t0b3-regles-autosourcees/sous-lot-propose.json
 *
 * Cet outil ne mesure rien de neuf : il TRIE ce que les outils 1 à 4 ont établi, selon un critère
 * écrit, pour qu'une proposition ne soit pas une opinion déguisée en liste.
 *
 * ─── CE QUE LA PREMIÈRE VERSION AVAIT MAL POSÉ ────────────────────────────────────────────────
 *
 * Elle reléguait les 41 règles de race au motif qu'elles sont « redondantes » — sans effet marginal
 * sur le statut — et posait comme garde-fou que `rule_global_brachy_hold` « reste en place ».
 *
 * Ce raisonnement s'appuie sur un filet déjà contesté. Cette règle globale :
 *   · refuse la soute ET le fret à TOUT chien brachycéphale, sans condition de saison ni de
 *     température — un « déconseillé en période chaude » devenu interdiction permanente ;
 *   · s'applique universellement, à toutes les compagnies, y compris celles qui n'ont jamais
 *     publié une telle interdiction ;
 *   · cite une page générique de l'IATA, et son propre `rationale` dit « la plupart des compagnies
 *     les refusent et les spécialistes le déconseillent » — c'est un DÉFAUT DE SÉCURITÉ assumé,
 *     pas une interdiction documentée.
 *
 * L'absence d'effet marginal des 41 ne prouve donc pas leur justesse : elle prouve seulement
 * qu'une 42ᵉ règle, elle-même à arbitrer, produit déjà le même refus. Les 41 et la globale forment
 * un ENSEMBLE DÉPENDANT DE 42 RÈGLES, à traiter comme un P0 commun — pas une famille à reléguer
 * derrière un garde-fou qui n'en est pas un.
 */
import { readFileSync } from "node:fs";
import { ecrireJson, chargerReferentiel } from "./lib-regles.mjs";

const DOSSIER = "mesures/t0b3-regles-autosourcees";
const lire = (f) => JSON.parse(readFileSync(`${DOSSIER}/${f}`, "utf8"));

const { sceau, regles } = chargerReferentiel();
const inventaire = lire("inventaire-171.json");
const classification = lire("classification.json");
const impact = lire("impact-retrait.json");
const groupe = lire("retrait-groupe.json");

const parId = new Map(inventaire.regles.map((r) => [r.id, r]));
const classeDe = new Map(classification.regles.map((r) => [r.id, r.classe]));

/* Cohérence entre les artefacts : trois vues du même ensemble doivent porter les mêmes identités. */
const anomalies = [];
const idsInv = new Set(parId.keys());
for (const src of [classification.regles, impact.regles]) {
  for (const r of src) if (!idsInv.has(r.id)) anomalies.push(`${r.id} absent de l'inventaire`);
  if (src.length !== idsInv.size) anomalies.push(`cardinal divergent : ${src.length} vs ${idsInv.size}`);
}

/** Trois strates, disjointes et exhaustives sur les 171. Le vocabulaire est délibéré : aucune ne
 *  dit « superflue », aucune ne dit « juste ». Elles décrivent un EFFET OBSERVÉ, pas une valeur. */
const strates = { dominant_for_status: [], sans_effet_marginal_sur_le_statut: [], temoin_non_constructible: [] };
for (const r of impact.regles) {
  const s = !r.temoin.construit ? "temoin_non_constructible"
    : r.temoin.dominant_for_status ? "dominant_for_status"
    : "sans_effet_marginal_sur_le_statut";
  strates[s].push(r.id);
}

const POIDS_CATEGORIE = { hold_weight: 0, import_rules: 1, cabin_weight: 2, placement: 3, breed_ban: 4 };
const detailler = (id) => {
  const i = parId.get(id), m = impact.regles.find((x) => x.id === id);
  return {
    id, categorie: i.categorie, criticite: i.criticite, portee: i.portee,
    effet: i.effet, conditions: i.conditions, seuil: i.params?.max_weight_kg ?? null,
    classe: classeDe.get(id), source_actuelle: i.source.url, verifiee_le: i.source.verified_date,
    fired: m.temoin.fired,
    status_changed_on_removal: m.temoin.status_changed_on_removal,
    score_changed_on_removal: m.temoin.score_changed_on_removal,
    scenarios_publics_affectes: m.public.scenarios_affectes,
    temoin: m.temoin.requete,
    effet_du_retrait: m.temoin.entite_avant && m.temoin.entite_apres
      ? `${m.temoin.entite_avant} → ${m.temoin.entite_apres}`
      : `verdict ${m.temoin.verdict_avant} → ${m.temoin.verdict_apres}`,
  };
};

const dominantes = strates.dominant_for_status.map(detailler).sort((a, b) =>
  POIDS_CATEGORIE[a.categorie] - POIDS_CATEGORIE[b.categorie] ||
  b.scenarios_publics_affectes - a.scenarios_publics_affectes ||
  a.id.localeCompare(b.id));

/* ---- P0 : l'ensemble brachycéphale, 41 + 1 -------------------------------------------------- */
const GLOBALE = "rule_global_brachy_hold";
const globale = regles.find((r) => r.id === GLOBALE) ?? null;
const brachy41 = inventaire.regles.filter((r) => r.categorie === "breed_ban").map((r) => r.id);
const mesureConjointe = groupe.mesures.find((m) => m.groupe.startsWith("breed_ban auto-citées +")) ?? null;

/* ---- Candidate de backlog : les dominantes au poids décisionnel le plus lourd ---------------- */
const FAMILLES_CANDIDATES = ["hold_weight", "import_rules"];
const candidate = dominantes.filter((d) => FAMILLES_CANDIDATES.includes(d.categorie));

const doc = {
  lot: "T0-B3 — mesure des règles auto-sourcées",
  nature: "MESURE et PROPOSITION — aucune correction appliquée ; toute suite est soumise à arbitrage",
  sceau,
  anomalies,
  strates: Object.fromEntries(Object.entries(strates).map(([k, v]) => [k, v.length])),
  lecture_des_strates: {
    dominant_for_status:
      "la règle se déclenche ET son retrait déplace le statut publié du canal : elle décide seule",
    sans_effet_marginal_sur_le_statut:
      "la règle se déclenche, mais son retrait ne déplace pas le statut — une autre règle ou la " +
      "politique canonique produit déjà le même refus. Cela ne dit RIEN de sa justesse, et " +
      "certaines font tout de même bouger le score.",
    temoin_non_constructible:
      "aucun témoin constructible : les 31 pays concernés n'ont aucun aéroport dans le GRAPHE " +
      "FINDER ACTUEL. Inatteignables aujourd'hui, pas inertes définitivement — l'ajout d'un seul " +
      "aéroport les remettrait en service sans que rien ne le signale.",
  },

  p0_ensemble_brachycephale: {
    intitule: "P0 — les 41 règles de race et la règle globale forment un ensemble dépendant de 42",
    regles: [...brachy41, GLOBALE],
    total: brachy41.length + 1,
    pourquoi:
      "Les 41 sont sans effet marginal sur le statut UNIQUEMENT parce que la règle globale produit " +
      "déjà le même refus. Or cette règle globale est elle-même à arbitrer : elle transforme un " +
      "« déconseillé en période chaude » en interdiction permanente de soute et de fret, " +
      "l'applique à toutes les compagnies sans distinction, et s'adosse à une page générique de " +
      "l'IATA que son propre rationale décrit comme un défaut de sécurité. Demander qu'elle " +
      "« reste en place » comme garde-fou revient à garantir un ensemble par l'un de ses membres " +
      "contestés. L'absence d'effet marginal des 41 ne prouve pas leur justesse.",
    regle_globale: globale
      ? { id: globale.id, portee: globale.scope.type, effet: globale.effect,
          conditions_de_saison: false, source: globale.source.url,
          source_type: globale.source.source_type, auto_citee: false }
      : null,
    mesure_conjointe: mesureConjointe,
    consequence_mesuree:
      "retirer les 41 seules ne rouvre aucune soute ; retirer les 42 en rouvre 41 sur 41. " +
      "Aucune intervention partielle sur cet ensemble ne peut être évaluée règle par règle.",
  },

  candidate_de_backlog: {
    intitule: "Candidate — revérifier les seuils de soute et les importations atteignables",
    statut: "NON VALIDÉE comme premier sous-lot : l'arbitrage de la règle brachycéphale globale " +
      "passe devant, et peut redistribuer les priorités.",
    familles: FAMILLES_CANDIDATES,
    regles: candidate.length,
    entites_concernees: new Set(candidate.map((d) => d.portee.id)).size,
    pourquoi:
      "Ce sont les dominantes au poids décisionnel le plus lourd. Les 34 seuils de soute sont " +
      "dominants à 34 sur 34 — aucun filet derrière eux : un seuil faux refuse un chien qui " +
      "pouvait voler, ou en accepte un qui ne le pouvait pas. Une règle d'importation fausse " +
      "envoie un voyageur vers une frontière qui le refusera. Les 13 retenues sont celles dont le " +
      "pays est atteignable dans le graphe Finder actuel.",
    liste: candidate,
  },

  reste_a_traiter: [
    "cabin_weight — 31 dominantes sur 40 ; un refus de cabine se rattrape en soute",
    "placement — 1 dominante sur 12 ; les 11 autres se déclenchent mais sont doublées par la politique canonique, et l'une fait bouger le score",
    "les 31 importations non atteignables dans le graphe Finder actuel — à réévaluer dès qu'un aéroport est ajouté dans l'un de ces pays",
    "les 13 règles citant un tiers non officiel (pettravel.com, IATA, anivetvoyage), hors périmètre de ce lot",
  ],
};

ecrireJson(`${DOSSIER}/sous-lot-propose.json`, doc);
console.log(`proposition écrite : ${DOSSIER}/sous-lot-propose.json`);
console.log(`  strates : ${doc.strates.dominant_for_status} dominant_for_status · ` +
  `${doc.strates.sans_effet_marginal_sur_le_statut} sans effet marginal · ` +
  `${doc.strates.temoin_non_constructible} témoin non constructible`);
console.log(`  P0 brachycéphale : ${doc.p0_ensemble_brachycephale.total} règles (41 + la globale)`);
console.log(`  candidate de backlog : ${candidate.length} règles · ${doc.candidate_de_backlog.entites_concernees} entités — NON validée`);
console.log(`  anomalies de cohérence : ${anomalies.length}`);
