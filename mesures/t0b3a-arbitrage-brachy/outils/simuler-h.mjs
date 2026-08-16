/**
 * T0-B3-a · SIMULATION de l'option H — v3. Sans écrire une ligne de moteur.
 *
 *   node --import tsx mesures/t0b3a-arbitrage-brachy/outils/simuler-h.mjs
 *   node --import tsx …/simuler-h.mjs --contre-epreuve=causes|table|ids42|bascules
 *
 * ─── CE QUI A CHANGÉ, ET POURQUOI ─────────────────────────────────────────────────────────────
 *
 * P0-A · LE SIMULATEUR N'ÉCHOUAIT SUR AUCUNE GARANTIE MÉTIER. Il ne sortait en erreur que si le
 *   référentiel avait bougé. Des causes perdues, une fixture fausse, une auto-citation détectée
 *   auraient été ÉCRITES DANS LE JSON puis le processus serait sorti en 0. Un contrôle dont
 *   l'échec ne coûte rien n'est pas un contrôle.
 *   → v3 : chaque garantie passe par `exiger()`. Une seule violation ⇒ code 1. Et `--contre-epreuve`
 *     casse volontairement un invariant pour prouver que la sortie 1 arrive vraiment.
 *
 * P0-B · H CONTOURNAIT LE CONTRAT DÉJÀ CONSTRUIT. `BreedRestriction`
 *   (`packages/knowledge/src/breed-restrictions.ts`) existe : action `allow|deny|warn|require`,
 *   cible de race, placements, conditions, et une `SourcedQuote` OBLIGATOIRE qui exige une citation,
 *   sa langue, un type de source factuel, et refuse les domaines MyDogCanFly. Son propre commentaire
 *   nomme `rule_global_brachy_hold` comme le défaut fondateur. Je ne l'avais pas cherché, et
 *   je proposais d'ajouter un état concurrent dans `PlacementPolicy` — deux modèles pour un fait.
 *   Pire : ma fixture « source auditée » n'avait ni citation ni langue, et `preuveAuditee` l'acceptait
 *   parce qu'elle vérifie autre chose (ni dérivée, ni auto-citée, ni non revue). Ce n'était donc pas
 *   une preuve brachycéphale au sens du contrat.
 *   → v3 : H consomme `BreedRestriction`, et rien d'autre.
 *
 * P0-C · LES FIXTURES TESTAIENT UNE SECONDE IMPLÉMENTATION. Elles appelaient `brancheFx`, un
 *   clone de la table. Une inversion dans la vraie table H les aurait laissées vertes.
 *   → v3 : UNE fonction, `decisionH`, paramétrée par le référentiel de restrictions. La simulation,
 *     les quatre fixtures et les contre-épreuves l'appellent toutes.
 *
 * P0-D · LA CONSERVATION DES CAUSES N'ÉTAIT PAS VÉRIFIÉE PAR SCÉNARIO. La clé du journal était
 *   `airline#placement|cause` : une cause perdue sur un trajet pouvait être masquée par la même
 *   cause présente sur un autre trajet de la même compagnie.
 *   → v3 : l'inclusion est vérifiée DANS la transformation, avec la clé complète du scénario.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { normalize } from "../../../packages/knowledge/src/normalize.ts";
import { rawKB } from "../../../packages/knowledge/src/data.ts";
import { evaluate } from "../../../packages/engine/src/evaluate.ts";
import { explain } from "../../../packages/engine/src/explain.ts";
import { runFinder } from "../../../packages/engine/src/pipeline.ts";
import { FinderRequest, makePlacementDecision, causeKey } from "../../../packages/engine/src/contracts.ts";
import { BreedRestriction } from "../../../packages/knowledge/src/breed-restrictions.ts";
import { chargerReferentiel, estAutoCitee, ecrireJson } from "./lib-arbitrage.mjs";

const DOSSIER = "mesures/t0b3a-arbitrage-brachy";
const GLOBALE = "rule_global_brachy_hold";
const CAUSE_H = "breed_policy_unreviewed";
const AUTO = /(^|\.)mydogcanfly\.com$/i;
const URL_IATA_MORTE = "https://www.iata.org/en/youandiata/travelers/pets/";
const CONTRE = (process.argv.find((a) => a.startsWith("--contre-epreuve=")) ?? "").split("=")[1] ?? null;

const { sceau, regles } = chargerReferentiel();
const sha256Fichier = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

/* ---- Le registre des exigences : une violation ⇒ sortie 1 -------------------------------------- */
const exigences = [];
const exiger = (nom, condition, detail = "") => {
  exigences.push({ exigence: nom, tenue: !!condition, detail: condition ? "" : String(detail).slice(0, 300) });
  return !!condition;
};

