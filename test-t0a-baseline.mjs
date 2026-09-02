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
import { loadKB, preuveAuditee } from "./packages/knowledge/src/index.ts";
import { evaluate } from "./packages/engine/src/evaluate.ts";
import { explain } from "./packages/engine/src/explain.ts";

/* Sentinelles de forme des cartes de baseline : douze segments, le tarif au onzième rang (index
   10). Mesurées sur les 1 560 cartes ; elles ne bougent que par un mouvement nommé. */
const SEGMENTS_PAR_CARTE = 12;
const RANG_TARIF = 10;


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
    /* LE CHAMP « fee » N'EXISTE PLUS (micro-lot Tarifs, 29/08/2026). Laisser « fee:${a.fee ?? "-"} »
       rendrait « fee:- » partout : la baseline cesserait de contrôler quoi que ce soit de
       tarifaire, en silence. Elle porte désormais les STATUTS PAR CANAL, qui sont ce que le
       rapport dit maintenant — le mouvement de baseline est donc un mouvement NOMMÉ, et son diff
       montre ligne à ligne ce qui a remplacé quoi. */
    `label:${a.label}`, `tarifs:${(a.statuts_tarifaires ?? []).map((s) => s.placement).join("+") || "-"}`,
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
    /* Les AVIS DE SÉCURITÉ entrent dans la surface figée (T0-B3-b) : ils sont publiés au visiteur,
       donc un lot futur qui les perdrait, les élargirait ou en changerait la citation doit avoir à
       s'en expliquer devant la baseline. Forme compacte, comme les cartes compagnie — identité,
       portée, canaux, citation — et TRIÉE, pour que le diff soit lisible. */
    safety_advisories: (body.safety_advisories ?? [])
      .map((a) => `${a.restriction_ref}|${a.scope}|${(a.placements ?? []).join("+")}|${a.source?.url ?? "-"}|${a.source?.quote ?? "-"}`)
      .sort(),
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
/**
 * Preuve PERMANENTE T0-B3-b — le retrait des 42 règles brachycéphales auto-citées.
 *
 * Même discipline que la preuve T0-A ci-dessous : deux fichiers SCELLÉS, jamais l'état vivant.
 * Ce que ce lot a déplacé n'a aucune raison de vieillir, et un lot futur ne doit ni le rougir ni
 * l'effacer — il doit avoir à s'expliquer devant lui.
 *
 * Ce qui est verrouillé ici tient en une phrase : le changement ne touche QUE les chiens
 * brachycéphales. Les 36 scénarios « carlin » bougent tous, les 36 scénarios « golden » ne bougent
 * pas d'un octet. Une régression qui élargirait le retrait à d'autres races se verrait ici.
 */
