/**
 * T0-B3 · outil 3 — la SIMULATION ISOLÉE du retrait de chaque règle auto-citée.
 *
 *   node --import tsx mesures/t0b3-regles-autosourcees/outils/simuler-retrait.mjs
 *   → mesures/t0b3-regles-autosourcees/impact-retrait.json
 *   → mesures/t0b3-regles-autosourcees/baseline-ca254bf.json   (--ecrire-baseline)
 *
 * ─── LE RÉFÉRENTIEL N'EST JAMAIS MODIFIÉ ───────────────────────────────────────────────────────
 *
 * Aucun fichier de `packages/knowledge/raw/` n'est écrit, ni même ouvert en écriture. Le retrait
 * se fait EN MÉMOIRE : on filtre le tableau de règles avant `normalize()`, on interroge le moteur,
 * on jette la variante. L'empreinte SHA-256 des deux fichiers bruts est relue à la FIN et comparée
 * à celle du début — si elle bougeait, le dossier se disqualifierait lui-même.
 *
 * ─── DEUX VOLETS, PARCE QU'UN SEUL MENTIRAIT ──────────────────────────────────────────────────
 *
 * VOLET PUBLIC — les 72 scénarios de la baseline T0-A (9 routes × 2 chiens × 2 saisons ×
 *   2 placements), ceux qui décrivent le contrat rendu aux visiteurs. Ils répondent à : « retirer
 *   cette règle changerait-il ce que le site affiche aujourd'hui sur ses parcours de référence ? »
 *   Pour la grande majorité des règles la réponse sera « non » — non parce qu'elles sont inertes,
 *   mais parce que ces 9 routes ne les rencontrent pas. Lire un « 0 » ici comme « règle sans
 *   conséquence » serait un contresens, et c'est pourquoi le second volet existe.
 *
 * VOLET TÉMOIN — un scénario construit À PARTIR DE LA RÈGLE : on résout ses propres conditions en
 *   une requête qui la déclenche, sur une route réellement desservie par l'entité qu'elle porte.
 *
 * ─── QUATRE QUESTIONS DISTINCTES, QUATRE CHAMPS ───────────────────────────────────────────────
 *
 *   `fired`                      la règle mord-elle ? Lu dans `evaluate().airlines[].fired[]` et
 *                                `countryRequirements[]` — le moteur le dit, on ne l'infère pas.
 *   `status_changed_on_removal`  son retrait déplace-t-il le statut publié du canal ?
 *   `score_changed_on_removal`   son retrait déplace-t-il le score de confiance ?
 *   `dominant_for_status`        les deux premiers réunis : elle mord ET elle décide seule.
 *
 * Les confondre a produit, dans la première version de ce dossier, l'expression « lettre morte »
 * appliquée à onze règles `placement` qui se déclenchent toutes — elles sont seulement doublées
 * par la politique canonique issue de T0-B2, et l'une d'elles fait tout de même bouger le score.
 * On écrit donc « SANS EFFET MARGINAL SUR LE STATUT », jamais « redondante » ni « inerte » :
 * l'absence d'effet marginal ne dit rien de la JUSTESSE de la règle, qui reste entière à établir.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { normalize } from "../../../packages/knowledge/src/normalize.ts";
import { rawKB } from "../../../packages/knowledge/src/data.ts";
import { runFinder } from "../../../packages/engine/src/pipeline.ts";
import { evaluate } from "../../../packages/engine/src/evaluate.ts";
import { FinderRequest } from "../../../packages/engine/src/contracts.ts";
import { chargerReferentiel, estAutoCitee, trierRegles, ecrireJson } from "./lib-regles.mjs";

const DOSSIER = "mesures/t0b3-regles-autosourcees";
const ECRIRE_BASELINE = process.argv.includes("--ecrire-baseline");

const { sceau, regles, objets } = chargerReferentiel();
const sha256Fichier = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");

/* ---- Les 72 scénarios publics, repris à l'identique de test-t0a-baseline.mjs ------------------
   Mêmes routes, mêmes chiens, mêmes saisons, mêmes placements. Les redéfinir autrement aurait
   produit un dossier incomparable avec la baseline que la CI rejoue déjà. */
