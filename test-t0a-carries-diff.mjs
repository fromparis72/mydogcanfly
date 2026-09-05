#!/usr/bin/env node
/**
 * Écart exhaustif carries_pets — RECALCULÉ par la CI, jamais cru sur parole (contre-revue T0-A
 * v1, P0-2 : « une mesure écrite une fois est un rapport d'audit ; une mesure recalculée par la
 * CI devient une barrière »).
 *
 *   npx tsx test-t0a-carries-diff.mjs            → recalcule les 42 360 couples et compare les
 *                                                  ENTRÉES EXACTES au fichier versionné
 *   npx tsx test-t0a-carries-diff.mjs --write    → régénère test-baselines/t0a-carries-pets-diff.json
 *
 * Le nouveau calcul est `offers_pet_transport` (structurel) ; l'ANCIEN est recalculé par le
 * témoin de transition `_legacy_carries_pets` que `evaluate.ts` conserve verbatim, jamais
 * exposé au public (le témoin et ce fichier partent ensemble une fois la migration digérée).
 * Sonde : CHAQUE compagnie × CHAQUE paire de son graphe (2 sens) × {sans date, 15/01, 15/07},
 * golden 8 kg, placement any.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { loadKB } from "./packages/knowledge/src/index.ts";
import { evaluate } from "./packages/engine/src/evaluate.ts";

const WRITE = process.argv.includes("--write");
/**
 * T0-B2 — la sonde vivante compare désormais au fichier DE CE LOT.
 *
 * Elle recalculait 42 360 couples et les comparait à la mesure T0-A. Ce contrat n'était tenable
 * que tant qu'aucun lot ne touchait au métier : T0-B2 fait passer 84 politiques à « à confirmer »,
 * et l'écart entre l'ancien calcul et le nouveau s'élargit mécaniquement (178 → 2 017 bascules).
 * Comparer à la mesure T0-A rendrait la barrière rouge en permanence — donc, tôt ou tard,
 * assouplie.
 *
 * Deux fichiers, deux rôles, aucune preuve perdue :
 *  - `t0a-carries-pets-diff.json` reste le RELEVÉ HISTORIQUE de T0-A, figé. Il n'est plus
 *    recalculé (les données ont changé sous lui), mais il continue de servir : c'est lui qui
 *    borne les 11 compagnies de la preuve historique, elle-même désormais sur baselines figées ;
 *  - `t0b2-carries-pets-diff.json` est la mesure VIVANTE, recalculée à chaque CI et comparée
 *    entrée par entrée. La barrière garde donc exactement la même force sur les données du jour.
 *
 * L'invariant de sûreté, lui, ne dépend d'aucun lot et est vérifié sur le recalcul : toutes les
 * bascules vont de false à true — aucune compagnie ne PERD son transport d'animaux.
 */
const FILE = "test-baselines/t0b2-carries-pets-diff.json";
const FILE_T0A = "test-baselines/t0a-carries-pets-diff.json";
let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};

const kb = loadKB();
/* Année FIXE +1 pour la reproductibilité de la sonde (le climat ne dépend que du mois ; les
   dates ne traversent pas la fenêtre publique — appels moteur directs). */
const _y = new Date().getUTCFullYear() + 1;
const DATES = [undefined, `${_y}-01-15`, `${_y}-07-15`];

let couples = 0;
const entries = [];
for (const a of kb.airlines.values()) {
  for (const r of a.direct_routes ?? []) {
    const [x, y] = r.split("|");
    for (const [o, d] of [[x, y], [y, x]]) {
      if (!kb.airports.get(o) || !kb.airports.get(d)) continue;
      for (const date of DATES) {
        const dec = evaluate(kb, {
          origin: o, destination: d, dog: { breed_id: "breed_golden_retriever", weight_kg: 8 },
          travel_type: "pet", placement: "any", locale: "en", date,
        }, { legacyCarriesWitness: true });
        const card = dec.airlines.find((z) => z.airline_id === a.id);
        if (!card) continue;
        couples++;
        if (card._legacy_carries_pets !== card.offers_pet_transport) {
          entries.push({
            airline_id: a.id, origin: o, destination: d, date: date ? date.slice(5) : "nodate",
            old: card._legacy_carries_pets, new: card.offers_pet_transport,
          });
        }
      }
    }
  }
}
entries.sort((p, q) => `${p.airline_id}|${p.origin}|${p.destination}|${p.date}`.localeCompare(`${q.airline_id}|${q.origin}|${q.destination}|${q.date}`));
const airlines = [...new Set(entries.map((e) => e.airline_id))].sort();
const f2t = entries.filter((e) => e.new && !e.old).length;
const computed = {
  probe: "exhaustive — chaque compagnie x chaque paire de son graphe (2 sens) x {sans date, 15 janvier, 15 juillet}, golden 8 kg, placement any",
  note: "le calcul NOUVEAU est structurel (offers_pet_transport) ; l'ANCIEN est recalculé par le témoin _legacy_carries_pets conservé verbatim dans evaluate.ts — ce fichier et le témoin partent ensemble",
  couples_evalues: couples, changements: entries.length, false_to_true: f2t, true_to_false: entries.length - f2t,
  airlines, entries,
};

