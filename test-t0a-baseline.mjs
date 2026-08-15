#!/usr/bin/env node
/**
 * Baseline T0-A — la matrice métier VERSIONNÉE, rejouée par la CI (contre-revue du 14/08/2026).
 *
 *   npx tsx test-t0a-baseline.mjs            → compare à test-baselines/t0a-finder-baseline.json
 *   npx tsx test-t0a-baseline.mjs --write    → régénère la baseline (diff à approuver en revue)
 *
 * 72 scénarios (9 routes × 2 chiens × 2 saisons × 2 placements), interrogés à travers le
 * contrat HTTP réel du Worker. La projection canonique retient la surface MÉTIER : verdict,
 * score, classement, statuts, booléens, compteurs, textes visiteurs, causes — et neutralise ce
 * qui varie légitimement : `generated_at` supprimé, dates ramenées à MM-JJ.
 *
 * DURABILITÉ (contre-revue) : les dates sont « le prochain 15 janvier / 15 juillet » ; la
 * canonisation MM-JJ rend la baseline INSENSIBLE au passage des années — prouvé par la
 * contre-épreuve N/N+1 (mêmes scénarios, année civile suivante, snapshot identique).
 *
 * `carries_pets` : la correction structurelle T0-A est ASSUMÉE ici (les valeurs de cette
 * baseline sont les nouvelles) ; l'écart complet vs l'ancien calcul est versionné à part dans
 * test-baselines/t0a-carries-pets-diff.json (sonde exhaustive : 42 360 couples, 178 bascules,
 * toutes false→true, 11 compagnies) — aucun autre écart n'est toléré.
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import worker from "./packages/workers/src/index.ts";
import { loadKB } from "./packages/knowledge/src/index.ts";
import { evaluate } from "./packages/engine/src/evaluate.ts";
import { explain } from "./packages/engine/src/explain.ts";

const WRITE = process.argv.includes("--write");
const FILE = "test-baselines/t0a-finder-baseline.json";
let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};

/* Dates dynamiques : le prochain 15 janvier / 15 juillet, comparaison sur la date UTC complète. */
const _now = new Date();
const _y = _now.getUTCFullYear();
const _today = Date.UTC(_y, _now.getUTCMonth(), _now.getUTCDate());
const nextDate = (month, day, plusYears = 0) => {
  const target = Date.UTC(_y, month - 1, day);
  const y = (_today <= target ? _y : _y + 1) + plusYears;
  return `${y}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
};

const ROUTES = [
  ["airport_cdg", "airport_bkk"], ["airport_cdg", "airport_jfk"], ["airport_cdg", "airport_dxb"],
  ["airport_lhr", "airport_mia"], ["airport_fra", "airport_sin"], ["airport_mad", "airport_mex"],
  ["airport_cdg", "airport_lhr"], ["airport_jfk", "airport_cdg"], ["airport_mxp", "airport_jfk"],
];
const DOGS = [["golden", "breed_golden_retriever"], ["pug", "breed_pug"]];
const SEASONS = [[1, 15], [7, 15]];
const PLACEMENTS = ["any", "hold"];

/* Projection canonique d'un rapport : la surface métier, triée, sans horloge, dates en MM-JJ. */
function canonical(body) {
  const mmdd = (s) => (typeof s === "string" ? s.replace(/\b\d{4}-(\d{2}-\d{2})\b/g, "$1") : s);
  const walk = (v) => {
    if (Array.isArray(v)) return v.map(walk);
    if (v && typeof v === "object") {
      const o = {};
      for (const k of Object.keys(v).sort()) {
        if (k === "generated_at") continue;
        o[k] = walk(v[k]);
      }
      return o;
    }
    return mmdd(v);
  };
  /* Ligne compacte par compagnie : tout le métier, un ordre stable, un diff lisible. */
  const dec = (d) => `${d.placement}:${d.status}` + (d.confirmation_causes
    ? `[${d.confirmation_causes.map((c) => c.code === "estimated_climate" ? `clim:${c.rule_id}` : c.code === "missing_fact" ? `fact:${c.fact}` : `${c.code}:${c.policy_ref}`).join(",")}]` : "");
  const air = (a) => [
    a.airline_id, a.direct ? "direct" : "conn", a.itinerary_confidence ?? "-",
    `st:${a.cabin_status}/${a.hold_status}/${a.cargo_status}`,
    (a.placement_decisions ?? []).map(dec).join(" ") || "-",
    `bool:${Number(a.cabin)}${Number(a.hold)}${Number(a.cargo)}`,
    `confirm:${(a.to_confirm ?? []).join("+") || "-"}`,
    `pets:${a.carries_pets ?? "-"}/${a.offers_pet_transport ?? "-"}`,
    `deny:${(a.deny_reasons ?? []).join("+") || "-"}`,
    `label:${a.label}`, `fee:${a.fee ?? "-"}${a.fee_quote_only ? "(devis)" : ""}`,
    `heat:${Number(a.heat_embargo)}${Number(a.heat_confirmation_required)}`,
  ].join(" | ");
  return walk({
    verdict: body.verdict, score: body.score, compatible: body.compatible,
    domestic: body.domestic, climate: body.climate ?? null,
    destination_country: body.destination_country ?? null,
    confidence: body.confidence ?? null,
    conditions: (body.conditions ?? []).map((c) => c.text),
    positives: body.positives ?? [], warnings: body.warnings ?? [], risks: body.risks ?? [],
    alternatives: body.alternatives ?? [], sources: (body.sources ?? []).map((x) => x.url).sort(),
    airlines: (body.airlines ?? []).map(air),
  });
}

/* Le Worker limite à 60 req/min PAR IP (`cf-connecting-ip`). La matrice en fait ~90 : chaque
   scénario porte une IP de test distincte — on teste le contrat de réponse, pas le limiteur
   (qui a son harnais à lui dans les cas de référence). */
let ipSeq = 0;
const call = async (o, d, breed, date, placement) => {
  const res = await worker.fetch(new Request(
    `https://x/v1/finder?origin=${o}&destination=${d}&weight_kg=8&breed=${breed}&placement=${placement}&date=${date}&locale=en`,
    { headers: { "cf-connecting-ip": `10.0.${Math.floor(ipSeq / 250)}.${(ipSeq++ % 250) + 1}` } }), {});
  if (res.status !== 200) throw new Error(`${o}→${d} ${date} ${placement}: HTTP ${res.status}`);
  return canonical(await res.json());
};

