#!/usr/bin/env node
/* Fait entrer les 62 guides de lechienvoyageur dans MyDogCanFly, en français et en anglais.
 *
 * (À ne pas confondre avec `ingest-guides.mjs`, qui est antérieur et sans rapport : celui-là
 *  compile les guides du Hub rédigés à la main vers `guides.json`.)
 *
 * Contexte. lechienvoyageur.com était la version française du site v1 : 149 articles, dont
 * 87 doublent déjà des fiches MyDogCanFly (pays, compagnies, comparateur) et n'ont donc rien
 * à faire ici — elles seront redirigées. Restent 62 guides pratiques, sans équivalent : ce
 * sont eux, et eux seuls, qui deviennent le Travel Hub. La liste est arbitrée dans
 * INVENTAIRE-LECHIENVOYAGEUR.md ; ce script ne la recalcule pas, il la lit.
 *
 * L'anglais n'a pas à être traduit : il dort déjà dans `content/posts/`, et chaque fichier y
 * porte un champ `frUrl` qui désigne son jumeau français. 149 couples, zéro orphelin — vérifié
 * avant d'écrire quoi que ce soit. L'appariement n'est donc jamais deviné.
 *
 * Deux partis pris qui se paient plus tard si on les prend à l'envers :
 *
 *   · Chaque langue GARDE son slug d'origine — `camping-avec-chien` en français,
 *     `camping-with-a-dog` en anglais. La redirection depuis l'ancien site reste ainsi
 *     exactement 1 pour 1, et l'URL conserve son mot-clé dans la langue du lecteur. Le lien
 *     entre les deux versions passe par `key`, jamais par le slug.
 *   · Le `{{< enbref >}}` remonte dans le front matter au lieu de rester du texte. C'est un
 *     résumé structuré, pas un paragraphe : le laisser dans le corps interdirait de le
 *     réutiliser ailleurs et le figerait en haut de page.
 *
 *   node packages/knowledge/scripts/import-travel-hub.mjs [--dry]
 */
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ZIP_FR = "/tmp/lcv/content/posts";
const EN_DIR = "content/posts";
const OUT = "packages/ui/src/content/guides";
const LISTE_B = "/tmp/ing/liste-b.txt";
const dry = process.argv.includes("--dry");

/* ------------------------------------------------------------------ front matter */

function decoupe(src) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/.exec(src);
  if (!m) throw new Error("front matter introuvable");
  return { fm: m[1], corps: m[2] };
}

/* Un mini-lecteur plutôt que js-yaml : le front matter Hugo porte des dates non quotées que
 * js-yaml convertit en objets Date, et on ne veut relire que ce qu'on va réécrire. */
const champ = (fm, nom) => {
  const m = new RegExp(`^${nom}:\\s*(.*)$`, "m").exec(fm);
  if (!m) return null;
  return m[1].trim().replace(/^"(.*)"$/s, "$1").replace(/^'(.*)'$/s, "$1") || null;
};
const liste = (fm, nom) => {
  const m = new RegExp(`^${nom}:\\s*\\[(.*)\\]\\s*$`, "m").exec(fm);
  return m ? m[1].split(",").map((s) => s.trim().replace(/^"(.*)"$/, "$1")).filter(Boolean) : [];
};
function faq(fm) {
  const bloc = /^faq:\s*\n([\s\S]*?)(?=^\S|$(?![\s\S]))/m.exec(fm);
  if (!bloc) return [];
  const out = [];
  for (const m of bloc[1].matchAll(/-\s*q:\s*"([\s\S]*?)"\s*\n\s*a:\s*"([\s\S]*?)"\s*(?=\n\s*-\s*q:|\n*$)/g))
    out.push({ q: m[1], a: m[2] });
  return out;
}
function cover(fm) {
  const b = /^cover:\s*\n([\s\S]*?)(?=^\S|$(?![\s\S]))/m.exec(fm);
  if (!b) return null;
  const g = (n) => (new RegExp(`${n}:\\s*"([\\s\\S]*?)"`).exec(b[1]) || [])[1] || null;
  return { image: g("image"), alt: g("alt"), credit: g("caption") };
}

/* ------------------------------------------------------------------ shortcodes */

/** Markdown en ligne → HTML. Gras et liens seulement : c'est tout ce qu'on rencontre. */
const enligne = (s) =>
  s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
   .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

function extraitEnbref(corps) {
  const m = /\{\{<\s*enbref\s*>\}\}([\s\S]*?)\{\{<\s*\/enbref\s*>\}\}/.exec(corps);
  if (!m) return { corps, enbref: [] };
  const puces = m[1].split("\n").map((l) => l.replace(/^\s*[-*]\s*/, "").trim()).filter(Boolean);
  return { corps: corps.replace(m[0], "").trim(), enbref: puces };
}

