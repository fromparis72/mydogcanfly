#!/usr/bin/env node
/**
 * LE REGISTRE CANONIQUE DES ANCIENNES URL → LES TABLES DU WORKER, ET RIEN D'AUTRE.
 *
 *   node packages/knowledge/scripts/generer-worker-legacy.mjs            contrôle (sortie 1 si écart)
 *   node packages/knowledge/scripts/generer-worker-legacy.mjs --ecrire   regénère le bloc du Worker
 *
 * POURQUOI CE SCRIPT EXISTE. Deux listes vivaient côte à côte : les tables de
 * `packages/ui/public/_worker.js` et `packages/ui/public/_redirects`. Rien ne les confrontait, et
 * `_routes.json` décidait silencieusement laquelle gagne — le Worker voit la requête en premier,
 * `_redirects` n'est appliqué qu'aux chemins servis par la liaison ASSETS.
 *
 * MESURÉ le 28/08/2026 : sur 73 règles de `_redirects`, 54 étaient DÉMENTIES par la surface
 * réelle — 46 servies en 410 Gone, 8 redirigées vers une cible générique — et 53 d'entre elles
 * promettaient une page vivante ET indexable. Autrement dit, 53 anciennes URL du site v1 dont
 * l'équivalent existe perdaient leur autorité de lien, sans que rien ne le dise.
 *
 * Arbitrage du propriétaire (28/08/2026) : 301 partout où un équivalent pertinent existe ; 410
 * seulement à défaut, et alors avec une justification écrite. `legacy-urls-registre.json` porte
 * cette décision, entrée par entrée. Ce script en DÉRIVE le bloc du Worker — il n'y a donc plus
 * deux listes à tenir d'accord, il y en a une et une copie générée.
 *
 * Il contrôle aussi `_redirects` : aucune de ses règles ne doit tomber dans le périmètre du
 * Worker. Une règle qui y tombe est une promesse que la plateforme ne tiendra jamais.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { surfaceDe } from "../../../porte-sceller-routage.mjs";

const RACINE = join(fileURLToPath(import.meta.url), "..", "..", "..", "..");
const REGISTRE = join(RACINE, "legacy-urls-registre.json");
const WORKER = join(RACINE, "packages", "ui", "public", "_worker.js");
const REDIRECTS = join(RACINE, "packages", "ui", "public", "_redirects");
const ROUTES = join(RACINE, "packages", "ui", "public", "_routes.json");
const DEBUT = "// >>> LEGACY-DATA-START";
const FIN = "// <<< LEGACY-DATA-END";

/** Le bloc de code que le registre dicte — la seule chose qui s'écrit dans le Worker. */
export function blocDepuisRegistre(registre) {
  const red = registre.entrees.filter((e) => e.type === "redirect");
  const gone = registre.entrees.filter((e) => e.type === "gone");
  const l = [];
  l.push(DEBUT);
  l.push("// GÉNÉRÉ depuis legacy-urls-registre.json par packages/knowledge/scripts/generer-worker-legacy.mjs.");
  l.push("// Ne pas éditer à la main : le registre porte la décision et son motif, ce bloc n'en est que la copie.");
  l.push(`const LEGACY_REDIRECTS = new Map([`);
  for (const e of red) l.push(`  [${JSON.stringify(e.source)}, ${JSON.stringify(e.cible)}],`);
  l.push(`]);`);
  l.push(`const GONE_EXACT = new Set([`);
  for (const e of gone) l.push(`  ${JSON.stringify(e.source)},`);
  l.push(`]);`);
  l.push(`const GONE_PREFIXES = [${registre.prefixes_gone.map((p) => JSON.stringify(p.prefixe)).join(", ")}];`);
  l.push(`const REDIRECT_PREFIXES = new Map([`);
  for (const p of registre.prefixes_redirect) l.push(`  [${JSON.stringify(p.prefixe)}, ${JSON.stringify(p.cible)}],`);
  l.push(`]);`);
  l.push(`const BREED_ALIAS = new Map([`);
  for (const a of registre.breed_alias) l.push(`  [${JSON.stringify(a.v1)}, ${JSON.stringify(a.v2)}],`);
  l.push(`]);`);
  l.push(FIN);
  return l.join("\n");
}

/** Les règles de `_redirects` qui tombent dans le périmètre du Worker — donc sans effet. */
export function reglesEnOmbre(texteRedirects, routes) {
  const ombres = [];
  for (const brute of texteRedirects.split("\n")) {
    const ligne = brute.trim();
    if (!ligne || ligne.startsWith("#")) continue;
    const [source, cible, statut] = ligne.split(/\s+/);
    if (surfaceDe(source, routes) === "worker") ombres.push({ source, cible, statut: Number(statut ?? 302) });
  }
  return ombres;
}

/* ---- CLI ------------------------------------------------------------------------------------ */
const estCli = process.argv[1]?.endsWith("generer-worker-legacy.mjs");
if (estCli) {
  const ECRIRE = process.argv.includes("--ecrire");
  const registre = JSON.parse(readFileSync(REGISTRE, "utf8"));
  const worker = readFileSync(WORKER, "utf8");
  const bloc = blocDepuisRegistre(registre);

  const i = worker.indexOf(DEBUT), j = worker.indexOf(FIN);
  if (i < 0 || j < 0) {
    console.error(`[legacy] marqueurs ${DEBUT} / ${FIN} introuvables dans _worker.js — le bloc généré n'a plus d'emplacement`);
    process.exit(1);
  }
  const actuel = worker.slice(i, j + FIN.length);

  const problemes = [];
  if (actuel !== bloc) problemes.push("les tables du Worker ne sont plus celles que le registre dicte");
  const ombres = reglesEnOmbre(readFileSync(REDIRECTS, "utf8"), JSON.parse(readFileSync(ROUTES, "utf8")));
  for (const o of ombres) {
    problemes.push(`_redirects : « ${o.source} → ${o.cible} » tombe dans le périmètre du Worker — la plateforme ne l'appliquera JAMAIS ; sa place est au registre`);
  }

  if (ECRIRE) {
    if (actuel !== bloc) {
      writeFileSync(WORKER, worker.slice(0, i) + bloc + worker.slice(j + FIN.length));
      console.error(`[legacy] tables du Worker RÉGÉNÉRÉES depuis le registre : ${registre.entrees.filter((e) => e.type === "redirect").length} redirections, ${registre.entrees.filter((e) => e.type === "gone").length} disparitions, ${registre.prefixes_gone.length} préfixes 410, ${registre.prefixes_redirect.length} préfixe(s) 301, ${registre.breed_alias.length} alias de race`);
    } else console.error("[legacy] tables déjà conformes au registre — rien à réécrire");
    if (ombres.length) {
      console.error(`[legacy] ${ombres.length} règle(s) de _redirects restent en OMBRE derrière le Worker — à porter au registre ou à retirer :`);
      for (const o of ombres.slice(0, 5)) console.error(`  · ${o.source} → ${o.cible}`);
      process.exit(1);
    }
    process.exit(0);
  }

  if (problemes.length) {
    for (const p of problemes.slice(0, 8)) console.error(`  ÉCART ${p}`);
    if (problemes.length > 8) console.error(`  … et ${problemes.length - 8} autres`);
    console.error(`[legacy] ÉCHEC — ${problemes.length} écart(s) entre le registre canonique et les fichiers de routage. « --ecrire » regénère les tables ; les règles en ombre se corrigent à la main, au registre.`);
    process.exit(1);
  }
  console.error(`[legacy] registre tenu : ${registre.entrees.length} anciennes URL, tables du Worker conformes, aucune règle de _redirects en ombre`);
}