const snapshot = {};
for (const [o, d] of ROUTES) for (const [dogKey, breed] of DOGS) for (const [m, day] of SEASONS) for (const pl of PLACEMENTS) {
  const key = `${o.slice(8)}-${d.slice(8)}|${dogKey}|${String(m).padStart(2, "0")}-15|${pl}`;
  snapshot[key] = await call(o, d, breed, nextDate(m, day), pl);
}
const nScen = Object.keys(snapshot).length;
check("72 scénarios évalués", nScen === 72, String(nScen));

if (WRITE) {
  mkdirSync("test-baselines", { recursive: true });
  writeFileSync(FILE, JSON.stringify(snapshot, null, 1));
  console.log(`baseline écrite : ${FILE} (${nScen} scénarios)`);
} else {
  check("la baseline versionnée existe", existsSync(FILE));
  const ref = JSON.parse(readFileSync(FILE, "utf8"));
  let diffs = 0;
  for (const k of Object.keys(snapshot)) {
    if (JSON.stringify(snapshot[k]) !== JSON.stringify(ref[k])) {
      diffs++;
      if (diffs <= 3) console.log(`  DIFF ${k}`);
    }
  }
  check("aucun écart métier vs la baseline approuvée", diffs === 0, `${diffs} scénario(s) divergent(s)`);
  check("aucun scénario fantôme dans la baseline", Object.keys(ref).length === nScen);
}

