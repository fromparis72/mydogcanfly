#!/usr/bin/env node
/* Pré-remplit le gabarit de traduction d'une fiche compagnie avec ce qui est déjà traduit.
 *
 * La mémoire est plus large que pour les pays : elle agrège trois sources déjà validées —
 * les fiches compagnies portant un `pt`, les 140 fiches pays, et la table d'interface
 * `translations/pt/inline.json`. Beaucoup de formulations circulent d'une famille à l'autre
 * (« Cabine », « Porão », « Somente carga », « Raças proibidas »), et les réécrire à chaque
 * fois est le meilleur moyen de finir avec trois portugais pour la même idée.
 *
 *   node packages/knowledge/scripts/airline-pt-prefill.mjs <slug> > /tmp/<slug>.json
 *
 * Quand deux traductions concurrentes existent pour un même anglais, la valeur est laissée
 * VIDE plutôt qu'arbitrée au hasard : le trou se voit, un mauvais arbitrage non.
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import yaml from "js-yaml";

const slug = process.argv[2];
if (!slug) { console.error("usage : airline-pt-prefill.mjs <slug-compagnie>"); process.exit(2); }

const norm = (s) => String(s).split(/\s+/).join(" ").trim();
const mem = new Map();
const litige = new Set();
const retiens = (en, pt) => {
  const a = norm(en), b = norm(pt);
  if (!a || !b) return;
  if (mem.has(a) && mem.get(a) !== b) litige.add(a);
  else mem.set(a, b);
};

/** 1 + 2. Les fiches YAML — compagnies déjà traduites, puis pays. */
for (const dir of ["content/airlines", "content/countries"]) {
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".yml") && !f.startsWith("_"))) {
    const src = readFileSync(`${dir}/${f}`, "utf-8");
    if (!/^\s+pt:/m.test(src)) continue;
    (function walk(o) {
      if (Array.isArray(o)) return o.forEach(walk);
      if (o && typeof o === "object") {
        if (typeof o.en === "string" && typeof o.pt === "string") return retiens(o.en, o.pt);
        Object.values(o).forEach(walk);
      }
    })(yaml.load(src));
  }
}

/** 3. La table d'interface : l'anglais y est déjà la clé. */
const INLINE = "packages/knowledge/translations/pt/inline.json";
if (existsSync(INLINE)) for (const [en, pt] of Object.entries(JSON.parse(readFileSync(INLINE, "utf-8")))) retiens(en, pt);

const gabarit = JSON.parse(execFileSync("node", ["packages/knowledge/scripts/airline-pt.mjs", "dump", slug]).toString());
let connues = 0;
for (const en of Object.keys(gabarit)) {
  const k = norm(en);
  if (mem.has(k) && !litige.has(k)) { gabarit[en] = mem.get(k); connues++; }
}
console.error(`${slug} : ${Object.keys(gabarit).length} valeurs · ${connues} reprises de la mémoire · ${Object.keys(gabarit).length - connues} à traduire`);
console.log(JSON.stringify(gabarit, null, 2));