console.log("=== Preuve PERMANENTE T0-B3-b (deux baselines FIGÉES : les 42 retirées) ===");
{
  const AVANT = "test-baselines/t0b3b-finder-baseline-avant.json";
  const APRES = "test-baselines/t0b3b-finder-baseline-apres.json";
  check("la baseline AVANT le retrait des 42 est versionnée", existsSync(AVANT));
  check("la baseline APRÈS le retrait des 42 est versionnée", existsSync(APRES));
  if (existsSync(AVANT) && existsSync(APRES)) {
    const avant = JSON.parse(readFileSync(AVANT, "utf8"));
    const apres = JSON.parse(readFileSync(APRES, "utf8"));
    const cles = Object.keys(apres);
    check("les deux baselines couvrent les mêmes 72 scénarios",
      cles.length === 72 && Object.keys(avant).length === 72
        && cles.every((k) => k in avant), `${Object.keys(avant).length} → ${cles.length}`);
    const bouge = cles.filter((k) => JSON.stringify(avant[k]) !== JSON.stringify(apres[k]));
    const carlins = cles.filter((k) => k.includes("pug"));
    const goldens = cles.filter((k) => k.includes("golden"));
    check("EXACTEMENT 36 scénarios bougent", bouge.length === 36, `${bouge.length}`);
    check("ce sont exactement les 36 scénarios CARLIN — tous, et rien qu'eux",
      bouge.length === carlins.length && carlins.every((k) => bouge.includes(k)),
      bouge.filter((k) => !k.includes("pug")).join(", "));
    check("AUCUN scénario golden retriever ne bouge, pas d'un octet",
      goldens.every((k) => JSON.stringify(avant[k]) === JSON.stringify(apres[k])),
      goldens.filter((k) => JSON.stringify(avant[k]) !== JSON.stringify(apres[k])).join(", "));
    /* Le SENS de la bascule, pas seulement son existence : un canal ne s'ouvre jamais en
       `allowed`. Le site cesse d'affirmer un refus qu'il ne peut pas prouver ; il n'affirme pas
       une acceptation qu'il ne peut pas prouver davantage. */
    let versAllowed = 0, versConfirmer = 0, autres = 0;
    const statuts = (ligne) => (ligne.split(" | ")[3] ?? "").replace("st:", "").split("/");
    for (const k of bouge) {
      const A = new Map((avant[k].airlines ?? []).map((l) => [l.split(" | ")[0], l]));
      for (const ligne of apres[k].airlines ?? []) {
        const a = A.get(ligne.split(" | ")[0]);
        if (!a) continue;
        const sa = statuts(a), sb = statuts(ligne);
        for (let i = 0; i < 3; i++) {
          if (sa[i] === sb[i]) continue;
          if (sa[i] === "denied" && sb[i] === "confirmation_required") versConfirmer++;
          else if (sb[i] === "allowed") versAllowed++;
          else autres++;
        }
      }
    }
    check("aucun canal ne s'ouvre en `allowed` — le retrait ne fabrique aucune acceptation",
      versAllowed === 0, `${versAllowed} bascule(s) vers allowed`);
    check("toutes les bascules vont de `denied` vers « à confirmer », et il y en a 940",
      versConfirmer === 940 && autres === 0, `${versConfirmer} vers confirmer, ${autres} autre(s)`);
  }
}

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
    const classementsApprouves = new Map((approuve.classements ?? []).map((c) => [c.scenario, c]));
    const vuesCartes = new Set(), vuesTetes = new Set(), vusClassements = new Set();
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
      /* Le CLASSEMENT est un contenu public : comparer les cartes par `Map` ne le voit pas —
         deux listes permutées ont les mêmes clés. Les séquences avant/après sont donc exigées
         à l'identique, dans les deux sens (contre-revue du 15/08/2026). */
      const ordreA = (A.airlines || []).map(id), ordreB = (B.airlines || []).map(id);
      if (JSON.stringify(ordreA) !== JSON.stringify(ordreB)) {
        vusClassements.add(k);
        const app = classementsApprouves.get(k);
        if (!app) echec(`DIFF ${k} classement modifié HORS du diff approuvé`);
        else if (JSON.stringify(app.avant) !== JSON.stringify(ordreA) || JSON.stringify(app.apres) !== JSON.stringify(ordreB)) {
          echec(`DIFF ${k} classement différent de la séquence EXACTE approuvée`);
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
    for (const cle of classementsApprouves.keys()) if (!vusClassements.has(cle)) echec(`DIFF classement approuvé NON observé: ${cle}`);

    check("bijection stricte avec le diff T0-B2 approuvé (452 cartes, 46 champs de tête)", bad === 0, `${bad} écart(s)`);
    check("452 cartes, 46 champs de tête et 28 classements approuvés",
      approuve.cartes.length === 452 && approuve.champs_de_tete.length === 46 && approuve.classements.length === 28,
      `${approuve.cartes.length} cartes · ${approuve.champs_de_tete.length} champs · ${approuve.classements?.length} classements`);
    /* Un classement figé n'est une garantie que s'il porte VRAIMENT une permutation : une
       séquence identique des deux côtés passerait la bijection sans rien prouver. */
    check("les 28 classements approuvés sont de vraies permutations",
      approuve.classements.every((c) => JSON.stringify(c.avant) !== JSON.stringify(c.apres)
        && c.avant.length > 0 && c.apres.length > 0));
    check("46 compagnies touchées, 48 couples justifiants",
      approuve.totaux.compagnies === 46 && approuve.totaux.couples_justifiants === 48,
      JSON.stringify(approuve.totaux));
    /* Chaque carte modifiée cite le couple migré qui l'explique : aucune bascule orpheline. */
    check("chaque carte approuvée cite au moins un couple migré",
      approuve.cartes.every((c) => c.couples.length > 0 && c.couples.every((x) => approuve.couples_justifiants.includes(x))));
  }
}