/* ---- Les 42 identités, VERROUILLÉES ------------------------------------------------------------ */
const brachyCompagnie = regles.filter((r) => r.category === "breed_ban" && estAutoCitee(r));
let IDS_42 = [...brachyCompagnie.map((r) => r.id), GLOBALE];
if (CONTRE === "ids42") IDS_42 = IDS_42.slice(0, 41); // contre-épreuve : une identité manque
exiger("les 42 identités sont exactement 42", IDS_42.length === 42, `${IDS_42.length}`);
exiger("les 42 identités sont uniques", new Set(IDS_42).size === IDS_42.length);
exiger("les 41 règles compagnie sont bien de catégorie breed_ban et auto-citées",
  brachyCompagnie.length === 41 && brachyCompagnie.every((r) => r.scope.type === "airline"),
  `${brachyCompagnie.length}`);
exiger("la règle globale IATA est présente et de portée globale",
  regles.find((r) => r.id === GLOBALE)?.scope.type === "global");

const kbA = normalize(rawKB);
const kbH = normalize({ ...rawKB, rules: rawKB.rules.filter((r) => !IDS_42.includes(r.id)) });

/* ---- LE RÉFÉRENTIEL DE RESTRICTIONS DE RACE ----------------------------------------------------
   Le contrat existe ; le référentiel n'en contient AUCUNE entrée à ce jour. C'est un fait, pas une
   commodité de simulation : sous H, les 102 compagnies tombent donc toutes sur « aucun fait audité
   applicable ». Chaque entrée est validée par le contrat lui-même — une fixture qui n'aurait ni
   citation ni langue serait REFUSÉE ici, ce qui est exactement ce que la v2 laissait passer. */
function chargerRestrictions(liste) {
  return liste.map((r, i) => {
    const p = BreedRestriction.safeParse(r);
    if (!p.success) throw new Error(`restriction #${i} refusée par le contrat : ${p.error.issues[0]?.message}`);
    return p.data;
  });
}
const RESTRICTIONS_REELLES = chargerRestrictions([]); // le référentiel est vide, et on le dit

/* ---- LA FONCTION H, UNIQUE ---------------------------------------------------------------------
   Paramétrée par le référentiel. Utilisée par la simulation, par les fixtures et par les
   contre-épreuves — il n'existe pas de seconde table à maintenir en parallèle. */
const cibleTouche = (applies_to, chien) =>
  "trait" in applies_to ? (applies_to.trait === "brachycephalic" && chien.brachycephalic)
    : applies_to.breed_ids.includes(chien.breed_id);

