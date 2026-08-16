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

/* ---- 3 · Les options ------------------------------------------------------------------------- */
const IDS_41 = brachyCompagnie.map((r) => r.id);
const IDS_42 = [...IDS_41, GLOBALE];
const sansRegles = (ids) => ({ ...rawKB, rules: rawKB.rules.filter((r) => !ids.includes(r.id)) });

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
  { cle: "G", intitule: "retirer les 42 ET basculer la politique du canal en « non documentée »",
    kb: kbOptionG,
    description: "seul chemin DONNÉES vers « à confirmer » — mais il agit sur le CANAL, pas sur la race." },
];

const refPublique = Object.fromEntries(publique.map((s) => [s.cle, compact(runFinder(kbRef, s.req))]));
const refBrachy = Object.fromEntries(grilleBrachy.map((s) => [s.cle, triplet(runFinder(kbRef, s.req), s.airline_id)]));
const refTemoin = Object.fromEntries(grilleTemoin.map((s) => [s.cle, triplet(runFinder(kbRef, s.req), s.airline_id)]));

function mesurer(opt) {
  const kb = normalize(opt.kb());
  let verdictsChanges = 0, statutsChanges = 0, scoreSeul = 0;
  let scoreMin = 0, scoreMax = 0;
  for (const s of publique) {
    const ap = compact(runFinder(kb, s.req)), av = refPublique[s.cle];
    if (JSON.stringify(ap) === JSON.stringify(av)) continue;
    if (ap.verdict !== av.verdict) verdictsChanges++;
    else if (JSON.stringify(ap.airlines) !== JSON.stringify(av.airlines)) statutsChanges++;
    else scoreSeul++;
    const d = ap.score - av.score;
    scoreMin = Math.min(scoreMin, d); scoreMax = Math.max(scoreMax, d);
  }
  const avecRegleP = new Set(cibles);
  const bascules = (grille, ref) => {
    const par = {};
    const exemples = [];
    let avecRegle = 0, sansRegle = 0;
    for (const s of grille) {
      const ap = triplet(runFinder(kb, s.req), s.airline_id), av = ref[s.cle];
      if (ap === av) continue;
      const k = `${av} → ${ap}`;
      par[k] = (par[k] ?? 0) + 1;
      /* La ventilation qui compte : une compagnie qui a sa propre règle n'est pas dans la même
         situation qu'une compagnie qui ne tenait que par la règle globale. */
      avecRegleP.has(s.airline_id) ? avecRegle++ : sansRegle++;
      if (exemples.length < 4) exemples.push(`${s.airline_id} ${k}`);
    }
    return { total: avecRegle + sansRegle, compagnies_avec_regle_propre: avecRegle,
      compagnies_sans_regle_propre: sansRegle, par_bascule: par, exemples };
  };
  const brachy = bascules(grilleBrachy, refBrachy);
  const temoin = bascules(grilleTemoin, refTemoin);
  return {
    option: opt.cle, intitule: opt.intitule, description: opt.description,
    grille_publique: { scenarios: publique.length, verdicts_changes: verdictsChanges,
      statuts_changes: statutsChanges, score_seul: scoreSeul, ecart_score: [scoreMin, scoreMax] },
    grille_brachycephale: brachy,
    grille_temoin_non_brachycephale: temoin,
    dommage_collateral: temoin.total > 0
      ? `${temoin.total} canal/canaux déplacés pour un chien NON brachycéphale — cette option n'agit pas sur la race`
      : "aucun : les chiens non brachycéphales ne sont pas touchés",
  };
}

const mesures = OPTIONS.map(mesurer);

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
    "3_officiellement_confirmees": {
      total: confirmees.length,
      critere:
        "la politique du canal porte une preuve auditée (non auto-citée, non dérivée de la fiche, " +
        "non « non revérifiée ») QUI DIT `brachy_allowed = false`. Pas « la compagnie a une source " +
        "quelque part » : la source doit énoncer le fait que la règle affirme.",
      liste: confirmees,
      lecture: confirmees.length === 0
        ? "AUCUNE des 41 interdictions compagnie n'est adossée à une source officielle énonçant " +
          "l'interdiction. Sous le premier principe directeur, aucune ne subsiste telle quelle."
        : `${confirmees.length} interdiction(s) survivraient au premier principe directeur.`,
    },
    "4_auto_sourcees_ou_non_verifiables": {
      total: nonVerifiables.length,
      liste: nonVerifiables,
    },
  },
  limite_du_moteur: limiteMoteur,
  diff_previsionnel_par_option: mesures,
  options_qui_se_confondent: {
    "E — ne garder que les interdictions officiellement confirmées":
      "identique à D : l'ensemble des interdictions confirmées est VIDE (0 sur 41).",
    "F — passer les 42 en action « warn » ou « require »":
      "identique à D : le moteur n'accorde d'effet sur un statut qu'à l'action « deny ».",
  },
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
console.log(`  famille 3 : ${confirmees.length} officiellement confirmée(s)`);
console.log(`  famille 4 : ${nonVerifiables.length} auto-sourcée(s) ou non vérifiable(s)`);
console.log("");
for (const m of mesures) {
  console.log(`  ${m.option} · ${m.intitule}`);
  console.log(`      publique : ${m.grille_publique.verdicts_changes} verdict(s), ` +
    `${m.grille_publique.statuts_changes} statut(s), ${m.grille_publique.score_seul} score seul, ` +
    `écart score ${m.grille_publique.ecart_score[0]}…${m.grille_publique.ecart_score[1]}`);
  console.log(`      brachy   : ${m.grille_brachycephale.total}/${grilleBrachy.length} canaux déplacés ` +
    `(${m.grille_brachycephale.compagnies_avec_regle_propre} avec règle propre, ` +
    `${m.grille_brachycephale.compagnies_sans_regle_propre} sans)  ·  témoin golden : ` +
    `${m.grille_temoin_non_brachycephale.total}/${grilleTemoin.length}`);
}
console.log(`\n  référentiel intact : ${intact ? "OUI" : "NON — DOSSIER INVALIDE"}`);
if (!intact) process.exit(1);