const ROUTES = [
  ["airport_cdg", "airport_bkk"], ["airport_cdg", "airport_jfk"], ["airport_cdg", "airport_dxb"],
  ["airport_lhr", "airport_mia"], ["airport_fra", "airport_sin"], ["airport_mad", "airport_mex"],
  ["airport_cdg", "airport_lhr"], ["airport_jfk", "airport_cdg"], ["airport_mxp", "airport_jfk"],
];
const CHIENS = [["golden", "breed_golden_retriever"], ["pug", "breed_pug"]];
const SAISONS = [1, 7];
const PLACEMENTS = ["any", "hold"];

/* Dates figées et FUTURES : la baseline T0-A canonise les dates en MM-JJ pour rester insensible au
   passage des années. Ici on n'écrit pas de baseline versionnée, on compare deux exécutions du même
   instant — une date fixe suffit et rend la simulation strictement reproductible. */
const _y = new Date().getUTCFullYear() + 1;
const dateDe = (mois) => `${_y}-${String(mois).padStart(2, "0")}-15`;

const scenariosPublics = [];
for (const [o, d] of ROUTES) {
  for (const [nomChien, breed] of CHIENS) {
    for (const m of SAISONS) {
      for (const pl of PLACEMENTS) {
        scenariosPublics.push({
          cle: `${o.slice(8)}-${d.slice(8)}|${nomChien}|${String(m).padStart(2, "0")}-15|${pl}`,
          req: FinderRequest.parse({
            origin: o, destination: d, dog: { breed_id: breed, weight_kg: 8 },
            placement: pl, date: dateDe(m), locale: "en",
          }),
        });
      }
    }
  }
}

/* ---- Projection canonique : la surface MÉTIER d'un rapport, sans horloge ---------------------- */
function canonique(rapport) {
  const dec = (d) => `${d.placement}:${d.status}`;
  const air = (a) => [
    a.airline_id,
    `st:${a.cabin_status}/${a.hold_status}/${a.cargo_status}`,
    (a.placement_decisions ?? []).map(dec).join(" ") || "-",
    `bool:${Number(a.cabin)}${Number(a.hold)}${Number(a.cargo)}`,
    `deny:${(a.deny_reasons ?? []).join("+") || "-"}`,
    `label:${a.label}`,
  ].join(" | ");
  return {
    verdict: rapport.verdict, score: rapport.score, compatible: rapport.compatible,
    airlines: (rapport.airlines ?? []).map(air),
  };
}

/* ---- Construction du TÉMOIN : résoudre les conditions d'une règle en une requête -------------- */
const aeroports = objets.airports;
const parPays = new Map();
for (const a of aeroports) {
  if (!parPays.has(a.country_id)) parPays.set(a.country_id, []);
  parPays.get(a.country_id).push(a.id);
}
for (const l of parPays.values()) l.sort();
const compagnies = new Map(objets.airlines.map((a) => [a.id, a]));
const racesParTaille = new Map();
for (const b of objets.breeds ?? []) {
  if (!racesParTaille.has(b.size)) racesParTaille.set(b.size, []);
  racesParTaille.get(b.size).push(b);
}
const raceBrachy = (objets.breeds ?? []).find((b) => b.brachycephalic === true)?.id ?? "breed_pug";
const raceNonBrachy = (objets.breeds ?? []).find((b) => b.brachycephalic !== true)?.id ?? "breed_golden_retriever";

/** Aplati le prédicat en feuilles à satisfaire. `any` → on prend la première branche ; `not` sur
 *  une feuille → on inverse l'opérateur. Toute forme non gérée est SIGNALÉE, jamais ignorée. */
function feuilles(p, refus) {
  if (!p || typeof p !== "object") { refus.push("prédicat non objet"); return []; }
  if (Array.isArray(p.all)) return p.all.flatMap((x) => feuilles(x, refus));
  if (Array.isArray(p.any)) return p.any.length ? feuilles(p.any[0], refus) : [];
  if (p.not) {
    const inv = { eq: "neq", neq: "eq", in: "nin", nin: "in", gt: "lte", gte: "lt", lt: "gte", lte: "gt" };
    const sous = feuilles(p.not, refus);
    if (sous.length !== 1) { refus.push("NON sur une sous-expression composée"); return []; }
    return [{ ...sous[0], op: inv[sous[0].op] ?? sous[0].op }];
  }
  if (typeof p.fact === "string") return [p];
  refus.push("feuille sans fait");
  return [];
}