function decisionH({ restrictions, airline_id, placement, statutBase, chien }) {
  /* 0 · HORS PÉRIMÈTRE. H ne parle que des chiens dont la politique de race est en cause. Sans ce
     garde, un golden retriever tombait en « branche 4 » et recevait une confirmation de race :
     défaut relevé par la fixture « chien NON brachycéphale », qui n'existait que parce que la
     contre-revue a exigé que fixtures et simulation appellent LA MÊME fonction. La v2 gardait ce
     filtre dans `appliquerH` ; il devait être dans la table, sinon la table est fausse dès qu'on
     l'appelle autrement. */
  if (!chien.brachycephalic) return { branche: 9, statut: statutBase, motif: "hors périmètre de H", conseils: [] };
  /* 1 · Canal structurellement fermé : H n'ouvre rien. */
  if (statutBase === "denied") return { branche: 1, statut: "denied", motif: "canal structurellement fermé", conseils: [] };

  const applicables = restrictions.filter((r) =>
    (r.airline_id === undefined || r.airline_id === airline_id) &&
    r.placements.includes(placement) &&
    cibleTouche(r.applies_to, chien));

  /* Une restriction CONDITIONNELLE demande un évaluateur de prédicat que cette simulation n'a pas.
     On refuse de deviner : elle est signalée, jamais ignorée en silence. */
  const conditionnelles = applicables.filter((r) => r.when !== undefined);
  if (conditionnelles.length) {
    return { branche: 0, statut: statutBase, motif: "restriction conditionnelle non simulable",
      conseils: [], non_simulable: conditionnelles.map((r) => r.id) };
  }

  /* `warn` n'agit JAMAIS sur le statut : c'est le cas fondateur du contrat — la recommandation
     IATA déconseille sans interdire, et en faire un refus est ce qui a produit la règle globale. */
  const conseils = applicables.filter((r) => r.action === "warn").map((r) => ({ id: r.id, detail: r.detail }));

  /* Précédence : deny > require > allow. Un refus audité prime sur une autorisation auditée —
     en cas de sources contradictoires, on ne publie pas l'ouverture. */
  if (applicables.some((r) => r.action === "deny"))
    return { branche: 2, statut: "denied", motif: "refus audité (BreedRestriction deny)", conseils };
  if (applicables.some((r) => r.action === "require"))
    return { branche: 5, statut: "confirmation_required", motif: "exigence auditée à satisfaire (BreedRestriction require)", conseils };
  if (applicables.some((r) => r.action === "allow"))
    return { branche: 3, statut: statutBase, motif: "autorisation auditée (BreedRestriction allow)", conseils };

  /* 4 · Aucun fait audité applicable → notre incertitude, dite « à confirmer ». */
  if (CONTRE === "table") return { branche: 4, statut: "allowed", motif: "CONTRE-ÉPREUVE : table inversée", conseils };
  return { branche: 4, statut: "confirmation_required", motif: "aucun fait audité applicable", conseils };
}

const branches = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 9: 0 };
const conseilsIata = [];
const nonSimulables = new Set();

const fusionner = (existantes, ajout) => {
  const m = new Map();
  for (const c of [...(existantes ?? []), ...ajout]) m.set(causeKey(c), c);
  return [...m.values()].sort((a, b) => causeKey(a).localeCompare(causeKey(b)));
};

const journal = { causes_perdues: [], dominance_jouee: 0, dominance_violee: [] };

function appliquerH(decision, restrictions, cleScenario) {
  const chien = {
    breed_id: decision.request.dog.breed_id,
    brachycephalic: decision.request.dog.brachycephalic === true ||
      brachyParRace.get(decision.request.dog.breed_id) === true,
  };
  if (!chien.brachycephalic) return decision;
  const airlines = decision.airlines.map((a) => {
    const placements = a.placements.map((d) => {
      if (d.placement === "cabin") return d;
      const r = decisionH({ restrictions, airline_id: a.airline_id, placement: d.placement,
        statutBase: d.status, chien });
      branches[r.branche]++;
      for (const c of r.conseils) conseilsIata.push(`${a.airline_id}#${d.placement}|${c.id}`);
      for (const id of r.non_simulable ?? []) nonSimulables.add(id);

      const causesAvant = d.status === "confirmation_required" ? (d.confirmation_causes ?? []) : [];
      const ref = `${cleScenario}|${a.airline_id}#${d.placement}`;

      if (r.statut === "denied") {
        /* DOMINANCE : un refus dur éteint toutes les causes. On COMPTE les cas où elle joue. */
        if (causesAvant.length) journal.dominance_jouee++;
        return { placement: d.placement, status: "denied", allowed: false, ...(d.source ? { source: d.source } : {}) };
      }
      if (r.statut === "allowed") return d;

      const ajout = r.branche === 4 || r.branche === 5
        ? [{ code: CAUSE_H, policy_ref: `${a.airline_id}#${d.placement}` }] : [];
      let causesApres = fusionner(causesAvant, ajout);
      if (CONTRE === "causes") causesApres = ajout; // contre-épreuve : on écrase comme la v1

      /* P0-D · L'INCLUSION EST VÉRIFIÉE ICI, avec la clé complète du scénario — pas agrégée à la
         fin, où une perte sur un trajet pouvait être masquée par la même cause sur un autre. */
      const apres = new Set(causesApres.map(causeKey));
      for (const c of causesAvant) {
        if (!apres.has(causeKey(c))) journal.causes_perdues.push(`${ref}|${causeKey(c)}`);
      }
      return { placement: d.placement, status: "confirmation_required", allowed: false,
        confirmation_causes: causesApres, ...(d.source ? { source: d.source } : {}) };
    });
    return { ...a, placements };
  });
  return { ...decision, airlines };
}