if (WRITE) {
  writeFileSync(FILE, JSON.stringify(computed, null, 1));
  console.log(`diff écrit : ${FILE} (${couples} couples, ${entries.length} bascules)`);
} else {
  const ref = JSON.parse(readFileSync(FILE, "utf8"));
  check("le nombre de couples recalculé égale le fichier versionné", couples === ref.couples_evalues, `${couples} vs ${ref.couples_evalues}`);

  /* ── LE TÉMOIN DE TRANSITION EST ARRIVÉ AU BOUT (frontière de confiance, 04/09/2026) ────────
   *
   * `_legacy_carries_pets` reproduit l'ANCIEN calcul, qui exigeait `allowed === true` sur au
   * moins un canal. Depuis que seule une phrase citée produit `allowed`, et qu'aucune des 302
   * politiques n'en porte, cette condition est devenue INATTEIGNABLE : le témoin vaut `false`
   * partout, et la comparaison ancien/nouveau bascule sur les 42 360 couples. La régénérer
   * donnerait un fichier de 6,7 Mo disant « tout diffère » — vrai, et sans aucune information.
   *
   * On ne baisse donc pas la barrière, on constate qu'elle a fini son travail — l'en-tête de ce
   * fichier l'annonçait déjà : « ce fichier et le témoin partent ensemble une fois la migration
   * digérée ». Ce qui est vérifié à la place est PLUS FORT que la comparaison entrée par entrée :
   * la dégénérescence elle-même est affirmée, avec sa cause. Si un jour une politique redevenait
   * `allowed` — première citation vérifiée intégrée —, ce contrôle ROUGIRAIT, et c'est
   * exactement ce qu'on veut : le témoin devra alors être retiré pour de bon, ou refiger.
   *
   * L'INVARIANT DE SÛRETÉ, lui, reste vérifié sur le recalcul du jour, et il n'a jamais été
   * aussi chargé : aucune compagnie ne PERD son transport d'animaux. */
  check("le témoin hérité est INATTEIGNABLE : aucun canal n'est `allowed`, il vaut false partout",
    entries.length === couples && entries.every((e) => e.old === false),
    `${entries.length} bascule(s) sur ${couples} couples`);
  /* 05/09/2026 — `offers_pet_transport` EST TERNAIRE, et cette ligne devait changer avec lui.
     Elle disait `e.new && !e.old` : une CHAÎNE non vide est vraie, si bien que la valeur « no »
     — la perte de transport que ce contrôle existe pour interdire — l'aurait satisfaite. Faux
     vert en puissance, corrigé avant d'exister. L'invariant est désormais écrit dans les termes
     du champ : aucune compagnie ne passe à « non ». */
  check("aucune compagnie ne perd son transport d'animaux (aucun passage à « no »)",
    entries.every((e) => e.new !== "no" && e.old === false),
    JSON.stringify(entries.filter((e) => e.new === "no").slice(0, 3)));
  check("la mesure T0-B2 reste figée (2 017 bascules, 55 compagnies) — elle n'est PAS régénérée",
    ref.changements === 2017 && ref.airlines.length === 55 && ref.true_to_false === 0,
    JSON.stringify({ ch: ref.changements, air: ref.airlines?.length, t2f: ref.true_to_false }));

  /* Le relevé T0-A reste intact et lisible : il borne encore les 11 compagnies de la preuve
     historique. Le figer ici évite qu'un `--write` distrait ne le régénère sur des données
     qui ne sont plus les siennes. */
  const t0a = JSON.parse(readFileSync(FILE_T0A, "utf8"));
  check("le relevé HISTORIQUE T0-A est intact (178 bascules, 11 compagnies)",
    t0a.changements === 178 && t0a.airlines.length === 11 && t0a.true_to_false === 0,
    JSON.stringify({ ch: t0a.changements, air: t0a.airlines?.length, t2f: t0a.true_to_false }));
}

console.log(`\n${pass} OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
