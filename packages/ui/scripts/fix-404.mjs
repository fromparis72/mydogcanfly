#!/usr/bin/env node
// Retest 09/08/2026 : Cloudflare Pages sert une 404 par répertoire en remontant l'arborescence
// jusqu'à trouver un fichier nommé littéralement 404.html (voir le commentaire en tête de
// src/components/NotFoundPage.astro pour le contexte complet du correctif). Astro ne
// spécialise en fichier plat (dist/404.html) QUE la racine src/pages/404.astro ; les pages
// imbriquées (src/pages/fr/404.astro, es/, pt/) sortent en dist/<loc>/404/index.html — un
// format que Cloudflare ignore pour cette recherche précise. Ce script copie chaque sortie
// vers l'emplacement plat attendu, après le build normal.
import { existsSync, copyFileSync } from "node:fs";
import { join } from "node:path";

const outDir = process.env.OUTDIR || "dist";
let missing = false;
for (const loc of ["fr", "es", "pt"]) {
  const src = join(outDir, loc, "404", "index.html");
  const dest = join(outDir, loc, "404.html");
  if (!existsSync(src)) {
    console.error(`[fix-404] introuvable : ${src} — le build a-t-il bien produit cette page ?`);
    missing = true;
    continue;
  }
  copyFileSync(src, dest);
  console.log(`[fix-404] ${dest}`);
}
if (missing) process.exitCode = 1;
