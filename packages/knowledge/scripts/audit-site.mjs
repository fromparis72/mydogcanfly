#!/usr/bin/env node
/* Audit de cohérence du site construit — à lancer sur dist/ avant chaque déploiement.
 *
 *   node packages/knowledge/scripts/audit-site.mjs [chemin-dist]
 *
 * Chaque contrôle correspond à un défaut réellement rencontré en production, pas à une
 * bonne pratique théorique. L'ordre suit la gravité : ce qui casse un parcours d'abord,
 * ce qui gêne le référencement ensuite.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { resolve, join } from "node:path";

const DIST = resolve(process.argv[2] ?? "packages/ui/dist");
if (!existsSync(DIST)) { console.error(`dist introuvable : ${DIST}`); process.exit(2); }

const html = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) { if (e !== "_astro") walk(p); }
    else if (e.endsWith(".html")) html.push(p);
  }
})(DIST);

const rel = (p) => "/" + p.slice(DIST.length + 1).replace(/index\.html$/, "").replace(/\\/g, "/");
const findings = [];
const add = (sev, check, msg, sample) => findings.push({ sev, check, msg, sample });
const read = (p) => readFileSync(p, "utf8");

// ─── 0. Build complet ? ─────────────────────────────────────────────────────────────
// Un build interrompu laisse un dist partiel : sitemap manquant et pages absentes, ce qui
// fait ensuite hurler tous les autres contrôles pour rien. On le dit franchement et on
// s'arrête, plutôt que de noyer le rapport sous des faux positifs.
{
  const noSitemap = !existsSync(join(DIST, "sitemap.xml"));
  const thin = html.length < 1500;          // le site complet dépasse 1900 pages
  if (noSitemap || thin) {
    console.log(`\n${"─".repeat(60)}`);
    console.log("❌ BUILD INCOMPLET — audit interrompu");
    console.log(`   pages HTML trouvées : ${html.length}` + (thin ? "  (attendu : ~1900+)" : ""));
    if (noSitemap) console.log("   sitemap.xml : absent");
    console.log("\n   Un build interrompu produit un dist partiel. Relancer :");
    console.log("     PUBLIC_SITE_ENV=production npm run build");
    console.log("   puis relancer cet audit.\n");
    process.exit(2);
  }
}

// ─── 1. Les paramètres passés dans le dièse — et le mécanisme qui les lit ────────────
//
// CE CONTRÔLE A ÉTÉ RETOURNÉ LE 19/08/2026, PARCE QU'IL ACCUSAIT LE SITE À TORT.
// Il dénonçait toute adresse « chemin#ancre?cle=valeur » comme un paramètre perdu — le bug des
// 507 pages races. Depuis, `Base.astro` définit `window.mdcfQuery`, qui lit LE DIÈSE D'ABORD et
// `location.search` seulement en repli, et `window.mdcfPut` place délibérément les paramètres
// dans le dièse. La convention est documentée dans env.d.ts, OnwardNav.astro et
// BreedTravelPage.astro. Vérifié : aucune source ne lit `location.search` en direct.
// Le contrôle dénonçait donc 1 656 adresses correctes — la pire faute possible pour un audit.
//
// Ce qui reste vrai, et que ce contrôle protège désormais : ces adresses ne fonctionnent QUE
// parce que le lecteur est là. Une page qui porte de tels liens sans embarquer `mdcfQuery` les
// casserait toutes en silence. C'est cette dépendance qui est vérifiée, plus la convention.
{
  const sansLecteur = [];
  for (const p of html) {
    const b = read(p);
    if (!/href="[^"]*#[^"?]*\?[^"]*"/.test(b)) continue;
    if (!b.includes("mdcfQuery")) sansLecteur.push(rel(p));
  }
  if (sansLecteur.length) add("BLOQUANT", "dièse-sans-lecteur",
    `${sansLecteur.length} page(s) portent des paramètres dans le dièse SANS embarquer mdcfQuery : `
    + "ces liens perdent leur paramètre en silence", sansLecteur.slice(0, 3));
}

// ─── 2. Liens internes morts ────────────────────────────────────────────────────────
{
  const pages = new Set(html.map(rel));
  const assets = new Set();
  (function walk(d, base = "") {
    for (const e of readdirSync(d)) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p, base + "/" + e);
      else assets.add(base + "/" + e);
    }
  })(DIST);
  const dead = new Map(), deadNoindex = new Map();
  for (const p of html) {
    const b = read(p);
    const noindex = /name="robots" content="noindex/.test(b);
    for (const m of b.matchAll(/href="(\/[^"#?]*)/g)) {
      let h = m[1];
      if (h.startsWith("//")) continue;
      // Un href contenant « ${ » est un gabarit JavaScript interpolé à l'exécution, pas un
      // lien : la maquette /lab/roundtrip/ en contient un, signalé à chaque audit depuis des mois.
      if (h.includes("${")) continue;
      const norm = h.endsWith("/") ? h : h + "/";
      if (pages.has(norm) || assets.has(h) || pages.has(h)) continue;
      (noindex ? deadNoindex : dead).set(h, rel(p));
    }
  }
  if (dead.size) add("BLOQUANT", "lien-mort",
    `${dead.size} cible(s) de lien interne inexistante(s) sur des pages publiques`,
    [...dead].slice(0, 4).map(([h, from]) => `${h}  (depuis ${from})`));
  if (deadNoindex.size) add("À VÉRIFIER", "lien-mort-noindex",
    `${deadNoindex.size} lien(s) mort(s) sur des pages noindex (404, lab…) — invisibles de Google, mais à nettoyer`,
    [...deadNoindex].slice(0, 4).map(([h, from]) => `${h}  (depuis ${from})`));
}

// ─── 3. Page 404 réelle ─────────────────────────────────────────────────────────────
if (!existsSync(join(DIST, "404.html")))
  add("BLOQUANT", "404", "Aucun 404.html : toute URL inconnue renverra la page d'accueil en 200 (soft-404)");

// ─── 4. Cohérence des noms de pays entre le titre et le corps ───────────────────────
// (le cas « Türkiye » : le menu dit Turkey, la page dit Türkiye)
{
  // Variante → langues où elle est INATTENDUE. « Cabo Verde » est le nom correct en espagnol ;
  // « Côte d'Ivoire » l'est en français : on ne les signale que là où ils détonnent.
  const suspects = [
    ["Türkiye", ["en", "fr", "es"]], ["Turkiye", ["en", "fr", "es"]],
    ["Côte d'Ivoire", ["en", "es"]], ["Cabo Verde", ["en", "fr"]],
    ["Holland", ["en"]], ["Burma", ["en"]],
  ];
  const hits = [];
  for (const p of html) {
    const r = rel(p);
    const loc = ["fr", "es", "pt"].find((l) => r.startsWith(`/${l}/`)) ?? "en";
    // On n'analyse que le TEXTE rendu : les balises (et donc les URLs des href) sont retirées,
    // sinon un lien source « …/turkiye-pet-import-requirements/ » déclenche un faux positif.
    const body = read(p).replace(/<script[\s\S]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ");
    for (const [s, langs] of suspects) {
      if (!langs.includes(loc) || !body.includes(s)) continue;
      // toléré si présenté comme forme officielle entre parenthèses
      if (new RegExp(`\\((?:officially|oficialmente|officiellement)\\s+${s}`, "i").test(body)) continue;
      hits.push(`${r} [${loc}] → « ${s} »`);
    }
  }
  if (hits.length) add("À VÉRIFIER", "nom-pays",
    `${hits.length} page(s) employant une variante de nom de pays inattendue pour la langue`,
    hits.slice(0, 4));
}

// ─── 5. Métadonnées : longueur et unicité ───────────────────────────────────────────
{
  const titles = new Map(), longT = [], longD = [], noD = [];
  for (const p of html) {
    const b = read(p);
    if (/name="robots" content="noindex/.test(b)) continue;
    // Décoder les entités avant de mesurer : « &#39; » occupe 5 octets dans la source mais
    // un seul caractère à l'écran, et c'est la longueur affichée que Google tronque.
    const ent = (s) => s
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
      .replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
    const t = ent(b.match(/<title>([^<]*)<\/title>/)?.[1] ?? "");
    const d = ent(b.match(/<meta name="description" content="([^"]*)"/)?.[1] ?? "");
    if (t.length > 65) longT.push(`${rel(p)} (${t.length})`);
    if (d.length > 165) longD.push(`${rel(p)} (${d.length})`);
    if (!d) noD.push(rel(p));
    if (t) titles.set(t, (titles.get(t) ?? 0) + 1);
  }
  const dup = [...titles].filter(([, n]) => n > 1);
  if (longT.length) add("SEO", "titre-long", `${longT.length} titre(s) > 65 caractères (tronqués par Google)`, longT.slice(0, 3));
  if (longD.length) add("SEO", "desc-longue", `${longD.length} description(s) > 165 caractères`, longD.slice(0, 3));
  if (noD.length) add("SEO", "desc-absente", `${noD.length} page(s) indexable(s) sans meta description`, noD.slice(0, 3));
  if (dup.length) add("SEO", "titre-doublon", `${dup.length} titre(s) partagé(s) par plusieurs pages`, dup.slice(0, 3).map(([t, n]) => `${n}× « ${t.slice(0, 60)} »`));
}

// ─── 6. JSON-LD parsable, et FAQPage adossé à du contenu visible ────────────────────
{
  const broken = [], ghost = [];
  for (const p of html) {
    const b = read(p);
    for (const m of b.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      let d;
      try { d = JSON.parse(m[1]); } catch { broken.push(rel(p)); continue; }
      const nodes = Array.isArray(d) ? d : [d];
      for (const n of nodes) {
        if (n?.["@type"] !== "FAQPage") continue;
        const q = n.mainEntity?.[0]?.name;
        // la première question doit être visible dans le HTML rendu
        if (q && !b.includes(q.slice(0, 40).replace(/&/g, "&amp;"))) ghost.push(`${rel(p)} → « ${q.slice(0, 50)} »`);
      }
    }
  }
  if (broken.length) add("BLOQUANT", "jsonld", `${broken.length} bloc(s) JSON-LD non parsable(s)`, broken.slice(0, 3));
  if (ghost.length) add("BLOQUANT", "faq-fantome",
    `${ghost.length} FAQPage balisant des questions ABSENTES du contenu visible (pénalisé par Google)`, ghost.slice(0, 3));
}

// ─── 7. Sitemap ↔ pages réelles ─────────────────────────────────────────────────────
{
  // LE SITEMAP EST UN INDEX DEPUIS LE 01/08/2026, et ce contrôle l'ignorait : il prenait les
  // quatre `<loc>` de l'index — les fichiers `sitemap-<lang>.xml` — pour des pages, et déclarait
  // « 4 URL du sitemap sans page correspondante ». Les quatre fichiers existent et pèsent 430 ko
  // chacun. Corrigé le 19/08/2026 : l'index est SUIVI, et son absence de suivi ne peut plus se
  // traduire par une accusation.
  const sm = join(DIST, "sitemap.xml");
  if (!existsSync(sm)) add("SEO", "sitemap", "sitemap.xml absent");
  else {
    const brut = read(sm);
    let sources = [sm];
    if (/<sitemapindex/.test(brut)) {
      const refs = [...brut.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].replace(/^https?:\/\/[^/]+\//, ""));
      const absents = refs.filter((r) => !existsSync(join(DIST, r)));
      if (absents.length) add("BLOQUANT", "sitemap-index",
        `${absents.length} sitemap(s) annoncé(s) par l'index et absent(s) du site`, absents.slice(0, 3));
      sources = refs.filter((r) => existsSync(join(DIST, r))).map((r) => join(DIST, r));
      if (!sources.length) add("BLOQUANT", "sitemap-index", "l'index ne mène à aucun sitemap lisible");
    }
    const urls = sources.flatMap((f) => [...read(f).matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map((m) => m[1].replace(/^https?:\/\/[^/]+/, "")));
    const pages = new Set(html.map(rel));
    const missing = urls.filter((u) => !pages.has(u.endsWith("/") ? u : u + "/"));
    if (missing.length) add("BLOQUANT", "sitemap-404",
      `${missing.length} URL du sitemap sans page correspondante`, missing.slice(0, 3));
    // pages indexables absentes du sitemap
    const inSm = new Set(urls.map((u) => (u.endsWith("/") ? u : u + "/")));
    const orphans = html.filter((p) => !/name="robots" content="noindex/.test(read(p)) && !inSm.has(rel(p)));
    if (orphans.length) add("SEO", "hors-sitemap",
      `${orphans.length} page(s) indexable(s) absente(s) du sitemap`, orphans.slice(0, 3).map(rel));
  }
}

// ─── 8. Canonical et hreflang ───────────────────────────────────────────────────────
{
  const noCanon = [], selfMismatch = [];
  for (const p of html) {
    const b = read(p);
    if (/name="robots" content="noindex/.test(b)) continue;
    const c = b.match(/<link rel="canonical" href="([^"]*)"/)?.[1];
    if (!c) { noCanon.push(rel(p)); continue; }
    const path = c.replace(/^https?:\/\/[^/]+/, "");
    if (path !== rel(p)) selfMismatch.push(`${rel(p)} → ${path}`);
  }
  if (noCanon.length) add("SEO", "canonical", `${noCanon.length} page(s) sans canonical`, noCanon.slice(0, 3));
  if (selfMismatch.length) add("À VÉRIFIER", "canonical-croisé",
    `${selfMismatch.length} canonical pointant ailleurs que la page elle-même`, selfMismatch.slice(0, 3));
}

// ─── 9. Images : attribut alt ───────────────────────────────────────────────────────
{
  let n = 0; const ex = [];
  for (const p of html) {
    for (const m of read(p).matchAll(/<img(?![^>]*\balt=)[^>]*>/g)) {
      n++; if (ex.length < 3) ex.push(`${rel(p)} → ${m[0].slice(0, 70)}`);
    }
  }
  if (n) add("A11Y", "img-alt", `${n} image(s) sans attribut alt`, ex);
}

// ─── Rapport ────────────────────────────────────────────────────────────────────────
const ORDER = ["BLOQUANT", "À VÉRIFIER", "SEO", "A11Y"];
console.log(`\nAudit de ${html.length} pages — ${DIST}\n${"─".repeat(60)}`);
if (!findings.length) console.log("\n✅ Aucune anomalie.\n");
for (const sev of ORDER) {
  const g = findings.filter((f) => f.sev === sev);
  if (!g.length) continue;
  console.log(`\n${sev}`);
  for (const f of g) {
    console.log(`  • [${f.check}] ${f.msg}`);
    for (const s of f.sample ?? []) console.log(`      ${s}`);
  }
}
const blocking = findings.filter((f) => f.sev === "BLOQUANT").length;
console.log(`\n${"─".repeat(60)}`);
console.log(blocking ? `❌ ${blocking} anomalie(s) bloquante(s) — ne pas déployer en l'état.` : "✅ Rien de bloquant.");
process.exit(blocking ? 1 : 0);