/** Une valeur numérique qui satisfait l'opérateur, avec une marge d'un kilo. */
function valeurNumerique(op, v) {
  const n = Number(v);
  if (op === "gt") return n + 1;
  if (op === "gte") return n;
  if (op === "lt") return Math.max(0.5, n - 1);
  if (op === "lte") return n;
  if (op === "eq") return n;
  return null;
}

/** Une route réellement desservie par la compagnie : la première de ses routes directes, triée
 *  pour être stable d'une exécution à l'autre. */
function routeDe(airlineId) {
  const a = compagnies.get(airlineId);
  const rs = [...(a?.direct_routes ?? [])].sort();
  if (!rs.length) return null;
  const [o, d] = rs[0].split("|");
  return { origin: o, destination: d };
}

/** Une route qui ARRIVE dans le pays visé, prise chez n'importe quelle compagnie. */
function routeVers(countryId) {
  const cibles = new Set(parPays.get(countryId) ?? []);
  if (!cibles.size) return null;
  for (const a of [...objets.airlines].sort((x, y) => x.id.localeCompare(y.id))) {
    for (const r of [...(a.direct_routes ?? [])].sort()) {
      const [o, d] = r.split("|");
      if (cibles.has(d) && !cibles.has(o)) return { origin: o, destination: d, via: a.id };
    }
  }
  return null;
}

function construireTemoin(r) {
  const refus = [];
  const fs = feuilles(r.applies_when, refus);
  if (refus.length) return { req: null, refus: refus.join(" ; ") };

  const base = r.scope.type === "airline" ? routeDe(r.scope.id)
    : r.scope.type === "country" ? routeVers(r.scope.id)
    : null;
  if (!base) return { req: null, refus: `aucune route trouvée pour ${r.scope.id ?? r.scope.type}` };

  const req = {
    origin: base.origin, destination: base.destination,
    dog: { breed_id: raceNonBrachy, weight_kg: 8 },
    placement: "any", date: dateDe(1), locale: "en",
  };
  const nonGeres = [];

  for (const f of fs) {
    switch (f.fact) {
      case "dog.brachycephalic": {
        const veutVrai = (f.op === "eq" && f.value === true) || (f.op === "neq" && f.value === false);
        req.dog.breed_id = veutVrai ? raceBrachy : raceNonBrachy;
        req.dog.brachycephalic = veutVrai;
        break;
      }
      case "dog.weight_kg": {
        const v = valeurNumerique(f.op, f.value);
        if (v === null) { nonGeres.push(`${f.fact} ${f.op}`); break; }
        req.dog.weight_kg = Math.min(120, v);
        break;
      }
      case "dog.size": {
        const taille = Array.isArray(f.value) ? f.value[0] : f.value;
        const cand = (racesParTaille.get(taille) ?? [])[0];
        if (!cand) { nonGeres.push(`taille ${taille} sans race`); break; }
        req.dog.breed_id = cand.id;
        break;
      }
      case "dog.breed_id": {
        req.dog.breed_id = Array.isArray(f.value) ? f.value[0] : f.value;
        break;
      }
      case "placement": {
        const pl = Array.isArray(f.value) ? f.value[0] : f.value;
        if (f.op === "eq" || f.op === "in") req.placement = pl;
        break;
      }
      case "travel_type": {
        req.travel_type = Array.isArray(f.value) ? f.value[0] : f.value;
        break;
      }
      case "season.month": {
        const m = Number(Array.isArray(f.value) ? f.value[0] : f.value);
        if (Number.isFinite(m) && m >= 1 && m <= 12) req.date = dateDe(m);
        break;
      }
      case "docs.eu_passport": {
        const v = Array.isArray(f.value) ? f.value[0] : f.value;
        if (v === "yes" || v === "no") req.eu_passport = v;
        break;
      }
      case "route.dest_country_id": {
        const pays = Array.isArray(f.value) ? f.value[0] : f.value;
        const rr = routeVers(pays);
        if (rr) { req.origin = rr.origin; req.destination = rr.destination; }
        else nonGeres.push(`pays destination ${pays} sans route`);
        break;
      }
      case "route.dest_airport_id": {
        req.destination = Array.isArray(f.value) ? f.value[0] : f.value;
        break;
      }
      case "route.origin_country_id": {
        const pays = Array.isArray(f.value) ? f.value[0] : f.value;
        const cand = (parPays.get(pays) ?? [])[0];
        if (cand) req.origin = cand; else nonGeres.push(`pays origine ${pays} sans aéroport`);
        break;
      }
      case "weather.temperature_c": {
        const v = valeurNumerique(f.op, f.value);
        if (v !== null) req.weather = { temperature_c: Math.max(-60, Math.min(60, v)) };
        break;
      }
      default:
        nonGeres.push(f.fact);
    }
  }
  if (nonGeres.length) return { req: null, refus: `faits non gérés : ${[...new Set(nonGeres)].join(", ")}` };
  if (req.origin === req.destination) return { req: null, refus: "route dégénérée (origine = destination)" };
  try {
    return { req: FinderRequest.parse(req), refus: null, entite: r.scope.id ?? null };
  } catch (e) {
    return { req: null, refus: `requête invalide : ${String(e).slice(0, 120)}` };
  }
}

