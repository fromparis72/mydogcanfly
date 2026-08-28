#!/usr/bin/env node
/**
 * LES CONTRE-ÉPREUVES DU CONTRAT DES ANCIENNES URL.
 *
 *   node test-legacy-urls.mjs --dist=<dist scellé de production>
 *
 * Chacune mute une COPIE du registre ou des tables servies, exécute le MÊME vérificateur que la
 * porte — jamais une réimplémentation —, et exige qu'il rougisse pour SA cause. Les sept
 * mutations sont celles que la contre-revue du 28/08/2026 exige, plus la garde d'effectif.
 *
 * Les mutations qui touchent le Worker écrivent une copie du dist dans un répertoire temporaire :
 * l'artefact scellé n'est jamais modifié, et le module Worker est réimporté par une URL unique.
 */
import { readFileSync, writeFileSync, mkdtempSync, cpSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { verifierLegacy, verifierAucuneRegleHorsRegistre, FICHIER_REGISTRE } from "./porte-legacy.mjs";
import { lireRoutage, surfaceDe } from "./porte-sceller-routage.mjs";

const DIST = process.argv.slice(2).find((a) => a.startsWith("--dist="))?.slice(7);
if (!DIST) { console.error("[legacy] usage : node test-legacy-urls.mjs --dist=<dist scellé>"); process.exit(2); }

let defauts = 0;
const echec = (nom, detail) => { defauts++; console.error(`  ✗ ${nom} — ${detail}`); };
const ok = (nom) => console.log(`  ✓ ${nom}`);

const REGISTRE = JSON.parse(readFileSync(FICHIER_REGISTRE, "utf8"));
const DOMAINE = "https://mydogcanfly.com";

/* Les ensembles que la porte passe au vérificateur — calculés une fois, comme elle. */
const urlsSitemaps = new Set();
for (const l of ["en", "fr", "es", "pt"]) {
  for (const m of readFileSync(join(DIST, `sitemap-${l}.xml`), "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)) urlsSitemaps.add(m[1]);
}
const contexte = { urlsSitemaps, pagesNoindex: new Set(), domaine: DOMAINE, racinePages: DIST };

/** Une copie jetable du dist, pour les mutations qui touchent les tables servies. */
function surCopie(muter) {
  const tmp = mkdtempSync(join(tmpdir(), "legacy-"));
  try {
    for (const f of ["_worker.js", "_routes.json", "_redirects"]) cpSync(join(DIST, f), join(tmp, f));
    for (const l of ["en", "fr", "es", "pt"]) cpSync(join(DIST, `sitemap-${l}.xml`), join(tmp, `sitemap-${l}.xml`));
    const w = readFileSync(join(tmp, "_worker.js"), "utf8");
    const mute = muter(w);
    if (mute === w) return { erreur: "la mutation ne s'applique pas (ancre introuvable) — elle ne prouverait rien" };
    writeFileSync(join(tmp, "_worker.js"), mute);
    return { dist: tmp, nettoyer: () => rmSync(tmp, { recursive: true, force: true }) };
  } catch (e) { rmSync(tmp, { recursive: true, force: true }); throw e; }
}

/** Mute le Worker, rejoue LE vérificateur, exige le rouge et le diagnostic attendu. */
async function contreEpreuve(nom, muter, attendu, { surRegistre = null } = {}) {
  const c = surCopie(muter);
  if (c.erreur) { echec(nom, c.erreur); return; }
  try {
    /* La cible du dist muté n'existe pas toujours : on juge sur les écarts, pas sur le dist. */
    const registre = surRegistre ? surRegistre(JSON.parse(JSON.stringify(REGISTRE))) : REGISTRE;
    const ecarts = [
      ...await verifierLegacy(c.dist, registre, { ...contexte, pagesNoindex: new Set() }),
      ...verifierAucuneRegleHorsRegistre(c.dist, registre, lireRoutage(c.dist).familles),
    ];
    if (!ecarts.length) { echec(nom, "le vérificateur est resté VERT sous la mutation"); return; }
    const manquants = [attendu].flat().filter((a) => !ecarts.some((e) => e.includes(a)));
    if (manquants.length) { echec(nom, `rouge, mais pour un AUTRE diagnostic — attendu « ${manquants[0] }» ; vu :\n      ${ecarts.slice(0, 2).join("\n      ")}`); return; }
    ok(nom);
  } finally { c.nettoyer(); }
}

/* ---- Ligne de départ : l'artefact tient le registre ------------------------------------------ */
{
  const ecarts = [
    ...await verifierLegacy(DIST, REGISTRE, contexte),
    ...verifierAucuneRegleHorsRegistre(DIST, REGISTRE, lireRoutage(DIST).familles),
  ];
  if (ecarts.length) {
    for (const e of ecarts.slice(0, 6)) console.error(`  ✗ départ — ${e}`);
    console.error(`\n[legacy] ÉCHEC — l'artefact ne tient pas le registre (${ecarts.length} écart(s)) : les mutations ne prouveraient rien.`);
    process.exit(1);
  }
  ok(`départ : ${REGISTRE.entrees.length} anciennes URL servies exactement comme le registre les décide`);
}

const UNE_REDIRECTION = REGISTRE.entrees.find((e) => e.type === "redirect" && e.source === "/best-dog-cooling-mats/") ?? REGISTRE.entrees.find((e) => e.type === "redirect");
const UNE_DISPARITION = REGISTRE.entrees.find((e) => e.type === "gone");

/* 1 — une redirection remplacée par un 410. */
await contreEpreuve("1 redirection retombée en 410",
  (w) => w.replace(`  ["${UNE_REDIRECTION.source}", "${UNE_REDIRECTION.cible}"],\n`, "")
          .replace("const GONE_EXACT = new Set([", `const GONE_EXACT = new Set([\n  "${UNE_REDIRECTION.source}",`),
  [UNE_REDIRECTION.source, "attendu 301"]);

/* 2 — une cible précise remplacée par « / ». */
await contreEpreuve("2 cible précise remplacée par la racine",
  (w) => w.replace(`["${UNE_REDIRECTION.source}", "${UNE_REDIRECTION.cible}"]`, `["${UNE_REDIRECTION.source}", "/"]`),
  [UNE_REDIRECTION.source, "au lieu de"]);

/* 3 — une règle présente seulement dans _redirects, interceptée par le Worker. C'est le défaut
      d'origine : elle ne doit plus pouvoir se reformer en silence. */
{
  const routes = JSON.parse(readFileSync(join(DIST, "_routes.json"), "utf8"));
  const source = "/best-dog-cooling-mats/";
  if (surfaceDe(source, routes) !== "worker") echec("3 règle en ombre", `${source} n'est plus dans le périmètre du Worker — la mutation ne prouverait rien`);
  else {
    const c = surCopie((w) => w.replace(`  ["${source}", "${UNE_REDIRECTION.cible}"],\n`, ""));
    if (c.erreur) echec("3 règle en ombre", c.erreur);
    else try {
      writeFileSync(join(c.dist, "_redirects"), `${source} ${UNE_REDIRECTION.cible} 301\n`);
      const ecarts = await verifierLegacy(c.dist, REGISTRE, contexte);
      if (ecarts.some((e) => e.includes(source) && e.includes("attendu 301"))) {
        ok("3 une règle laissée à _redirects mais interceptée par le Worker est vue — elle ne s'applique pas");
      } else echec("3 règle en ombre", `non détectée ; vu : ${ecarts.slice(0, 2).join(" | ") || "(aucun écart)"}`);
    } finally { c.nettoyer(); }
  }
}

/* 4 — une entrée retirée À EFFECTIF CONSTANT : une autre la remplace, les décomptes ne bougent pas. */
await contreEpreuve("4 entrée troquée à effectif constant",
  (w) => w.replace(`["${UNE_REDIRECTION.source}", "${UNE_REDIRECTION.cible}"]`, `["/url-qui-na-jamais-existe/", "${UNE_REDIRECTION.cible}"]`),
  ["que le registre canonique ne décide pas", "le Worker ne la sert pas"]);

/* 5 — une cible morte : la page n'existe pas dans le dist. */
await contreEpreuve("5 cible morte",
  (w) => w.replace(`["${UNE_REDIRECTION.source}", "${UNE_REDIRECTION.cible}"]`, `["${UNE_REDIRECTION.source}", "/travel-hub/page-qui-nexiste-pas/"]`),
  [UNE_REDIRECTION.source, "au lieu de"]);

/* 5 bis — une cible ABSENTE DES SITEMAPS, servie et vivante : le lien est perdu à moitié. */
{
  const registreMute = JSON.parse(JSON.stringify(REGISTRE));
  const e = registreMute.entrees.find((x) => x.source === UNE_REDIRECTION.source);
  e.cible = "/button-lab.html";
  const c = surCopie((w) => w.replace(`["${UNE_REDIRECTION.source}", "${UNE_REDIRECTION.cible}"]`, `["${UNE_REDIRECTION.source}", "/button-lab.html"]`));
  if (c.erreur) echec("5bis cible hors sitemap", c.erreur);
  else try {
    const ecarts = await verifierLegacy(c.dist, registreMute, contexte);
    if (ecarts.some((x) => x.includes("annoncée par aucun sitemap"))) ok("5bis une cible vivante mais absente des sitemaps est vue");
    else echec("5bis cible hors sitemap", `non détectée ; vu : ${ecarts.slice(0, 2).join(" | ") || "(aucun écart)"}`);
  } finally { c.nettoyer(); }
}

/* 5 ter — une cible NOINDEX : rediriger vers une page qu'on interdit aux moteurs. */
{
  /* Aucune mutation du Worker ici : c est l ensemble des pages noindex qu on fait mentir,
     et le vérificateur doit le voir sur l artefact intact. */
  const rel = (UNE_REDIRECTION.cible.endsWith("/") ? UNE_REDIRECTION.cible + "index.html" : UNE_REDIRECTION.cible + ".html");
  const ecarts = await verifierLegacy(DIST, REGISTRE, { ...contexte, pagesNoindex: new Set([rel]) });
  if (ecarts.some((e) => e.includes("porte noindex"))) ok("5ter une cible noindex est vue — le lien serait perdu deux fois");
  else echec("5ter cible noindex", `non détectée ; vu : ${ecarts.slice(0, 2).join(" | ") || "(aucun écart)"}`);
}

/* 6 — une disparition transformée SILENCIEUSEMENT en redirection. */
await contreEpreuve("6 disparition transformée en 301",
  (w) => w.replace(`  "${UNE_DISPARITION.source}",\n`, "")
          .replace("const LEGACY_REDIRECTS = new Map([", `const LEGACY_REDIRECTS = new Map([\n  ["${UNE_DISPARITION.source}", "/travel-hub/"],`),
  [UNE_DISPARITION.source, "attendu 410"]);

/* 7 — la query string perdue. */
await contreEpreuve("7 query string perdue",
  (w) => w.replace("Location: target + url.search,", "Location: target,"),
  ["la query string est perdue"]);

/* 8 — garde d'effectif : le vérificateur ne peut pas être vert faute d'avoir tourné. */
{
  const vide = { entrees: [], prefixes_gone: [], prefixes_redirect: [], breed_alias: [] };
  const ecarts = await verifierLegacy(DIST, vide, contexte);
  const horsRegistre = verifierAucuneRegleHorsRegistre(DIST, vide, lireRoutage(DIST).familles);
  if (horsRegistre.length) ok(`8 un registre VIDE ne rend pas l'artefact conforme — ${horsRegistre.length} règles servies sans décision`);
  else echec("8 garde d'effectif", "un registre vide laisse le contrôle vert");
}

if (defauts) { console.error(`\n[legacy] ÉCHEC — ${defauts} contre-épreuve(s) en défaut`); process.exit(1); }
console.log(`\n[legacy] le contrat des anciennes URL a été vu rougir pour chacune de ses causes.`);
