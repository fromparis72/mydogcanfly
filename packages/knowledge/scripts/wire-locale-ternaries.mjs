#!/usr/bin/env node
/* Convertit les ternaires de langue en dur en appels T(en, fr, es).
 *
 *   locale === "fr" ? "…" : locale === "es" ? "…" : "…"
 *   fr ? "…" : es ? "…" : "…"
 *        →  T("…anglais…", "…français…", "…espagnol…")
 *
 * Ce sont surtout les titres SEO et les libellés d'outils : écrits ainsi, ils retombent sur
 * l'anglais pour toute quatrième langue. Passés par T(), ils traversent la table
 * translations/<langue>/inline.json comme le reste des gabarits.
 *
 * Seuls les ternaires dont les trois branches sont des chaînes littérales simples sont
 * touchés — un ternaire qui choisit un objet ou une variable est laissé tel quel.
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = "packages/ui/src";
const files = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (p.endsWith(".astro")) files.push(p);
  }
})(ROOT);
files.sort();

// Une chaîne double-quotée, échappements compris.
const S = `"(?:[^"\\\\]|\\\\.)*"`;
const FORMS = [
  new RegExp(`locale === "fr"\\s*\\?\\s*(${S})\\s*:\\s*locale === "es"\\s*\\?\\s*(${S})\\s*:\\s*(${S})`, "g"),
  new RegExp(`\\bfr\\s*\\?\\s*(${S})\\s*:\\s*es\\s*\\?\\s*(${S})\\s*:\\s*(${S})`, "g"),
];

let touched = 0;
let count = 0;
for (const f of files) {
  const src = readFileSync(f, "utf-8");
  let out = src;
  for (const re of FORMS) {
    out = out.replace(re, (_m, frS, esS, enS) => {
      count++;
      return `T(${enS}, ${frS}, ${esS})`;
    });
  }
  if (out === src) continue;

  if (!/const T = inlineT\(locale\)/.test(out)) {
    // Le fichier n'a pas encore de T : on l'ajoute juste après la destructuration des props.
    const anchor = /const \{[^}]*locale[^}]*\} = Astro\.props[^;]*;\n/.exec(out);
    if (!anchor) {
      console.log(` ⚠︎ ${relative(ROOT, f)} : pas de point d'ancrage pour déclarer T, fichier ignoré`);
      continue;
    }
    out = out.replace(anchor[0], `${anchor[0]}const T = inlineT(locale);\n`);
  }
  if (!/inlineT/.test(out.split("---")[1] ?? "") && !/import \{[^}]*inlineT/.test(out)) {
    const imp = /import \{([^}]*)\} from "@mydogcanfly\/knowledge";/.exec(out);
    out = imp
      ? out.replace(imp[0], `import {${imp[1].replace(/\s+$/, "")}, inlineT } from "@mydogcanfly/knowledge";`)
      : out.replace(/^---\n/, `---\nimport { inlineT } from "@mydogcanfly/knowledge";\n`);
  }
  writeFileSync(f, out);
  touched++;
  console.log(` · ${relative(ROOT, f)}`);
}
console.log(`\nfichiers modifiés : ${touched} · ternaires convertis : ${count}`);
