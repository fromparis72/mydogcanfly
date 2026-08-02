#!/usr/bin/env node
/* Normalise "Türkiye" -> "Turkey" (en) / "Turquía" (es) dans content/countries/tr.yml.
   Le français est déjà cohérent ("Turquie"). Respecte la langue de chaque valeur,
   y compris dans les blocs YAML multi-lignes (> et |) et les objets inline. */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const FILE = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "content/countries/tr.yml");

const WORD = { en: "Turkey", fr: "Turquie", es: "Turquía" };
const sub = (text, lang) => text.replace(/Türkiye/g, WORD[lang] || "Türkiye");

const lines = readFileSync(FILE, "utf8").split("\n");
let cur = null; // langue du bloc multi-lignes en cours
let changed = 0;

const out = lines.map((line) => {
  if (line.trimStart().startsWith("#")) return line; // commentaires laissés tels quels

  // Bloc multi-lignes : "en: >" ou "es: |"
  const block = line.match(/^\s*(en|fr|es):\s*[>|]/);
  if (block) { cur = block[1]; return line; }

  // Valeurs entre guillemets portant une clé de langue (inline compris)
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

  // Nouvelle clé non linguistique : on sort du bloc
  if (/^\s*[a-z_]+:/i.test(line) && !/^\s*(en|fr|es):/.test(line)) cur = null;

  // Continuation d'un bloc multi-lignes
  if (cur && line.includes("Türkiye")) { changed++; return sub(line, cur); }
  return line;
});

writeFileSync(FILE, out.join("\n"));
console.log(`tr.yml — ${changed} remplacement(s).`);
const rest = out.filter((l) => l.includes("Türkiye") && !l.trimStart().startsWith("#"));
console.log(rest.length ? "Restant hors commentaires :\n  " + rest.join("\n  ") : "Aucun résidu hors commentaires.");
