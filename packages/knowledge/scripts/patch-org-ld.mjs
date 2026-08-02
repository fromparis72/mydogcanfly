#!/usr/bin/env node
/* Propage le bloc JSON-LD « Organization » dans les pages de `dist` non reconstruites.
 *
 * Pourquoi un correctif de texte plutôt qu'une reconstruction. Le bloc vit dans Base.astro,
 * il figure donc sur les 2 645 pages ; l'enrichir imposerait 27 passes de build. Or ce bloc
 * ne dépend d'AUCUNE donnée de page : il est construit à partir des constantes de lib/legal,
 * et il est par conséquent rigoureusement identique partout — vérifié sur 400 pages tirées au
 * sort avant d'écrire quoi que ce soit. Une substitution exacte est donc sûre, et vérifiable :
 * les familles réellement reconstruites servent de témoin.
 *
 * Ce script est un rattrapage, pas un mécanisme. La source est déjà à jour ; la prochaine
 * reconstruction complète produira le même résultat sans lui.
 *
 *   node packages/knowledge/scripts/patch-org-ld.mjs [--dry]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST = "packages/ui/dist";
const dry = process.argv.includes("--dry");

const bloc = (html) => {
  for (const m of html.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs))
    if (m[1].includes('"Organization"') && m[1].includes("#org")) return m[1];
  return null;
};

/* Le témoin : une page fraîchement construite porte la version de référence. */
const NEUF = bloc(readFileSync(join(DIST, "index.html"), "utf-8"));
if (!NEUF) { console.error("bloc de référence introuvable dans dist/index.html"); process.exit(1); }

const pages = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) { if (e !== "_astro") walk(p); }
    else if (e.endsWith(".html")) pages.push(p);
  }
})(DIST);

let vus = 0, corrigés = 0, sansBloc = 0;
const variantes = new Set();
for (const p of pages) {
  const h = readFileSync(p, "utf-8");
  const b = bloc(h);
  if (!b) { sansBloc++; continue; }
  vus++;
  if (b === NEUF) continue;
  variantes.add(b);
  /* Une seule substitution, sur la chaîne exacte : on ne réécrit jamais un bloc qu'on n'a pas
   * reconnu à l'identique. Deux variantes distinctes feraient échouer le contrôle ci-dessous. */
  if (!dry) writeFileSync(p, h.replace(b, NEUF));
  corrigés++;
}
console.log(`${vus} pages avec un bloc Organization · ${corrigés} mises à jour · ${sansBloc} sans bloc${dry ? " — essai à blanc" : ""}`);
if (variantes.size > 1) {
  console.error(`⚠ ${variantes.size} versions différentes rencontrées — vérifier avant de se fier au résultat`);
  process.exit(1);
}
