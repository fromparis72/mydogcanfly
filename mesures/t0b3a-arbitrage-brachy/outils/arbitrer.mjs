/**
 * T0-B3-a · le dossier d'ARBITRAGE de l'ensemble brachycéphale (42 règles).
 *
 *   node --import tsx mesures/t0b3a-arbitrage-brachy/outils/arbitrer.mjs
 *   → mesures/t0b3a-arbitrage-brachy/arbitrage-p0-brachy.json
 *
 * ─── CE QUE CE DOSSIER FAIT, ET CE QU'IL NE FAIT PAS ──────────────────────────────────────────
 *
 * Il MESURE ce que chaque option déplacerait — verdicts, canaux, scores — avant toute
 * modification. Il n'applique rien : `packages/knowledge/raw/` n'est jamais écrit, l'empreinte
 * SHA-256 est relue à la fin et comparée à celle du début.
 *
 * Il ne tranche pas non plus. Le choix engage ce que le site AFFIRME à un voyageur dont le chien
 * risque de mourir en soute ; c'est une décision produit, elle revient à Philippe.
 *
 * ─── LES PRINCIPES DIRECTEURS, ET CE QUE LA MESURE EN FAIT ────────────────────────────────────
 *
 *   « Une interdiction ne subsiste que si une source officielle actuelle l'énonce explicitement. »
 *      → mesuré : ZÉRO des 41 interdictions compagnie est adossée à une preuve auditée disant
 *        `brachy_allowed = false`. Aucune ne survit à ce critère telle quelle.
 *
 *   « Une politique non vérifiée devient "à confirmer", jamais "interdit". »
 *      → mesuré : le moteur ne SAIT PAS l'exprimer pour une race. Voir la section
 *        `limite_du_moteur` : seule l'action `deny` agit sur un statut, et le seul « à confirmer »
 *        disponible vient de la politique du CANAL, qui n'a pas de dimension race — l'appliquer
 *        dégraderait aussi le canal des chiens non brachycéphales. C'est le résultat central de ce
 *        dossier, et il conditionne toutes les options.
 *
 *   « La recommandation générale de l'IATA ne doit plus produire une interdiction universelle. »
 *      → les options B, D et G la retirent ; leur coût est mesuré séparément.
 *
 *   « Aucun seuil de température ou de saison ne doit être inventé. »
 *      → AUCUNE option saisonnière n'est proposée. Le référentiel ne contient pas de seuil
 *        brachycéphale sourcé ; en fabriquer un serait exactement le défaut que ce chantier
 *        corrige. Une option « interdiction d'avril à octobre » aurait été facile à écrire et
 *        impossible à justifier : elle n'existe donc pas ici.
 *
 *   « Chaque option doit être mesurée sur les verdicts, les canaux et les scores avant
 *     modification. » → les trois axes, sur deux grilles (publique et brachycéphale dédiée).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { normalize } from "../../../packages/knowledge/src/normalize.ts";
import { rawKB } from "../../../packages/knowledge/src/data.ts";
import { runFinder } from "../../../packages/engine/src/pipeline.ts";
import { FinderRequest } from "../../../packages/engine/src/contracts.ts";
import { preuveAuditee } from "../../../packages/knowledge/src/preuve.ts";
import { chargerReferentiel, estAutoCitee, ecrireJson } from "./lib-arbitrage.mjs";

const DOSSIER = "mesures/t0b3a-arbitrage-brachy";
const GLOBALE = "rule_global_brachy_hold";

const { sceau, regles } = chargerReferentiel();
const sha256Fichier = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

/* ---- 1 · Les quatre familles demandées ------------------------------------------------------- */
const kbRef = normalize(rawKB);
const brachyCompagnie = regles.filter((r) => r.category === "breed_ban" && estAutoCitee(r));
const globale = regles.find((r) => r.id === GLOBALE);

/** Une interdiction est « officiellement confirmée » si la politique du canal porte une preuve
 *  auditée QUI DIT `brachy_allowed = false`. Pas « la compagnie a une source quelque part » :
 *  la source doit énoncer le fait que la règle affirme. */
