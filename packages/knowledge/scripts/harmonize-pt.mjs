#!/usr/bin/env node
/* Harmonise le portugais : une même phrase anglaise doit avoir une seule traduction.
 *
 * Pourquoi ce script existe. Les fiches sont traduites dix par lot, par des agents qui
 * travaillent en parallèle et ne se voient pas. Chacun retraduit de son côté le texte
 * répété d'une fiche à l'autre — en-têtes de tableau, mentions légales, noms de sources.
 * Au bout de soixante fiches, la mention légale du site existait en NEUF formulations,
 * alors que le français et l'espagnol n'en ont qu'une. Ce n'est pas une nuance de style :
 * c'est la même phrase, sur la même ligne, qui change de mots selon le pays consulté.
 *
 * Deux registres coexistent et doivent être harmonisés séparément :
 *   · le portugais du Brésil, qui est le public premier du site ;
 *   · le portugais neutre des trois fiches lusophones (Angola, Mozambique, Cap-Vert),
 *     écrit à l'infinitif impersonnel plutôt qu'avec « você ». Les fondre dans le premier
 *     groupe détruirait un choix éditorial délibéré.
 *
 * La forme retenue est la majoritaire à l'intérieur de chaque groupe — sauf arbitrage
 * explicite ci-dessous, là où la majorité est un ex æquo ou un contresens.
 *
 *   node packages/knowledge/scripts/harmonize-pt.mjs --dry
 *   node packages/knowledge/scripts/harmonize-pt.mjs
 */
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import YAML from "yaml";

const SRC = "content/countries";
const PT = join(SRC, "_pt");
const DRY = process.argv.includes("--dry");

/** Les trois fiches écrites en portugais neutre, pour des lecteurs qui ne lisent pas une
 *  traduction mais leur propre langue. Elles forment leur propre groupe d'harmonisation. */
const LUSOPHONE = new Set(["ao", "mz", "cv"]);

/** Arbitrages : la majorité ne tranche pas, ou tranche mal.
 *  Clé = texte anglais ; valeur = [forme brésilienne, forme lusophone neutre]. */
const ARBITRAGE = {
  "How your dog's entry requirements are decided": [
    "Como são definidas as exigências de entrada do seu cachorro",
    "Como são definidas as exigências de entrada do cão",
  ],
  "MyDogCanFly provides general information — not veterinary or legal advice.": [
    "O MyDogCanFly oferece informação geral — não é orientação veterinária nem jurídica.",
    "O MyDogCanFly fornece informações gerais — não constitui aconselhamento veterinário nem jurídico.",
  ],
  "Always consult your veterinarian before booking your trip.": [
    "Consulte sempre seu veterinário antes de fechar a viagem.",
    "Consultar sempre o médico-veterinário antes de reservar a viagem.",
  ],
  "Only a veterinarian can confirm the exact procedure for your individual dog.": [
    "Só um médico-veterinário pode confirmar o procedimento exato para o seu cachorro.",
    "Só um médico-veterinário pode confirmar o procedimento exato para cada cão.",
  ],
  // Cohérence avec « Veterinary health certificate » → « Atestado de saúde veterinário ».
  "Government veterinary health certificate": [
    "Atestado de saúde veterinário oficial",
    "Atestado de saúde veterinário oficial",
  ],
  // Deux phrases voisines, sur la même fiche, disaient l'une « no pior dos casos » et
  // l'autre « na pior das hipóteses ». Et le corpus dit « dono » 137 fois contre 26 « tutor ».
  "Only if rules are breached — authorities may then order re-export, quarantine or, in the worst case, euthanasia.": [
    "Apenas em caso de descumprimento das regras — as autoridades podem então determinar a reexportação, a quarentena ou, na pior das hipóteses, a eutanásia.",
    "Apenas em caso de incumprimento das regras — as autoridades podem então determinar a reexportação, a quarentena ou, na pior das hipóteses, a eutanásia.",
  ],
  "If documents are missing or invalid, authorities may order re-export, quarantine or, in the worst case, euthanasia — at the owner's expense.": [
    "Se faltarem documentos ou eles não forem válidos, as autoridades podem determinar a reexportação, a quarentena ou, na pior das hipóteses, a eutanásia — às custas do dono.",
    "Se faltarem documentos ou não forem válidos, as autoridades podem determinar a reexportação, a quarentena ou, na pior das hipóteses, a eutanásia — a expensas do dono.",
  ],
  "Only if rules are breached — customs may then order re-export, quarantine or euthanasia.": [
    "Apenas em caso de descumprimento das regras — a alfândega pode então determinar a reexportação, a quarentena ou a eutanásia.",
    "Apenas em caso de incumprimento das regras — a alfândega pode então determinar a reexportação, a quarentena ou a eutanásia.",
  ],
};

const codes = readdirSync(PT)
  .filter((f) => f.endsWith(".json") && !f.startsWith("_"))
  .map((f) => f.replace(/\.json$/, ""));

/* ---- 1. relevé : pour chaque groupe, chaque anglais et ses traductions observées ---- */
const tally = { br: new Map(), lus: new Map() };
const pairsOf = (code) => {
  const doc = YAML.parse(readFileSync(join(SRC, `${code}.yml`), "utf-8"));
  const out = [];
  (function walk(o) {
    if (!o || typeof o !== "object") return;
    if (typeof o.en === "string" && typeof o.pt === "string") return void out.push([o.en, o.pt]);
    for (const v of Object.values(o)) walk(v);
  })(doc);
  return out;
};

