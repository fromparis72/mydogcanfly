/**
 * T0-B3-a · SIMULATION de l'option H — v5 — après le patch des contrats moteur.
 *
 *   node --import tsx mesures/t0b3a-arbitrage-brachy/outils/simuler-h.mjs
 *   node --import tsx …/simuler-h.mjs --contre-epreuve=causes|table|ids42|bascules|validateur|multi
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
import { BreedRestriction, validateBreedRestrictions, SourcedQuote } from "../../../packages/knowledge/src/breed-restrictions.ts";
import { z } from "zod";
import { chargerReferentiel, estAutoCitee, ecrireJson } from "./lib-arbitrage.mjs";

const DOSSIER = "mesures/t0b3a-arbitrage-brachy";
const GLOBALE = "rule_global_brachy_hold";
const CAUSE_NON_REVUE = "breed_policy_unreviewed";
const CAUSE_EXIGENCE = "breed_requirement";
const CAUSE_H = "breed_policy_unreviewed"; // conservé pour les contrôles historiques

/**
 * LA CLÉ DE CAUSE DE H — et pourquoi celle du moteur ne suffit pas.
 *
 * `causeKey()` (contracts.ts) ne connaît pas `breed_requirement` : elle retombe sur
 * `${code}|${policy_ref}`. Deux exigences distinctes sur le MÊME canal — certificat vétérinaire et
 * caisse particulière, que le contrat `BreedRestriction` autorise parfaitement — seraient donc
 * dédupliquées en une seule, et le visiteur n'en verrait qu'une. La simulation utilise donc une clé
 * qui intègre `restriction_ref`, et MESURE l'écart avec la clé du moteur : c'est le travail de
 * contrat à faire, chiffré plutôt qu'annoncé.
 */
const cleCauseH = (c) => c.restriction_ref ? `${c.code}|${c.policy_ref}|${c.restriction_ref}` : causeKey(c);
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
const KNOWN_IDS = {
  airlineIds: new Set(rawKB.airlines.map((a) => a.id)),
  breedIds: new Set((rawKB.breeds ?? []).map((b) => b.id)),
  countryIds: new Set(rawKB.countries.map((c) => c.id)),
  airportIds: new Set(rawKB.airports.map((a) => a.id)),
};

/**
 * CHARGEMENT = schéma PUIS validation d'ENSEMBLE.
 *
 * La v3 n'appelait que `BreedRestriction.safeParse()`, entrée par entrée, et « résolvait » ensuite
 * les conflits par une priorité inventée (`deny > require > allow`). C'était contourner la moitié
 * du contrat : `validateBreedRestrictions()` refuse `allow` + `deny` (CONTRADICTION), rend
 * `deny` + `require` inatteignable (UNREACHABLE), signale les conditions non disjointes et les
 * identifiants inconnus — y compris entre une règle GLOBALE et une règle compagnie.
 *
 * Une contradiction ne se RÉSOUT pas : elle se refuse. La priorité est donc supprimée.
 */
function chargerRestrictions(liste) {
  const parsees = liste.map((r, i) => {
    const p = BreedRestriction.safeParse(r);
    if (!p.success) throw new Error(`restriction #${i} refusée par le schéma : ${p.error.issues[0]?.message}`);
    return p.data;
  });
  const anomalies = validateBreedRestrictions(parsees, KNOWN_IDS);
  if (anomalies.length) {
    throw new Error(`ensemble refusé par validateBreedRestrictions : ` +
      anomalies.map((a) => `${a.code} — ${a.message}`).join(" | "));
  }
  return parsees;
}

/** L'avertissement IATA, sous sa FORME CIBLE : une `BreedRestriction` `warn`, avec l'URL vivante et
 *  la phrase officielle complète. `warn` compose avec toute autre action — c'est le contrat qui le
 *  dit — et n'agit ni sur le statut, ni sur le score, ni sur les sources probantes.
 *  La v3 le laissait dans une fixture : le parcours public n'en émettait aucun, et « avertissement
 *  conservé à part » n'était donc pas prouvé fonctionnellement. */
const IATA_WARN = {
  id: "brest_iata_snub_nose_hot_season",
  applies_to: { trait: "brachycephalic" },
  action: "warn",
  /* LES TROIS PLACEMENTS. La page IATA formule son conseil pour le transport des chiens au museau
     écrasé sans le limiter à la soute et au fret — elle traite aussi de la cabine. Restreindre
     l'avis à `hold`+`cargo` aurait reconduit le cadrage de l'ANCIENNE règle, pas ce que la source
     dit. Relevé en contre-revue le 16/08/2026. */
  placements: ["cabin", "hold", "cargo"],
  detail: {
    en: "IATA advises against transporting snub-nosed dogs in hot season.",
    fr: "L'IATA déconseille le transport des chiens au museau écrasé en saison chaude.",
    es: "La IATA desaconseja transportar perros de hocico chato en temporada calurosa.",
    pt: "A IATA desaconselha o transporte de cães de focinho achatado em época quente.",
  },
  source: {
    url: "https://www.iata.org/en/programs/cargo/live-animals/pets/",
    /* `official_website` et non `regulation` : c'est une page de CONSEILS aux voyageurs, pas le
       texte des Live Animals Regulations. La classer en règlement lui prêterait une force
       normative qu'elle n'a pas. */
    source_type: "official_website", verified_date: "2026-08-16", review_due: "2027-02-12",
    confidence: 4, reviewer: "contre-revue Codex", history: [],
    quote: "Transport of snub nose dogs, such as boxers, pugs, bulldogs and Pekinese, in hot season is not recommended.",
    quote_language: "en",
  },
};

/* Le référentiel RÉEL ne contient aucune BreedRestriction. La cible de H en contient une seule :
   l'avertissement IATA. C'est la différence entre l'état d'aujourd'hui et l'état proposé, et elle
   doit être lisible plutôt que fondue dans un tableau vide. */