const brachyParRace = new Map((rawKB.breeds ?? []).map((b) => [b.id, b.brachycephalic === true]));

/** `explain` ne doit JAMAIS échouer en silence : la v2 avalait l'erreur et renvoyait null. */
let rapportsRefuses = 0;
function rapportH(req, cle, restrictions = RESTRICTIONS_REELLES) {
  const dec = appliquerH(evaluate(kbH, req), restrictions, cle);
  try {
    return explain(dec, req.locale);
  } catch (e) {
    rapportsRefuses++;
    journal.derniere_erreur_explain = String(e).split("\n")[0].slice(0, 200);
    return null;
  }
}

/* ---- Grilles ------------------------------------------------------------------------------------ */
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
  grilleBrachy.push({ cle: `brachy|${id}`, airline_id: id,
    req: FinderRequest.parse({ ...base, dog: { breed_id: "breed_pug", weight_kg: 8, brachycephalic: true } }) });
  grilleTemoin.push({ cle: `temoin|${id}`, airline_id: id,
    req: FinderRequest.parse({ ...base, dog: { breed_id: "breed_golden_retriever", weight_kg: 8 } }) });
}
exiger("les 102 compagnies sont couvertes par la grille brachycéphale",
  grilleBrachy.length === rawKB.airlines.length && grilleBrachy.length === 102,
  `${grilleBrachy.length} / ${rawKB.airlines.length}`);

const PL = ["cabin_status", "hold_status", "cargo_status"];
const carte = (r, id) => (r?.airlines ?? []).find((x) => x.airline_id === id) ?? null;
const trip = (a) => (a ? PL.map((p) => a[p]).join("/") : "absente");
const compact = (r) => ({ verdict: r.verdict, score: r.score,
  airlines: (r.airlines ?? []).map((a) => `${a.airline_id}|${trip(a)}`) });

/* ---- Mesures ------------------------------------------------------------------------------------ */
let goldenTouches = 0, goldenPlacements = 0;
for (const s of grilleTemoin) {
  const av = carte(runFinder(kbA, s.req), s.airline_id);
  const ap = carte(rapportH(s.req, s.cle), s.airline_id);
  const n = PL.filter((p) => (av?.[p] ?? null) !== (ap?.[p] ?? null)).length;
  if (n) { goldenTouches++; goldenPlacements += n; }
}

const diffPublic = { scenarios: publique.length, verdicts: 0, cartes: 0, placements: 0,
  ecart_score: [0, 0], golden_affectes: 0 };
const causesFinales = {}, coexistence = {};
let climatObserves = 0, climatUsurpe = 0, autoCitations = 0;

for (const s of publique) {
  const rA = runFinder(kbA, s.req), rH = rapportH(s.req, s.cle);
  if (!rH) continue;
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
    for (const d of a.placement_decisions ?? []) {
      const codes = (d.confirmation_causes ?? []).map((c) => c.code);
      if (!codes.length) continue;
      for (const c of codes) causesFinales[c] = (causesFinales[c] ?? 0) + 1;
      if (codes.includes("estimated_climate")) climatObserves++;
      if (codes.length > 1) {
        const k = [...new Set(codes)].sort().join(" + ");
        coexistence[k] = (coexistence[k] ?? 0) + 1;
      }
    }
    if (a.heat_confirmation_required) {
      const race = (a.placement_decisions ?? []).some((d) => (d.confirmation_causes ?? []).some((c) => c.code === CAUSE_H));
      const climat = (a.placement_decisions ?? []).some((d) => (d.confirmation_causes ?? []).some((c) => c.code === "estimated_climate"));
      if (race && !climat) climatUsurpe++;
    }
  }
  const urls = [...(rH.sources ?? []).map((x) => x.url),
    ...(rH.airlines ?? []).flatMap((a) => (a.placement_decisions ?? []).map((d) => d.source?.url).filter(Boolean))];
  for (const u of urls) {
    let h = ""; try { h = new URL(u).hostname; } catch { /* ignore */ }
    if (AUTO.test(h) || u === URL_IATA_MORTE) autoCitations++;
  }
}