function confirmationOfficielle(r) {
  const pol = kbRef.airlines.get(r.scope.id)?.premium?.policy ?? {};
  const canaux = (r.effect.placement ?? ["hold", "cargo"]).filter((p) => {
    const preuve = preuveAuditee(pol[p]);
    return preuve !== null && pol[p]?.brachy_allowed === false;
  });
  return canaux.length ? canaux : null;
}

const confirmees = [], nonVerifiables = [];
for (const r of brachyCompagnie) {
  const c = confirmationOfficielle(r);
  const pol = kbRef.airlines.get(r.scope.id)?.premium?.policy ?? {};
  const fiche = {
    id: r.id, compagnie: r.scope.id,
    effet: `${r.effect.action} ${(r.effect.placement ?? []).join("+")}`,
    source: r.source.url, source_type: r.source.source_type, verifiee_le: r.source.verified_date,
    statut_canonique_soute: pol.hold?.status ?? "absent",
    statut_canonique_fret: pol.cargo?.status ?? "absent",
    brachy_allowed_declare: { hold: pol.hold?.brachy_allowed ?? null, cargo: pol.cargo?.brachy_allowed ?? null },
    preuve_auditee_soute: preuveAuditee(pol.hold)?.url ?? null,
  };
  (c ? confirmees : nonVerifiables).push(c ? { ...fiche, canaux_confirmes: c } : fiche);
}

/* ---- 2 · Les grilles de mesure ---------------------------------------------------------------- */
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
          req: FinderRequest.parse({ origin: o, destination: d, dog: { breed_id: breed, weight_kg: 8 },
            placement: pl, date: `${_y}-${String(m).padStart(2, "0")}-15`, locale: "en" }) });

/** Deux grilles jumelles sur les MÊMES routes : un carlin, et un golden témoin. Sans le témoin,
 *  on ne verrait pas le dommage collatéral d'une option qui agit sur le canal et non sur la race —
 *  et c'est précisément ce que fait la seule option capable de produire « à confirmer ».
 *
 *  ELLES COUVRENT TOUTES LES COMPAGNIES, pas seulement les 41 qui portent une règle propre.
 *  Restreinte aux 41, la grille affichait « 0 canal déplacé » pour l'option B — alors que retirer
 *  la règle globale change 18 verdicts publics. L'effet portait sur les compagnies SANS règle
 *  propre, celles qui ne tiennent que par elle : exactement la population que cet arbitrage doit
 *  éclairer, et exactement celle que le cadrage initial rendait invisible. */
const cibles = [...new Set(brachyCompagnie.map((r) => r.scope.id))].sort();
const toutesCompagnies = rawKB.airlines.map((a) => a.id).sort();
const grilleBrachy = [], grilleTemoin = [];
for (const id of toutesCompagnies) {
  const route = [...(rawKB.airlines.find((a) => a.id === id)?.direct_routes ?? [])].sort()[0];
  if (!route) continue;
  const [o, d] = route.split("|");
  const base = { origin: o, destination: d, placement: "hold", date: `${_y}-01-15`, locale: "en" };
  grilleBrachy.push({ cle: id, airline_id: id,
    req: FinderRequest.parse({ ...base, dog: { breed_id: "breed_pug", weight_kg: 8, brachycephalic: true } }) });
  grilleTemoin.push({ cle: id, airline_id: id,
    req: FinderRequest.parse({ ...base, dog: { breed_id: "breed_golden_retriever", weight_kg: 8 } }) });
}

const triplet = (rapport, id) => {
  const a = (rapport.airlines ?? []).find((x) => x.airline_id === id);
  return a ? `${a.cabin_status}/${a.hold_status}/${a.cargo_status}` : "absente";
};
const compact = (r) => ({ verdict: r.verdict, score: r.score,
  airlines: (r.airlines ?? []).map((a) => `${a.airline_id}|${a.cabin_status}/${a.hold_status}/${a.cargo_status}`) });

