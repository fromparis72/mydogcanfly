/**
 * T0-B3 · outil 4 — le retrait GROUPÉ, par famille.
 *
 *   npx tsx mesures/t0b3-regles-autosourcees/outils/retrait-groupe.mjs
 *   → mesures/t0b3-regles-autosourcees/retrait-groupe.json
 *
 * POURQUOI CET OUTIL EXISTE, alors que la contre-revue demandait une simulation ISOLÉE.
 *
 * La simulation isolée répond à « que se passe-t-il si je retire CETTE règle ». Un sous-lot, lui,
 * en retire une FAMILLE. Or les deux ne coïncident pas : mesuré le 16/08/2026, retirer
 * `rule_aegean_brachy_hold` seule ne change rien, retirer `rule_global_brachy_hold` seule ne change
 * rien — retirer les deux rouvre la soute (denied → allowed) et le fret (denied →
 * confirmation_required). Deux règles individuellement « redondantes » sont conjointement
 * porteuses.
 *
 * Lire les 41 verdicts « redondante » comme « ces 41 règles sont retirables » serait donc une
 * erreur de raisonnement, pas une erreur de mesure. Cet outil la rend impossible : il retire la
 * famille entière et regarde ce que le contrat public devient.
 *
 * Ici encore, rien n'est écrit dans `packages/knowledge/raw/`.
 */
import { normalize } from "../../../packages/knowledge/src/normalize.ts";
import { rawKB } from "../../../packages/knowledge/src/data.ts";
import { runFinder } from "../../../packages/engine/src/pipeline.ts";
import { FinderRequest } from "../../../packages/engine/src/contracts.ts";
import { chargerReferentiel, estAutoCitee, ecrireJson } from "./lib-regles.mjs";

const SORTIE = "mesures/t0b3-regles-autosourcees/retrait-groupe.json";
const { sceau, regles } = chargerReferentiel();
const autoCitees = regles.filter(estAutoCitee);

/* Les 72 scénarios publics, à l'identique de la simulation isolée. */
const ROUTES = [
  ["airport_cdg", "airport_bkk"], ["airport_cdg", "airport_jfk"], ["airport_cdg", "airport_dxb"],
  ["airport_lhr", "airport_mia"], ["airport_fra", "airport_sin"], ["airport_mad", "airport_mex"],
  ["airport_cdg", "airport_lhr"], ["airport_jfk", "airport_cdg"], ["airport_mxp", "airport_jfk"],
];
const _y = new Date().getUTCFullYear() + 1;
const scenarios = [];
for (const [o, d] of ROUTES)
  for (const [nom, breed] of [["golden", "breed_golden_retriever"], ["pug", "breed_pug"]])
    for (const m of [1, 7])
      for (const pl of ["any", "hold"])
        scenarios.push({
          cle: `${o.slice(8)}-${d.slice(8)}|${nom}|${String(m).padStart(2, "0")}-15|${pl}`,
          req: FinderRequest.parse({ origin: o, destination: d, dog: { breed_id: breed, weight_kg: 8 },
            placement: pl, date: `${_y}-${String(m).padStart(2, "0")}-15`, locale: "en" }),
        });

/* Une sonde brachycéphale DÉDIÉE : les 72 scénarios publics ne mettent aucun carlin en soute sur
   une route Aegean. Sans elle, un retrait qui rouvre 90 soutes s'afficherait « 0 scénario
   affecté » — le faux négatif exact que ce dossier doit rendre impossible. */
const sondesBrachy = [];
for (const a of new Set(autoCitees.filter((r) => r.category === "breed_ban").map((r) => r.scope.id))) {
  const cie = rawKB.airlines?.find?.((x) => x.id === a) ?? null;
  const route = [...(cie?.direct_routes ?? [])].sort()[0];
  if (!route) continue;
  const [o, d] = route.split("|");
  sondesBrachy.push({
    cle: `${a}|pug|hold`, airline_id: a,
    req: FinderRequest.parse({ origin: o, destination: d,
      dog: { breed_id: "breed_pug", weight_kg: 8, brachycephalic: true },
      placement: "hold", date: `${_y}-01-15`, locale: "en" }),
  });
}

const compact = (rapport) => ({
  verdict: rapport.verdict, score: rapport.score,
  airlines: (rapport.airlines ?? []).map((a) =>
    `${a.airline_id}|${a.cabin_status}/${a.hold_status}/${a.cargo_status}`),
});
/* Sur la sonde brachycéphale, seuls la SOUTE et le FRET portent le risque qu'on surveille : c'est
   là qu'un chien au museau écrasé meurt. Comparer le triplet complet ferait compter un simple
   changement de statut CABINE comme « soute rouverte » — mesuré le 16/08/2026 sur la famille
   `cabin_weight`, qui ne touche pourtant aucune soute. Un faux positif de cette nature discrédite
   toute la colonne. */
const etatSoute = (rapport, id) => {
  const a = (rapport.airlines ?? []).find((x) => x.airline_id === id);
  return a ? `${a.hold_status}/${a.cargo_status}` : "absente";
};