/* Grille brachycéphale — et G2 comparée à la DÉCISION DE RÉFÉRENCE, pas à la politique. */
const brachy = { compagnies: 0, placements: 0, par_statut_cible: {} };
let refusStructurelsLeves = 0, refusLeves = 0, refusLevesSansCause = 0;
for (const s of grilleBrachy) {
  const rA = runFinder(kbA, s.req), rH = rapportH(s.req, s.cle);
  if (!rH) continue;
  const av = carte(rA, s.airline_id), ap = carte(rH, s.airline_id);
  const bouges = PL.filter((p) => (av?.[p] ?? null) !== (ap?.[p] ?? null));
  if (bouges.length) {
    brachy.compagnies++; brachy.placements += bouges.length;
    for (const p of bouges) {
      const cible = ap?.[p] ?? "absente";
      brachy.par_statut_cible[cible] = (brachy.par_statut_cible[cible] ?? 0) + 1;
    }
  }
  /* G2 · L'INVARIANT JUSTE. « Tout placement refusé avant H reste refusé » serait incompatible
     avec H : les 147 placements SONT refusés au statu quo, et les faire passer « à confirmer » est
     exactement son objet. Ce qui doit être préservé, c'est le refus STRUCTUREL — celui que le
     moteur produit SANS les 42 règles. On compare donc à la base H, et non au statu quo.
     On vérifie en outre que chaque refus levé l'est bien parce que les 42 ont disparu, et pour
     aucune autre raison. */
  const base = carte(explain(evaluate(kbH, s.req), s.req.locale), s.airline_id);
  for (const p of PL) {
    if (base?.[p] === "denied" && ap?.[p] !== "denied") refusStructurelsLeves++;
    if (av?.[p] === "denied" && ap?.[p] !== "denied") {
      refusLeves++;
      if (base?.[p] === "denied") refusLevesSansCause++; // levé alors que la base le refuse encore
    }
  }
}
if (CONTRE === "bascules") brachy.par_statut_cible.allowed = 1; // contre-épreuve

/* ---- Les 42 hors du calcul, et la dette résiduelle comptée à part ------------------------------ */
let les42DansLeCalcul = 0, detteResiduelle = 0;
const reglesResiduelles = new Set();
for (const s of publique) {
  for (const a of evaluate(kbH, s.req).airlines) {
    for (const f of a.fired ?? []) {
      const hote = (() => { try { return new URL(f.source_url).hostname; } catch { return ""; } })();
      if (IDS_42.includes(f.rule_id)) les42DansLeCalcul++;
      else if (AUTO.test(hote)) { detteResiduelle++; reglesResiduelles.add(f.rule_id); }
    }
  }
}

/* Les compteurs de branches ci-dessous portent sur les GRILLES. Les fixtures appellent la même
   fonction et les feraient bouger : on fige donc l'instantané ici. */
const branchesGrilles = { ...branches };

/* ---- FIXTURES : la MÊME fonction H, sur un référentiel synthétique ------------------------------
   Chaque source est une `SourcedQuote` complète — citation, langue, type factuel, hors domaine
   MyDogCanFly — donc validée par le contrat. La v2 utilisait une source sans citation ni langue
   que `preuveAuditee` acceptait : ce n'était pas une preuve brachycéphale. */
const QUOTE = (url, quote) => ({
  url, source_type: "official_website", verified_date: "2026-08-01", review_due: "2026-10-30",
  confidence: 4, reviewer: "fixture", history: [], quote, quote_language: "en",
});
const CHIEN_BRACHY = { breed_id: "breed_pug", brachycephalic: true };
const CHIEN_NON_BRACHY = { breed_id: "breed_golden_retriever", brachycephalic: false };