/* ─── COMPAGNIE ≠ CANAL ≠ PLACEMENT ───────────────────────────────────────────────────────────
   La v1 comptait « 1 » dès qu'un triplet cabine/soute/fret changeait, et appelait ce nombre des
   « canaux ». C'était un décompte de COMPAGNIES : une compagnie dont la soute ET le fret bougent
   comptait pour un. Relevé en contre-revue le 16/08/2026 — 81 compagnies pour 147 placements sur
   l'option D. Les deux grandeurs sont désormais publiées côte à côte, jamais l'une pour l'autre. */
const PLACEMENTS = ["cabin_status", "hold_status", "cargo_status"];
const placementsDifferents = (a, b) => {
  if (!a || !b) return a === b ? 0 : PLACEMENTS.length;
  return PLACEMENTS.filter((p) => a[p] !== b[p]).length;
};
const parCompagnie = (r) => new Map((r.airlines ?? []).map((a) => [a.airline_id, a]));

/* ---- 3 · Les options ------------------------------------------------------------------------- */
const IDS_41 = brachyCompagnie.map((r) => r.id);
const IDS_42 = [...IDS_41, GLOBALE];
const sansRegles = (ids) => ({ ...rawKB, rules: rawKB.rules.filter((r) => !ids.includes(r.id)) });
/** Les 42 conservées mais dotées d'une autre action. Elles restent dans `fired`, donc leur
 *  confiance continue d'alimenter le score : ce n'est PAS un retrait, contrairement à ce que la v1
 *  affirmait. L'écart est petit et réel — c'est pour cela qu'il se mesure. */
const enAction = (action) => ({ ...rawKB,
  rules: rawKB.rules.map((r) => IDS_42.includes(r.id) ? { ...r, effect: { ...r.effect, action } } : r) });

/** Option G : retirer les 42 ET basculer la politique soute/fret des compagnies concernées sur
 *  `undocumented`, seul chemin DONNÉES vers « à confirmer ». Le prix est mesuré, pas supposé. */
function kbOptionG() {
  const set = new Set(cibles);
  const airlines = rawKB.airlines.map((a) => {
    if (!set.has(a.id) || !a.premium?.policy) return a;
    const pol = { ...a.premium.policy };
    for (const p of ["hold", "cargo"]) {
      if (!pol[p] || !("availability" in pol[p])) continue;
      pol[p] = { ...pol[p], availability: "undocumented" };
    }
    return { ...a, premium: { ...a.premium, policy: pol } };
  });
  return { ...sansRegles(IDS_42), airlines };
}

const OPTIONS = [
  { cle: "A", intitule: "statu quo — référence", kb: () => rawKB,
    description: "les 42 règles en place : interdiction permanente de soute et de fret pour tout chien brachycéphale, sur toutes les compagnies." },
  { cle: "B", intitule: "retirer la seule règle globale IATA", kb: () => sansRegles([GLOBALE]),
    description: "la recommandation générale cesse de produire une interdiction universelle ; les 41 règles compagnie restent." },
  { cle: "C", intitule: "retirer les 41 règles compagnie", kb: () => sansRegles(IDS_41),
    description: "les interdictions auto-citées disparaissent ; la règle globale IATA reste seule." },
  { cle: "D", intitule: "retirer les 42", kb: () => sansRegles(IDS_42),
    description: "plus aucune interdiction brachycéphale : le canal retombe sur la politique de la fiche." },
  { cle: "F-warn", intitule: "passer les 42 de l'action « deny » à « warn »",
    kb: () => enAction("warn"),
    description: "les règles restent chargées et visibles dans `fired` ; leur confiance continue " +
      "d'entrer dans le score, mais elles ne décident plus d'aucun statut." },
  { cle: "F-require", intitule: "passer les 42 de l'action « deny » à « require »",
    kb: () => enAction("require"),
    description: "même mécanique que « warn » — mesurée séparément parce qu'affirmer sans mesurer " +
      "que deux actions se comportent pareil serait précisément l'erreur de la v1." },
  { cle: "G", intitule: "retirer les 42 ET basculer la politique du canal en « non documentée »",
    kb: kbOptionG,
    description: "seul chemin DONNÉES vers « à confirmer » — mais il agit sur le CANAL, pas sur la race." },
];

