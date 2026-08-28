#!/usr/bin/env node
/**
 * PORTE DE LANCEMENT SEO/GEO — un exécutable, deux verdicts, zéro déduction.
 * Conception contre-revue en six versions (DOSSIER-PORTE-LANCEMENT.md, feu vert Codex sur v6).
 *
 *   node porte-lancement.mjs --dist=packages/ui/dist --attendu=production [--sha=<sha>]
 *   node porte-lancement.mjs --dist=packages/ui/dist --attendu=preview   [--sha=<sha>]
 *
 * La porte JUGE UN ARTEFACT, hors ligne, et rien d'autre :
 *   · elle REFUSE tout dist sans carte de provenance valide, construit d'un arbre sale, ou —
 *     si --sha est donné — d'un autre commit que celui demandé (le déployeur donne toujours --sha) ;
 *   · elle ne lit JAMAIS les sources du dépôt : ses attentes sont VERSIONNÉES
 *     (porte-noindex-admis.json, porte-routage-scelle.json, porte-redirects-exemples.json)
 *     et le reste vient du dist lui-même ;
 *   · tout écart est nommé (page, contrôle, valeur vue/attendue) ; la sortie est 0 ou 1,
 *     jamais un avertissement — une porte qui « signale » sans bloquer n'est pas une porte.
 *
 * Ce qu'elle ne conclut PAS : les en-têtes réellement SERVIS (Transform Rules, couche réseau).
 * L'autorité finale est la réponse HTTP de la production — c'est le contre-test exhaustif de
 * deployer-production.mjs, jamais un contrôle hors ligne.
 */
import { readFileSync, readdirSync, statSync, existsSync, realpathSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join, resolve } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { verifierProvenance } from "./packages/knowledge/scripts/lib/provenance.mjs";
import { lireRoutage, comparerAuScelle, FICHIER_SCELLE } from "./porte-sceller-routage.mjs";

const DOMAINE = "https://mydogcanfly.com";
const LANGUES = ["en", "fr", "es", "pt"];
/** L'attribut <html lang> par langue de chemin — mesuré : le portugais se déclare pt-BR. */
const LANG_HTML = { en: "en", fr: "fr", es: "es", pt: "pt-BR" };
const SITEMAPS_ENFANTS = LANGUES.map((l) => `sitemap-${l}.xml`);
/** Les types JSON-LD que le site émet SCIEMMENT (mesurés sur le build production de 5b8257e).
 *  Un type nouveau est un choix éditorial : il s'ajoute ici, dans la même PR, revu. */
const TYPES_JSONLD_ADMIS = new Set(["Organization", "WebSite", "WebPage", "Person", "FAQPage", "BreadcrumbList", "Article"]);
/** L'adresse retirée par arbitrage (lot F) : nommée, en recouvrement assumé avec sa garde. */
const ADRESSE_RETIREE = "/tools/is-it-too-hot-for-my-dog/";
/** Échantillon GEO versionné : une entité par gabarit, dans les quatre langues. */
const ECHANTILLON_GEO = [
  { chemin: "airlines/air-france/", nom: "Air France", source: { en: "· confidence", fr: "· confiance", es: "· confianza", pt: "· confiança" } },
  { chemin: "countries/fr/", nom: { en: "France", fr: "France", es: "Francia", pt: "França" }, source: null },
  { chemin: "breeds/pug/", nom: { en: "Pug", fr: "Carlin", es: "Carlino", pt: "Pug" }, source: null },
];
const SENTINEL_API_BASE = "https://00000000-mydogcanfly-api-preview.fromparis.workers.dev";

/* ---- CLI ------------------------------------------------------------------------------------ */
const args = process.argv.slice(2);
const lireArg = (nom) => { const a = args.find((x) => x.startsWith(`--${nom}=`)); return a ? a.slice(nom.length + 3) : null; };
const DIST = lireArg("dist") ?? "packages/ui/dist";
const ATTENDU = lireArg("attendu");
const SHA_DEMANDE = lireArg("sha");
const inconnus = args.filter((a) => !/^--(dist|attendu|sha)=/.test(a));
if (inconnus.length || !["production", "preview"].includes(ATTENDU ?? "")) {
  console.error(`[porte] usage : node porte-lancement.mjs --dist=<dossier> --attendu=production|preview [--sha=<sha>]`);
  if (inconnus.length) console.error(`[porte] argument(s) non reconnu(s) : ${inconnus.join(", ")}`);
  process.exit(2);
}