const FIXTURES = [
  { nom: "branche 1 · canal structurellement fermé", restrictions: [], statutBase: "denied",
    chien: CHIEN_BRACHY, attendu: { statut: "denied", branche: 1 } },
  { nom: "branche 2 · deny audité", statutBase: "allowed", chien: CHIEN_BRACHY,
    restrictions: [{ id: "brest_fx_deny", airline_id: "airline_fx", applies_to: { trait: "brachycephalic" },
      action: "deny", placements: ["hold"], source: QUOTE("https://fx.example/pets", "Snub-nosed breeds are not accepted in the hold.") }],
    attendu: { statut: "denied", branche: 2 } },
  { nom: "branche 3 · allow audité", statutBase: "allowed", chien: CHIEN_BRACHY,
    restrictions: [{ id: "brest_fx_allow", airline_id: "airline_fx", applies_to: { trait: "brachycephalic" },
      action: "allow", placements: ["hold"], source: QUOTE("https://fx.example/pets", "Snub-nosed breeds are accepted in the hold.") }],
    attendu: { statut: "allowed", branche: 3 } },
  { nom: "branche 4 · aucun fait audité applicable", restrictions: [], statutBase: "allowed",
    chien: CHIEN_BRACHY, attendu: { statut: "confirmation_required", branche: 4 } },
  { nom: "branche 5 · require audité → confirmation", statutBase: "allowed", chien: CHIEN_BRACHY,
    restrictions: [{ id: "brest_fx_require", airline_id: "airline_fx", applies_to: { trait: "brachycephalic" },
      action: "require", placements: ["hold"], detail: { en: "Vet fitness certificate required." },
      source: QUOTE("https://fx.example/pets", "A veterinary fitness certificate is required for snub-nosed breeds.") }],
    attendu: { statut: "confirmation_required", branche: 5 } },
  { nom: "warn IATA · aucun effet sur le statut", statutBase: "allowed", chien: CHIEN_BRACHY,
    restrictions: [{ id: "brest_iata_warn", applies_to: { trait: "brachycephalic" }, action: "warn",
      placements: ["hold", "cargo"], detail: { en: "Not recommended in hot season." },
      source: QUOTE("https://www.iata.org/en/programs/cargo/live-animals/pets/",
        "Transport of snub nose dogs, such as boxers, pugs, bulldogs and Pekinese, in hot season is not recommended.") }],
    attendu: { statut: "confirmation_required", branche: 4 } },
  { nom: "deny audité ciblant une AUTRE race · ne touche pas le carlin", statutBase: "allowed", chien: CHIEN_BRACHY,
    restrictions: [{ id: "brest_fx_autre", airline_id: "airline_fx", applies_to: { breed_ids: ["breed_chow_chow"] },
      action: "deny", placements: ["hold"], source: QUOTE("https://fx.example/pets", "Chow chows are not accepted in the hold.") }],
    attendu: { statut: "confirmation_required", branche: 4 } },
  { nom: "chien NON brachycéphale · la table ne s'applique pas", statutBase: "allowed", chien: CHIEN_NON_BRACHY,
    restrictions: [{ id: "brest_fx_deny2", airline_id: "airline_fx", applies_to: { trait: "brachycephalic" },
      action: "deny", placements: ["hold"], source: QUOTE("https://fx.example/pets", "Snub-nosed breeds are not accepted in the hold.") }],
    attendu: { statut: "allowed", branche: 9 } },
];

const fixtures = FIXTURES.map((f) => {
  let restrictions;
  try { restrictions = chargerRestrictions(f.restrictions); }
  catch (e) { return { nom: f.nom, conforme: false, erreur: String(e).slice(0, 200) }; }
  const r = decisionH({ restrictions, airline_id: "airline_fx", placement: "hold",
    statutBase: f.statutBase, chien: f.chien });
  return { nom: f.nom, statut: r.statut, branche: r.branche, attendu: f.attendu,
    conseils: r.conseils.length,
    conforme: r.statut === f.attendu.statut && r.branche === f.attendu.branche };
});

/* FIXTURE DE DOMINANCE : une confirmation portant une cause, puis un refus audité — la cause doit
   s'éteindre. La v2 annonçait la dominance « vérifiée » avec un compteur à zéro : aucun cas ne
   l'exerçait. */