/**
 * Preuve HISTORIQUE T0-A — désormais PERMANENTE, parce qu'elle porte sur deux baselines FIGÉES.
 *
 * Elle comparait l'état VIVANT à la baseline pré-T0-A. Cela fonctionnait tant qu'aucun lot ne
 * touchait au métier ; T0-B2 en a fait basculer 464 cartes, et la preuve serait devenue rouge en
 * permanence — donc, tôt ou tard, assouplie ou supprimée. Or ce qu'elle démontre n'a aucune
 * raison de vieillir : entre pré-T0-A et post-T0-A, SEULES 24 cartes ont changé, à leurs valeurs
 * exactes, dans les deux sens.
 *
 * Elle compare donc deux fichiers scellés : `t0a-finder-baseline-avant.json` (pré-T0-A) et
 * `t0b-finder-baseline-avant.json` (post-T0-A, pré-T0-B2). Aucun lot futur ne peut plus la
 * rougir, et aucun ne peut l'effacer : elle reste exécutée à chaque CI, avec la totalité de ses
 * contrôles — y compris les trois faux verts corrigés en contre-revue (compagnie supprimée,
 * libellé changé sans bascule, valeurs exactes des 24 cartes).
 *
 * Ce qu'elle a perdu, et il faut le dire : le témoin legacy VIVANT (`verifyFlip`) recalculait
 * chaque bascule sur la base du jour. Sur données figées, il n'a plus de sens — il interrogerait
 * une base qui a changé depuis. Sa démonstration a eu lieu, et son résultat EST le fichier
 * approuvé, dont la bijection reste exigée dans les deux sens. Le témoin vivant continue, lui,
 * de servir dans la preuve T0-B2 ci-dessous, sur les données de ce lot.
 */
