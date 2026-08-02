#!/usr/bin/env node
/* Pré-remplit le gabarit de traduction d'une fiche pays avec ce qui est DÉJÀ traduit ailleurs.
 *
 * Pourquoi. Les 140 fiches partagent énormément de formulations : « Microchip », « Required »,
 * « Not routinely required », des phrases entières de rappel réglementaire. Les retraduire à
 * chaque lot, c'est fabriquer de l'incohérence — on l'a payé une fois, avec 507 corrections
 * d'harmonisation sur les 60 premières fiches. La mémoire de traduction supprime le problème
 * à la source : ce qui a déjà été validé est réinjecté à l'identique, et le traducteur ne voit
 * que les chaînes réellement nouvelles.
 *
 *   node packages/knowledge/scripts/country-pt-prefill.mjs <code> > /tmp/<code>.json
 *
 * La mémoire est reconstruite à chaque appel depuis les fiches portant déjà `pt:` — elle
 * s'enrichit donc d'elle-même au fil des lots, sans fichier à tenir à jour.
 */
import { readFileSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import yaml from "js-yaml";

const code = process.argv[2];
if (!code) { console.error("usage : country-pt-prefill.mjs <code-pays>"); process.exit(2); }

const norm = (s) => String(s).split(/\s+/).join(" ").trim();

/** Mémoire : tout couple (en → pt) trouvé dans les fiches déjà traduites. */
const mem = new Map();
const litige = new Set();
for (const f of readdirSync("content/countries").filter((f) => f.endsWith(".yml"))) {
  const src = readFileSync(`content/countries/${f}`, "utf-8");
  if (!/^\s+pt:/m.test(src)) continue;
  (function walk(o) {
    if (Array.isArray(o)) return o.forEach(walk);
    if (o && typeof o === "object") {
      if (typeof o.en === "string" && typeof o.pt === "string") {
        const en = norm(o.en), pt = norm(o.pt);
        /* Deux portugais pour un même anglais : on ne choisit pas au hasard, on laisse le
         * trou. Un arbitrage silencieux, c'est exactement ce qui crée les incohérences. */
        if (mem.has(en) && mem.get(en) !== pt) litige.add(en);
        else mem.set(en, pt);
      }
      Object.values(o).forEach(walk);
    }
  })(yaml.load(src));
}

const gabarit = JSON.parse(execFileSync("node", ["packages/knowledge/scripts/country-pt.mjs", "dump", code]).toString());
let connues = 0;
for (const en of Object.keys(gabarit)) {
  const k = norm(en);
  if (mem.has(k) && !litige.has(k)) { gabarit[en] = mem.get(k); connues++; }
}
console.error(`${code} : ${Object.keys(gabarit).length} valeurs · ${connues} reprises de la mémoire · ${Object.keys(gabarit).length - connues} à traduire`);
console.log(JSON.stringify(gabarit, null, 2));