const fixtureDominance = (() => {
  const restrictions = chargerRestrictions([{ id: "brest_fx_dom", airline_id: "airline_fx",
    applies_to: { trait: "brachycephalic" }, action: "deny", placements: ["hold"],
    source: QUOTE("https://fx.example/pets", "Snub-nosed breeds are not accepted in the hold.") }]);
  const decision = {
    request: FinderRequest.parse({ origin: "airport_cdg", destination: "airport_jfk",
      dog: { breed_id: "breed_pug", weight_kg: 8, brachycephalic: true }, placement: "hold",
      date: `${_y}-01-15`, locale: "en" }),
    airlines: [{ airline_id: "airline_fx", placements: [
      { placement: "hold", status: "confirmation_required", allowed: false,
        confirmation_causes: [{ code: "legacy_unreviewed", policy_ref: "airline_fx#hold" }] },
    ] }],
  };
  const apres = appliquerH(decision, restrictions, "fixture|dominance");
  const d = apres.airlines[0].placements[0];
  return { statut: d.status, causes_restantes: (d.confirmation_causes ?? []).length,
    conforme: d.status === "denied" && !(d.confirmation_causes ?? []).length };
})();

/* ---- Sonde de contrat ---------------------------------------------------------------------------- */
const sondeContrat = (() => {
  try {
    makePlacementDecision("hold", "confirmation_required", [{ code: CAUSE_H, policy_ref: "airline_aegean#hold" }], undefined);
    return { cause_acceptee: true };
  } catch (e) { return { cause_acceptee: false, erreur: String(e).split("\n")[0].slice(0, 140) }; }
})();

/* ---- LES EXIGENCES BLOQUANTES ------------------------------------------------------------------- */
exiger("G1 · aucun chien non brachycéphale touché", goldenTouches === 0 && goldenPlacements === 0 && diffPublic.golden_affectes === 0,
  `${goldenTouches} compagnies, ${goldenPlacements} placements, ${diffPublic.golden_affectes} scénarios`);
exiger("G2 · aucun refus STRUCTUREL (base sans les 42) n'est levé par H", refusStructurelsLeves === 0, `${refusStructurelsLeves}`);
exiger("G2bis · tout refus levé l'est UNIQUEMENT par le retrait des 42", refusLevesSansCause === 0,
  `${refusLevesSansCause} levé(s) sans que le retrait des 42 l'explique`);
exiger("G3 · aucune confirmation de race ne devient message climatique", climatUsurpe === 0, `${climatUsurpe}`);
exiger("G3bis · des causes climatiques sont RÉELLEMENT observées", climatObserves > 0, `${climatObserves}`);
exiger("G4 · aucune auto-citation ni URL IATA morte présentée comme preuve", autoCitations === 0, `${autoCitations}`);
exiger("G5 · aucune cause préexistante perdue, scénario par scénario", journal.causes_perdues.length === 0,
  journal.causes_perdues.slice(0, 3).join(" | "));
exiger("G6 · la dominance est exercée par une fixture et respectée", fixtureDominance.conforme,
  JSON.stringify(fixtureDominance));
exiger("G7 · aucune des 42 n'entre dans le calcul", les42DansLeCalcul === 0, `${les42DansLeCalcul}`);
exiger("les fixtures de la table H sont toutes conformes", fixtures.every((f) => f.conforme),
  fixtures.filter((f) => !f.conforme).map((f) => f.nom).join(" | "));
exiger("aucun rapport refusé par explain", rapportsRefuses === 0,
  `${rapportsRefuses} — ${journal.derniere_erreur_explain ?? ""}`);
exiger("aucune restriction conditionnelle laissée non simulée", nonSimulables.size === 0, [...nonSimulables].join(","));
exiger("les 147 bascules vont EXCLUSIVEMENT vers confirmation_required",
  brachy.par_statut_cible.confirmation_required === brachy.placements &&
  Object.keys(brachy.par_statut_cible).length === 1,
  JSON.stringify(brachy.par_statut_cible));

const intact = sha256Fichier("packages/knowledge/raw/rules.json") === sceau.raw_rules_sha256 &&
  sha256Fichier("packages/knowledge/raw/objects.json") === sceau.raw_objects_sha256;
exiger("le référentiel est intact après simulation", intact);

const violations = exigences.filter((e) => !e.tenue);

