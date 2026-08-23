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
import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, statSync, renameSync, rmSync } from "node:fs";
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
  /* TÉLÉCHARGEMENT EN DEUX TEMPS, ET C'EST LA CORRECTION LA PLUS IMPORTANTE DE CE SCRIPT.
   *
   * Il écrivait DIRECTEMENT dans le fichier de destination. Un téléchargement interrompu, un
   * disque plein, un redimensionnement échoué : l'erreur était bien consignée dans `echecs`,
   * mais le fichier partiel RESTAIT SUR PLACE. Or la phase de réécriture qui suit ne vérifie
   * que l'EXISTENCE du fichier — elle repointait donc les quatre langues vers une image cassée,
   * et le compte rendu annonçait l'échec dans la même seconde. Un fichier à moitié écrit qu'on
   * publie est pire qu'un fichier absent : le second se voit, le premier se sert.
   *
   * On télécharge donc à côté, on valide, et on ne renomme qu'en cas de succès — un renommage
   * dans le même dossier est atomique. Le `finally` efface le temporaire quoi qu'il arrive. */
  const temp = `${out}.part`;
  try {
    /* `-f` fait échouer curl sur un code HTTP d'erreur au lieu d'écrire la page d'erreur
     * dans le fichier — sans ça on se retrouve avec des « images » de 2 Ko illisibles. */
    execFileSync("curl", ["-fsSL", "--max-time", "45", "-o", temp, url], { stdio: "pipe" });
    if (!existsSync(temp)) throw new Error("curl n'a produit aucun fichier");
    if (statSync(temp).size < 8000) throw new Error(`fichier suspect (${statSync(temp).size} octets)`);
    if (SIPS) execFileSync("sips", ["-Z", "1600", temp], { stdio: "pipe" });
    else if (MAGICK) execFileSync(dispo("magick") ? "magick" : "convert", [temp, "-resize", "1600x>", "-quality", "82", temp], { stdio: "pipe" });
    /* Second contrôle APRÈS redimensionnement : un outil peut sortir en 0 et laisser un fichier
       tronqué, et c'est le fichier final qui compte, pas celui d'avant. */
    if (statSync(temp).size < 8000) throw new Error(`fichier suspect après redimensionnement (${statSync(temp).size} octets)`);
    renameSync(temp, out);
    console.log(`${Math.round(statSync(out).size / 1024)} Ko`);
    ok.push(key);
  } catch (e) {
    console.log("échec");
    echecs.push(`${key} : ${e.message.split("\n")[0]}`);
  } finally {
    if (existsSync(temp)) rmSync(temp, { force: true });
  }
}

/* RÉÉCRITURE DES QUATRE LANGUES, et seulement pour les photos RÉELLEMENT VALIDÉES.
 *
 * Le commentaire disait « des deux langues » : faux depuis que le lot 2 a créé `es` et `pt`.
 * Et la condition portait sur l'EXISTENCE du fichier, ce qui suffisait à repointer un guide vers
 * une image cassée restée sur le disque. On n'accepte plus que les clés sorties VALIDÉES de la
 * boucle ci-dessus — celles téléchargées à l'instant, plus celles déjà présentes avant le
 * lancement. Une clé en échec ne fait bouger AUCUN front matter. */
const validees = new Set([...ok, ...deja]);
let reecrits = 0;
if (!dry) for (const dir of LANGUES) {
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".md"))) {
    const p = join(dir, f);
    const t = readFileSync(p, "utf-8");
    const key = champ(t, "key");
    if (!key || !validees.has(key) || !existsSync(join(DEST, `${key}.jpg`))) continue;
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