function shortcodes(corps) {
  let c = corps;
  /* `meta` et `faq` étaient des marqueurs de position pour Hugo. Le gabarit Astro place la
   * signature en tête et la FAQ en fin d'article : les marqueurs n'ont plus d'objet. */
  c = c.replace(/\{\{<\s*meta[^>]*>\}\}/g, "").replace(/\{\{<\s*faq\s*>\}\}/g, "");
  /* `outils` insérait un encart. Le gabarit rend déjà les outils liés en pied d'article ;
   * conserver le marqueur afficherait deux fois le même bloc. */
  c = c.replace(/\{\{<\s*outils\s*>\}\}/g, "");
  /* `alerte` porte un `type` qui change la couleur ET le sens — « obligatoire » n'est pas
   * « attention ». On le garde en classe plutôt que de l'aplatir en encadré neutre. */
  c = c.replace(/\{\{<\s*alerte\s+type="([^"]+)"\s*>\}\}([\s\S]*?)\{\{<\s*\/alerte\s*>\}\}/g,
    (_, type, inner) => `<aside class="gd-alerte gd-alerte--${type}">${enligne(inner.trim())}</aside>`);
  /* `etapes` : une marche à suivre numérotée. Le HTML est écrit ici, liens déjà convertis —
   * à l'intérieur d'un bloc HTML, le Markdown n'est plus interprété. */
  c = c.replace(/\{\{<\s*etapes\s*>\}\}([\s\S]*?)\{\{<\s*\/etapes\s*>\}\}/g, (_, inner) => {
    const items = inner.split("\n").map((l) => l.replace(/^\s*\d+\.\s*/, "").trim()).filter(Boolean);
    return `<ol class="gd-etapes">${items.map((i) => `<li>${enligne(i)}</li>`).join("")}</ol>`;
  });
  /* Filet : un shortcode inconnu qui survit doit faire échouer le script, pas se publier. */
  return { corps: c.replace(/\n{3,}/g, "\n\n").trim(), reste: c.match(/\{\{<[^>]*>\}\}/g) ?? [] };
}

/* ------------------------------------------------------------------ écriture */

const q = (s) => `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;

function ecris(dir, slug, m, corps) {
  const l = ["---", `key: ${q(m.key)}`, `title: ${q(m.title)}`];
  if (m.seoTitle) l.push(`seoTitle: ${q(m.seoTitle)}`);
  l.push(`description: ${q(m.description)}`);
  if (m.summary) l.push(`summary: ${q(m.summary)}`);
  l.push(`date: ${q(m.date)}`, `lastmod: ${q(m.lastmod || m.date)}`);
  if (m.author) l.push(`author: ${q(m.author)}`);
  if (m.categories.length) l.push(`categories: [${m.categories.map(q).join(", ")}]`);
  if (m.tags.length) l.push(`tags: [${m.tags.map(q).join(", ")}]`);
  /* L'URL d'origine : elle sert à fabriquer les 301 sans réinventer la correspondance. */
  l.push(`sourceUrl: ${q(m.sourceUrl)}`);
  if (m.enbref.length) { l.push("enbref:"); for (const p of m.enbref) l.push(`  - ${q(p)}`); }
  if (m.cover?.image) {
    l.push("cover:", `  image: ${q(m.cover.image)}`);
    if (m.cover.alt) l.push(`  alt: ${q(m.cover.alt)}`);
    if (m.cover.credit) l.push(`  credit: ${q(m.cover.credit)}`);
  }
  if (m.faq.length) { l.push("faq:"); for (const { q: a, a: b } of m.faq) { l.push(`  - q: ${q(a)}`, `    a: ${q(b)}`); } }
  l.push("---", "", corps, "");
  if (!dry) { mkdirSync(dir, { recursive: true }); writeFileSync(join(dir, `${slug}.md`), l.join("\n")); }
}

/* ------------------------------------------------------------------ marche */

const bSlugs = readFileSync(LISTE_B, "utf-8").split("\n").map((s) => s.trim()).filter(Boolean);

/** frUrl → fichier anglais, reconstruit depuis `content/posts`. */
const parFr = new Map();
for (const f of readdirSync(EN_DIR).filter((f) => f.endsWith(".md"))) {
  const m = /^frUrl:\s*"?\/([^"/\s]+)\/?"?\s*$/m.exec(readFileSync(join(EN_DIR, f), "utf-8"));
  if (m) parFr.set(m[1], f);
}

let nFr = 0, nEn = 0;
const sansEn = [], residus = [];
for (const slug of bSlugs) {
  const fEn = parFr.get(slug);
  if (!fEn) { sansEn.push(slug); continue; }
  /* La clé stable est le slug anglais : ASCII, sans accent, et il ne bougera plus. */
  const key = fEn.slice(0, -3);

  for (const [langue, src, sortie, nom, url] of [
    ["fr", readFileSync(join(ZIP_FR, `${slug}.md`), "utf-8"), join(OUT, "fr"), slug, `/${slug}/`],
    ["en", readFileSync(join(EN_DIR, fEn), "utf-8"), join(OUT, "en"), key, null],
  ]) {
    const { fm, corps } = decoupe(src);
    const e = extraitEnbref(corps);
    const s = shortcodes(e.corps);
    if (s.reste.length) residus.push(`${langue}/${nom} → ${s.reste.join(" ")}`);
    ecris(sortie, nom, {
      key, title: champ(fm, "title"), seoTitle: champ(fm, "seoTitle"),
      description: champ(fm, "description"), summary: champ(fm, "summary"),
      date: champ(fm, "date"), lastmod: champ(fm, "lastmod"), author: champ(fm, "author"),
      categories: liste(fm, "categories"), tags: liste(fm, "tags"),
      sourceUrl: url ?? (champ(fm, "url") || `/${nom}/`),
      enbref: e.enbref, cover: cover(fm), faq: faq(fm),
    }, s.corps);
    if (langue === "fr") nFr++; else nEn++;
  }
}

console.log(`${nFr} guides français · ${nEn} guides anglais écrits${dry ? " — essai à blanc" : ""}`);
if (sansEn.length) console.error(`⚠ sans jumeau anglais : ${sansEn.join(", ")}`);
if (residus.length) { console.error(`⚠ shortcodes non convertis :\n  ${residus.join("\n  ")}`); process.exit(1); }