const refPublique = Object.fromEntries(publique.map((s) => [s.cle, compact(runFinder(kbRef, s.req))]));
const refCartes = Object.fromEntries(publique.map((s) => [s.cle, parCompagnie(runFinder(kbRef, s.req))]));
const refObjets = {
  brachy: new Map(grilleBrachy.map((s) => [s.cle, parCompagnie(runFinder(kbRef, s.req)).get(s.airline_id)])),
  temoin: new Map(grilleTemoin.map((s) => [s.cle, parCompagnie(runFinder(kbRef, s.req)).get(s.airline_id)])),
};
const refBrachy = Object.fromEntries(grilleBrachy.map((s) => [s.cle, triplet(runFinder(kbRef, s.req), s.airline_id)]));
const refTemoin = Object.fromEntries(grilleTemoin.map((s) => [s.cle, triplet(runFinder(kbRef, s.req), s.airline_id)]));

function mesurer(opt) {
  const kb = normalize(opt.kb());
  let verdictsChanges = 0, scenariosCarteChange = 0, scoreSeul = 0;
  let cartesModifiees = 0, placementsModifies = 0, scoreMin = 0, scoreMax = 0;
  for (const s of publique) {
    const rap = runFinder(kb, s.req);
    const ap = compact(rap), av = refPublique[s.cle];
    /* Le grain fin se compte TOUJOURS, y compris quand le verdict change : sinon un scénario au
       verdict bousculé masquerait les cartes qu'il déplace. */
    const apCies = parCompagnie(rap), avCies = refCartes[s.cle];
    for (const [id, avant] of avCies) {
      const apres = apCies.get(id);
      const n = placementsDifferents(avant, apres);
      if (n > 0) { cartesModifiees++; placementsModifies += n; }
    }
    if (JSON.stringify(ap) === JSON.stringify(av)) continue;
    if (ap.verdict !== av.verdict) verdictsChanges++;
    else if (JSON.stringify(ap.airlines) !== JSON.stringify(av.airlines)) scenariosCarteChange++;
    else scoreSeul++;
    const d = ap.score - av.score;
    scoreMin = Math.min(scoreMin, d); scoreMax = Math.max(scoreMax, d);
  }
  const avecRegleP = new Set(cibles);
  const bascules = (grille, ref) => {
    const par = {};
    const exemples = [];
    let avecRegle = 0, sansRegle = 0, placements = 0;
    for (const s of grille) {
      const rap = runFinder(kb, s.req);
      const ap = triplet(rap, s.airline_id), av = ref[s.cle];
      if (ap === av) continue;
      placements += placementsDifferents(refObjets[ref === refBrachy ? "brachy" : "temoin"].get(s.cle),
        parCompagnie(rap).get(s.airline_id));
      const k = `${av} → ${ap}`;
      par[k] = (par[k] ?? 0) + 1;
      /* La ventilation qui compte : une compagnie qui a sa propre règle n'est pas dans la même
         situation qu'une compagnie qui ne tenait que par la règle globale. */
      avecRegleP.has(s.airline_id) ? avecRegle++ : sansRegle++;
      if (exemples.length < 4) exemples.push(`${s.airline_id} ${k}`);
    }
    return { compagnies_touchees: avecRegle + sansRegle, placements_modifies: placements,
      compagnies_avec_regle_propre: avecRegle, compagnies_sans_regle_propre: sansRegle,
      par_bascule: par, exemples };
  };
  const brachy = bascules(grilleBrachy, refBrachy);
  const temoin = bascules(grilleTemoin, refTemoin);
  return {
    option: opt.cle, intitule: opt.intitule, description: opt.description,
    grille_publique: { scenarios: publique.length,
      scenarios_dont_le_verdict_change: verdictsChanges,
      scenarios_dont_une_carte_change_a_verdict_stable: scenariosCarteChange,
      scenarios_dont_seul_le_score_change: scoreSeul,
      cartes_compagnie_modifiees: cartesModifiees,
      placements_modifies: placementsModifies,
      ecart_score: [scoreMin, scoreMax] },
    grille_brachycephale: brachy,
    grille_temoin_non_brachycephale: temoin,
    dommage_collateral: temoin.compagnies_touchees > 0
      ? `${temoin.compagnies_touchees} compagnie(s) et ${temoin.placements_modifies} placement(s) ` +
        `déplacés pour un chien NON brachycéphale — cette option n'agit pas sur la race`
      : "aucun : les chiens non brachycéphales ne sont pas touchés",
  };
}