const RESTRICTIONS_AUJOURD_HUI = chargerRestrictions([]);
const RESTRICTIONS_REELLES = chargerRestrictions(CONTRE === "validateur"
  ? [IATA_WARN,
     { id: "brest_ct_allow", airline_id: "airline_aegean", applies_to: { trait: "brachycephalic" },
       action: "allow", placements: ["hold"], source: { ...IATA_WARN.source, url: "https://aegean.example/pets",
         source_type: "official_website", quote: "Snub-nosed breeds are accepted in the hold." } },
     { id: "brest_ct_deny", airline_id: "airline_aegean", applies_to: { trait: "brachycephalic" },
       action: "deny", placements: ["hold"], source: { ...IATA_WARN.source, url: "https://aegean.example/pets2",
         source_type: "official_website", quote: "Snub-nosed breeds are not accepted in the hold." } }]
  : [IATA_WARN]);

/* ---- LA FONCTION H, UNIQUE ---------------------------------------------------------------------
   Paramétrée par le référentiel. Utilisée par la simulation, par les fixtures et par les
   contre-épreuves — il n'existe pas de seconde table à maintenir en parallèle. */
const cibleTouche = (applies_to, chien) =>
  "trait" in applies_to ? (applies_to.trait === "brachycephalic" && chien.brachycephalic)
    : applies_to.breed_ids.includes(chien.breed_id);

/** Les avis applicables, INDÉPENDAMMENT de la table de statut. La cabine n'est jamais touchée par
 *  H — les 42 règles ne l'ont jamais visée — mais l'avis IATA, lui, porte aussi sur elle : le
 *  raccourci « on saute la cabine » supprimait donc l'avis en cabine avec le statut. Deux
 *  questions distinctes, deux chemins. */
function avisApplicables({ restrictions, airline_id, placement, chien }) {
  if (!chien.brachycephalic) return [];
  return restrictions.filter((r) =>
    r.action === "warn" &&
    (r.airline_id === undefined || r.airline_id === airline_id) &&
    r.placements.includes(placement) &&
    r.when === undefined &&
    cibleTouche(r.applies_to, chien))
    .map((r) => ({ id: r.id, detail: r.detail, source: r.source, placements: r.placements,
      airline_id: r.airline_id }));
}

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
      conseils: [], decisives: [], non_simulable: conditionnelles.map((r) => r.id) };
  }

  /* `warn` n'agit JAMAIS sur le statut : c'est le cas fondateur du contrat — la recommandation
     IATA déconseille sans interdire, et en faire un refus est ce qui a produit la règle globale.
     Le contrat prévoit explicitement que `warn` COMPOSE avec toute autre action. */
  const conseils = applicables.filter((r) => r.action === "warn")
    .map((r) => ({ id: r.id, detail: r.detail, source: r.source, placements: r.placements,
      airline_id: r.airline_id }));

  /* PAS DE PRIORITÉ INVENTÉE. `allow` + `deny` est une CONTRADICTION et `deny` + `require` une
     situation INATTEIGNABLE : `validateBreedRestrictions()` les refuse au chargement, si bien
     qu'aucune résolution n'a à exister ici. La v3 les tranchait silencieusement en `deny` — elle
     réparait à l'exécution ce que le contrat interdit à la construction.
     Reste `allow` + `require`, que le validateur AUTORISE : l'exigence l'emporte, puisqu'elle
     décrit ce qu'il faut faire pour que l'autorisation vaille. */
  /* TOUTES les restrictions applicables, pas la première trouvée. Le contrat autorise plusieurs
     `require` sur un même canal — certificat vétérinaire ET caisse particulière — et `find()` en
     perdait silencieusement toutes sauf une. Tri par identité pour un ordre total et stable. */
  const parAction = (a) => applicables.filter((r) => r.action === a).sort((x, y) => x.id.localeCompare(y.id));
  const denys = parAction("deny"), requires = parAction("require"), allows = parAction("allow");
  if (denys.length)
    return { branche: 2, statut: "denied", motif: "refus audité", conseils,
      decisives: denys, decisive: denys[0] };
  if (requires.length)
    return { branche: 5, statut: "confirmation_required", motif: "exigence(s) auditée(s) à satisfaire",
      conseils, decisives: requires, decisive: requires[0] };
  if (allows.length)
    return { branche: 3, statut: statutBase, motif: "autorisation auditée", conseils,
      decisives: allows, decisive: allows[0] };

  /* 4 · Aucun fait audité applicable → notre incertitude, dite « à confirmer ». */
  if (CONTRE === "table") return { branche: 4, statut: "allowed", motif: "CONTRE-ÉPREUVE : table inversée", conseils, decisives: [] };
  return { branche: 4, statut: "confirmation_required", motif: "aucun fait audité applicable", conseils, decisives: [] };
}

const branches = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 9: 0 };

/** La preuve DESCEND avec la décision : quand une restriction tranche, c'est SA source qui
 *  justifie le canal, pas la provenance générale préexistante. La v3 conservait `d.source` même
 *  sur une branche décidée par une restriction — la carte aurait montré la mauvaise page. */
const sourceDeDecision = (r) => ({
  url: r.source.url, source_type: r.source.source_type,
  verified_date: r.source.verified_date, confidence: r.source.confidence,
});
const conseilsIata = [];
const nonSimulables = new Set();

const fusionner = (existantes, ajout) => {
  const m = new Map();
  for (const c of [...(existantes ?? []), ...ajout]) m.set(cleCauseH(c), c);
  return [...m.values()].sort((a, b) => cleCauseH(a).localeCompare(cleCauseH(b)));
};

const journal = { causes_perdues: [], dominance_jouee: 0, dominance_violee: [] };
let preuvesAttendues = 0, preuvesTransportees = 0;
const avisInvalides = [];

/**
 * LE CONTRAT PUBLIC D'UN AVIS DE SÉCURITÉ.
 *
 * La v4 attachait librement `rapport.avis_securite = [...]` : un champ qu'aucun contrat ne
 * vérifiait, que l'interface pouvait ignorer sans que rien n'échoue. Un avis qui n'est pas un
 * contrat n'est pas un avis, c'est une intention.
 *
 * `.strict()` : un champ inconnu est refusé, comme partout ailleurs dans ce dépôt. Et la source
 * porte OBLIGATOIREMENT sa citation et sa langue — un avis sans la phrase qui le fonde retomberait
 * dans le défaut que tout ce chantier corrige.
 */