let defauts = 0;
const echec = (ctrl, detail) => { defauts++; console.error(`  ✗ ${ctrl} — ${detail}`); };
const ok = (ctrl) => console.log(`  ✓ ${ctrl}`);
const note = (m) => console.log(`  · ${m}`);

/* ---- 0. La provenance d'abord : sans carte valide, RIEN ne se juge --------------------------- */
{
  const ecarts = verifierProvenance(DIST, "complet");
  if (ecarts.length) {
    for (const e of ecarts) echec("0 provenance", e);
    console.error(`\n[porte] REFUS — l'artefact n'a pas de provenance valide (${ecarts.length} écart(s)). Rien d'autre n'est jugé.`);
    process.exit(1);
  }
}
const PROV = JSON.parse(readFileSync(join(DIST, ".provenance.json"), "utf8"));
if (!PROV.entrees_propres) { /* redite délibérée : ceinture ET bretelles sur le point le plus grave */
  echec("0 provenance", "construit depuis un arbre SALE — cet artefact ne correspond à aucun commit");
}
if (SHA_DEMANDE && PROV.sha !== SHA_DEMANDE) {
  echec("0 provenance", `SHA de la carte ${PROV.sha.slice(0, 12)}… ≠ SHA demandé ${SHA_DEMANDE.slice(0, 12)}… — un ancien dist cohérent n'est pas le dist demandé`);
}
{
  const siteEnv = PROV.parametres?.PUBLIC_SITE_ENV ?? "";
  if (ATTENDU === "production" && siteEnv !== "production") {
    echec("0 provenance", `--attendu=production mais la carte dit PUBLIC_SITE_ENV=« ${siteEnv || "(absent)"} » — cet artefact n'est pas un build production`);
  }
  if (ATTENDU === "preview" && siteEnv === "production") {
    echec("0 provenance", "--attendu=preview mais la carte dit PUBLIC_SITE_ENV=production — les deux verdicts ne peuvent pas être verts sur le même artefact");
  }
}
if (defauts) { console.error(`\n[porte] REFUS — provenance incohérente avec le mode demandé.`); process.exit(1); }
ok(`0 provenance : carte valide, arbre propre, SHA ${PROV.sha.slice(0, 12)}…, PUBLIC_SITE_ENV=${PROV.parametres.PUBLIC_SITE_ENV}`);

/* ---- Lecture unique des pages ---------------------------------------------------------------- */
const pages = []; // { rel: "/x/index.html", texte }
{
  const marcher = (d) => {
    for (const n of readdirSync(d)) {
      const c = join(d, n); const s = statSync(c);
      if (s.isDirectory()) marcher(c);
      else if (n.endsWith(".html")) pages.push({ rel: c.slice(resolve(DIST).length).replaceAll("\\", "/"), chemin: c });
    }
  };
  marcher(resolve(DIST));
}
const texteDe = new Map();
const lirePage = (rel) => {
  if (!texteDe.has(rel)) texteDe.set(rel, readFileSync(join(DIST, rel), "utf8"));
  return texteDe.get(rel);
};
const metaRobots = (t) => t.match(/<meta name="robots" content="([^"]*)"/)?.[1] ?? null;
const relVersUrl = (rel) => DOMAINE + rel.replace(/index\.html$/, "").replace(/\.html$/, "");
const urlVersRel = (url) => {
  const p = url.replace(DOMAINE, "");
  return p.endsWith("/") ? `${p}index.html` : `${p}.html`;
};