/**
 * Preuve T0-B2-UI — la source RACINE cesse de justifier une décision (deux baselines FIGÉES).
 *
 * Le contre-test navigateur du 15/08/2026 a vu la carte du Finder de Thai Airways présenter
 * « mydogcanfly.com » comme la source de sa politique. La première version de ce lot n'a retiré
 * que les auto-citations ; la contre-revue a montré que le critère était faux. Sur les 50 racines
 * restantes, 35 sont de simples pages d'accueil — `aerlingus.com`, `airchina.com` — qui ne
 * prouvent pas davantage une politique de transport d'animaux. Ce qui disqualifie une source
 * racine n'est pas son DOMAINE, c'est qu'elle n'est rattachée à AUCUN canal.
 *
 * Ce que le lot change, et il n'a le droit de changer que cela : la liste `sources` du rapport
 * perd les sources racines et gagne les sources AUDITÉES des canaux, désormais portées par les
 * décisions elles-mêmes. Verdict, score, statuts, décisions, causes, libellés, tarifs, classement
 * — strictement identiques, et c'est vérifié champ par champ ci-dessous, pas affirmé.
 *
 * DEUX PRÉCAUTIONS que la bijection seule n'apporterait pas, toutes deux par IDENTITÉ et relues
 * dans la base :
 *   · toute URL retirée doit ÊTRE une source racine de compagnie. Sans cela, un lot futur pourrait
 *     retirer une source de canal officielle en se réclamant de ce diff ;
 *   · toute URL ajoutée doit ÊTRE la source d'une politique de canal — sinon le rapport citerait
 *     une page que rien n'atteste — et ne peut pas être une auto-citation.
 */
