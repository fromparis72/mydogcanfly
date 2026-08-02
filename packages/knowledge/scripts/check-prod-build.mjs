#!/usr/bin/env node
/* Refuse un `dist` qui n'a pas été construit en mode production.
 *
 * Pourquoi ce garde-fou existe. Le 01/08/2026, un `dist` a été déployé avec un `robots.txt`
 * interdisant tout le site à l'exploration et 95 pages en `noindex`, dont les quatre accueils.
 * La cause : `IS_PRODUCTION` vient de `PUBLIC_SITE_ENV`, et quelques rebuilds partiels avaient
 * été lancés sans cette variable. Or CHAQUE build réémet les pages non shardées et le
 * `robots.txt` — un seul build oublié suffit donc à désindexer le site entier.
 *
 * Le défaut ne se voyait pas : le site s'affichait normalement, les audits existants ne
 * regardaient ni le `robots.txt` ni le `noindex` de l'accueil. Il a fallu un outil externe
 * pour le détecter, après mise en ligne.
 *
 *   node packages/knowledge/scripts/check-prod-build.mjs [dossier]
 *
 * Sortie non nulle si le build est inexploitable : à lancer AVANT tout déploiement.
 */
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIST = process.argv[2] ?? "packages/ui/dist";
const erreurs = [];

/* 1. robots.txt — le plus grave : il conditionne tout le reste. */
const robots = join(DIST, "robots.txt");
if (!existsSync(robots)) erreurs.push("robots.txt absent");
else {
  const r = readFileSync(robots, "utf-8");
  if (/^\s*Disallow:\s*\/\s*$/m.test(r) && !/Allow:\s*\//.test(r))
    erreurs.push("robots.txt interdit tout le site (build de préproduction)");
  if (!/Sitemap:/i.test(r)) erreurs.push("robots.txt ne déclare pas le sitemap");
}

/* 2. Les quatre accueils : une page d'accueil en noindex n'est jamais voulue. */
for (const p of ["", "fr/", "es/", "pt/"]) {
  const f = join(DIST, p, "index.html");
  if (!existsSync(f)) { erreurs.push(`accueil /${p} absent`); continue; }
  if (/name="robots"\s+content="[^"]*noindex/.test(readFileSync(f, "utf-8")))
    erreurs.push(`accueil /${p} en noindex`);
}

/* 3. Les index de familles : mêmes conséquences, moins visibles. */
for (const p of ["", "fr/", "es/", "pt/"])
  for (const fam of ["airlines", "countries", "breeds", "airports"]) {
    const f = join(DIST, p, fam, "index.html");
    if (existsSync(f) && /name="robots"\s+content="[^"]*noindex/.test(readFileSync(f, "utf-8")))
      erreurs.push(`/${p}${fam}/ en noindex`);
  }

if (erreurs.length) {
  console.error(`✗ build NON déployable — ${erreurs.length} problème(s) :`);
  for (const e of erreurs) console.error("   ·", e);
  process.exit(1);
}
console.log("✓ build de production : robots.txt ouvert, accueils et index indexables.");
