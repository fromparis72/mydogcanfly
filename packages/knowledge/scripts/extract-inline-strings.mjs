#!/usr/bin/env node
/* Extraction des phrases écrites en dur dans les gabarits.
 *
 * Le site a deux mécanismes de traduction. Les 277 chaînes d'interface passent par
 * `t(locale, clé)` et vivent dans translations/. Tout le reste — titres de pages, blocs
 * éditoriaux, libellés des outils — est écrit directement dans les composants sous la forme
 * `T("english", "français", "español")`, avec les trois langues en dur côté à côte.
 *
 * Ce script relève le premier argument de chaque appel : la version anglaise, qui sert de
 * clé. Une langue supplémentaire n'a alors pas besoin de toucher aux 542 sites d'appel,
 * seulement de fournir une table « anglais → autre langue ».
 *
 * Il refuse de deviner : un appel dont le premier argument n'est pas une chaîne littérale
 * simple est signalé, jamais ignoré en silence.
 *
 *   node packages/knowledge/scripts/extract-inline-strings.mjs [--json fichier]
 */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = "packages/ui/src";
const files = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    // Les gabarits .astro, mais aussi les modules .ts qui fabriquent du texte (faq.ts et
    // consorts) : une chaîne oubliée là ne se voit nulle part ailleurs.
    else if (p.endsWith(".astro") || p.endsWith(".ts")) files.push(p);
  }
})(ROOT);
files.sort();

/** Lit une chaîne littérale à partir de `i` (qui pointe sur le guillemet ouvrant). */
function readLiteral(src, i) {
  const q = src[i];
  if (q !== '"' && q !== "'" && q !== "`") return null;
  let out = "";
  for (let j = i + 1; j < src.length; j++) {
    const c = src[j];
    if (c === "\\") {
      const n = src[j + 1];
      out += n === "n" ? "\n" : n === "t" ? "\t" : n;
      j++;
      continue;
    }
    if (c === q) return { value: out, end: j };
    if (q === "`" && c === "$" && src[j + 1] === "{") return null; // interpolation : on ne touche pas
    out += c;
  }
  return null;
}

const found = [];   // { file, line, en }
const skipped = []; // { file, line, snippet }

for (const f of files) {
  const src = readFileSync(f, "utf-8");
  const rel = relative("packages/ui/src", f);
  const re = /(^|[^A-Za-z0-9_$.])([TLFQP])\s*\(/g;
  let m;
  while ((m = re.exec(src))) {
    const open = m.index + m[0].length;         // premier caractère après la parenthèse
    let k = open;
    while (k < src.length && /\s/.test(src[k])) k++;
    const line = src.slice(0, k).split("\n").length;
    const lit = readLiteral(src, k);
    if (!lit) {
      // Appels légitimes qu'on ne traduit pas : T(x) sur une variable, L.clé, etc.
      const snippet = src.slice(m.index, m.index + 60).replace(/\s+/g, " ").trim();
      skipped.push({ file: rel, line, snippet });
      continue;
    }
    found.push({ file: rel, line, en: lit.value });
  }
}

const uniq = new Map();
for (const x of found) if (!uniq.has(x.en)) uniq.set(x.en, x);

const out = {
  fichiers: files.length,
  appels: found.length,
  distinctes: uniq.size,
  nonAnalyses: skipped.length,
};

const argJson = process.argv.indexOf("--json");
if (argJson > -1) {
  // Squelette ordonné par fichier puis par ligne d'apparition — plus facile à relire.
  const ordered = [...uniq.values()].sort((a, b) => a.file.localeCompare(b.file) || a.line - b.line);
  const skel = {};
  for (const x of ordered) skel[x.en] = "";
  writeFileSync(process.argv[argJson + 1], JSON.stringify(skel, null, 2) + "\n");
  out.ecrit = process.argv[argJson + 1];
}

console.log(JSON.stringify(out, null, 1));
if (skipped.length) {
  console.log("\nAppels non analysés (à vérifier à la main) :");
  const byFile = {};
  for (const s of skipped) (byFile[s.file] ??= []).push(`${s.line}: ${s.snippet}`);
  for (const [f, list] of Object.entries(byFile)) {
    console.log(` ${f}`);
    for (const l of list.slice(0, 6)) console.log(`   ${l}`);
    if (list.length > 6) console.log(`   … et ${list.length - 6} autres`);
  }
}