console.log("=== Preuve T0-B2-UI (deux baselines FIGÉES — permanente) ===");
{
  const AVANT = "test-baselines/t0b2-finder-baseline-apres.json";
  const APRES = "test-baselines/t0b2ui-finder-baseline-apres.json";
  const APPROUVE = "test-baselines/t0b2ui-approved-diff.json";
  check("la baseline APRÈS T0-B2-UI est versionnée", existsSync(APRES));
  check("le diff T0-B2-UI approuvé est versionné", existsSync(APPROUVE));
  if (existsSync(APRES) && existsSync(APPROUVE)) {
    const avant = JSON.parse(readFileSync(AVANT, "utf8"));
    const apres = JSON.parse(readFileSync(APRES, "utf8"));
    const approuve = JSON.parse(readFileSync(APPROUVE, "utf8"));
    let bad = 0;
    const echec = (msg) => { bad++; if (bad <= 5) console.log(`  ${msg}`); };
    const vus = new Set();
    /* Tout ce qui n'est PAS `sources` : identité exigée, y compris la séquence des cartes. */
    const CHAMPS_FIGES = ["verdict", "score", "compatible", "domestic", "climate", "destination_country",
      "confidence", "conditions", "positives", "warnings", "risks", "alternatives", "airlines"];
    for (const k of Object.keys(avant)) {
      const A = avant[k], B = apres[k];
      if (!B) { echec(`MANQUANT après: ${k}`); continue; }
      for (const champ of CHAMPS_FIGES) {
        if (JSON.stringify(A[champ]) !== JSON.stringify(B[champ])) echec(`ÉCART MÉTIER ${k}.${champ} — interdit dans ce lot`);
      }
      if (JSON.stringify(A.sources) === JSON.stringify(B.sources)) continue;
      vus.add(k);
      const app = approuve.par_scenario[k];
      if (!app) { echec(`DIFF ${k} sources modifiées HORS du diff approuvé`); continue; }
      const out = A.sources.filter((u) => !B.sources.includes(u)).sort();
      const inn = B.sources.filter((u) => !A.sources.includes(u)).sort();
      if (JSON.stringify(out) !== JSON.stringify(app.retirees)) echec(`DIFF ${k} URL retirées ≠ liste approuvée`);
      if (JSON.stringify(inn) !== JSON.stringify(app.ajoutees)) echec(`DIFF ${k} URL ajoutées ≠ liste approuvée`);
    }
    for (const k of Object.keys(approuve.par_scenario)) if (!vus.has(k)) echec(`DIFF scénario approuvé NON observé: ${k}`);
    check("bijection stricte avec le diff T0-B2-UI approuvé, zéro écart métier", bad === 0, `${bad} écart(s)`);

    const estAuto = (u) => { try { return /(^|\.)mydogcanfly\.com$/i.test(new URL(u).hostname); } catch { return false; } };
    /* Les deux références d'identité, RELUES dans la base — jamais recopiées du diff. */
    const kbPreuve = loadKB();
    const racines = new Set(), sourcesDeCanal = new Set();
    for (const a of kbPreuve.airlines.values()) {
      if (a.source?.url) racines.add(a.source.url);
      for (const p of Object.values(a.premium?.policy ?? {})) if (p?.source?.url) sourcesDeCanal.add(p.source.url);
    }
    const horsRacines = approuve.racines_retirees.filter((x) => !racines.has(x.url));
    check(`les ${approuve.totaux.retirees_distinctes} URL retirées sont TOUTES des sources racines de compagnie`,
      approuve.racines_retirees.length === approuve.totaux.retirees_distinctes && horsRacines.length === 0,
      horsRacines.map((x) => x.url).slice(0, 3).join(" | "));
    check(`dont ${approuve.totaux.retirees_auto_citations} auto-citations — le reste étant des pages officielles sans canal`,
      approuve.racines_retirees.filter((x) => estAuto(x.url)).length === approuve.totaux.retirees_auto_citations
      && approuve.racines_retirees.every((x) => x.auto_citation === estAuto(x.url)));
    /* Les URL ajoutées ne sortent pas de nulle part : chacune est la source d'au moins une
       politique de canal dans la base, et aucune n'est une auto-citation. */
    const orphelines = approuve.sources_de_canal_ajoutees.filter((x) => !sourcesDeCanal.has(x.url));
    check(`les ${approuve.totaux.ajoutees_distinctes} URL ajoutées sont des sources de CANAL existantes, sans auto-citation`,
      approuve.sources_de_canal_ajoutees.length === approuve.totaux.ajoutees_distinctes
      && orphelines.length === 0 && !approuve.sources_de_canal_ajoutees.some((x) => estAuto(x.url)),
      orphelines.map((x) => x.url).slice(0, 3).join(" | "));
    /* Et plus aucune URL ne subsiste dans la baseline APRÈS AU TITRE de racine.
       Nuance qui compte : 41 URL sont À LA FOIS la racine d'une fiche et la source d'un de ses
       canaux — la page « animaux » de British Airways, par exemple. Celles-là ont le droit de
       rester, mais parce qu'un CANAL les cite, jamais parce que la fiche les porte. Le contrôle
       exige donc qu'une URL racine encore présente soit AUSSI une preuve auditée de canal, au
       sens exact de `preuveAuditee` — la même fonction que le moteur, pas une approximation. */
    const auditees = new Set();
    for (const a of kbPreuve.airlines.values()) {
      for (const p of Object.values(a.premium?.policy ?? {})) {
        const preuve = preuveAuditee(p);
        if (preuve?.url) auditees.add(preuve.url);
      }
    }
    const restantes = new Set();
    for (const k of Object.keys(apres)) {
      for (const u of apres[k].sources) if (estAuto(u) || (racines.has(u) && !auditees.has(u))) restantes.add(u);
    }
    check("aucune URL ne subsiste au titre de source RACINE (une preuve de canal peut, elle, rester)",
      restantes.size === 0, [...restantes].slice(0, 3).join(" | "));
    /* La baseline VIVANTE et la baseline FIGÉE LA PLUS RÉCENTE doivent coïncider, sinon la figée
       pourrit en silence pendant que la vivante suit les lots.
       Ce garde-fou est ROULANT par nature : chaque lot métier qui déplace la baseline doit figer
       SON « après » et le désigner ici. C'est précisément ce qui rend permanentes les figées
       précédentes — celle de T0-B2-UI reste comparée à celle de T0-A dans les contrôles ci-dessus,
       et personne ne peut plus les toucher. La plus récente est désormais celle du lot RC
       (28/08/2026, lecture directe Codex) : suppression des cinq règles non prouvées — les deux
       poids Alaska inventés, les deux affirmations Garuda sans page passager, le refus
       brachycéphale catégorique de BA — et avis IAG « acceptation non garantie » à la place.
       36 scénarios carlin bougent, AUCUN statut ne change (le mouvement est dans les avis de
       sécurité publiés) ; les figées de T0-A, T0-B2-UI et T0-B3-b restent intouchables. */
    /* LA PLUS RÉCENTE EST DÉSORMAIS CELLE DE L'ÉTAPE 3 DU MICRO-LOT TARIFS (30/08/2026). Ni la
       RC ni l'étape 2 ne sont écrasées : elles restent intactes à côté, et DEUX preuves
       permanentes établissent ce qui sépare chaque paire — le segment tarifaire pour la première,
       le seul libellé de canal pour la seconde. */
    check("la baseline vivante est identique à la baseline figée la plus récente (Tarifs étape 3)",
      readFileSync("test-baselines/t0a-finder-baseline.json", "utf8")
        === readFileSync("test-baselines/tarifs-etape3-finder-baseline-apres.json", "utf8"));

    /* PREUVE PERMANENTE RC → TARIFS. Le lot supprime le champ « fee » du rapport et lui substitue
       les statuts par canal. Ce qui doit rester vrai, et qu'on exige ici pour toujours : la même
       bijection de scénarios et de cartes, TOUS les autres champs identiques, et SEUL le segment
       tarifaire remplacé.

       PREMIÈRE RÉDACTION FAUTIVE, NOMMÉE : elle ne lisait que « airlines ». La contre-revue du
       29/08/2026 l'a montré en modifiant un `verdict` dans la figée Tarifs — et à l'identique
       dans la vivante, pour que le garde-fou roulant reste vert par égalité de fichiers. La
       preuve répondait alors `cartes: 1560, tarifRemplace: 1560, autresSegments: 0`, donc
       VERTE sur un rapport saboté. Elle exige désormais l'égalité canonique des quatorze autres
       champs, et par carte : la même identité au même rang, le même nombre de segments, UNE
       divergence et une seule, à la place du tarif, de « fee: » vers « tarifs: ». */
    {
      const rc = JSON.parse(readFileSync("test-baselines/rc-finder-baseline-apres.json", "utf8"));
      const tarifs = JSON.parse(readFileSync("test-baselines/tarifs-finder-baseline-apres.json", "utf8"));

      /* La comparaison est une FONCTION, pour être rejouée sur des copies sabotées juste après :
         une preuve qu'on n'a jamais vue rougir ne prouve rien. */
      const comparer = (avant, apres) => {
        const scenarios = Object.keys(avant).sort();
        const anomalies = [];
        if (JSON.stringify(scenarios) !== JSON.stringify(Object.keys(apres).sort())) {
          anomalies.push("les scénarios ne sont pas les mêmes");
          return { scenarios: scenarios.length, champs: 0, cartes: 0, remplacements: 0, rangs: [], anomalies };
        }
        let champs = 0, cartes = 0, remplacements = 0;
        const rangs = new Set();
        for (const s of scenarios) {
          /* 1 — TOUT LE RESTE DU RAPPORT, champ par champ : verdict, score, conditions, risques,
             sources, avis de sécurité, alternatives, climat… un mouvement de statut ne peut plus
             se glisser sous un mouvement de tarif. */
          for (const c of new Set([...Object.keys(avant[s]), ...Object.keys(apres[s])])) {
            if (c === "airlines") continue;
            champs++;
            if (JSON.stringify(avant[s][c]) !== JSON.stringify(apres[s][c])) anomalies.push(`${s}.${c} a bougé`);
          }
          /* 2 — LES CARTES, rang par rang. */
          const a = avant[s].airlines ?? [], b = apres[s].airlines ?? [];
          if (a.length !== b.length) { anomalies.push(`${s} : ${a.length} cartes contre ${b.length}`); continue; }
          for (let i = 0; i < a.length; i++) {
            cartes++;
            const sa = String(a[i]).split(" | "), sb = String(b[i]).split(" | ");
            if (sa.length !== SEGMENTS_PAR_CARTE || sb.length !== SEGMENTS_PAR_CARTE) {
              anomalies.push(`${s}#${i} : ${sa.length} segments contre ${sb.length} (attendu ${SEGMENTS_PAR_CARTE})`); continue;
            }
            if (sa[0] !== sb[0]) { anomalies.push(`${s}#${i} : identité ${sa[0]} devenue ${sb[0]}`); continue; }
            const divergents = sa.map((x, k) => (x === sb[k] ? -1 : k)).filter((k) => k >= 0);
            if (divergents.length !== 1) {
              anomalies.push(`${s}#${i} : ${divergents.length} segments divergents (${divergents.join(",")}), attendu 1`); continue;
            }
            const k = divergents[0];
            if (!sa[k].startsWith("fee:") || !sb[k].startsWith("tarifs:")) {
              anomalies.push(`${s}#${i} : divergence au segment ${k} « ${sa[k]} » → « ${sb[k]} », qui n'est pas un remplacement tarifaire`); continue;
            }
            rangs.add(k);
            remplacements++;
          }
        }
        return { scenarios: scenarios.length, champs, cartes, remplacements, rangs: [...rangs], anomalies };
      };

      const r = comparer(rc, tarifs);
      check(`RC → Tarifs : les ${r.scenarios} scénarios sont les mêmes`, r.scenarios === 72);
      check(`RC → Tarifs : ${r.champs} champs hors « airlines » comparés un à un`, r.champs === 1008);
      check(`RC → Tarifs : ${r.cartes} cartes comparées`, r.cartes === 1560);
      check(`RC → Tarifs : ${r.remplacements} remplacements tarifaires, tous au même rang ${JSON.stringify(r.rangs)}`,
        r.remplacements === 1560 && JSON.stringify(r.rangs) === JSON.stringify([RANG_TARIF]));
      check("RC → Tarifs : aucune autre divergence, nulle part",
        r.anomalies.length === 0, r.anomalies.slice(0, 5).join(" ; "));

      /* LA PREUVE VUE ROUGIR, sur les trois sabotages qu'elle a laissé passer ou qu'elle doit
         attraper. Sans ceci, elle resterait une affirmation. */
      const copie = () => JSON.parse(JSON.stringify(tarifs));
      const premier = Object.keys(tarifs)[0];
      const sabotages = [
        ["un verdict modifié — L'ATTAQUE DU 29/08", (t) => { t[premier].verdict = "SABOTÉ"; }],
        ["un avis de sécurité retiré", (t) => {
          /* Sur un scénario qui EN PORTE : vider un champ déjà vide ne prouverait rien. */
          const s = Object.keys(t).find((k) => (t[k].safety_advisories ?? []).length > 0);
          if (!s) return false;
          t[s].safety_advisories = [];
          return true;
        }],
        ["un statut de carte modifié hors segment tarifaire", (t) => {
          const c = t[premier].airlines[0].split(" | ");
          c[3] = "st:denied/denied/denied";
          t[premier].airlines[0] = c.join(" | ");
        }],
        ["une carte déplacée dans l'ordre", (t) => {
          const l = t[premier].airlines;
          [l[0], l[1]] = [l[1], l[0]];
        }],
      ];
      for (const [nom, saboter] of sabotages) {
        const t = copie();
        /* UNE MUTATION QUI NE S'APPLIQUE PAS NE PROUVE RIEN — la première rédaction vidait
           `safety_advisories` sur un scénario où il était DÉJÀ vide, et rougissait pour ça. */
        if (saboter(t) === false) { check(`RC → Tarifs : sabotage « ${nom} » applicable`, false, "la mutation ne change rien"); continue; }
        if (JSON.stringify(t) === JSON.stringify(tarifs)) { check(`RC → Tarifs : sabotage « ${nom} » applicable`, false, "la copie sabotée est identique à l'originale"); continue; }
        const vu = comparer(rc, t);
        check(`RC → Tarifs : la preuve rougit sur ${nom}`, vu.anomalies.length > 0,
          "la preuve est restée verte sur un rapport saboté");
      }
    }

    /* PREUVE PERMANENTE TARIFS ÉTAPE 2 → ÉTAPE 3. L'étape 3 remplace la cascade de libellés par
       une construction depuis l'ensemble RÉEL des canaux ouverts. Ce qui doit rester vrai pour
       toujours : SEUL le libellé bouge, sur EXACTEMENT 430 cartes, et pour les seules
       combinaisons multicanales — les 1 130 autres ne changent pas d'un octet.

       Ce que l'ancienne cascade disait, mesuré avant correction :
         011 ×  12  « Soute uniquement » alors que le fret est ouvert — FAUX ;
         110 × 264  « Cabine OK »        la soute est tue ;
         111 × 134  « Cabine OK »        la soute et le fret sont tus ;
         101 ×  20  « Cabine OK »        le fret est tu.
       Douze cartes affirmaient donc quelque chose de faux, et 418 taisaient un canal ouvert. */
    {
      const etape2 = JSON.parse(readFileSync("test-baselines/tarifs-finder-baseline-apres.json", "utf8"));
      const etape3 = JSON.parse(readFileSync("test-baselines/tarifs-etape3-finder-baseline-apres.json", "utf8"));
      const seg = (c, p) => (String(c).split(" | ").find((x) => x.startsWith(p)) || "").slice(p.length);
      const sansLibelle = (c) => String(c).split(" | ").filter((x) => !x.startsWith("label:")).join(" | ");

      const comparerLibelles = (avant, apres) => {
        const anomalies = [], parCombo = {};
        let cartes = 0, changes = 0;
        const scenarios = Object.keys(avant).sort();
        if (JSON.stringify(scenarios) !== JSON.stringify(Object.keys(apres).sort())) {
          return { cartes: 0, changes: 0, parCombo, anomalies: ["les scénarios ne sont pas les mêmes"] };
        }
        for (const s of scenarios) {
          /* Tout le reste du rapport — verdict, score, conditions, avis — doit être identique. */
          for (const c of new Set([...Object.keys(avant[s]), ...Object.keys(apres[s])])) {
            if (c === "airlines") continue;
            if (JSON.stringify(avant[s][c]) !== JSON.stringify(apres[s][c])) anomalies.push(`${s}.${c} a bougé`);
          }
          const a = avant[s].airlines ?? [], b = apres[s].airlines ?? [];
          if (a.length !== b.length) { anomalies.push(`${s} : ${a.length} cartes contre ${b.length}`); continue; }
          for (let i = 0; i < a.length; i++) {
            cartes++;
            /* HORS LIBELLÉ, la carte doit être identique à l'octet près. */
            if (sansLibelle(a[i]) !== sansLibelle(b[i])) { anomalies.push(`${s}#${i} : un segment hors libellé a bougé`); continue; }
            const la = seg(a[i], "label:"), lb = seg(b[i], "label:");
            if (la === lb) continue;
            changes++;
            const bools = seg(a[i], "bool:");
            /* Un libellé ne peut changer QUE sur une combinaison multicanale : deux « 1 » ou plus. */
            if ((bools.match(/1/g) ?? []).length < 2) {
              anomalies.push(`${s}#${i} : libellé changé sur ${bools}, qui n'ouvre pas deux canaux`);
              continue;
            }
            parCombo[bools] = (parCombo[bools] || 0) + 1;
          }
        }
        return { cartes, changes, parCombo, anomalies };
      };

      const r = comparerLibelles(etape2, etape3);
      check(`étape 2 → 3 : ${r.cartes} cartes comparées`, r.cartes === 1560);
      check(`étape 2 → 3 : ${r.changes} libellés changés, ${r.cartes - r.changes} inchangés`,
        r.changes === 430 && r.cartes - r.changes === 1130);
      /* Comparaison EXPLICITE, triée. La première rédaction comparait deux `JSON.stringify`
         d'objets : elle ne passait que parce que JavaScript réordonne les clés ressemblant à des
         index entiers — « 101 » avant « 011 ». Une égalité qui tient par une règle d'ordonnancement
         du langage est une égalité qu'on ne contrôle pas. */
      const ATTENDU_PAR_COMBO = [["011", 12], ["101", 20], ["110", 264], ["111", 134]];
      const vuParCombo = Object.entries(r.parCombo).sort(([a], [b]) => a.localeCompare(b));
      check(`étape 2 → 3 : les changements par combinaison ${JSON.stringify(vuParCombo)}`,
        JSON.stringify(vuParCombo) === JSON.stringify(ATTENDU_PAR_COMBO));
      check("étape 2 → 3 : rien d'autre n'a bougé, nulle part",
        r.anomalies.length === 0, r.anomalies.slice(0, 5).join(" ; "));

      /* AUCUN « UNIQUEMENT » QUAND UN SECOND CANAL EST OUVERT — dans les quatre langues, sur la
         baseline vivante comme sur la figée. C'est l'affirmation fausse que l'étape 3 ferme. */
      const EXCLUSIF = /\b(only|uniquement|solo|somente)\b/i;
      let fautifs = 0;
      for (const s of Object.keys(etape3)) {
        for (const c of etape3[s].airlines) {
          const bools = seg(c, "bool:");
          if ((bools.match(/1/g) ?? []).length >= 2 && EXCLUSIF.test(seg(c, "label:"))) fautifs++;
        }
      }
      check(`étape 2 → 3 : aucun libellé exclusif sur une carte à deux canaux ouverts (${fautifs})`, fautifs === 0);

      /* LA PREUVE VUE ROUGIR. Une preuve qu'on n'a jamais vue distinguer ne distingue rien. */
      const copie = () => JSON.parse(JSON.stringify(etape3));
      const premier = Object.keys(etape3)[0];
      const sabotages = [
        ["un libellé changé sur une carte à canal unique", (t) => {
          const s = Object.keys(t).find((k) => t[k].airlines.some((c) => (seg(c, "bool:").match(/1/g) ?? []).length === 1));
          if (!s) return false;
          const i = t[s].airlines.findIndex((c) => (seg(c, "bool:").match(/1/g) ?? []).length === 1);
          t[s].airlines[i] = t[s].airlines[i].replace(/label:[^|]*/, "label:SABOTÉ ");
          return true;
        }],
        ["un segment hors libellé modifié", (t) => {
          const c = t[premier].airlines[0].split(" | ");
          c[3] = "st:denied/denied/denied";
          t[premier].airlines[0] = c.join(" | ");
          return true;
        }],
        ["un verdict modifié", (t) => { t[premier].verdict = "SABOTÉ"; return true; }],
      ];
      for (const [nom, saboter] of sabotages) {
        const t = copie();
        if (saboter(t) === false) { check(`étape 2 → 3 : sabotage « ${nom} » applicable`, false, "la mutation ne change rien"); continue; }
        const vu = comparerLibelles(etape2, t);
        check(`étape 2 → 3 : la preuve rougit sur ${nom}`, vu.anomalies.length > 0,
          "la preuve est restée verte sur un rapport saboté");
      }
    }
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
  /* 28/08/2026 — Virgin Australia cabine : `offered` → `case_by_case` (arbitrage A-bis,
   * « Pets in Cabin » n'est ni interdit ni universel — routes/dates domestiques éligibles
   * seulement). Une politique passe donc d'`allowed` à `confirmation_required` : 143→142 et
   * 84→85. Le mouvement est nommé ici parce que cette répartition est un COMPTE FIGÉ : toute
   * bascule non documentée doit rougir, celle-ci est documentée.
   * 28/08/2026 (2e passe, contre-revue Codex) — Garuda Indonesia cabine : `not_offered` →
   * `legacy_unreviewed`. La lecture directe n'a trouvé aucune page passager officielle lisible
   * établissant l'interdiction cabine : « refusé » affirmait un fait non prouvé. La décision
   * rejoint l'héritage non re-vérifié, comme la soute et le fret de la même fiche : 75→74
   * denied, 85→86 à confirmer, et la cause legacy_unreviewed 83→84. */
  check("répartition runtime : 142 allowed · 74 denied · 86 à confirmer",
    parStatut.allowed === 142 && parStatut.denied === 74 && parStatut.confirmation_required === 86,
    JSON.stringify(parStatut));
  check("causes : 84 legacy_unreviewed · 1 policy_unpublished",
    parCause.legacy_unreviewed === 84 && parCause.policy_unpublished === 1, JSON.stringify(parCause));
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