console.log("=== Preuve HISTORIQUE T0-A (deux baselines FIGÉES — permanente) ===");
{
  const AVANT = "test-baselines/t0a-finder-baseline-avant.json";
  const APRES = "test-baselines/t0b-finder-baseline-avant.json";
  check("la baseline AVANT (générée sur la base pré-T0-A) est versionnée", existsSync(AVANT));
  check("la baseline APRÈS T0-A (figée avant T0-B2) est versionnée", existsSync(APRES));
  if (existsSync(AVANT) && existsSync(APRES)) {
    const avant = JSON.parse(readFileSync(AVANT, "utf8"));
    const snapshot = JSON.parse(readFileSync(APRES, "utf8"));
    const diffFile = JSON.parse(readFileSync("test-baselines/t0a-carries-pets-diff.json", "utf8"));
    /* Contre-revue v3 : l'appartenance aux 11 compagnies ne suffit pas — et le fichier de diff
       (sonde sur le réseau PROPRE de chaque compagnie) ne couvre pas les cartes en
       correspondance. La preuve est donc VIVANTE : chaque bascule observée est revérifiée en
       recalculant le témoin legacy sur le scénario EXACT — une fausse bascule (Turkish sur
       CDG→BKK) échoue, une vraie (Vueling en correspondance sur CDG→LHR) est démontrée. */
    const flipAirlinesRef = new Set(diffFile.airlines);
    /* Contre-revue v4 (dernier faux vert) : une bascule LÉGITIME ne donne pas un blanc-seing
       sur le libellé — les 24 différences de carte autorisées sont VERROUILLÉES à leurs valeurs
       EXACTES dans t0a-approved-diff.json ; un « ARBITRARY UNRELATED LABEL » échoue même sur une
       vraie bascule Vueling CDG→LHR. Bijection exigée : chaque bascule observée figure dans
       l'approuvé, chaque entrée approuvée est observée. */
    const approved = JSON.parse(readFileSync("test-baselines/t0a-approved-diff.json", "utf8"));
    const approvedByKey = new Map(approved.entries.map((e) => [`${e.scenario}#${e.airline_id}`, e]));
    const seenFlips = new Set();
    let bad = 0;
    const segs = (line) => line.split(" | ");
    for (const k of Object.keys(snapshot)) {
      const A = avant[k], B = snapshot[k];
      if (!A) { bad++; if (bad <= 3) console.log(`  MANQUANT avant: ${k}`); continue; }
      for (const fld of ["verdict", "score", "compatible", "domestic", "climate", "destination_country", "confidence", "conditions", "positives", "warnings", "risks", "alternatives", "sources"]) {
        if (JSON.stringify(A[fld]) !== JSON.stringify(B[fld])) { bad++; if (bad <= 5) console.log(`  DIFF ${k} ${fld}`); }
      }
      const aById = new Map(A.airlines.map((l) => [segs(l)[0], l]));
      /* Faux vert n° 2 de la contre-revue : une compagnie SUPPRIMÉE passait inaperçue —
         contrôle dans les deux sens. */
      const bIds = new Set(B.airlines.map((l) => segs(l)[0]));
      for (const idA of aById.keys()) {
        if (!bIds.has(idA)) { bad++; if (bad <= 5) console.log(`  DIFF ${k} compagnie ${idA} SUPPRIMÉE après T0-A`); }
      }
      for (const lineB of B.airlines) {
        const sB = segs(lineB);
        const lineA = aById.get(sB[0]);
        if (!lineA) { bad++; if (bad <= 5) console.log(`  DIFF ${k} compagnie ${sB[0]} absente avant`); continue; }
        const sA = segs(lineA);
        // positions : 0 id · 1 direct · 2 conf · 3 st: · 4 decisions(nouveau) · 5 bool · 6 confirm · 7 pets · 8 deny · 9 label · 10 fee · 11 heat
        for (const i of [1, 2, 3, 5, 6, 8, 10, 11]) {
          if (sA[i] !== sB[i]) { bad++; if (bad <= 5) console.log(`  DIFF ${k} ${sB[0]} seg#${i}: ${sA[i]} → ${sB[i]}`); }
        }
        /* `pets:` = ancien carries / nouvel offers — seule la partie ANCIENNE se compare
           strictement, l'offers est un champ nouveau (écart additif approuvé). */
        const petsChanged = sA[7].split("/")[0] !== sB[7].split("/")[0], labelChanged = sA[9] !== sB[9];
        /* Second faux vert : un changement de LIBELLÉ n'est admis que sur une carte dont
           `carries_pets` a réellement basculé, chez une compagnie approuvée — jamais un blanc-
           seing par compagnie. */
        if (petsChanged) {
          /* La compagnie doit appartenir aux 11 du diff exhaustif — l'appartenance ne suffit pas,
             la valeur exacte de la carte est vérifiée juste après, dans les deux sens. */
          if (!flipAirlinesRef.has(sB[0])) { bad++; if (bad <= 5) console.log(`  DIFF ${k} ${sB[0]} bascule pets hors des 11 compagnies du diff exhaustif`); }
          const app = approvedByKey.get(`${k}#${sB[0]}`);
          seenFlips.add(`${k}#${sB[0]}`);
          if (!app) { bad++; if (bad <= 5) console.log(`  DIFF ${k} ${sB[0]} bascule ABSENTE des 24 différences approuvées`); }
          else if (app.apres !== lineB || app.avant !== lineA) {
            bad++; if (bad <= 5) console.log(`  DIFF ${k} ${sB[0]} carte différente de la valeur EXACTE approuvée`);
          }
        }
        if (labelChanged && !petsChanged) {
          bad++; if (bad <= 5) console.log(`  DIFF ${k} ${sB[0]} libellé changé SANS bascule pets: ${sA[9]} → ${sB[9]}`);
        }
      }
    }
    for (const key of approvedByKey.keys()) {
      if (!seenFlips.has(key)) { bad++; if (bad <= 5) console.log(`  DIFF entrée approuvée NON observée: ${key}`); }
    }
    check("aucune différence métier hors les 24 cartes approuvées, à leurs valeurs EXACTES (bijection)", bad === 0, `${bad} écart(s)`);
  }
}

