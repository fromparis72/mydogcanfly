#!/usr/bin/env node
/* Rapatrie les photos de couverture des 62 guides — À LANCER SUR VOTRE MACHINE.
 *
 * Pourquoi ce script existe au lieu d'avoir été exécuté. Les outils réseau dont je dispose ne
 * savent pas récupérer un binaire : ils rendent du texte. Les 59 photos sont donc restées en
 * lien direct vers Unsplash, ce qui est précisément le problème à régler — ces URL portent un
 * identifiant de session (`ixid`) et rien ne garantit qu'elles répondront dans six mois.
 *
 * Ce que fait le script :
 *   1. lit `cover.image` dans les 62 guides français ;
 *   2. télécharge chaque photo (curl), la redimensionne à 1600 px de large (sips sur macOS,
 *      ImageMagick sinon) et l'écrit dans `packages/ui/public/travel-hub/<key>.jpg` ;
 *   3. réécrit `cover.image` dans les QUATRE langues pour pointer vers le fichier local.
 *
 * Il est ré-exécutable : une photo déjà présente n'est pas retéléchargée. En cas d'échec sur
 * une URL, le guide concerné GARDE son lien Unsplash — mieux vaut une image fragile qu'une
 * image absente — et le script le signale à la fin.
 *
 * Le crédit au photographe reste dans le front matter : la licence Unsplash l'exige, et
 * héberger la photo chez soi n'y change rien.
 *
 *   cd ~/Documents/GitHub/mydogcanfly && node packages/knowledge/scripts/fetch-guide-covers.mjs
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

/* LES QUATRE LANGUES, et non plus deux. Ce script ne connaissait que `fr` et `en` : il lisait
 * les URL dans le français et repointait `[FR, EN]`. Le lot 2 a créé `es` et `pt` — 144 guides
 * de plus — et le script ne les a pas suivis. Une couverture rapatriée y serait restée pointée
 * sur Unsplash, c'est-à-dire sur l'URL fragile que ce script existe pour supprimer. */
const LANGUES = ["en", "fr", "es", "pt"].map((l) => `packages/ui/src/content/guides/${l}`);
const FR = "packages/ui/src/content/guides/fr";
const DEST = "packages/ui/public/travel-hub";
const dry = process.argv.includes("--dry");

const dispo = (bin) => { try { execFileSync("which", [bin], { stdio: "pipe" }); return true; } catch { return false; } };
const SIPS = dispo("sips"), MAGICK = dispo("magick") || dispo("convert");
if (!dispo("curl")) { console.error("curl est introuvable — arrêt."); process.exit(1); }

const champ = (t, n) => (new RegExp(`^${n}:\\s*"([\\s\\S]*?)"\\s*$`, "m").exec(t) || [])[1] || null;
const coverImage = (t) => (/^cover:\s*\n(?:\s+\w+:.*\n)*?\s+image:\s*"([^"]+)"/m.exec(t) || [])[1] || null;

mkdirSync(DEST, { recursive: true });
const ok = [], echecs = [], deja = [];

/* Une ligne par photo, affichée AVANT le téléchargement. Sans ça l'écran reste vide une à
 * deux minutes et le script passe pour figé — c'est exactement ce qui s'est produit la
 * première fois. Un travail long doit dire où il en est. */
const fichiers = readdirSync(FR).filter((f) => f.endsWith(".md"));
console.log(`${fichiers.length} guides à examiner · outils : curl${SIPS ? " + sips" : MAGICK ? " + ImageMagick" : " (aucun redimensionneur, images gardées telles quelles)"}\n`);
let i = 0;

for (const f of fichiers) {
  const p = join(FR, f);
  const t = readFileSync(p, "utf-8");
  const key = champ(t, "key");
  const url = coverImage(t);
  if (!key || !url || url.startsWith("/")) continue;   // déjà local, ou pas de couverture
  const out = join(DEST, `${key}.jpg`);
  if (existsSync(out)) { deja.push(key); continue; }
  if (dry) { ok.push(key); continue; }
  process.stdout.write(`  [${String(++i).padStart(2)}] ${key.padEnd(38)} `);
  try {
    /* `-f` fait échouer curl sur un code HTTP d'erreur au lieu d'écrire la page d'erreur
     * dans le fichier — sans ça on se retrouve avec des « images » de 2 Ko illisibles. */
    execFileSync("curl", ["-fsSL", "--max-time", "45", "-o", out, url], { stdio: "pipe" });
    if (statSync(out).size < 8000) throw new Error(`fichier suspect (${statSync(out).size} octets)`);
    if (SIPS) execFileSync("sips", ["-Z", "1600", out], { stdio: "pipe" });
    else if (MAGICK) execFileSync(dispo("magick") ? "magick" : "convert", [out, "-resize", "1600x>", "-quality", "82", out], { stdio: "pipe" });
    console.log(`${Math.round(statSync(out).size / 1024)} Ko`);
    ok.push(key);
  } catch (e) {
    console.log("échec");
    echecs.push(`${key} : ${e.message.split("\n")[0]}`);
  }
}

/* Réécriture des deux langues, et seulement pour les photos réellement présentes. */
let reecrits = 0;
if (!dry) for (const dir of LANGUES) {
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
    const p = join(dir, f);
    const t = readFileSync(p, "utf-8");
    const key = champ(t, "key");
    if (!key || !existsSync(join(DEST, `${key}.jpg`))) continue;
    const url = coverImage(t);
    if (!url || url.startsWith("/")) continue;
    writeFileSync(p, t.replace(`image: "${url}"`, `image: "/travel-hub/${key}.jpg"`));
    reecrits++;
  }
}

const poids = existsSync(DEST) ? readdirSync(DEST).reduce((s, f) => s + statSync(join(DEST, f)).size, 0) : 0;
console.log(`${ok.length} photos rapatriées · ${deja.length} déjà présentes · ${echecs.length} échecs`);
console.log(`${reecrits} fichiers Markdown repointés vers /travel-hub/ · ${(poids / 1048576).toFixed(1)} Mo au total`);
if (echecs.length) {
  console.error("\nÉchecs — ces guides gardent leur lien Unsplash :");
  for (const e of echecs) console.error("  " + e);
}