const doc = {
  lot: "T0-B3-a — simulation de l'option H (v3)",
  nature: "SIMULATION — aucun code moteur écrit, aucun fichier de packages/ modifié",
  sceau, referentiel_intact: intact,
  contre_epreuve_active: CONTRE,
  modele: {
    contrat_consomme: "BreedRestriction (packages/knowledge/src/breed-restrictions.ts)",
    pourquoi: "le contrat canonique existe déjà : action allow|deny|warn|require, cible de race, " +
      "placements, conditions, et une SourcedQuote obligatoire — citation, langue, type factuel, " +
      "refus des domaines MyDogCanFly. La v2 proposait un état concurrent dans PlacementPolicy et " +
      "s'appuyait sur `preuveAuditee`, qui ne vérifie NI citation NI langue : ce n'était pas une " +
      "preuve brachycéphale au sens du contrat.",
    entrees_dans_le_referentiel: RESTRICTIONS_REELLES.length,
    consequence: "le référentiel n'en contient aucune : sous H, les 102 compagnies tombent toutes " +
      "sur « aucun fait audité applicable ». C'est un état de notre documentation, pas un choix " +
      "de simulation.",
    table: [
      "1 · canal structurellement fermé → denied",
      "2 · BreedRestriction `deny` applicable → denied",
      "5 · BreedRestriction `require` applicable → confirmation_required (l'exigence est à satisfaire)",
      "3 · BreedRestriction `allow` applicable → statut général inchangé",
      "4 · aucun fait audité applicable → confirmation_required (breed_policy_unreviewed)",
      "`warn` (IATA) → conseil séparé, AUCUN effet sur le statut ni sur le score",
      "précédence : deny > require > allow — en cas de sources contradictoires, on ne publie pas l'ouverture",
    ],
  },
  exigences, violations,
  branches_exercees_par_les_grilles: branchesGrilles,
  branches_toutes_appels_confondus: branches,
  fixtures, fixture_dominance: fixtureDominance,
  conseils_iata_emis: conseilsIata.length,
  causes_finales_par_code: causesFinales,
  coexistence_des_causes: coexistence,
  causes_climatiques_observees: climatObserves,
  dominance_jouee: journal.dominance_jouee,
  dette_auto_citee_residuelle_hors_perimetre: {
    occurrences: detteResiduelle, regles_distinctes: [...reglesResiduelles].sort(),
    lecture: "les AUTRES auto-citations de T0-B3 (poids, placement, importation) — hors périmètre " +
      "de H, résorption au lot suivant. Comptées à part pour ne pas lire la garantie 7 comme une " +
      "propreté générale qui n'est pas atteinte.",
  },
  sonde_de_contrat: sondeContrat,
  diff_contre_le_statu_quo: { grille_publique: diffPublic, grille_brachycephale: brachy },
};
ecrireJson(`${DOSSIER}/option-h-simulee.json`, doc);

console.log(`simulation v3 écrite : ${DOSSIER}/option-h-simulee.json`);
if (CONTRE) console.log(`  ⚠ CONTRE-ÉPREUVE ACTIVE : « ${CONTRE} »`);
console.log(`\n  EXIGENCES : ${exigences.length - violations.length}/${exigences.length} tenues`);
for (const v of violations) console.log(`    ✗ ${v.exigence}${v.detail ? ` — ${v.detail}` : ""}`);
console.log(`\n  branches (grilles) : ${JSON.stringify(branchesGrilles)} · conseils IATA émis : ${conseilsIata.length}`);
console.log(`  fixtures : ${fixtures.filter((f) => f.conforme).length}/${fixtures.length} conformes · dominance ${fixtureDominance.conforme ? "OK" : "ÉCART"}`);
console.log(`  causes climatiques observées : ${climatObserves} · coexistence : ${JSON.stringify(coexistence)}`);
console.log(`  publique : ${diffPublic.verdicts} verdict(s) · ${diffPublic.cartes} carte(s) · ${diffPublic.placements} placement(s) · score ${diffPublic.ecart_score[0]}…${diffPublic.ecart_score[1]}`);
console.log(`  brachy   : ${brachy.compagnies} compagnies, ${brachy.placements} placements → ${JSON.stringify(brachy.par_statut_cible)}`);
console.log(`  dette résiduelle hors H : ${detteResiduelle} occurrences, ${reglesResiduelles.size} règles`);

if (violations.length) {
  console.error(`\n[simuler-h] ÉCHEC — ${violations.length} exigence(s) non tenue(s)`);
  process.exit(1);
}
console.log("\n[simuler-h] toutes les exigences sont tenues.");