/**
 * Preuve T0-B2 — même dispositif, et permanente pour la même raison : deux baselines FIGÉES.
 *
 * `t0b-finder-baseline-avant.json` (pré-T0-B2) → `t0b2-finder-baseline-apres.json` (post-T0-B2).
 * Chaque carte modifiée est verrouillée à sa valeur EXACTE dans `t0b2-approved-diff.json`, et
 * RATTACHÉE au couple (compagnie, placement) du registre approuvé qui la justifie. Bijection
 * exigée dans les deux sens.
 *
 * Le contrôle qui compte n'est pas le nombre : c'est qu'aucune carte ne bouge sans qu'un couple
 * migré l'explique. Un lot futur qui ferait basculer un 85ᵉ couple ne pourrait pas se glisser
 * dans les 452 cartes déjà approuvées.
 */
console.log("=== Preuve T0-B2 (deux baselines FIGÉES — permanente) ===");
{
  const AVANT = "test-baselines/t0b-finder-baseline-avant.json";
  const APRES = "test-baselines/t0b2-finder-baseline-apres.json";
  const APPROUVE = "test-baselines/t0b2-approved-diff.json";
  check("la baseline APRÈS T0-B2 est versionnée", existsSync(APRES));
  check("le diff T0-B2 approuvé est versionné", existsSync(APPROUVE));
  if (existsSync(APRES) && existsSync(APPROUVE)) {
    const avant = JSON.parse(readFileSync(AVANT, "utf8"));
    const apres = JSON.parse(readFileSync(APRES, "utf8"));
    const approuve = JSON.parse(readFileSync(APPROUVE, "utf8"));
    const id = (l) => l.split(" | ")[0];
    const cartesApprouvees = new Map(approuve.cartes.map((c) => [`${c.scenario}#${c.airline_id}`, c]));
    const tetesApprouvees = new Map(approuve.champs_de_tete.map((t) => [`${t.scenario}#${t.champ}`, t]));
    const vuesCartes = new Set(), vuesTetes = new Set();
    let bad = 0;
    const echec = (msg) => { bad++; if (bad <= 5) console.log(`  ${msg}`); };

    for (const k of Object.keys(avant)) {
      const A = avant[k], B = apres[k];
      if (!B) { echec(`MANQUANT après: ${k}`); continue; }
      for (const champ of ["verdict", "score", "compatible", "domestic", "climate", "destination_country",
        "confidence", "conditions", "positives", "warnings", "risks", "alternatives", "sources"]) {
        if (JSON.stringify(A[champ]) === JSON.stringify(B[champ])) continue;
        const app = tetesApprouvees.get(`${k}#${champ}`);
        vuesTetes.add(`${k}#${champ}`);
        if (!app) echec(`DIFF ${k} champ de tête ${champ} NON approuvé`);
        else if (JSON.stringify(app.avant) !== JSON.stringify(A[champ]) || JSON.stringify(app.apres) !== JSON.stringify(B[champ])) {
          echec(`DIFF ${k} champ ${champ} : valeur différente de l'approuvée`);
        }
      }
      const parId = new Map((A.airlines || []).map((l) => [id(l), l]));
      const idsB = new Set((B.airlines || []).map(id));
      for (const idA of parId.keys()) if (!idsB.has(idA)) echec(`DIFF ${k} compagnie ${idA} SUPPRIMÉE par T0-B2`);
      for (const ligneB of B.airlines || []) {
        const ligneA = parId.get(id(ligneB));
        if (ligneA === undefined) { echec(`DIFF ${k} compagnie ${id(ligneB)} APPARUE`); continue; }
        if (ligneA === ligneB) continue;
        const cle = `${k}#${id(ligneB)}`;
        vuesCartes.add(cle);
        const app = cartesApprouvees.get(cle);
        if (!app) { echec(`DIFF ${k} ${id(ligneB)} carte modifiée HORS du diff approuvé`); continue; }
        if (app.avant !== ligneA || app.apres !== ligneB) echec(`DIFF ${k} ${id(ligneB)} carte différente de la valeur EXACTE approuvée`);
      }
    }
    for (const cle of cartesApprouvees.keys()) if (!vuesCartes.has(cle)) echec(`DIFF carte approuvée NON observée: ${cle}`);
    for (const cle of tetesApprouvees.keys()) if (!vuesTetes.has(cle)) echec(`DIFF champ de tête approuvé NON observé: ${cle}`);

    check("bijection stricte avec le diff T0-B2 approuvé (452 cartes, 46 champs de tête)", bad === 0, `${bad} écart(s)`);
    check("452 cartes et 46 champs de tête approuvés",
      approuve.cartes.length === 452 && approuve.champs_de_tete.length === 46,
      `${approuve.cartes.length} cartes · ${approuve.champs_de_tete.length} champs`);
    check("46 compagnies touchées, 48 couples justifiants",
      approuve.totaux.compagnies === 46 && approuve.totaux.couples_justifiants === 48,
      JSON.stringify(approuve.totaux));
    /* Chaque carte modifiée cite le couple migré qui l'explique : aucune bascule orpheline. */
    check("chaque carte approuvée cite au moins un couple migré",
      approuve.cartes.every((c) => c.couples.length > 0 && c.couples.every((x) => approuve.couples_justifiants.includes(x))));
    /* La baseline VIVANTE et la baseline FIGÉE après T0-B2 doivent coïncider, sinon la figée
       pourrit en silence pendant que la vivante suit les lots. */
    check("la baseline vivante est identique à la baseline figée APRÈS T0-B2",
      readFileSync("test-baselines/t0a-finder-baseline.json", "utf8") === readFileSync(APRES, "utf8"));
  }
}