const kbRef = normalize(rawKB);
const refPublic = Object.fromEntries(scenarios.map((s) => [s.cle, compact(runFinder(kbRef, s.req))]));
const refBrachy = Object.fromEntries(sondesBrachy.map((s) => [s.cle, etatSoute(runFinder(kbRef, s.req), s.airline_id)]));

/** Un groupe = un nom, une liste d'identités, et ce que son retrait produit. */
function mesurer(nom, ids, note) {
  const restants = new Set(ids);
  const kb = normalize({ ...rawKB, rules: rawKB.rules.filter((r) => !restants.has(r.id)) });

  /* Un scénario « changé » ne dit pas de quoi il a changé, et les deux natures n'ont pas la même
     gravité. Un STATUT qui bouge, c'est un canal qui s'ouvre ou se ferme — un fait publié. Un
     SCORE seul, c'est la confiance qui remonte parce qu'une source faible a disparu du calcul :
     réel, visible, mais sans promesse nouvelle sur le transport. Confondre les deux ferait passer
     une hausse de confiance pour une réouverture, ou l'inverse. */
  const changesPublics = [], scoreSeul = [];
  for (const s of scenarios) {
    const apres = compact(runFinder(kb, s.req));
    const avant = refPublic[s.cle];
    if (JSON.stringify(apres) === JSON.stringify(avant)) continue;
    const memesStatuts = JSON.stringify(apres.airlines) === JSON.stringify(avant.airlines);
    const memeVerdict = apres.verdict === avant.verdict;
    (memesStatuts && memeVerdict ? scoreSeul : changesPublics).push(s.cle);
  }
  const rouvertures = sondesBrachy
    .map((s) => ({ cle: s.cle, avant: refBrachy[s.cle], apres: etatSoute(runFinder(kb, s.req), s.airline_id) }))
    .filter((x) => x.avant !== x.apres);
  return {
    groupe: nom, note, regles_retirees: ids.length,
    scenarios_statut_change: changesPublics.length, exemples_statut: changesPublics.slice(0, 5),
    scenarios_score_seul: scoreSeul.length, exemples_score: scoreSeul.slice(0, 5),
    soutes_brachy_rouvertes: rouvertures.length, exemples_rouvertures: rouvertures.slice(0, 5),
  };
}

const parCategorie = {};
for (const r of autoCitees) (parCategorie[r.category] ??= []).push(r.id);

const mesures = [];
for (const [cat, ids] of Object.entries(parCategorie).sort()) {
  mesures.push(mesurer(`auto-citées · ${cat}`, ids, "toute la famille auto-citée de cette catégorie"));
}
mesures.push(mesurer("auto-citées · TOUTES", autoCitees.map((r) => r.id),
  "les 171 d'un coup — la borne haute du risque"));
/* La contre-épreuve qui compte : la protection brachycéphale tient-elle SANS la règle globale ? */
mesures.push(mesurer("breed_ban auto-citées + rule_global_brachy_hold",
  [...parCategorie.breed_ban, "rule_global_brachy_hold"],
  "ajoute la règle globale IATA, seul filet restant une fois les 41 retirées"));
mesures.push(mesurer("rule_global_brachy_hold SEULE", ["rule_global_brachy_hold"],
  "règle non auto-citée (IATA) — mesurée pour situer la dépendance, hors périmètre du lot"));

const doc = {
  lot: "T0-B3 — mesure des règles auto-sourcées",
  nature: "MESURE — retraits groupés SIMULÉS en mémoire, référentiel jamais écrit",
  sceau,
  lecture:
    "« scenarios_statut_change » = un statut de canal ou le verdict a bougé (un fait publié change). " +
    "« scenarios_score_seul » = seul le score bouge, tous les statuts identiques (la confiance remonte, " +
    "aucune promesse nouvelle sur le transport). Les deux portent sur les 72 scénarios de la baseline T0-A. " +
    "« soutes_brachy_rouvertes » porte sur une sonde dédiée : un carlin en soute sur la première " +
    "route directe de chaque compagnie concernée, en ne comparant QUE la soute et le fret. Sans " +
    "cette sonde, une réouverture massive resterait invisible : les 72 scénarios publics ne mettent " +
    "aucun brachycéphale en soute sur ces routes.",
  sondes: { scenarios_publics: scenarios.length, sondes_brachy: sondesBrachy.length },
  mesures,
};
ecrireJson(SORTIE, doc);

console.log(`retrait groupé écrit : ${SORTIE}`);
console.log(`  sondes : ${scenarios.length} scénarios publics · ${sondesBrachy.length} sondes brachy`);
for (const m of mesures) {
  console.log(`  ${m.groupe.padEnd(48)} ${String(m.regles_retirees).padStart(3)} règles · ` +
    `statut ${String(m.scenarios_statut_change).padStart(2)} · score seul ${String(m.scenarios_score_seul).padStart(2)} · ` +
    `${m.soutes_brachy_rouvertes} soute(s) brachy rouverte(s)`);
}