/* ---- Exécution -------------------------------------------------------------------------------- */
const kbRef = normalize(rawKB);
const baselinePublique = {};
for (const s of scenariosPublics) baselinePublique[s.cle] = canonique(runFinder(kbRef, s.req));

const autoCitees = regles.filter(estAutoCitee).sort(trierRegles);
console.log(`simulation : ${autoCitees.length} retraits × (72 scénarios publics + 1 témoin)`);

/** L'état d'une compagnie dans un rapport, ou null si elle n'y figure pas. */
const etatCompagnie = (rapport, id) => {
  const a = (rapport.airlines ?? []).find((x) => x.airline_id === id);
  return a ? `${a.cabin_status}/${a.hold_status}/${a.cargo_status}` : null;
};

const resultats = [];
let n = 0;
for (const r of autoCitees) {
  const kbSans = normalize({ ...rawKB, rules: rawKB.rules.filter((x) => x.id !== r.id) });

  /* VOLET PUBLIC */
  const scenariosChanges = [];
  for (const s of scenariosPublics) {
    const apres = canonique(runFinder(kbSans, s.req));
    if (JSON.stringify(apres) !== JSON.stringify(baselinePublique[s.cle])) scenariosChanges.push(s.cle);
  }

  /* VOLET TÉMOIN */
  const t = construireTemoin(r);
  let temoin = { construit: false, refus: t.refus };
  if (t.req) {
    const avant = runFinder(kbRef, t.req);
    const apres = runFinder(kbSans, t.req);
    const idEntite = r.scope.type === "airline" ? r.scope.id : null;
    const avantC = canonique(avant), apresC = canonique(apres);
    const change = JSON.stringify(avantC) !== JSON.stringify(apresC);

    /* SE DÉCLENCHE-T-ELLE ? Le moteur le DIT, il n'y a pas à l'inférer.
       `evaluate()` expose `airlines[].fired[].rule_id` pour les règles compagnie et
       `countryRequirements[].rule_id` pour les règles pays. La première version de ce dossier
       comparait à la place une base réduite à la seule règle contre une base sans règle : cette
       mesure ne répondait pas à « la règle mord-elle » mais à « son effet est-il observable au
       statut », et elle rapportait 129 déclenchements au lieu de 140 — les onze manquantes étant
       des règles `placement` qui mordent bel et bien, mais que la politique canonique double.
       Relevé en contre-revue le 16/08/2026. */
    const decision = evaluate(kbRef, t.req);
    const idsDeclenches = new Set([
      ...(decision.airlines ?? []).flatMap((a) => (a.fired ?? []).map((f) => f.rule_id)),
      ...(decision.countryRequirements ?? []).map((f) => f.rule_id),
    ]);
    const fired = idsDeclenches.has(r.id);

    const statutAvant = idEntite ? etatCompagnie(avant, idEntite) : null;
    const statutApres = idEntite ? etatCompagnie(apres, idEntite) : null;
    /* Trois questions distinctes, trois champs. Les confondre est ce qui a produit « lettre
       morte » pour des règles qui se déclenchent : une règle peut mordre, ne rien changer au
       statut parce qu'une autre source dit déjà non, et faire tout de même bouger le score. */
    const statutChange = idEntite
      ? statutAvant !== statutApres
      : avantC.verdict !== apresC.verdict;
    const scoreChange = avantC.score !== apresC.score;

    temoin = {
      construit: true,
      requete: { origin: t.req.origin, destination: t.req.destination, placement: t.req.placement,
        breed: t.req.dog.breed_id, poids_kg: t.req.dog.weight_kg, date: t.req.date },
      fired,
      status_changed_on_removal: statutChange,
      score_changed_on_removal: scoreChange,
      /* DOMINANT_FOR_STATUS : elle se déclenche ET son retrait déplace le statut publié. Le
         contraire n'est PAS « redondante » au sens de « superflue » — c'est « sans effet
         marginal sur le statut » : une autre règle ou la politique canonique produit déjà le
         même refus. Sa justesse reste entière à établir. */
      dominant_for_status: fired && statutChange,
      retrait_modifie_le_rapport: change,
      entite_avant: statutAvant, entite_apres: statutApres,
      verdict_avant: avantC.verdict, verdict_apres: apresC.verdict,
      score_avant: avantC.score, score_apres: apresC.score,
    };
  }

  resultats.push({
    id: r.id, categorie: r.category, criticite: r.criticality,
    portee: { type: r.scope.type, id: r.scope.id ?? null },
    effet: `${r.effect.action}${r.effect.placement ? " " + r.effect.placement.join("+") : ""}`,
    public: { scenarios_affectes: scenariosChanges.length, exemples: scenariosChanges.slice(0, 4) },
    temoin,
  });

  if (++n % 25 === 0) console.log(`  ${n}/${autoCitees.length}`);
}

