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

console.log("=== Preuve AVANT/APRÈS : les seules différences métier sont les nouveaux champs et les bascules approuvées ===");
{
  const AVANT = "test-baselines/t0a-finder-baseline-avant.json";
  check("la baseline AVANT (générée sur la base pré-T0-A) est versionnée", existsSync(AVANT));
  if (existsSync(AVANT)) {
    const avant = JSON.parse(readFileSync(AVANT, "utf8"));
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
    const kbProof = loadKB();
    const verifyFlip = (airlineId, o, d, breed, date, placement) => {
      const dec = evaluate(kbProof, {
        origin: `airport_${o}`, destination: `airport_${d}`,
        dog: { breed_id: breed, weight_kg: 8 }, travel_type: "pet",
        placement, locale: "en", date,
      }, { legacyCarriesWitness: true });
      const card = dec.airlines.find((z) => z.airline_id === airlineId);
      return !!card && card._legacy_carries_pets === false && card.offers_pet_transport === true;
    };
    let bad = 0;
    const segs = (line) => line.split(" | ");
    for (const k of Object.keys(snapshot)) {
      const A = avant[k], B = snapshot[k];
      if (!A) { bad++; if (bad <= 3) console.log(`  MANQUANT avant: ${k}`); continue; }
      const [routeKey, dogKey, mmdd, plKey] = k.split("|");
      const [oCity, dCity] = routeKey.split("-");
      const scnBreed = dogKey === "pug" ? "breed_pug" : "breed_golden_retriever";
      const scnDate = nextDate(parseInt(mmdd.slice(0, 2), 10), 15);
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
          const legit = flipAirlinesRef.has(sB[0]) && verifyFlip(sB[0], oCity, dCity, scnBreed, scnDate, plKey);
          if (!legit) { bad++; if (bad <= 5) console.log(`  DIFF ${k} ${sB[0]} bascule pets NON démontrée par le témoin legacy sur ce scénario exact`); }
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