const SafetyAdvisory = z.strictObject({
  restriction_ref: z.string().regex(/^brest_[a-z0-9_]+$/),
  /** « global » ou une compagnie : la portée de l'avis, jamais devinée. */
  scope: z.union([z.literal("global"), z.string().regex(/^airline_[a-z0-9_]+$/)]),
  placements: z.array(z.enum(["cabin", "hold", "cargo"])).min(1),
  /** DÉJÀ LOCALISÉ, comme `ReportItem.text`. La v4-bis publiait l'objet multilingue entier et
     « vérifiait » le rendu en relisant `detail[locale]` dans ce même objet : le test ne prouvait
     pas qu'un texte localisé était produit, il relisait son entrée. */
  text: z.string().min(1),
  criticality: z.enum(["critical", "high", "medium", "low"]),
  /** LE CONTRAT CANONIQUE, pas une provenance appauvrie. La v4-bis redéfinissait localement
     `url + quote + quote_language` : elle contournait `SourcedQuote`, qui garantit AUSSI le type de
     source factuel, les dates, l'échéance de revue, la confiance, le relecteur, l'historique et le
     refus des auto-citations. Recréer une preuve plus pauvre à côté d'un contrat existant est
     exactement le défaut relevé en P0-B sur `BreedRestriction`. */
  source: SourcedQuote,
}).strict();

const cleAvis = (a) => `${a.restriction_ref}|${a.scope}`;

/** Les avis de sécurité du scénario en cours. Ils sortent de la décision et sont RATTACHÉS au
 *  rapport, sans jamais toucher au statut, au score, à `fired` ni aux sources probantes : c'est le
 *  chemin que l'implémentation devra suivre — `BreedRestriction warn` → avis structuré → rapport
 *  public → rendu localisé. */
let avisParCle = new Map();
let langueDuScenario = "en";
/** Les preuves de race, par (compagnie, canal) : une PAR restriction décisive. Le contrat actuel
 *  n'en transporte qu'une — on le mesure au lieu de choisir en silence. */
