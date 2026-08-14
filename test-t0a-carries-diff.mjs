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
const FILE = "test-baselines/t0a-carries-pets-diff.json";
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
  check("les ENTRÉES EXACTES concordent (chaque bascule, une à une)",
    JSON.stringify(entries) === JSON.stringify(ref.entries),
    `${entries.length} recalculées vs ${ref.entries?.length ?? 0} versionnées`);
  check("compteurs cohérents avec les entrées recalculées",
    ref.changements === entries.length && ref.false_to_true === f2t && ref.true_to_false === entries.length - f2t);
  check("liste EXACTE des compagnies", JSON.stringify(airlines) === JSON.stringify(ref.airlines), airlines.join(","));
  check("toutes les bascules sont false→true (aucune perte de transport)", entries.every((e) => e.new && !e.old));
}

console.log(`\n${pass} OK, ${fail} FAIL`);
if (fail > 0) process.exit(1);