/* ============================== MODE PREVIEW : V1–V3 ========================================= */
if (ATTENDU === "preview") {
  /* V1 — chaque page porte noindex, nofollow. */
  {
    const fuites = pages.filter((p) => metaRobots(lirePage(p.rel)) !== "noindex, nofollow");
    if (fuites.length) for (const p of fuites.slice(0, 10)) echec("V1 noindex global", `${p.rel} : robots=« ${metaRobots(lirePage(p.rel)) ?? "(absent)"} » ≠ « noindex, nofollow »${fuites.length > 10 ? ` (+${fuites.length - 10} autres)` : ""}`);
    else ok(`V1 les ${pages.length} pages portent « noindex, nofollow »`);
  }
  /* V2 — le robots N'EMPÊCHE PAS la lecture du noindex : pas de « Disallow: / ». */
  {
    const robots = join(DIST, "robots.txt");
    if (!existsSync(robots)) echec("V2 robots.txt", "absent du build");
    else {
      const t = readFileSync(robots, "utf8");
      if (/^\s*Disallow:\s*\/\s*$/m.test(t)) echec("V2 robots.txt", "« Disallow: / » présent — Google ne pourrait pas LIRE le noindex des pages (Search Central, block-indexing)");
      else ok("V2 robots.txt de préversion : aucun « Disallow: / », le noindex reste lisible");
    }
  }
  /* V3 — aucune ligne Sitemap : une préversion n'annonce rien. */
  {
    const robots = join(DIST, "robots.txt");
    if (existsSync(robots) && /^\s*Sitemap:/mi.test(readFileSync(robots, "utf8"))) {
      echec("V3 robots.txt", "une ligne « Sitemap: » annonce la préversion aux moteurs");
    } else ok("V3 robots.txt de préversion : aucune ligne Sitemap");
  }
  conclure();
}

/* ============================== MODE PRODUCTION : P1–P10, G1–G4 ============================== */

/* ---- P1 — indexabilité : le noindex du dist ↔ la liste admise, dans les deux sens ----------- */
const admis = JSON.parse(readFileSync("porte-noindex-admis.json", "utf8")).motifs
  .map((m) => ({ ...m, re: new RegExp(m.motif), vues: 0 }));
const pagesNoindex = new Set(); // rel des pages noindex — sert aussi à P3
{
  const horsListe = [], sansNoindex = [];
  for (const p of pages) {
    const robots = metaRobots(lirePage(p.rel));
    const noidx = robots !== null && /noindex/.test(robots);
    const motif = admis.find((m) => m.re.test(p.rel));
    if (noidx) {
      pagesNoindex.add(p.rel);
      if (motif) motif.vues++;
      else horsListe.push(`${p.rel} (robots=« ${robots} »)`);
    } else if (motif && !motif.conditionnel) {
      /* Un motif CONDITIONNEL (noindex piloté par les données, ex. aéroports) admet des pages
         indexables sous son chemin : le partage n'est pas figé ici — P3 garde l'invariant
         « noindex ⇔ hors sitemap », et les données bougent par leurs registres. */
      sansNoindex.push(`${p.rel} correspond au motif admis « ${motif.motif} » mais n'est PAS noindex`);
    }
  }
  for (const x of horsListe.slice(0, 10)) echec("P1 noindex hors liste", x + (horsListe.length > 10 ? ` (+${horsListe.length - 10})` : ""));
  for (const x of sansNoindex.slice(0, 10)) echec("P1 motif sans noindex", x);
  for (const m of admis) if (m.vues === 0) echec("P1 motif mort", `« ${m.motif} » ne correspond à aucune page noindex — liste morte = liste fausse`);
  if (!horsListe.length && !sansNoindex.length && admis.every((m) => m.vues > 0)) {
    ok(`P1 indexabilité : ${pagesNoindex.size} pages noindex, toutes admises ; ${admis.length} motifs, tous vivants`);
  }
  const headers = join(DIST, "_headers");
  if (existsSync(headers) && /x-robots-tag[^\n]*noindex/i.test(readFileSync(headers, "utf8"))) {
    echec("P1 _headers", "un X-Robots-Tag: noindex vit dans _headers — la surface publique en serait désindexée");
  }
  note("P1 conclut sur l'ARTEFACT seulement — les en-têtes réellement servis relèvent du contre-test HTTP du déployeur");
}
const pagesIndexables = pages.filter((p) => !pagesNoindex.has(p.rel));

/* ---- P2 — robots.txt de production ----------------------------------------------------------- */
{
  const robots = join(DIST, "robots.txt");
  if (!existsSync(robots)) echec("P2 robots.txt", "absent du build");
  else {
    const t = readFileSync(robots, "utf8");
    const lignes = t.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
    const attendu = ["User-agent: *", "Allow: /", "Disallow: /lab/", `Sitemap: ${DOMAINE}/sitemap.xml`];
    const manque = attendu.filter((l) => !lignes.includes(l));
    const enTrop = lignes.filter((l) => !attendu.includes(l));
    for (const l of manque) echec("P2 robots.txt", `ligne attendue absente : « ${l} »`);
    for (const l of enTrop) echec("P2 robots.txt", `ligne inattendue : « ${l} »${/^Disallow:\s*\/\s*$/.test(l) ? " — le défaut classique du lancement raté" : ""}`);
    if (!manque.length && !enTrop.length) ok("P2 robots.txt : ouvert, /lab/ interdit, sitemap déclaré, rien d'autre");
  }
}