for (const code of codes) {
  const g = LUSOPHONE.has(code) ? "lus" : "br";
  for (const [en, pt] of pairsOf(code)) {
    if (!tally[g].has(en)) tally[g].set(en, new Map());
    const m = tally[g].get(en);
    m.set(pt, (m.get(pt) || 0) + 1);
  }
}

/* ---- 2. forme canonique par groupe ---- */
const canon = { br: new Map(), lus: new Map() };
const ties = [];
for (const g of ["br", "lus"]) {
  const idx = g === "br" ? 0 : 1;
  for (const [en, variants] of tally[g]) {
    if (variants.size < 2) continue;
    if (ARBITRAGE[en]) { canon[g].set(en, ARBITRAGE[en][idx]); continue; }
    const sorted = [...variants].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "pt"));
    if (sorted[0][1] === sorted[1][1]) ties.push([g, en, sorted.map((s) => s[0])]);
    canon[g].set(en, sorted[0][0]);
  }
}

/* ---- 3. réécriture ---- */
// Les valeurs `pt` n'existent que sous deux formes dans ces fichiers, toutes deux tenant
// sur une ligne : `pt: "…"` en bloc, et `pt: "…"` à l'intérieur d'un mapping en flow.
// Aucune n'est repliée (`>-`), ce qui a été vérifié avant d'écrire ce script.
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
const unesc = (s) => s.replace(/\\"/g, '"').replace(/\\\\/g, "\\");

let changed = 0, touchedFiles = 0;
const log = [];
for (const code of codes) {
  const g = LUSOPHONE.has(code) ? "lus" : "br";
  const map = canon[g];
  const file = join(SRC, `${code}.yml`);
  const lines = readFileSync(file, "utf-8").split("\n");
  let fileChanged = 0;
  let currentEn = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // mapping en flow : on lit l'anglais et le portugais sur la même ligne
    const flow = /^(\s*(?:-\s+)?[A-Za-z_]\w*:\s*\{\s*en:\s*")((?:[^"\\]|\\.)*)("[\s\S]*?pt:\s*")((?:[^"\\]|\\.)*)("\s*\}\s*)$/.exec(line);
    if (flow) {
      const en = unesc(flow[2]), pt = unesc(flow[4]);
      const want = map.get(en);
      if (want && want !== pt) {
        lines[i] = flow[1] + flow[2] + flow[3] + esc(want) + flow[5];
        fileChanged++; log.push([code, en, pt, want]);
      }
      continue;
    }

    const openEn = /^\s*(?:-\s+)?en:\s*"((?:[^"\\]|\\.)*)"\s*$/.exec(line);
    if (openEn) { currentEn = unesc(openEn[1]); continue; }
    const openFolded = /^\s*(?:-\s+)?en:\s*(>-?|\|-?)\s*$/.exec(line);
    if (openFolded) {
      // anglais replié : on recolle les lignes indentées pour retrouver la clé
      const indent = line.search(/\S/);
      const parts = [];
      let k = i + 1;
      while (k < lines.length && (lines[k].trim() === "" || lines[k].search(/\S/) > indent)) {
        if (lines[k].trim() !== "") parts.push(lines[k].trim());
        k++;
      }
      currentEn = parts.join(" ");
      i = k - 1;
      continue;
    }

    const ptLine = /^(\s*pt:\s*")((?:[^"\\]|\\.)*)("\s*)$/.exec(line);
    if (ptLine && currentEn) {
      const pt = unesc(ptLine[2]);
      const want = map.get(currentEn);
      if (want && want !== pt) {
        lines[i] = ptLine[1] + esc(want) + ptLine[3];
        fileChanged++; log.push([code, currentEn, pt, want]);
      }
    }
  }

  if (fileChanged) {
    changed += fileChanged; touchedFiles++;
    if (!DRY) writeFileSync(file, lines.join("\n"));
    // la trace JSON doit rester le reflet exact de la fiche
    const tj = join(PT, `${code}.json`);
    if (!DRY && existsSync(tj)) {
      const t = JSON.parse(readFileSync(tj, "utf-8"));
      let n = 0;
      for (const [en, v] of Object.entries(t)) { const w = map.get(en); if (w && w !== v) { t[en] = w; n++; } }
      if (n) writeFileSync(tj, JSON.stringify(t, null, 2) + "\n");
    }
  }
}

console.log(`${DRY ? "[simulation] " : ""}${changed} valeur(s) harmonisée(s) dans ${touchedFiles} fiche(s).`);
console.log(`Formes figées : ${canon.br.size} (brésilien) · ${canon.lus.size} (lusophone neutre).`);
if (ties.length) {
  console.log(`\n${ties.length} ex æquo tranché(s) par ordre alphabétique — à relire :`);
  for (const [g, en, vs] of ties.slice(0, 10)) console.log(`  [${g}] ${en.slice(0, 70)}\n      → ${vs[0]}\n        (autre : ${vs[1]})`);
}
if (DRY) {
  console.log("\nExtrait des remplacements :");
  for (const [c, en, o, n] of log.slice(0, 8)) console.log(`  ${c} · ${en.slice(0, 55)}\n     − ${o}\n     + ${n}`);
}
