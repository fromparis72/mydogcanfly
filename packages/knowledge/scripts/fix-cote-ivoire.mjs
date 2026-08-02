#!/usr/bin/env node
/* "Côte d'Ivoire" -> "Ivory Coast" (en) / "Costa de Marfil" (es) dans ci.yml.
   Le français n'est JAMAIS touché (ni le texte, ni le style d'apostrophe).
   Les parenthèses redondantes « Ivory Coast (Côte d'Ivoire) » sont d'abord repliées. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const FILE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "content/countries/ci.yml");

const WORD = { en: "Ivory Coast", es: "Costa de Marfil" };      // fr absent = intouché
const CDI = /C[ôo]te d['’]Ivoire/g;
const REDUNDANT = /(Ivory Coast|Costa de Marfil)\s*\(C[ôo]te d['’]Ivoire\)/g;

function sub(text, lang) {
  if (!WORD[lang]) return text;                                  // fr : on ne touche à rien
  return text.replace(REDUNDANT, "$1").replace(CDI, WORD[lang]);
}

const lines = readFileSync(FILE, "utf8").split("\n");
let cur = null;
let changed = 0;

const out = lines.map((line) => {
  if (line.trimStart().startsWith("#")) return line;

  const block = line.match(/^\s*(en|fr|es):\s*[>|]/);
  if (block) { cur = block[1]; return line; }

  if (/\b(en|fr|es):\s*"/.test(line)) {
    let last = null;
    const next = line.replace(/\b(en|fr|es):\s*"((?:[^"\\]|\\.)*)"/g, (m, lang, val) => {
      last = lang;
      const v = sub(val, lang);
      if (v !== val) changed++;
      return `${lang}: "${v}"`;
    });
    cur = last;
    return next;
  }

  if (/^\s*[a-z_]+:/i.test(line) && !/^\s*(en|fr|es):/.test(line)) cur = null;

  if (cur && WORD[cur] && CDI.test(line)) { CDI.lastIndex = 0; changed++; return sub(line, cur); }
  CDI.lastIndex = 0;
  return line;
});

writeFileSync(FILE, out.join("\n"));
console.log(`ci.yml — ${changed} remplacement(s).`);

const text = out.join("\n");
console.log(`Résidus "Côte d'Ivoire" : ${(text.match(CDI) || []).length} (attendu : uniquement le français et les commentaires)`);
console.log(`Parenthèses redondantes restantes : ${(text.match(REDUNDANT) || []).length}`);