const mesures = OPTIONS.map(mesurer);

/** F n'est PAS D. Les règles en `warn`/`require` restent chargées : leur confiance entre encore
 *  dans le score, et le score n'est pas cosmétique — c'est ce que le visiteur lit. La v1 écrivait
 *  « identique à un retrait pur » sans l'avoir mesuré scénario par scénario ; ce comparateur rend
 *  l'affirmation impossible à refaire à l'aveugle. */
function comparerADeD() {
  const kbD = normalize(sansRegles(IDS_42));
  const refD = publique.map((s) => runFinder(kbD, s.req));
  const out = {};
  for (const action of ["warn", "require"]) {
    const kb = normalize(enAction(action));
    let scoreDifferent = 0, verdictDifferent = 0, statutDifferent = 0, ecartMin = 0, ecartMax = 0;
    publique.forEach((s, i) => {
      const a = runFinder(kb, s.req), d = refD[i];
      if (a.verdict !== d.verdict) verdictDifferent++;
      const ca = compact(a), cd = compact(d);
      if (JSON.stringify(ca.airlines) !== JSON.stringify(cd.airlines)) statutDifferent++;
      if (a.score !== d.score) {
        scoreDifferent++;
        const e = a.score - d.score;
        ecartMin = Math.min(ecartMin, e); ecartMax = Math.max(ecartMax, e);
      }
    });
    out[`F-${action} vs D`] = {
      scenarios: publique.length,
      scenarios_au_score_different: scoreDifferent,
      scenarios_au_verdict_different: verdictDifferent,
      scenarios_au_statut_different: statutDifferent,
      ecart_de_score: [ecartMin, ecartMax],
      lecture: scoreDifferent > 0
        ? "F n'est PAS un retrait : les règles restent dans `fired` et leur confiance pèse encore sur le score."
        : "aucun écart mesuré avec D sur cette grille.",
    };
  }
  out["E — ne garder que les interdictions représentées comme auditées"] =
    "se confond avec D, l'ensemble étant VIDE (0 sur 41) — voir la famille 3.";
  return out;
}

/* ---- 4 · La limite du moteur, démontrée ------------------------------------------------------- */
const kbWarn = normalize({ ...rawKB,
  rules: rawKB.rules.map((r) => IDS_42.includes(r.id) ? { ...r, effect: { ...r.effect, action: "warn" } } : r) });
const temoinWarn = grilleBrachy.slice(0, 1)[0];
const limiteMoteur = {
  constat: "le moteur ne peut pas exprimer « brachycéphale : à confirmer »",
  demonstration_1: {
    geste: "passer les 42 règles de l'action « deny » à « warn »",
    attendu_naif: "le canal passerait « à confirmer »",
    observe: temoinWarn ? triplet(runFinder(kbWarn, temoinWarn.req), temoinWarn.airline_id) : null,
    reference: temoinWarn ? refBrachy[temoinWarn.cle] : null,
    explication:
      "evaluate() ne retient que `effect.action === \"deny\"` pour décider d'un statut ; une règle " +
      "d'une autre action reste visible dans `fired` mais ne déplace rien. Le résultat est donc " +
      "identique à un retrait pur.",
  },
  demonstration_2: {
    geste: "basculer la politique du canal sur « undocumented » (option G)",
    observe: "le canal passe bien « à confirmer »",
    prix:
      "la politique d'un canal n'a AUCUNE dimension race : le même « à confirmer » s'applique à un " +
      "golden retriever, pour lequel rien n'a jamais été en doute. Le dommage est chiffré dans " +
      "`grille_temoin_non_brachycephale` de l'option G.",
  },
  consequence:
    "Aucune option DONNÉES ne satisfait « non vérifié → à confirmer, jamais interdit » pour la " +
    "seule race concernée. Y parvenir demanderait une évolution du moteur — une classe de règle " +
    "produisant `confirmation_required` sur le chien qu'elle vise — donc un lot de code, contre-revu " +
    "et mesuré à part. Ce dossier le nomme plutôt que de faire passer une option approchante pour " +
    "la bonne.",
};