let preuvesDeRace = new Map();
function appliquerH(decision, restrictions, cleScenario) {
  avisParCle = new Map();
  preuvesDeRace = new Map();
  langueDuScenario = decision.request.locale ?? "en";
  const chien = {
    breed_id: decision.request.dog.breed_id,
    brachycephalic: decision.request.dog.brachycephalic === true ||
      brachyParRace.get(decision.request.dog.breed_id) === true,
  };
  if (!chien.brachycephalic) return decision;
  const airlines = decision.airlines.map((a) => {
    const placements = a.placements.map((d) => {
      /* L'avis se collecte sur les TROIS canaux ; le statut, lui, ne bouge jamais en cabine. */
      for (const c of avisApplicables({ restrictions, airline_id: a.airline_id, placement: d.placement, chien })) {
        const scope = c.airline_id ?? "global";
        const cle = `${c.id}|${scope}`;
        const deja = avisParCle.get(cle);
        if (deja) { if (!deja.placements.includes(d.placement)) deja.placements.push(d.placement); }
        else {
          avisParCle.set(cle, { restriction_ref: c.id, scope, placements: [d.placement],
            /* Le texte est choisi ICI, dans la langue de la requête — pas laissé à l'appelant. */
            text: c.detail?.[langueDuScenario] ?? c.detail?.en ?? "",
            criticality: "medium", source: c.source });
        }
      }
      if (d.placement === "cabin") return d;
      const r = decisionH({ restrictions, airline_id: a.airline_id, placement: d.placement,
        statutBase: d.status, chien });
      branches[r.branche]++;
      for (const c of r.conseils) conseilsIata.push(`${a.airline_id}#${d.placement}|${c.id}`);
      for (const id of r.non_simulable ?? []) nonSimulables.add(id);

      const causesAvant = d.status === "confirmation_required" ? (d.confirmation_causes ?? []) : [];
      const ref = `${cleScenario}|${a.airline_id}#${d.placement}`;

      /* UNE PREUVE PAR RESTRICTION DÉCISIVE. `PlacementDecision.source` n'en porte qu'une : on
         enregistre donc la liste complète à côté, et on COMPTE ce que le contrat actuel perd.
         La v4-bis avait un compteur `preuvesSurnumeraires` mécaniquement nul — les branches `deny`
         et `allow` sortaient avant lui, `require` en était exclue, et il n'était même pas publié. */
      const preuvesRestriction = (r.decisives ?? []).map((x) => ({
        restriction_ref: x.id, source: sourceDeDecision(x), quote: x.source.quote,
        quote_language: x.source.quote_language }));
      if (preuvesRestriction.length) {
        preuvesDeRace.set(`${a.airline_id}#${d.placement}`, preuvesRestriction);
        preuvesAttendues += preuvesRestriction.length;
        preuvesTransportees += 1; // le contrat n'en porte qu'une
      }
      const preuve = preuvesRestriction.length ? preuvesRestriction[0].source : (d.source ?? null);

      if (r.statut === "denied") {
        /* DOMINANCE : un refus dur éteint toutes les causes. On COMPTE les cas où elle joue. */
        if (causesAvant.length) journal.dominance_jouee++;
        return { placement: d.placement, status: "denied", allowed: false, ...(preuve ? { source: preuve } : {}) };
      }
      if (r.statut === "allowed") {
        return r.decisive ? { ...d, source: preuve } : d;
      }

      /* DEUX CAUSES DISTINCTES, et c'est le fond du sujet. La v3 émettait
         `breed_policy_unreviewed` pour la branche 4 ET pour la branche 5 : c'était faux — une
         exigence officielle auditée n'est PAS une politique non revérifiée. L'une dit « nous ne
         savons pas », l'autre dit « la compagnie exige ceci ». Les confondre, c'est reproduire
         exactement la perte d'interprétation que T0-B a réparée. */
      const ajout = r.branche === 5
        ? r.decisives.map((x) => ({ code: CAUSE_EXIGENCE,
            policy_ref: `${a.airline_id}#${d.placement}`, restriction_ref: x.id }))
        : r.branche === 4
          ? [{ code: CAUSE_NON_REVUE, policy_ref: `${a.airline_id}#${d.placement}` }]
          : [];

      let causesApres = fusionner(causesAvant, ajout);
      if (CONTRE === "causes") causesApres = ajout; // contre-épreuve : on écrase comme la v1

      /* P0-D · L'INCLUSION EST VÉRIFIÉE ICI, avec la clé complète du scénario — pas agrégée à la
         fin, où une perte sur un trajet pouvait être masquée par la même cause sur un autre. */
      const apres = new Set(causesApres.map(causeKey));
      for (const c of causesAvant) {
        if (!apres.has(causeKey(c))) journal.causes_perdues.push(`${ref}|${causeKey(c)}`);
      }
      /* `breed_policy_unreviewed` ne porte AUCUNE source : c'est une absence de fait, pas un fait.
         Lui en attacher une présenterait la provenance du canal comme la preuve d'une politique
         de race qu'elle ne documente pas. */
      const src = r.branche === 4 ? (d.source ?? null) : preuve;
      return { placement: d.placement, status: "confirmation_required", allowed: false,
        confirmation_causes: causesApres, ...(src ? { source: src } : {}) };
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
    const rapport = explain(dec, req.locale);
    /* L'avis voyage À CÔTÉ du rapport, jamais dedans comme preuve — et il est VALIDÉ par son
       contrat avant d'y être attaché, sans quoi « contrat public » ne serait qu'un mot. */
    rapport.safety_advisories = [...avisParCle.values()]
      .map((a) => ({ ...a, placements: [...a.placements].sort() }))
      .sort((x, y) => cleAvis(x).localeCompare(cleAvis(y)))
      .map((a) => {
        const v = SafetyAdvisory.safeParse(a);
        if (!v.success) { avisInvalides.push(`${cleAvis(a)} — ${v.error.issues[0]?.message}`); return a; }
        return v.data;
      });
    rapport.preuves_de_race = Object.fromEntries(preuvesDeRace);
    return rapport;
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
    restrictions: [{ id: "brest_fx_deny", airline_id: "airline_aegean", applies_to: { trait: "brachycephalic" },
      action: "deny", placements: ["hold"], source: QUOTE("https://fx.example/pets", "Snub-nosed breeds are not accepted in the hold.") }],
    attendu: { statut: "denied", branche: 2, cause: null, restriction_ref: "brest_fx_deny",
      source_url: "https://fx.example/pets", citation: "Snub-nosed breeds are not accepted in the hold." } },
  { nom: "branche 3 · allow audité", statutBase: "allowed", chien: CHIEN_BRACHY,
    restrictions: [{ id: "brest_fx_allow", airline_id: "airline_aegean", applies_to: { trait: "brachycephalic" },
      action: "allow", placements: ["hold"], source: QUOTE("https://fx.example/pets", "Snub-nosed breeds are accepted in the hold.") }],
    attendu: { statut: "allowed", branche: 3, cause: null, restriction_ref: "brest_fx_allow",
      source_url: "https://fx.example/pets", citation: "Snub-nosed breeds are accepted in the hold." } },
  { nom: "branche 4 · aucun fait audité applicable", restrictions: [], statutBase: "allowed",
    chien: CHIEN_BRACHY, attendu: { statut: "confirmation_required", branche: 4,
      cause: CAUSE_NON_REVUE, restriction_ref: null, source_url: null, citation: null } },
  { nom: "branche 5 · require audité → confirmation", statutBase: "allowed", chien: CHIEN_BRACHY,
    restrictions: [{ id: "brest_fx_require", airline_id: "airline_aegean", applies_to: { trait: "brachycephalic" },
      action: "require", placements: ["hold"], detail: { en: "Vet fitness certificate required." },
      source: QUOTE("https://fx.example/pets", "A veterinary fitness certificate is required for snub-nosed breeds.") }],
    attendu: { statut: "confirmation_required", branche: 5, cause: CAUSE_EXIGENCE,
      restriction_ref: "brest_fx_require", source_url: "https://fx.example/pets",
      citation: "A veterinary fitness certificate is required for snub-nosed breeds." } },
  { nom: "warn IATA · aucun effet sur le statut", statutBase: "allowed", chien: CHIEN_BRACHY,
    restrictions: [{ id: "brest_iata_warn", applies_to: { trait: "brachycephalic" }, action: "warn",
      placements: ["hold", "cargo"], detail: { en: "Not recommended in hot season." },
      source: QUOTE("https://www.iata.org/en/programs/cargo/live-animals/pets/",
        "Transport of snub nose dogs, such as boxers, pugs, bulldogs and Pekinese, in hot season is not recommended.") }],
    attendu: { statut: "confirmation_required", branche: 4 } },
  { nom: "deny audité ciblant une AUTRE race · ne touche pas le carlin", statutBase: "allowed", chien: CHIEN_BRACHY,
    restrictions: [{ id: "brest_fx_autre", airline_id: "airline_aegean", applies_to: { breed_ids: ["breed_chow_chow"] },
      action: "deny", placements: ["hold"], source: QUOTE("https://fx.example/pets", "Chow chows are not accepted in the hold.") }],
    attendu: { statut: "confirmation_required", branche: 4 } },
  { nom: "chien NON brachycéphale · la table ne s'applique pas", statutBase: "allowed", chien: CHIEN_NON_BRACHY,
    restrictions: [{ id: "brest_fx_deny2", airline_id: "airline_aegean", applies_to: { trait: "brachycephalic" },
      action: "deny", placements: ["hold"], source: QUOTE("https://fx.example/pets", "Snub-nosed breeds are not accepted in the hold.") }],
    attendu: { statut: "allowed", branche: 9 } },
];

const fixtures = FIXTURES.map((f) => {
  let restrictions;
  try { restrictions = chargerRestrictions(f.restrictions); }
  catch (e) { return { nom: f.nom, conforme: false, erreur: String(e).slice(0, 200) }; }
  const r = decisionH({ restrictions, airline_id: "airline_aegean", placement: "hold",
    statutBase: f.statutBase, chien: f.chien });
  /* On contrôle la CAUSE, la RÉFÉRENCE et la SOURCE, pas seulement le statut et le numéro de
     branche : la v3 aurait laissé passer une exigence auditée étiquetée « politique non
     revérifiée », c'est-à-dire une décision juste avec une explication fausse. */
  const cause = r.branche === 5 ? CAUSE_EXIGENCE : r.branche === 4 ? CAUSE_NON_REVUE : null;
  const refDecisive = r.decisive?.id ?? null;
  const srcDecisive = r.decisive ? sourceDeDecision(r.decisive).url : null;
  const citation = r.decisive?.source?.quote ?? null;
  const conformeCause = f.attendu.cause === undefined || cause === f.attendu.cause;
  const conformeRef = f.attendu.restriction_ref === undefined || refDecisive === f.attendu.restriction_ref;
  const conformeSrc = f.attendu.source_url === undefined || srcDecisive === f.attendu.source_url;
  const conformeCitation = f.attendu.citation === undefined || citation === f.attendu.citation;
  return { nom: f.nom, statut: r.statut, branche: r.branche, cause, restriction_ref: refDecisive,
    source_url: srcDecisive, citation, attendu: f.attendu, conseils: r.conseils.length,
    conforme: r.statut === f.attendu.statut && r.branche === f.attendu.branche &&
      conformeCause && conformeRef && conformeSrc && conformeCitation };
});

/* FIXTURE DE DOMINANCE : une confirmation portant une cause, puis un refus audité — la cause doit
   s'éteindre. La v2 annonçait la dominance « vérifiée » avec un compteur à zéro : aucun cas ne
   l'exerçait. */
const fixtureDominance = (() => {
  const restrictions = chargerRestrictions([{ id: "brest_fx_dom", airline_id: "airline_aegean",
    applies_to: { trait: "brachycephalic" }, action: "deny", placements: ["hold"],
    source: QUOTE("https://fx.example/pets", "Snub-nosed breeds are not accepted in the hold.") }]);
  const decision = {
    request: FinderRequest.parse({ origin: "airport_cdg", destination: "airport_jfk",
      dog: { breed_id: "breed_pug", weight_kg: 8, brachycephalic: true }, placement: "hold",
      date: `${_y}-01-15`, locale: "en" }),
    airlines: [{ airline_id: "airline_aegean", placements: [
      { placement: "hold", status: "confirmation_required", allowed: false,
        confirmation_causes: [{ code: "legacy_unreviewed", policy_ref: "airline_aegean#hold" }] },
    ] }],
  };
  const apres = appliquerH(decision, restrictions, "fixture|dominance");
  const d = apres.airlines[0].placements[0];
  return { statut: d.status, causes_restantes: (d.confirmation_causes ?? []).length,
    conforme: d.status === "denied" && !(d.confirmation_causes ?? []).length };
})();

/* ---- Sonde de contrat ---------------------------------------------------------------------------- */
const sondeContrat = (() => {
  /* Ces deux causes n'existaient pas : la sonde vérifiait qu'elles étaient REFUSÉES. Elle vérifie
     désormais qu'elles sont ACCEPTÉES — et que `causeKey` distingue bien deux exigences. */
  const essai = (causes, preuves) => {
    try { return { ok: true, d: makePlacementDecision("hold", "confirmation_required", causes, undefined, preuves) }; }
    catch (e) { return { ok: false, erreur: String(e).split("\n")[0].slice(0, 140) }; }
  };
  const EXIG = (ref) => ({ code: CAUSE_EXIGENCE, policy_ref: "airline_aegean#hold", restriction_ref: ref });
  /* Une preuve complète : le contrat exige la citation, sa langue et un type de source factuel. */
  const PREUVE = (ref, url) => ({ restriction_ref: ref, source: { ...IATA_WARN.source, url } });
  const nonRevue = essai([{ code: CAUSE_NON_REVUE, policy_ref: "airline_aegean#hold" }]);
  const deuxExigences = essai([EXIG("brest_a"), EXIG("brest_b")],
    [PREUVE("brest_a", "https://aegean.example/a"), PREUVE("brest_b", "https://aegean.example/b")]);
  const sansRef = essai([{ code: CAUSE_EXIGENCE, policy_ref: "airline_aegean#hold" }]);
  /* Étape 1-bis : les preuves sont devenues SOLIDAIRES de leurs causes. Ces trois essais mesurent
     la relation elle-même, celle qui manquait au contrat du 552c41c. */
  const exigenceSansPreuve = essai([EXIG("brest_a")]);
  const preuveSansExigence = essai([{ code: CAUSE_NON_REVUE, policy_ref: "airline_aegean#hold" }],
    [PREUVE("brest_a", "https://aegean.example/a")]);
  const preuveDupliquee = essai([EXIG("brest_a")],
    [PREUVE("brest_a", "https://aegean.example/a"), PREUVE("brest_a", "https://aegean.example/bis")]);
  return {
    breed_policy_unreviewed_acceptee: nonRevue.ok,
    deux_exigences_conservees: deuxExigences.ok &&
      (deuxExigences.d?.confirmation_causes?.length ?? 0) === 2,
    deux_preuves_conservees: (deuxExigences.d?.evidence?.length ?? 0) === 2 &&
      new Set((deuxExigences.d?.evidence ?? []).map((e) => e.restriction_ref)).size === 2,
    breed_requirement_sans_restriction_ref_refusee: !sansRef.ok,
    exigence_sans_preuve_refusee: !exigenceSansPreuve.ok,
    preuve_sans_exigence_refusee: !preuveSansExigence.ok,
    preuve_dupliquee_refusee: !preuveDupliquee.ok,
  };
})();
exiger("le contrat accepte `breed_policy_unreviewed`", sondeContrat.breed_policy_unreviewed_acceptee);
exiger("le contrat CONSERVE deux exigences distinctes sur le même canal",
  sondeContrat.deux_exigences_conservees, JSON.stringify(sondeContrat));
exiger("le contrat CONSERVE les DEUX preuves qui les fondent",
  sondeContrat.deux_preuves_conservees, JSON.stringify(sondeContrat));
exiger("`breed_requirement` sans `restriction_ref` est REFUSÉ",
  sondeContrat.breed_requirement_sans_restriction_ref_refusee);
/* La cardinalité mesurée plus bas ne vaut que si le contrat REFUSE les états incohérents : sans
   ces trois refus, « deux causes, deux preuves » resterait une coïncidence de fabrication. */
exiger("une exigence SANS preuve est refusée", sondeContrat.exigence_sans_preuve_refusee);
exiger("une preuve SANS exigence correspondante est refusée", sondeContrat.preuve_sans_exigence_refusee);
exiger("une preuve DUPLIQUÉE est refusée", sondeContrat.preuve_dupliquee_refusee);

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

/* ---- LE PARCOURS COMPLET : decisionH → appliquerH → explain → RAPPORT PUBLIC ------------------
   Les fixtures de la v4 lisaient la citation dans `r.decisive.source`, c'est-à-dire dans l'objet
   d'ENTRÉE. Elles pouvaient donc annoncer « citation conforme » alors que cette citation n'atteint
   jamais le rapport. On la contrôle désormais LÀ OÙ LE VISITEUR LA VERRAIT. */
const CIE_FX = "airline_aegean";
const ROUTE_FX = [...rawKB.airlines.find((a) => a.id === CIE_FX).direct_routes].sort()[0].split("|");
function parcoursComplet(restrictions, placement = "hold") {
  const req = FinderRequest.parse({ origin: ROUTE_FX[0], destination: ROUTE_FX[1],
    dog: { breed_id: "breed_pug", weight_kg: 8, brachycephalic: true },
    placement, date: `${_y}-01-15`, locale: "en" });
  const rapport = rapportH(req, `parcours|${placement}`, restrictions);
  const a = (rapport?.airlines ?? []).find((x) => x.airline_id === CIE_FX);
  const d = (a?.placement_decisions ?? []).find((x) => x.placement === placement) ?? null;
  return { rapport, decision: d, avis: rapport?.safety_advisories ?? [] };
}

const REQ_1 = { id: "brest_fx_req1", airline_id: CIE_FX, applies_to: { trait: "brachycephalic" },
  action: "require", placements: ["hold"], detail: { en: "Vet fitness certificate required." },
  source: QUOTE("https://fx.example/vet", "A veterinary fitness certificate is required for snub-nosed breeds.") };
const REQ_2 = { id: "brest_fx_req2", airline_id: CIE_FX, applies_to: { trait: "brachycephalic" },
  action: "require", placements: ["hold"], detail: { en: "Reinforced crate required." },
  source: QUOTE("https://fx.example/crate", "Snub-nosed breeds must travel in a reinforced crate.") };
const DENY_FX = { id: "brest_fx_deny_e2e", airline_id: CIE_FX, applies_to: { trait: "brachycephalic" },
  action: "deny", placements: ["hold"],
  source: QUOTE("https://fx.example/deny", "Snub-nosed breeds are not accepted in the hold.") };

const bout_en_bout = (() => {
  /* DEUX exigences valides sur le même canal → DEUX causes distinctes dans le rapport. */
  const multi = parcoursComplet(chargerRestrictions(CONTRE === "multi" ? [REQ_1] : [REQ_1, REQ_2]));
  const causesMulti = (multi.decision?.confirmation_causes ?? []).filter((c) => c.code === CAUSE_EXIGENCE);
  const refs = causesMulti.map((c) => c.restriction_ref).sort();

  /* La clé du MOTEUR les écraserait : on le démontre au lieu de l'annoncer. */
  const clesMoteur = new Set(causesMulti.map((c) => causeKey(c)));
  const clesH = new Set(causesMulti.map((c) => cleCauseH(c)));

  /* Un refus audité : la SOURCE du rapport doit être celle de la restriction, pas celle du canal. */
  const deny = parcoursComplet(chargerRestrictions([DENY_FX]));
  /* Aucun fait audité : la cause ne porte AUCUNE preuve de race. */
  const nonRevu = parcoursComplet(RESTRICTIONS_AUJOURD_HUI);
  const causeNonRevue = (nonRevu.decision?.confirmation_causes ?? []).find((c) => c.code === CAUSE_NON_REVUE);

  return {
    deux_exigences: { causes: causesMulti.length, references: refs,
      cles_distinctes_avec_la_cle_de_H: clesH.size, cles_distinctes_avec_causeKey_du_moteur: clesMoteur.size },
    refus_audite: { statut: deny.decision?.status ?? null, source_url: deny.decision?.source?.url ?? null,
      citation_dans_le_rapport: "quote" in (deny.decision?.source ?? {}) },
    aucun_fait_audite: { statut: nonRevu.decision?.status ?? null,
      cause_presente: !!causeNonRevue,
      cause_porte_une_source: causeNonRevue ? Object.keys(causeNonRevue).some((k) => k === "source") : false,
      champs_de_la_cause: causeNonRevue ? Object.keys(causeNonRevue).sort() : [] },
    /* LE CONSTAT DE CONTRAT : `DecisionSource` est `.strict()` et ne porte NI citation NI langue.
       La phrase officielle ne peut donc PAS atteindre le rapport public par ce chemin. */
    citation_atteint_le_rapport: "quote" in (deny.decision?.source ?? {}),
  };
})();

/* L'ATTENTE NE S'ADAPTE PAS À LA CONTRE-ÉPREUVE. Elle le faisait — `CONTRE === "multi" ? 1 : 2` —
   et la contre-épreuve sortait donc en 0 : un test qui révise sa cible quand on le casse ne casse
   jamais. L'attente est fixe ; c'est le référentiel injecté qui varie. */
exiger("deux exigences auditées produisent DEUX causes distinctes dans le rapport",
  bout_en_bout.deux_exigences.causes === 2 &&
  bout_en_bout.deux_exigences.cles_distinctes_avec_la_cle_de_H === 2,
  JSON.stringify(bout_en_bout.deux_exigences));
/* La clé du MOTEUR les distingue désormais aussi : c'était la lacune mesurée avant le patch
   (2 causes → 1 clé), elle est fermée. */
exiger("`causeKey()` du moteur distingue maintenant deux exigences",
  bout_en_bout.deux_exigences.cles_distinctes_avec_causeKey_du_moteur === 2,
  JSON.stringify(bout_en_bout.deux_exigences));
exiger("un refus audité fait descendre LA SOURCE DE LA RESTRICTION jusqu'au rapport",
  bout_en_bout.refus_audite.source_url === "https://fx.example/deny",
  JSON.stringify(bout_en_bout.refus_audite));
exiger("`breed_policy_unreviewed` ne porte aucune preuve de race",
  bout_en_bout.aucun_fait_audite.cause_presente &&
  !bout_en_bout.aucun_fait_audite.cause_porte_une_source,
  JSON.stringify(bout_en_bout.aucun_fait_audite));

/* ---- L'AVIS SUR UN RAPPORT PRÉCIS, et son rendu dans les quatre langues ------------------------ */
const avisSurUnRapport = (() => {
  const attendu = {
    restriction_ref: "brest_iata_snub_nose_hot_season", scope: "global",
    placements: ["cabin", "cargo", "hold"],
    url: "https://www.iata.org/en/programs/cargo/live-animals/pets/",
    quote: "Transport of snub nose dogs, such as boxers, pugs, bulldogs and Pekinese, in hot season is not recommended.",
  };
  const parLangue = {};
  for (const loc of ["en", "fr", "es", "pt"]) {
    const req = FinderRequest.parse({ origin: "airport_cdg", destination: "airport_bkk",
      dog: { breed_id: "breed_pug", weight_kg: 8 }, placement: "any", date: `${_y}-01-15`, locale: loc });
    const r = rapportH(req, `avis|${loc}`);
    const avis = r?.safety_advisories ?? [];
    /* On lit le `text` PRODUIT dans le rapport, pas `detail[locale]` de l'objet d'entrée : la
       v4-bis relisait sa propre source et appelait cela « rendu quadrilingue ». */
    parLangue[loc] = { nombre: avis.length, text: avis[0]?.text ?? null };
  }
  const req = FinderRequest.parse({ origin: "airport_cdg", destination: "airport_bkk",
    dog: { breed_id: "breed_pug", weight_kg: 8 }, placement: "any", date: `${_y}-01-15`, locale: "en" });
  const r = rapportH(req, "avis|reference");
  const a0 = (r?.safety_advisories ?? [])[0] ?? null;
  return { attendu, obtenu: a0, nombre: (r?.safety_advisories ?? []).length, par_langue: parLangue,
    textes_distincts: new Set(Object.values(parLangue).map((x) => x.text)).size };
})();

exiger("un rapport précis porte EXACTEMENT un avis de sécurité", avisSurUnRapport.nombre === 1,
  `${avisSurUnRapport.nombre}`);
exiger("cet avis porte la référence, la portée, les trois placements, l'URL et la citation attendues",
  avisSurUnRapport.obtenu?.restriction_ref === avisSurUnRapport.attendu.restriction_ref &&
  avisSurUnRapport.obtenu?.scope === "global" &&
  JSON.stringify(avisSurUnRapport.obtenu?.placements) === JSON.stringify(avisSurUnRapport.attendu.placements) &&
  avisSurUnRapport.obtenu?.source?.url === avisSurUnRapport.attendu.url &&
  avisSurUnRapport.obtenu?.source?.quote === avisSurUnRapport.attendu.quote,
  JSON.stringify(avisSurUnRapport.obtenu));
exiger("l'avis est rendu dans les QUATRE langues, avec quatre textes distincts",
  Object.values(avisSurUnRapport.par_langue).every((x) => x.nombre === 1 && x.text) &&
  avisSurUnRapport.textes_distincts === 4, JSON.stringify(avisSurUnRapport.par_langue));
exiger("tous les avis émis passent leur contrat SafetyAdvisory", avisInvalides.length === 0,
  avisInvalides.slice(0, 3).join(" | "));

/* ---- CARDINALITÉ DES PREUVES, et la lacune du contrat, mesurées ------------------------------- */
const cardinalitePreuves = (() => {
  const multi = parcoursComplet(chargerRestrictions(CONTRE === "multi" ? [REQ_1] : [REQ_1, REQ_2]));
  const cle = `${CIE_FX}#hold`;
  const preuves = multi.rapport?.preuves_de_race?.[cle] ?? [];
  const causes = (multi.decision?.confirmation_causes ?? []).filter((c) => c.code === CAUSE_EXIGENCE);
  return {
    causes: causes.length, preuves: preuves.length,
    references_des_preuves: preuves.map((x) => x.restriction_ref).sort(),
    portees_par_PlacementDecision_source: multi.decision?.source ? 1 : 0,
    perdues_par_le_contrat_actuel: Math.max(0, preuves.length - (multi.decision?.source ? 1 : 0)),
  };
})();
exiger("deux exigences produisent DEUX preuves distinctes à la sortie publique",
  cardinalitePreuves.preuves === 2 && new Set(cardinalitePreuves.references_des_preuves).size === 2,
  JSON.stringify(cardinalitePreuves));
exiger("la perte de preuves du contrat actuel est mesurée, non nulle et publiée",
  cardinalitePreuves.perdues_par_le_contrat_actuel === 1, JSON.stringify(cardinalitePreuves));

/* ---- LE CONTRAT MOTEUR, MAINTENANT VÉRIFIÉ EN POSITIF ------------------------------------------
   Tant que le patch n'existait pas, cette sonde exigeait les sept lacunes OUVERTES : c'était la
   seule façon de ne pas laisser croire à un acquis. Elle serait devenue rouge à l'instant précis
   où le moteur est réparé — défaut anticipé en contre-revue. Elle vérifie donc maintenant ce que
   le contrat DOIT porter.

   Une exception ASSUMÉE : `DecisionSource` ne porte toujours pas la citation, et ne doit pas la
   porter. Ajouter la citation ici ET des preuves plurielles aurait créé deux chemins concurrents.
   `DecisionSource` reste la projection courte de la politique générale du canal ;
   `RestrictionEvidence` porte les faits de race, au pluriel et avec leur `SourcedQuote`. */
const contratsMoteur = readFileSync("packages/engine/src/contracts.ts", "utf8");
const blocDecisionSource = /export const DecisionSource = z\.object\(\{[\s\S]*?\}\)/.exec(contratsMoteur)?.[0] ?? "";
const contratMoteur = {
  DecisionReport_declare_safety_advisories: /safety_advisories: SafetyAdvisory\[\]/.test(contratsMoteur),
  SafetyAdvisory_exporte_par_le_moteur: /export const SafetyAdvisory = z\./.test(contratsMoteur),
  cle_de_deduplication_des_avis: /export const advisoryKey/.test(contratsMoteur),
  ConfirmationCause_connait_breed_policy_unreviewed: /z\.literal\("breed_policy_unreviewed"\)/.test(contratsMoteur),
  ConfirmationCause_connait_breed_requirement: /z\.literal\("breed_requirement"\)/.test(contratsMoteur),
  causeKey_integre_restriction_ref: /breed_requirement" \? `\$\{c\.code\}\|\$\{c\.policy_ref\}\|\$\{c\.restriction_ref\}`/.test(contratsMoteur),
  /* Le pluriel est vérifié PAR LE COMPORTEMENT, pas par la forme du code : la première version
     cherchait `evidence: z.array(RestrictionEvidence)` et serait devenue fausse à la simple
     extraction du tableau dans une constante nommée — ce qui est arrivé à l'étape 1-bis. Une
     sonde qui rougit sur un renommage ne mesure pas le contrat. */
  preuves_plurielles_RestrictionEvidence: /export const RestrictionEvidence = z\./.test(contratsMoteur) &&
    sondeContrat.deux_preuves_conservees,
  RestrictionEvidence_compose_SourcedQuote: /RestrictionEvidence = z\.object\(\{[\s\S]*?source: SourcedQuote/.test(contratsMoteur),
};
exiger("les sept contrats moteur exigés par l'arbitrage sont en place",
  Object.values(contratMoteur).every((v) => v === true), JSON.stringify(contratMoteur));
exiger("`DecisionSource` NE porte PAS la citation — un seul chemin de preuve, pas deux",
  !blocDecisionSource.includes("quote:"), blocDecisionSource.slice(0, 120));

/* L'AVIS `warn` N'A AUCUN EFFET — prouvé en rejouant la grille publique SANS lui et en exigeant
   l'égalité stricte des verdicts, des scores et des statuts. La v3 l'affirmait ; ici on le mesure. */
const avisSansEffet = (() => {
  let ecarts = 0;
  for (const s2 of publique) {
    const avec = rapportH(s2.req, `avec|${s2.cle}`, RESTRICTIONS_REELLES);
    const sans = rapportH(s2.req, `sans|${s2.cle}`, RESTRICTIONS_AUJOURD_HUI);
    if (!avec || !sans) { ecarts++; continue; }
    if (JSON.stringify(compact(avec)) !== JSON.stringify(compact(sans))) ecarts++;
  }
  return ecarts;
})();
exiger("l'avertissement IATA `warn` ne change NI verdict NI score NI statut", avisSansEffet === 0, `${avisSansEffet}`);
exiger("l'avertissement IATA est réellement émis dans le parcours public", conseilsIata.length > 0, `${conseilsIata.length}`);
exiger("aucune URL d'avis n'apparaît comme source probante", autoCitations === 0);

/* Les chiffres APPROUVÉS, verrouillés littéralement sur cette base scellée. Un contrôle qui dit
   « toutes les bascules vont vers confirmation » sans dire COMBIEN laisserait passer une mesure
   qui n'en verrait plus que trois. */
exiger("72 scénarios publics", publique.length === 72, `${publique.length}`);
exiger("20 verdicts modifiés", diffPublic.verdicts === 20, `${diffPublic.verdicts}`);
exiger("524 cartes modifiées", diffPublic.cartes === 524, `${diffPublic.cartes}`);
exiger("940 placements modifiés", diffPublic.placements === 940, `${diffPublic.placements}`);
exiger("écart de score exactement [0, 2]",
  diffPublic.ecart_score[0] === 0 && diffPublic.ecart_score[1] === 2, JSON.stringify(diffPublic.ecart_score));
exiger("81 compagnies brachycéphales touchées", brachy.compagnies === 81, `${brachy.compagnies}`);
exiger("147 placements brachycéphales déplacés", brachy.placements === 147, `${brachy.placements}`);
exiger("147 cibles confirmation_required, et aucune autre",
  brachy.par_statut_cible.confirmation_required === 147 && Object.keys(brachy.par_statut_cible).length === 1,
  JSON.stringify(brachy.par_statut_cible));
exiger("56 causes climatiques observées", climatObserves === 56, `${climatObserves}`);

const intact = sha256Fichier("packages/knowledge/raw/rules.json") === sceau.raw_rules_sha256 &&
  sha256Fichier("packages/knowledge/raw/objects.json") === sceau.raw_objects_sha256;
exiger("le référentiel est intact après simulation", intact);

const violations = exigences.filter((e) => !e.tenue);

const doc = {
  lot: "T0-B3-a — simulation de l'option H (v5, contrats moteur en place)",
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
    entrees_dans_le_referentiel_aujourd_hui: RESTRICTIONS_AUJOURD_HUI.length,
    entrees_dans_le_referentiel_cible_de_H: RESTRICTIONS_REELLES.length,
    consequence: "AUJOURD'HUI le référentiel n'en contient aucune. La CIBLE de H en contient une " +
      "seule — l'avertissement IATA, action `warn`, qui ne décide rien. Les 102 compagnies tombent " +
      "donc toutes sur « aucun fait audité applicable » : c'est un état de notre documentation, " +
      "pas un choix de simulation.",
    table: [
      "1 · canal structurellement fermé → denied",
      "2 · BreedRestriction `deny` applicable → denied",
      "5 · BreedRestriction `require` applicable → confirmation_required (l'exigence est à satisfaire)",
      "3 · BreedRestriction `allow` applicable → statut général inchangé",
      "4 · aucun fait audité applicable → confirmation_required (breed_policy_unreviewed)",
      "`warn` (IATA) → conseil séparé, AUCUN effet sur le statut ni sur le score",
      "AUCUNE priorité de résolution : `allow` + `deny` (CONTRADICTION) et `deny` + `require` " +
      "(UNREACHABLE) sont refusés au CHARGEMENT par validateBreedRestrictions. Seul `allow` + " +
      "`require`, que le validateur autorise, est tranché ici — l'exigence l'emporte, puisqu'elle " +
      "dit ce qu'il faut faire pour que l'autorisation vaille.",
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
  cardinalite_des_preuves: cardinalitePreuves,
  contrat_moteur_verifie: contratMoteur,
  avis_sur_un_rapport_precis: avisSurUnRapport,
  preuves: { attendues: preuvesAttendues, transportees_par_le_contrat_actuel: preuvesTransportees },
  diff_contre_le_statu_quo: { grille_publique: diffPublic, grille_brachycephale: brachy },
};
/* UNE CONTRE-ÉPREUVE NE PUBLIE RIEN. Elle casse volontairement un invariant : si elle écrivait
   l'artefact, elle laisserait derrière elle un dossier faux — et c'est ce qui vient d'arriver en
   vérifiant la v4-ter à la main, l'artefact affichant les chiffres de `--contre-epreuve=multi`.
   Le runner enchaîne contre-épreuves puis régénération, ce qui masquait le défaut. */
if (!CONTRE) ecrireJson(`${DOSSIER}/option-h-simulee.json`, doc);
else console.log(`  (contre-épreuve « ${CONTRE} » : l'artefact n'est PAS écrit)`);

console.log(`simulation v5 écrite : ${DOSSIER}/option-h-simulee.json`);
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