/* ---- P3 — sitemaps exacts, ÉGALITÉ D'ENSEMBLES dans les deux sens (v6) ----------------------- */
const urlsSitemaps = new Set();
{
  const index = join(DIST, "sitemap.xml");
  if (!existsSync(index)) echec("P3 sitemaps", "sitemap.xml absent");
  else {
    const locs = [...readFileSync(index, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
    const attendus = SITEMAPS_ENFANTS.map((f) => `${DOMAINE}/${f}`);
    if (JSON.stringify([...locs].sort()) !== JSON.stringify([...attendus].sort())) {
      echec("P3 index", `l'index liste [${locs.join(", ")}] et non exactement les 4 sitemaps de langue`);
    }
    const doublons = [];
    for (const f of SITEMAPS_ENFANTS) {
      const chemin = join(DIST, f);
      if (!existsSync(chemin)) { echec("P3 sitemaps", `${f} absent du dist`); continue; }
      for (const m of readFileSync(chemin, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)) {
        if (urlsSitemaps.has(m[1])) doublons.push(`${m[1]} (revu dans ${f})`);
        urlsSitemaps.add(m[1]);
      }
    }
    for (const d of doublons.slice(0, 10)) echec("P3 doublon", d);

    const urlsAttendues = new Set(pagesIndexables.map((p) => relVersUrl(p.rel)));
    const manquantes = [...urlsAttendues].filter((u) => !urlsSitemaps.has(u));
    const surnumeraires = [...urlsSitemaps].filter((u) => !urlsAttendues.has(u));
    for (const u of manquantes.slice(0, 10)) echec("P3 page hors sitemap", `${u} est publique et indexable mais n'est listée par aucun sitemap${manquantes.length > 10 ? ` (+${manquantes.length - 10})` : ""}`);
    for (const u of surnumeraires.slice(0, 10)) {
      const rel = urlVersRel(u);
      const raison = !u.startsWith(DOMAINE) ? "hors du domaine de production"
        : pagesNoindex.has(rel) ? "pointe une page noindex"
        : "aucune page construite ne lui correspond";
      echec("P3 URL surnuméraire", `${u} — ${raison}${surnumeraires.length > 10 ? ` (+${surnumeraires.length - 10})` : ""}`);
    }
    if ([...urlsSitemaps].some((u) => u.includes(ADRESSE_RETIREE))) echec("P3 adresse retirée", `${ADRESSE_RETIREE} figure dans un sitemap — retirée par arbitrage (lot F)`);
    if (!doublons.length && !manquantes.length && !surnumeraires.length) {
      ok(`P3 sitemaps : ${urlsSitemaps.size} URL = exactement les ${urlsAttendues.size} pages publiques indexables, sans doublon`);
    }
  }
}

/* ---- P4 — canoniques ------------------------------------------------------------------------- */
{
  let defsAvant = defauts;
  for (const p of pagesIndexables) {
    const t = lirePage(p.rel);
    const canons = [...t.matchAll(/<link rel="canonical" href="([^"]+)"/g)].map((m) => m[1]);
    if (canons.length !== 1) { echec("P4 canonique", `${p.rel} : ${canons.length} canonique(s), attendu exactement 1`); continue; }
    const c = canons[0];
    if (!c.startsWith(DOMAINE + "/") && c !== DOMAINE + "/") { echec("P4 canonique", `${p.rel} → « ${c} » : hors du domaine de production${/pages\.dev|workers\.dev|localhost/.test(c) ? " (hôte de PRÉVERSION)" : ""}`); continue; }
    const cibleRel = urlVersRel(c);
    if (!existsSync(join(DIST, cibleRel))) echec("P4 canonique", `${p.rel} → ${c} : la cible n'existe pas dans le dist`);
    else if (pagesNoindex.has(cibleRel)) echec("P4 canonique", `${p.rel} → ${c} : la cible est noindex — recommander une page qu'on interdit`);
  }
  if (defauts === defsAvant) ok(`P4 canoniques : ${pagesIndexables.length} pages, une canonique absolue de production chacune, cibles vivantes`);
}

/* ---- P5 — hreflang réciproques, PAR CALCUL --------------------------------------------------- */
{
  let defsAvant = defauts;
  const altsDe = new Map(); // rel -> Map(lang -> url)
  for (const p of pagesIndexables) {
    const t = lirePage(p.rel);
    const alts = new Map([...t.matchAll(/<link rel="alternate" hreflang="([^"]+)" href="([^"]+)"/g)].map((m) => [m[1], m[2]]));
    altsDe.set(p.rel, alts);
  }
  for (const p of pagesIndexables) {
    const alts = altsDe.get(p.rel);
    const langs = [...alts.keys()].filter((l) => l !== "x-default").sort();
    if (!alts.size) { echec("P5 hreflang", `${p.rel} : page indexable sans aucun alternate`); continue; }
    if (JSON.stringify(langs) !== JSON.stringify([...LANGUES].sort())) {
      echec("P5 hreflang", `${p.rel} : langues [${langs.join(",")}] ≠ [${LANGUES.join(",")}]`); continue;
    }
    if (!alts.has("x-default")) echec("P5 hreflang", `${p.rel} : x-default absent`);
    else if (alts.get("x-default") !== alts.get("en")) echec("P5 hreflang", `${p.rel} : x-default (${alts.get("x-default")}) ≠ alternate en (${alts.get("en")})`);
    for (const [lang, url] of alts) {
      if (lang === "x-default") continue;
      const cibleRel = urlVersRel(url);
      if (!existsSync(join(DIST, cibleRel))) { echec("P5 hreflang", `${p.rel} : alternate ${lang} → ${url}, cible absente du dist`); continue; }
      const langHtml = lirePage(cibleRel).match(/<html[^>]*\slang="([^"]+)"/)?.[1];
      if (langHtml !== LANG_HTML[lang]) echec("P5 hreflang", `${p.rel} : alternate ${lang} → ${url}, mais la cible déclare lang="${langHtml}" (attendu ${LANG_HTML[lang]})`);
      const retour = altsDe.get(cibleRel);
      const mienne = relVersUrl(p.rel);
      const maLang = p.rel.match(/^\/(fr|es|pt)\//)?.[1] ?? "en";
      if (retour && retour.get(maLang) !== mienne) {
        echec("P5 réciprocité", `${p.rel} annonce ${lang}→${url}, mais ${cibleRel} n'annonce pas ${maLang}→${mienne} en retour`);
      }
    }
  }
  if (defauts === defsAvant) ok(`P5 hreflang : ${pagesIndexables.length} pages, quadrilingue + x-default, réciprocité vérifiée par calcul`);
}

/* ---- P6 — cohérence de tête ------------------------------------------------------------------ */
{
  let defsAvant = defauts;
  for (const p of pagesIndexables) {
    const t = lirePage(p.rel);
    const titre = t.match(/<title>([^<]*)<\/title>/)?.[1]?.trim();
    const desc = t.match(/<meta name="description" content="([^"]*)"/)?.[1]?.trim();
    const lang = t.match(/<html[^>]*\slang="([^"]+)"/)?.[1];
    const langChemin = p.rel.match(/^\/(fr|es|pt)\//)?.[1] ?? "en";
    if (!titre) echec("P6 tête", `${p.rel} : <title> vide ou absent`);
    if (!desc) echec("P6 tête", `${p.rel} : meta description vide ou absente`);
    if (lang !== LANG_HTML[langChemin]) echec("P6 tête", `${p.rel} : <html lang="${lang}"> mais le chemin dit « ${langChemin} » (attendu ${LANG_HTML[langChemin]})`);
  }
  if (defauts === defsAvant) ok(`P6 têtes : title, description et lang cohérents sur les ${pagesIndexables.length} pages indexables`);
}

/* ---- P7 — _redirects : statiques analysées, dynamiques prouvées par exemples ----------------- */
{
  let defsAvant = defauts;
  const texte = readFileSync(join(DIST, "_redirects"), "utf8");
  const regles = [];
  for (const brute of texte.split("\n")) {
    const l = brute.trim();
    if (!l || l.startsWith("#")) continue;
    const [source, cible, statut] = l.split(/\s+/);
    regles.push({ source, cible, statut: Number(statut ?? 302) });
  }
  const sources = new Set(regles.map((r) => r.source));
  const exemples = JSON.parse(readFileSync("porte-redirects-exemples.json", "utf8")).exemples;
  for (const r of regles) {
    if (![301, 302, 303, 307, 308].includes(r.statut)) echec("P7 statut", `${r.source} → statut ${r.statut} hors {301,302,303,307,308}`);
    if (r.source === r.cible) echec("P7 boucle", `${r.source} → lui-même`);
    const dynamique = r.source.includes("*");
    if (!dynamique) {
      const cibleSansFragment = r.cible.split("#")[0] || "/";
      if (sources.has(r.cible)) echec("P7 chaîne", `${r.source} → ${r.cible}, qui est lui-même source d'une règle (A→B→C interdit)`);
      const rel = cibleSansFragment.endsWith("/") ? `${cibleSansFragment}index.html` : `${cibleSansFragment}.html`;
      if (!existsSync(join(DIST, rel))) echec("P7 cible morte", `${r.source} → ${r.cible} : aucune page construite`);
    } else {
      const prefixe = r.source.slice(0, r.source.indexOf("*"));
      if (r.cible.startsWith(prefixe)) echec("P7 boucle symbolique", `${r.source} → ${r.cible} retombe dans son propre motif`);
      for (const autre of regles) {
        if (autre !== r && autre.source.includes("*") && r.cible.startsWith(autre.source.slice(0, autre.source.indexOf("*")))) {
          echec("P7 chaîne symbolique", `${r.source} → ${r.cible} retombe dans le motif source de ${autre.source}`);
        }
      }
      const ex = exemples.filter((e) => e.regle === r.source);
      if (!ex.length) { echec("P7 exemple", `règle dynamique ${r.source} sans exemple versionné — règle non prouvable = règle non prouvée`); continue; }
      for (const e of ex) {
        if (!e.source.startsWith(prefixe)) { echec("P7 exemple", `${e.source} ne correspond pas au motif ${r.source}`); continue; }
        const splat = e.source.slice(prefixe.length); /* le :splat garde sa barre finale */
        const resolue = r.cible.replace(":splat", splat);
        if (resolue !== e.cible) { echec("P7 exemple", `${e.source} : résolution ${resolue} ≠ cible attendue ${e.cible}`); continue; }
        const rel = e.cible.endsWith("/") ? `${e.cible}index.html` : `${e.cible}.html`;
        if (!existsSync(join(DIST, rel))) echec("P7 exemple", `${e.source} → ${e.cible} : la cible concrète n'existe pas dans le dist`);
      }
    }
  }
  if (defauts === defsAvant) ok(`P7 _redirects : ${regles.length} règles saines (statuts, boucles, chaînes, cibles), dynamiques prouvées par exemples`);
}

/* ---- P7 bis — le routage EFFECTIF de l'artefact, contre le registre scellé ------------------- */
{
  let defsAvant = defauts;
  const scelle = JSON.parse(readFileSync(FICHIER_SCELLE, "utf8"));
  for (const e of comparerAuScelle(DIST, scelle)) echec("P7bis registre", e);

  /* Le routage reproduit : périmètre _routes.json + VRAI _worker.js du dist, importé via une
     URL ESM UNIQUE — sans quoi le cache de modules ferait juger une ancienne copie (v6, P1). */
  const routes = JSON.parse(readFileSync(join(DIST, "_routes.json"), "utf8"));
  const toRe = (r) => new RegExp("^" + r.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
  const inc = routes.include.map(toRe), exc = routes.exclude.map(toRe);
  const passeParLeWorker = (p) => inc.some((r) => r.test(p)) && !exc.some((r) => r.test(p));
  const worker = (await import(pathToFileURL(resolve(join(DIST, "_worker.js"))).href + `?porte=${Date.now()}`)).default;
  const env = { ASSETS: { fetch: async () => new Response("__ASSET__", { status: 200 }) } };
  const sonder = async (p) => {
    if (!passeParLeWorker(p)) return { status: 200, via: "static" };
    const res = await worker.fetch(new Request(DOMAINE + p), env);
    return { status: res.status, via: "worker", loc: res.headers.get("Location") };
  };

  /* Toutes les URL des sitemaps enfants passent par le routage : jamais 301/410. */
  let sondees = 0;
  for (const u of urlsSitemaps) {
    const p = u.replace(DOMAINE, "") || "/";
    const r = await sonder(p);
    sondees++;
    if (r.status !== 200) echec("P7bis sitemap", `${p} → ${r.status}${r.loc ? " " + r.loc : ""} via ${r.via} — une URL de sitemap doit répondre 200`);
  }
  /* Chaque redirection scellée répond, et sa cible est construite ET vivante. */
  for (const { source, cible } of scelle.familles.legacy_redirects) {
    const r = await sonder(source);
    if (r.status !== 301 || r.loc !== cible) { echec("P7bis legacy", `${source} → attendu 301 ${cible}, vu ${r.status}${r.loc ? " " + r.loc : ""}`); continue; }
    const rel = cible.endsWith("/") ? `${cible}index.html` : `${cible}.html`;
    if (!existsSync(join(DIST, rel))) { echec("P7bis cible", `${source} → ${cible} : cible absente du dist`); continue; }
    const rc = await sonder(cible);
    if (rc.status !== 200) echec("P7bis cible", `${source} → ${cible} : la cible répond ${rc.status} au routage`);
  }
  for (const { source } of scelle.familles.gone_exact) {
    const r = await sonder(source);
    if (r.status !== 410) echec("P7bis gone", `${source} → attendu 410, vu ${r.status}${r.loc ? " " + r.loc : ""}`);
  }
  if (defauts === defsAvant) {
    ok(`P7bis routage : registre scellé tenu ; ${sondees} URL de sitemaps en 200 ; ${scelle.familles.legacy_redirects.length} redirections et ${scelle.familles.gone_exact.length} disparitions exercées sur le VRAI Worker du dist`);
  }
}

/* ---- P8 — JSON-LD : parse, types admis, FAQ ⊆ texte visible ---------------------------------- */
{
  let defsAvant = defauts;
  /* « Texte visible », défini (conception v3) : on retire script (donc le JSON-LD lui-même),
     style, template, noscript et svg (icônes aria-hidden), plus les éléments feuilles portant
     hidden/aria-hidden ; puis balises ôtées, NFKC, blancs réduits, casse pliée, guillemets
     droits. L'appartenance se juge en sous-chaîne des formes normalisées. */
  const normaliser = (s) => s.normalize("NFKC").replace(/[’‘]/g, "'").replace(/[“”]/g, '"')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&").replace(/&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ").trim().toLowerCase();
  const texteVisible = (html) => normaliser(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<template[\s\S]*?<\/template>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<(\w+)[^>]*(?:aria-hidden="true"|\shidden(?=[\s>]))[^>]*>[^<]*<\/\1>/gi, " ")
      .replace(/<[^>]+>/g, " "));
  let nBlocs = 0, nFaq = 0;
  for (const p of pages) {
    const t = lirePage(p.rel);
    let visible = null;
    for (const m of t.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
      nBlocs++;
      let bloc;
      try { bloc = JSON.parse(m[1]); } catch (e) { echec("P8 parse", `${p.rel} : bloc JSON-LD illisible — ${e.message}`); continue; }
      for (const objet of Array.isArray(bloc) ? bloc : [bloc]) {
        for (const type of [objet["@type"]].flat()) {
          if (!TYPES_JSONLD_ADMIS.has(type)) echec("P8 type", `${p.rel} : @type « ${type} » hors de la liste des types émis sciemment`);
        }
        if ([objet["@type"]].flat().includes("FAQPage")) {
          nFaq++;
          visible ??= texteVisible(t);
          for (const q of objet.mainEntity ?? []) {
            const question = normaliser(q.name ?? "");
            const reponse = normaliser(q.acceptedAnswer?.text?.replace(/<[^>]+>/g, " ") ?? "");
            if (question && !visible.includes(question)) echec("P8 FAQ invisible", `${p.rel} : la question « ${(q.name ?? "").slice(0, 60)}… » n'existe pas dans le texte visible`);
            if (reponse && !visible.includes(reponse)) echec("P8 FAQ invisible", `${p.rel} : la réponse de « ${(q.name ?? "").slice(0, 50)}… » n'existe pas dans le texte visible`);
          }
        }
      }
    }
  }
  if (defauts === defsAvant) ok(`P8 JSON-LD : ${nBlocs} blocs parsés, types admis, ${nFaq} FAQPage dont chaque question et réponse vit dans le texte visible`);
}