/* ---- 5 · Écriture ----------------------------------------------------------------------------- */
const intact = sha256Fichier("packages/knowledge/raw/rules.json") === sceau.raw_rules_sha256 &&
  sha256Fichier("packages/knowledge/raw/objects.json") === sceau.raw_objects_sha256;

const doc = {
  lot: "T0-B3-a — arbitrage de l'ensemble brachycéphale (42 règles)",
  nature: "MESURE et ARBITRAGE — aucune correction appliquée ; la décision revient à Philippe",
  sceau, referentiel_intact: intact,
  principes_directeurs: [
    "une interdiction ne subsiste que si une source officielle actuelle l'énonce explicitement",
    "une politique non vérifiée devient « à confirmer », jamais « interdit »",
    "la recommandation générale de l'IATA ne doit plus produire une interdiction universelle",
    "aucun seuil de température ou de saison ne doit être inventé",
    "chaque option est mesurée sur les verdicts, les canaux et les scores avant modification",
  ],
  familles: {
    "1_regle_globale_iata": {
      id: globale.id, portee: globale.scope.type, effet: globale.effect,
      condition_de_saison: false, condition_de_temperature: false,
      source: globale.source.url, source_type: globale.source.source_type,
      auto_citee: false, criticite: globale.criticality,
      rationale: globale.rationale,
      lecture:
        "refus permanent de soute ET de fret pour tout chien brachycéphale, toutes compagnies, " +
        "sans condition de saison ni de température. Le rationale dit lui-même « la plupart des " +
        "compagnies les refusent et les spécialistes le déconseillent » : c'est un défaut de " +
        "sécurité assumé, pas une interdiction documentée compagnie par compagnie.",
    },
    "2_regles_propres_aux_compagnies": {
      total: brachyCompagnie.length,
      compagnies: cibles.length,
      effet_unique: [...new Set(brachyCompagnie.map((r) => `${r.effect.action} ${(r.effect.placement ?? []).join("+")}`))],
      liste: brachyCompagnie.map((r) => r.id),
    },
    "3_interdictions_representees_comme_auditees_dans_le_referentiel": {
      total: confirmees.length,
      avertissement_de_lecture:
        "« 0 » ne veut PAS dire qu'aucune compagnie ne publie réellement d'interdiction " +
        "brachycéphale. Beaucoup en publient probablement. Cela veut dire que NOUS ne l'avons pas " +
        "prouvé : le référentiel ne contient, à ce jour, aucune interdiction adossée à une preuve " +
        "auditée. C'est un état de notre documentation, pas un fait sur le monde.",
      critere:
        "la politique du canal porte une preuve auditée (non auto-citée, non dérivée de la fiche, " +
        "non « non revérifiée ») QUI DIT `brachy_allowed = false`. Pas « la compagnie a une source " +
        "quelque part » : la source doit énoncer le fait que la règle affirme.",
      liste: confirmees,
      lecture: confirmees.length === 0
        ? "AUCUNE des 41 interdictions compagnie n'est REPRÉSENTÉE dans le référentiel comme " +
          "adossée à une source auditée. Sous le premier principe directeur, aucune ne subsiste " +
          "EN L'ÉTAT — ce qui appelle une revérification, pas un retrait automatique."
        : `${confirmees.length} interdiction(s) sont représentées comme auditées.`,
    },
    "4_auto_sourcees_ou_non_verifiables": {
      total: nonVerifiables.length,
      liste: nonVerifiables,
    },
  },
  source_iata: {
    url_enregistree_dans_la_regle: globale.source.url,
    etat_rapporte: "404 — page disparue",
    url_officielle_vivante_rapportee: "https://www.iata.org/en/programs/cargo/live-animals/pets/",
    citation_rapportee:
      "le transport des chiens brachycéphales en saison chaude est « not recommended » — " +
      "PAS interdit — et une caisse 10 % plus grande est demandée",
    provenance_de_ce_releve:
      "RAPPORTÉ PAR LA CONTRE-REVUE le 16/08/2026, et NON VÉRIFIÉ PAR MOI : l'accès réseau à " +
      "iata.org est bloqué par le proxy d'egress de cet environnement (curl comme WebFetch). " +
      "Dans un dossier dont l'objet est la provenance, présenter la lecture d'un autre comme la " +
      "mienne serait le défaut même que ce chantier corrige. À confirmer avant toute décision.",
    ecart_avec_notre_moteur:
      "Si ce relevé se confirme, l'écart est double et il est de nature, pas de degré : " +
      "(1) l'IATA RECOMMANDE de ne pas transporter en saison chaude, notre règle INTERDIT en " +
      "toute saison ; (2) l'IATA vise la saison chaude, notre règle ne porte aucune condition de " +
      "période ni de température. Nous avons donc transformé une recommandation conditionnelle en " +
      "interdiction universelle et permanente.",
    ce_que_cela_n_autorise_pas:
      "Cela n'autorise PAS à inventer une période ni un seuil de température. Le référentiel ne " +
      "modélise aucun seuil brachycéphale sourcé ; en fabriquer un à partir de « saison chaude » " +
      "reviendrait à remplacer une affirmation non sourcée par une autre. La caisse « 10 % plus " +
      "grande » est de même une exigence de MATÉRIEL, pas un critère d'acceptation : elle ne peut " +
      "pas servir à justifier un refus.",
  },
  limite_du_moteur: limiteMoteur,
  diff_previsionnel_par_option: mesures,
  comparaison_des_variantes_a_D: comparerADeD(),
  ce_que_ce_dossier_ne_fait_pas: [
    "il n'applique aucune option et ne modifie aucun fichier de packages/",
    "il ne propose AUCUNE option saisonnière ou par température : le référentiel ne contient " +
      "aucun seuil brachycéphale sourcé, et en fabriquer un serait le défaut que ce chantier corrige",
    "il ne rouvre pas les 47 candidates de T0-B3, qui restent hors décision",
    "il ne juge pas la véracité médicale du risque brachycéphale : il mesure ce que le site AFFIRME, " +
      "et avec quelle preuve",
  ],
};