/**
 * Couverture DIRECTE des 302 politiques, indépendante des routes.
 *
 * Les 72 scénarios n'exercent que 48 des 84 couples migrés — la matrice ne dessert que 9 routes.
 * Les 36 autres seraient migrés sans qu'aucun test ne les regarde. Cette sonde les prend tous, au
 * niveau normalisation/projection : ce que la fiche décide, ce que le runtime en fait.
 */
console.log("=== Couverture DIRECTE : les 302 politiques, hors des 72 scénarios ===");
{
  const kbCouverture = loadKB();
  const attendu = {
    offered: { status: "allowed", allowed: true, cause: undefined },
    not_offered: { status: "denied", allowed: false, cause: undefined },
    case_by_case: { status: "confirmation_required", allowed: false, cause: "airline_approval" },
    undocumented: { status: "confirmation_required", allowed: false, cause: "policy_unpublished" },
  };
  const objets = JSON.parse(readFileSync("packages/knowledge/raw/objects.json", "utf8"));
  const parStatut = {}, parCause = {};
  let vues = 0, conformes = 0, herites = 0;
  const ecarts = [];
  for (const a of objets.airlines) {
    for (const mode of ["cabin", "hold", "cargo"]) {
      const auteur = a.premium?.policy?.[mode];
      if (!auteur) continue;
      vues++;
      if ("allowed" in auteur || "conditional" in auteur) herites++;
      const projete = kbCouverture.airlines.get(a.id)?.premium?.policy?.[mode];
      if (!projete) { ecarts.push(`${a.id}.${mode} : non projetée`); continue; }
      parStatut[projete.status] = (parStatut[projete.status] || 0) + 1;
      if (projete.status_cause) parCause[projete.status_cause] = (parCause[projete.status_cause] || 0) + 1;
      const cible = "review_state" in auteur
        ? { status: "confirmation_required", allowed: false, cause: "legacy_unreviewed" }
        : attendu[auteur.availability];
      if (!cible) { ecarts.push(`${a.id}.${mode} : discriminant inconnu`); continue; }
      if (projete.status !== cible.status || projete.allowed !== cible.allowed || projete.status_cause !== cible.cause) {
        ecarts.push(`${a.id}.${mode} : ${projete.status}/${projete.status_cause} ≠ ${cible.status}/${cible.cause}`);
        continue;
      }
      conformes++;
    }
  }
  check("302 politiques d'auteur, toutes projetées", vues === 302 && ecarts.length === 0, `${vues} vues · ${ecarts.length} écart(s) : ${ecarts.slice(0, 3).join(" ; ")}`);
  check("302 conformes à la table de projection", conformes === 302, String(conformes));
  check("ZÉRO forme d'auteur héritée subsistante", herites === 0, `${herites} résiduelle(s)`);
  check("répartition runtime : 143 allowed · 75 denied · 84 à confirmer",
    parStatut.allowed === 143 && parStatut.denied === 75 && parStatut.confirmation_required === 84,
    JSON.stringify(parStatut));
  check("causes : 83 legacy_unreviewed · 1 policy_unpublished",
    parCause.legacy_unreviewed === 83 && parCause.policy_unpublished === 1, JSON.stringify(parCause));
}

