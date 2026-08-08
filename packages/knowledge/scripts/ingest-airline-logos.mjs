#!/usr/bin/env node
/* Le dossier des logos fait foi : ce script en tire la table que lit le gabarit.
 *
 * LE PROBLÈME QU'IL RÉSOUT. `packages/ui/src/data/airline-logos.generated.json` porte
 * « generated » dans son nom mais était tenu à la main : aucun script ne l'écrivait. Résultat,
 * poser un fichier dans `public/airline-logos/` ne suffisait pas à faire apparaître le logo, et
 * personne ne pouvait le deviner. C'est ainsi que les quatorze compagnies du 8 août 2026 se sont
 * retrouvées à afficher leur monogramme.
 *
 * COMMENT ÇA MARCHE. Le nom du fichier EST la clé : `royal-jordanian.svg` correspond à
 * `airline_royal_jordanian`, parce que c'est exactement ce que produit `slugFor(id)` — la même
 * fonction qui construit l'URL de la page. Un fichier dont le nom ne correspond à aucune
 * compagnie du graphe est signalé, jamais ignoré en silence : c'est presque toujours une faute
 * de frappe dans le nom du fichier.
 *
 * LE DRAPEAU `dark` EST ÉDITORIAL, PAS DÉDUIT. Il vaut « ce logo est blanc, il lui faut un fond
 * bleu nuit pour être visible » — deux compagnies sur soixante-seize dans ce cas. Aucune analyse
 * d'image ne peut trancher ça de façon fiable (un logo peut être clair sans être blanc), donc le
 * script CONSERVE la valeur existante et met `false` pour un nouveau venu. À corriger à l'œil,
 * une fois, si le logo disparaît sur le fond blanc.
 *
 * CE QU'IL NE FAIT PAS : télécharger des logos. Ce sont des marques déposées ; leur reproduction
 * ici relève de l'usage nominatif loyal, ce qui suppose de les obtenir proprement et non de les
 * aspirer. Les fichiers sont fournis à la main, le script ne fait que les recenser.
 *
 *   node packages/knowledge/scripts/ingest-airline-logos.mjs [--dry]
 */
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname, extname, basename } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "..", "..", "..");
const LOGOS = join(ROOT, "packages", "ui", "public", "airline-logos");
const TABLE = join(ROOT, "packages", "ui", "src", "data", "airline-logos.generated.json");
const OBJECTS = join(ROOT, "packages", "knowledge", "raw", "objects.json");
const dry = process.argv.includes("--dry");

/* Mêmes extensions que celles déjà présentes. Le `.webp` est admis d'avance : rien ne s'y oppose
 * côté navigateur et c'est le format le plus léger pour un logo bitmap. */
const OK = new Set([".svg", ".png", ".webp", ".jpg", ".jpeg"]);

const ancien = JSON.parse(readFileSync(TABLE, "utf8"));
const kb = JSON.parse(readFileSync(OBJECTS, "utf8"));

/* slugFor(id) : « airline_royal_jordanian » → « royal-jordanian ». */
const slug = (id) => id.replace(/^airline_/, "").replace(/_/g, "-");
const parSlug = new Map(kb.airlines.map((a) => [slug(a.id), a.id]));

const table = {};
const orphelins = [];

for (const f of readdirSync(LOGOS).sort()) {
  if (!OK.has(extname(f).toLowerCase())) continue;
  const nom = basename(f, extname(f));
  const id = parSlug.get(nom);
  if (!id) { orphelins.push(f); continue; }
  table[id] = { src: `/airline-logos/${f}`, dark: ancien[id]?.dark ?? false };
}

/* Tri par identifiant : le fichier reste lisible et un ajout ne remue pas tout le diff. */
const trie = Object.fromEntries(Object.keys(table).sort().map((k) => [k, table[k]]));
if (!dry) writeFileSync(TABLE, JSON.stringify(trie, null, 2) + "\n");

const total = kb.airlines.length;
const sans = kb.airlines.filter((a) => !trie[a.id]).map((a) => a.name).sort();

console.log(`${Object.keys(trie).length} logo(s) sur ${total} compagnie(s)${dry ? " — essai à blanc" : ""}`);
if (orphelins.length) {
  console.log(`\n⚠ ${orphelins.length} fichier(s) sans compagnie correspondante — nom à corriger :`);
  for (const o of orphelins) console.log("  · " + o);
}
if (sans.length) {
  console.log(`\n${sans.length} compagnie(s) sans logo (le monogramme s'affiche à la place) :`);
  for (const s of sans) console.log("  · " + s);
}