/* ---- P9 — liens internes et audit : EXÉCUTÉS, pas supposés ----------------------------------- */
{
  const reel = realpathSync(resolve("packages/ui/dist"));
  if (realpathSync(resolve(DIST)) !== reel) {
    note("P9 non exécuté sur cette copie (chemin ≠ packages/ui/dist) : audit et liens lisent le dist canonique — portés par l'exécution sur l'artefact réel");
  } else {
    for (const [nom, script] of [["audit", "audit"], ["liens", "test:liens"]]) {
      const r = spawnSync("npm", ["run", script], { stdio: ["ignore", "pipe", "pipe"] });
      if (r.status !== 0) echec(`P9 ${nom}`, `« npm run ${script} » sort en ${r.status} :\n${(r.stderr + r.stdout).toString().split("\n").slice(-6).join("\n")}`);
      else ok(`P9 ${nom} : exécuté sur ce dist, sortie 0`);
    }
  }
}

/* ---- P10 — le bundle appelle la bonne API ---------------------------------------------------- */
{
  const apiBase = PROV.parametres.PUBLIC_API_BASE ?? "";
  const assets = [];
  const marcher = (d) => { for (const n of readdirSync(d)) { const c = join(d, n); const s = statSync(c); if (s.isDirectory()) marcher(c); else if (n.endsWith(".js")) assets.push(c); } };
  const astroDir = join(DIST, "_astro");
  if (existsSync(astroDir)) marcher(astroDir);
  const hotes = new Set();
  for (const a of assets) {
    for (const m of readFileSync(a, "utf8").matchAll(/https?:\/\/([a-z0-9.-]*(?:workers\.dev|localhost)[a-z0-9.-]*)/gi)) hotes.add(m[1]);
  }
  if (apiBase === "") {
    if (hotes.size) echec("P10 bundle", `PUBLIC_API_BASE vide (same-origin) mais le bundle porte : ${[...hotes].join(", ")}`);
    else ok("P10 bundle : same-origin — aucun hôte workers.dev/localhost dans les assets ; artefact DÉPLOYABLE");
  } else if (apiBase === SENTINEL_API_BASE) {
    const autres = [...hotes].filter((h) => !SENTINEL_API_BASE.includes(h));
    if (autres.length) echec("P10 bundle", `sentinelle CI attendue seule, mais aussi : ${autres.join(", ")}`);
    else ok("P10 bundle : sentinelle CI épinglée, aucun autre hôte — artefact de JUGEMENT, jamais déployable");
  } else {
    echec("P10 bundle", `PUBLIC_API_BASE=« ${apiBase} » : un artefact PRODUCTION n'admet que same-origin (vide) ou la sentinelle CI`);
  }
}