console.log("=== Contre-épreuve N/N+1 : la baseline survit au passage des années ===");
{
  /* La fenêtre publique de 18 mois refuse — à juste titre — une date N+1 : la contre-épreuve
     passe par le MOTEUR direct (même rapport, même projection canonique), qui ne re-valide pas
     la fenêtre. Ce qu'elle prouve : rien dans le rapport ne dépend de l'ANNÉE, seulement du
     mois — la canonisation MM-JJ rend donc la baseline stable d'une année sur l'autre. */
  const kb = loadKB();
  const engineCall = (o, d, date) => canonical(explain(evaluate(kb, {
    origin: o, destination: d, dog: { breed_id: "breed_golden_retriever", weight_kg: 8 },
    travel_type: "pet", placement: "any", locale: "en", date,
  }), "en"));
  const probes = [ROUTES[0], ROUTES[3], ROUTES[6]];
  let same = true;
  for (const [o, d] of probes) for (const [m, day] of SEASONS) {
    const a = engineCall(o, d, nextDate(m, day));
    const b = engineCall(o, d, nextDate(m, day, 1));
    if (JSON.stringify(a) !== JSON.stringify(b)) { same = false; console.log(`  DIFF N/N+1 ${o}-${d} ${m}-15`); }
  }
  check("6 sondes x 2 saisons : snapshot canonique IDENTIQUE avec l'année civile suivante", same);
}

console.log("=== Le diff carries_pets versionné borne les seules bascules admises ===");
{
  const diffFile = JSON.parse(readFileSync("test-baselines/t0a-carries-pets-diff.json", "utf8"));
  check("le diff exhaustif est versionné (sonde 42 360 couples)", diffFile.couples_evalues === 42360);
  check("toutes les bascules sont false→true, aucune perte", diffFile.true_to_false === 0 && diffFile.false_to_true === diffFile.changements);
  const allowedAirlines = new Set(diffFile.airlines);
  /* Dans la matrice, toute carte carries_pets=true dont l'ANCIEN calcul aurait dit false doit
     appartenir aux compagnies du diff — vérifié indirectement : le diff liste les compagnies,
     la baseline fige les valeurs ; un écart nouveau ferait échouer la comparaison ci-dessus. */
  check("le diff nomme ses compagnies (11)", allowedAirlines.size === 11, [...allowedAirlines].join(","));
}

console.log(`\n${pass} OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