ecrireJson(`${DOSSIER}/arbitrage-p0-brachy.json`, doc);
console.log(`dossier écrit : ${DOSSIER}/arbitrage-p0-brachy.json`);
console.log(`  famille 1 : la règle globale IATA`);
console.log(`  famille 2 : ${brachyCompagnie.length} règles compagnie sur ${cibles.length} compagnies`);
console.log(`  famille 3 : ${confirmees.length} représentée(s) comme auditée(s) dans le référentiel`);
console.log(`  famille 4 : ${nonVerifiables.length} auto-sourcée(s) ou non vérifiable(s)`);
console.log("");
for (const m of mesures) {
  console.log(`  ${m.option} · ${m.intitule}`);
  const g = m.grille_publique;
  console.log(`      publique : ${g.scenarios_dont_le_verdict_change} verdict(s) · ` +
    `${g.cartes_compagnie_modifiees} carte(s) · ${g.placements_modifies} placement(s) · ` +
    `score ${g.ecart_score[0]}…${g.ecart_score[1]}`);
  const b = m.grille_brachycephale, t = m.grille_temoin_non_brachycephale;
  console.log(`      brachy   : ${b.compagnies_touchees}/${grilleBrachy.length} compagnies, ` +
    `${b.placements_modifies} placements (${b.compagnies_sans_regle_propre} sans règle propre)` +
    `  ·  témoin golden : ${t.compagnies_touchees} compagnies, ${t.placements_modifies} placements`);
}
console.log(`\n  référentiel intact : ${intact ? "OUI" : "NON — DOSSIER INVALIDE"}`);
if (!intact) process.exit(1);
