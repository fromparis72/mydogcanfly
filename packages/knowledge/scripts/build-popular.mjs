#!/usr/bin/env node
/* Classement des entités réellement consultées, extrait d'un export Search Console.
 *
 *   node packages/knowledge/scripts/build-popular.mjs <chemin/vers/Pages.csv> [--dry]
 *
 * Pourquoi ce fichier existe : le mega-menu listait les 78 compagnies, 140 pays et 172 races
 * sur chacune des 1 986 pages. Le remplacer par « les plus consultées » demandait de savoir
 * lesquelles le sont — pas de le deviner. La source est l'export Performance de Search
 * Console, seule mesure de la demande réelle dont nous disposons.
 *
 * Deux limites à garder en tête, écrites dans le fichier produit :
 *  1. C'est une PHOTOGRAPHIE. Le site est jeune (propriété créée le 5 juillet 2026) et la
 *     fenêtre fait 28 jours. À rafraîchir à chaque nouvel export, en relançant ce script.
 *  2. Le signal est inégal selon les familles : les pays pèsent 3 942 impressions, les races
 *     453 et les aéroports 169. Pour les races, un écart de 5 impressions ne veut rien dire —
 *     on complète donc jusqu'au quota avec les races au poids le plus élevé, qui sont celles
 *     dont le voyage pose vraiment problème (soute obligatoire, chaleur, caisse).
 *     Le fichier dit, entité par entité, si elle vient de la mesure ou du complément.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const OUT = resolve(ROOT, "packages/ui/src/data/popular.generated.json");
const csvPath = process.argv[2];
const dry = process.argv.includes("--dry");
if (!csvPath) {
  console.error("usage: build-popular.mjs <Pages.csv de l'export Search Console> [--dry]");
  process.exit(1);
}

const CAP = 10; // entrées par rubrique dans le menu

// ── Lecture du CSV. Format Search Console : "Top pages,Clicks,Impressions,CTR,Position".
const rows = readFileSync(csvPath, "utf-8")
  .replace(/^﻿/, "")
  .split(/\r?\n/)
  .slice(1)
  .filter(Boolean)
  .map((l) => {
    const c = l.split(",");
    return { url: c[0], impressions: Number(c[2]) || 0 };
  });
if (!rows.length) { console.error("CSV vide ou illisible :", csvPath); process.exit(1); }

// Les trois langues d'une même fiche sont la même entité : on somme.
const FAMILIES = [
  ["countries", /^\/countries\/([a-z]{2})\/$/],
  ["airlines", /^\/airlines\/([a-z0-9-]+)\/$/],
  ["breeds", /^\/breeds\/([a-z0-9-]+)\/$/],
  ["airports", /^\/airports\/([a-z0-9-]+)\/$/],
];
const measured = { countries: new Map(), airlines: new Map(), breeds: new Map(), airports: new Map() };
for (const { url, impressions } of rows) {
  const path = url.replace(/^https?:\/\/[^/]+/, "").replace(/^\/(fr|es)\//, "/");
  for (const [fam, rx] of FAMILIES) {
    const m = rx.exec(path);
    if (m) measured[fam].set(m[1], (measured[fam].get(m[1]) ?? 0) + impressions);
  }
}

// ── Complément pour les familles au signal trop faible. Le critère doit être stable dans le
// temps et défendable : le poids de la race (les grands chiens n'ont pas d'option cabine, ce
// sont eux dont le voyage est un problème). Aucun complément pour les pays : 88 sur 140 ont
// des impressions, la mesure suffit.
const objects = JSON.parse(readFileSync(resolve(ROOT, "packages/knowledge/raw/objects.json"), "utf-8"));
const slugOf = (id) => id.split("_").slice(1).join("-");
const fallbackBreeds = objects.breeds
  .map((b) => ({ slug: slugOf(b.id), weight: b.weight_kg ?? 0 }))
  .sort((x, y) => y.weight - x.weight)
  .map((b) => b.slug);

function rank(fam, fallback = []) {
  const list = [...measured[fam].entries()]
    .filter(([, imp]) => imp > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, CAP)
    .map(([key, impressions]) => ({ key, impressions, from: "search-console" }));
  for (const key of fallback) {
    if (list.length >= CAP) break;
    if (list.some((x) => x.key === key)) continue;
    list.push({ key, impressions: 0, from: "fallback-weight" });
  }
  return list;
}

const out = {
  _comment:
    "Généré par packages/knowledge/scripts/build-popular.mjs — NE PAS ÉDITER À LA MAIN. " +
    "Photographie d'un export Search Console : à régénérer à chaque nouvel export.",
  generated_on: new Date().toISOString().slice(0, 10),
  source: "Google Search Console — export Performance (Pages.csv)",
  window_days: 28,
  cap: CAP,
  totals: Object.fromEntries(
    Object.entries(measured).map(([k, m]) => [k, { entities_with_impressions: m.size, impressions: [...m.values()].reduce((a, b) => a + b, 0) }]),
  ),
  countries: rank("countries"),
  airlines: rank("airlines"),
  breeds: rank("breeds", fallbackBreeds),
  airports: rank("airports"),
};

const json = JSON.stringify(out, null, 2) + "\n";
if (dry) { console.log(json); process.exit(0); }
writeFileSync(OUT, json);
console.log(`✅ ${OUT}`);
for (const fam of ["countries", "airlines", "breeds", "airports"]) {
  const l = out[fam];
  const mes = l.filter((x) => x.from === "search-console").length;
  console.log(`   ${fam.padEnd(9)} ${l.length} entrées (${mes} mesurées, ${l.length - mes} complétées) — ${l.map((x) => x.key).join(", ")}`);
}
