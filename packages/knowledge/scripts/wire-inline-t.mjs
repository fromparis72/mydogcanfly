#!/usr/bin/env node
/* Remplace les définitions locales de T() et L() par le helper partagé `inlineT(locale)`.
 *
 * Ces définitions sont toutes la même fonction recopiée 21 fois, avec des variantes
 * cosmétiques (`es` obligatoire ou optionnel, booléens `fr`/`es` précalculés). Le
 * comportement pour l'anglais, le français et l'espagnol est strictement identique après
 * remplacement ; seules les autres langues gagnent une table de correspondance.
 *
 * Le script refuse de modifier un fichier dont il ne reconnaît pas exactement la forme.
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

// Les formes acceptées, toutes équivalentes.
const FORMS = [
  /const ([TL]) = \(en: string, f: string, es\?: string\) => \(locale === "fr" \? f : locale === "es" \? \(es \?\? en\) : en\);/g,
  /const ([TL]) = \(en: string, f: string, es: string\) => \(locale === "fr" \? f : locale === "es" \? es : en\);/g,
  /const ([TL]) = \(en: string, fr: string, es: string\) => \(locale === "fr" \? fr : locale === "es" \? es : en\);/g,
  /const ([TL]) = \(en: string, f: string, s: string\) => \(fr \? f : es \? s : en\);/g,
];

let touched = 0;
let replaced = 0;
for (const f of files) {
  let src = readFileSync(f, "utf-8");
  const before = src;
  for (const re of FORMS) {
    src = src.replace(re, (_m, name) => {
      replaced++;
      return `const ${name} = inlineT(locale);`;
    });
  }
  if (src === before) continue;

  // Import : on complète un import existant du paquet, sinon on en ajoute un.
  if (!/\binlineT\b.*from "@mydogcanfly\/knowledge"/.test(src)) {
    const existing = /import \{([^}]*)\} from "@mydogcanfly\/knowledge";/.exec(src);
    if (existing) {
      src = src.replace(existing[0], `import {${existing[1].replace(/\s+$/, "")}, inlineT } from "@mydogcanfly/knowledge";`);
    } else {
      src = src.replace(/^---\n/, `---\nimport { inlineT } from "@mydogcanfly/knowledge";\n`);
    }
  }
  writeFileSync(f, src);
  touched++;
  console.log(` · ${relative("packages/ui/src", f)}`);
}
console.log(`\nfichiers modifiés : ${touched} · définitions remplacées : ${replaced}`);
