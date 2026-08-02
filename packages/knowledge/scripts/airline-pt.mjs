#!/usr/bin/env node
/* Ajoute une langue à une fiche COMPAGNIE sans réécrire le fichier.
 *
 * Jumeau de `airline-pt.mjs` : mêmes trois formes de valeurs localisées, même refus d'écrire
 * tant qu'une chaîne manque. Séparé plutôt que factorisé : les deux familles de fiches n'ont
 * pas la même durée de vie — les pays bougent avec les réglementations, les compagnies avec
 * leurs conditions de transport — et un outil commun ferait qu'un correctif sur l'une
 * risquerait l'autre.
 *
 *   node packages/knowledge/scripts/airline-pt.mjs dump   br            > /tmp/br.json
 *   node packages/knowledge/scripts/airline-pt.mjs inject br /tmp/br-pt.json
 *
 * Pourquoi ne pas simplement parser puis re-sérialiser le YAML : la bibliothèque conserve
 * les commentaires mais pas les lignes vides, et ces fiches sont écrites et relues à la main.
 * Un aller-retour transformerait 351 lignes en 327 et rendrait illisible le diff de toute
 * correction future. On travaille donc sur le texte, en insérant `pt:` à côté de ses voisines.
 *
 * Trois formes de valeurs localisées coexistent dans ces fichiers :
 *   1. bloc      en: "…" / fr: "…" / es: "…" sur trois lignes
 *   2. replié    en: >- suivi de lignes indentées
 *   3. en flow   { en: "…", fr: "…", es: "…" } sur une seule ligne
 * Les trois sont traitées ; toute autre forme fait échouer le script plutôt que d'être devinée.
 *
 * La clé d'appariement est le texte anglais, comme pour translations/pt/inline.json.
 */
import { readFileSync, writeFileSync } from "node:fs";

const [, , mode, code, jsonPath] = process.argv;
if (!mode || !code) {
  console.error("usage : airline-pt.mjs dump|inject <slug-compagnie> [fichier.json]");
  process.exit(2);
}
const FILE = `content/airlines/${code}.yml`;
const src = readFileSync(FILE, "utf-8");
const lines = src.split("\n");

const q = (s) => `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

/** Repère les groupes de clés localisées et renvoie, pour chacun, de quoi lire et insérer. */
function scan() {
  const groups = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Forme 3 — mapping en flow sur une ligne.
    const flow = /^(\s*(?:-\s+)?[A-Za-z_][\w]*:\s*)\{\s*en:\s*"((?:[^"\\]|\\.)*)"(.*)\}\s*$/.exec(line);
    if (flow) {
      groups.push({ kind: "flow", line: i, en: flow[2].replace(/\\"/g, '"') });
      continue;
    }

    // Formes 1 et 2 — `en:` ouvrant un groupe de lignes sœurs.
    const open = /^(\s*(?:-\s+)?)en:\s*(.*)$/.exec(line);
    if (!open) continue;
    const pad = open[1].replace(/-\s+$/, (m) => " ".repeat(m.length));
    const indent = pad.length;

    const readValue = (j) => {
      const m = /^\s*(?:-\s+)?(?:en|fr|es|pt):\s*(.*)$/.exec(lines[j]);
      const head = m[1];
      if (head === ">-" || head === ">" || head === "|" || head === "|-") {
        const parts = [];
        let k = j + 1;
        while (k < lines.length && (lines[k].trim() === "" || lines[k].search(/\S/) > indent)) {
          if (lines[k].trim() !== "") parts.push(lines[k].trim());
          k++;
        }
        return { value: parts.join(" "), end: k - 1 };
      }
      const s = /^"((?:[^"\\]|\\.)*)"\s*$/.exec(head);
      if (s) return { value: s[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"), end: j };
      return { value: head, end: j }; // scalaire nu
    };

    const first = readValue(i);
    let last = first.end;
    // On avance tant que la ligne suivante est une sœur `fr:` / `es:` au même retrait.
    let j = last + 1;
    while (j < lines.length) {
      const sib = new RegExp(`^${" ".repeat(indent)}(fr|es):\\s*(.*)$`).exec(lines[j]);
      if (!sib) break;
      const v = readValue(j);
      last = v.end;
      j = last + 1;
    }
    groups.push({ kind: "block", line: i, insertAfter: last, indent, en: first.value });
    i = last;
  }
  return groups;
}

const groups = scan();

if (mode === "dump") {
  const seen = new Map();
  for (const g of groups) if (!seen.has(g.en)) seen.set(g.en, "");
  console.log(JSON.stringify(Object.fromEntries(seen), null, 2));
  process.exit(0);
}

if (mode !== "inject") {
  console.error(`mode inconnu : ${mode}`);
  process.exit(2);
}

const table = JSON.parse(readFileSync(jsonPath, "utf-8"));
const missing = [...new Set(groups.map((g) => g.en))].filter((k) => !table[k] || !String(table[k]).trim());
if (missing.length) {
  console.error(`${missing.length} chaîne(s) sans traduction — rien n'est écrit :`);
  for (const m of missing.slice(0, 10)) console.error(`  · ${m.slice(0, 90)}`);
  process.exit(1);
}

// On insère du bas vers le haut pour que les numéros de ligne restent valables.
const out = [...lines];
for (const g of [...groups].sort((a, b) => b.line - a.line)) {
  const pt = table[g.en];
  if (g.kind === "flow") {
    out[g.line] = out[g.line].replace(/\s*\}\s*$/, `, pt: ${q(pt)} }`);
  } else {
    out.splice(g.insertAfter + 1, 0, `${" ".repeat(g.indent)}pt: ${q(pt)}`);
  }
}
writeFileSync(FILE, out.join("\n"));
console.log(`${FILE} : ${groups.length} valeurs localisées, pt ajouté à chacune.`);