/* ---- Le référentiel est-il resté intact ? ------------------------------------------------------ */
const sceauFinal = {
  raw_rules_sha256: sha256Fichier("packages/knowledge/raw/rules.json"),
  raw_objects_sha256: sha256Fichier("packages/knowledge/raw/objects.json"),
};
const intact =
  sceauFinal.raw_rules_sha256 === sceau.raw_rules_sha256 &&
  sceauFinal.raw_objects_sha256 === sceau.raw_objects_sha256;

const temoinsConstruits = resultats.filter((x) => x.temoin.construit);
const doc = {
  lot: "T0-B3 — mesure des règles auto-sourcées",
  nature: "MESURE — retraits SIMULÉS en mémoire, référentiel jamais écrit",
  sceau, sceau_final: sceauFinal, referentiel_intact: intact,
  synthese: {
    regles_simulees: resultats.length,
    temoins_construits: temoinsConstruits.length,
    temoins_impossibles: resultats.length - temoinsConstruits.length,
    affectant_les_72_scenarios_publics: resultats.filter((x) => x.public.scenarios_affectes > 0).length,
    fired_sur_leur_temoin: temoinsConstruits.filter((x) => x.temoin.fired).length,
    NON_fired_sur_leur_temoin: temoinsConstruits.filter((x) => !x.temoin.fired).length,
    dominant_for_status: temoinsConstruits.filter((x) => x.temoin.dominant_for_status).length,
    sans_effet_marginal_sur_le_statut: temoinsConstruits.filter((x) => x.temoin.fired && !x.temoin.status_changed_on_removal).length,
    dont_le_score_bouge_au_retrait: temoinsConstruits.filter((x) => x.temoin.score_changed_on_removal).length,
  },
  regles: resultats,
};
ecrireJson(`${DOSSIER}/impact-retrait.json`, doc);

if (ECRIRE_BASELINE) {
  ecrireJson(`${DOSSIER}/baseline-ca254bf.json`, {
    lot: "T0-B3", role: "baseline FIGÉE du contrat public au SHA scellé, 72 scénarios",
    sceau, scenarios: baselinePublique,
  });
  console.log(`baseline figée écrite : ${DOSSIER}/baseline-ca254bf.json`);
}

console.log(`impact écrit : ${DOSSIER}/impact-retrait.json`);
for (const [k, v] of Object.entries(doc.synthese)) console.log(`  ${k.padEnd(38)} ${v}`);
console.log(`  référentiel intact après simulation : ${intact ? "OUI" : "NON — DOSSIER INVALIDE"}`);
if (!intact) process.exit(1);