/* ---- G1–G3 — GEO sobre, sur l'échantillon versionné (G4 = P8, G5 = clause d'absence) --------- */
{
  let defsAvant = defauts;
  for (const e of ECHANTILLON_GEO) {
    for (const lang of LANGUES) {
      const rel = `/${lang === "en" ? "" : lang + "/"}${e.chemin}index.html`;
      if (!existsSync(join(DIST, rel))) { echec("G1 échantillon", `${rel} absent du dist`); continue; }
      const t = lirePage(rel);
      const nom = typeof e.nom === "string" ? e.nom : e.nom[lang];
      const h1 = t.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]?.replace(/<[^>]+>/g, "") ?? "";
      const titre = t.match(/<title>([^<]*)<\/title>/)?.[1] ?? "";
      if (!h1.includes(nom)) echec("G3 entité", `${rel} : « ${nom} » absent du <h1> (« ${h1.slice(0, 60)} »)`);
      if (!titre.includes(nom)) echec("G3 entité", `${rel} : « ${nom} » absent du <title>`);
      if (e.source && !t.includes(e.source[lang])) echec("G2 sources", `${rel} : le bloc source (« ${e.source[lang]} ») n'est pas rendu dans le HTML`);
    }
  }
  if (defauts === defsAvant) ok(`G1–G3 : l'échantillon versionné (${ECHANTILLON_GEO.length} entités × 4 langues) rend ses réponses, ses sources et ses entités dans le HTML servi`);
  note("G4 = P8 (FAQ visible) · G5 = clause d'absence : la porte n'exige aucune densité, aucun mot-clé, aucun texte additionnel");
}

conclure();

function conclure() {
  if (defauts) {
    console.error(`\n[porte] ROUGE — ${defauts} défaut(s) en mode ${ATTENDU}. Aucun déploiement.`);
    process.exit(1);
  }
  console.log(`\n[porte] VERTE en mode ${ATTENDU} — artefact ${PROV.sha.slice(0, 12)}…, ${pages.length} pages jugées.`);
  process.exit(0);
}
