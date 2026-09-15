#!/usr/bin/env node
/* Refuse de laisser partir un site que Google ne pourra pas indexer.
 *
 * L'INCIDENT DU 5 AOÛT 2026. Le site est resté plusieurs jours en ligne avec
 * « robots.txt : Disallow: / » et « noindex, nofollow » sur chacune de ses 2 776 pages. La Search
 * Console a cessé de lire les sitemaps, et l'ensemble du site est devenu invisible.
 *
 * LA CAUSE N'ÉTAIT PAS UN BOGUE. `src/lib/env.ts` bloque l'indexation par défaut, délibérément :
 * tout ce qui n'est pas explicitement « production » est traité comme un aperçu, pour qu'un
 * déploiement d'essai ne fuite jamais dans les résultats de recherche. C'est la bonne décision.
 * Elle a un revers : OUBLIER la variable ne produit aucune erreur, aucun avertissement, aucune
 * page cassée. Le build réussit, le déploiement réussit, le site s'affiche normalement. Seul
 * Google voit la différence, et il met des jours à le dire.
 *
 * D'OÙ CE GARDE-FOU. Une commande de build correcte est une consigne ; une consigne s'oublie.
 * Ce script transforme la consigne en vérification : il lit ce qui a RÉELLEMENT été construit et
 * sort en erreur si le site est fermé aux moteurs. À lancer entre le build et le déploiement.
 *
 *   node packages/knowledge/scripts/verifier-indexation.mjs
 *   → code de sortie 0 : indexable, on peut déployer
 *   → code de sortie 1 : bloqué, NE PAS déployer
 */
import { readFileSync, existsSync, readdirSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DIST = join(HERE, "..", "..", "ui", "dist");

const echecs = [];
const ok = [];

/* 1 — robots.txt. C'est lui qui a bloqué les sitemaps : un `Disallow: /` interdit aussi
 *     /sitemap.xml, et la Search Console répond alors « Couldn't fetch ». */
const robots = join(DIST, "robots.txt");
if (!existsSync(robots)) {
  echecs.push("robots.txt absent du build");
} else {
  const txt = readFileSync(robots, "utf8");
  if (/^\s*Disallow:\s*\/\s*$/m.test(txt)) {
    echecs.push("robots.txt contient « Disallow: / » — le site entier est fermé aux moteurs");
  } else if (!/^\s*Sitemap:/m.test(txt)) {
    echecs.push("robots.txt ne déclare aucun Sitemap");
  } else ok.push("robots.txt ouvre le site et déclare le sitemap");
}

/* 2 — la balise robots des pages. Un échantillon suffit : la valeur vient d'une constante de
 *     build, elle est donc identique partout. On prend une page par langue, plus deux fiches. */
const echantillon = [
  "index.html", "fr/index.html", "es/index.html", "pt/index.html",
  "airlines/air-france/index.html", "countries/france/index.html",
];
let noindex = 0, vus = 0;
for (const p of echantillon) {
  const f = join(DIST, p);
  if (!existsSync(f)) continue;
  vus++;
  if (/name="robots"\s+content="[^"]*noindex/i.test(readFileSync(f, "utf8"))) noindex++;
}
if (!vus) echecs.push("aucune page de l'échantillon n'existe — le build est incomplet");
else if (noindex) echecs.push(`${noindex} page(s) sur ${vus} portent « noindex » — PUBLIC_SITE_ENV=production manquait au build`);
else ok.push(`${vus} pages contrôlées, aucune balise noindex`);

/* 3 — les sitemaps. Présents, non vides, cohérents avec le nombre de pages construites, et
 *     opposables page par page. L'échantillon précédent prouve la variable globale du build ; il
 *     ne suffit pas pour les pages qui portent légitimement un `noindex` propre. Une URL annoncée
 *     à Google ne doit jamais appartenir à cette famille : on ouvre donc chacune des pages des
 *     quatre sitemaps et on refuse à la fois un fichier absent et une balise `noindex`. */
const idx = join(DIST, "sitemap.xml");
if (!existsSync(idx)) echecs.push("sitemap.xml absent");
else {
  const sitemapUrls = [];
  for (const f of readdirSync(DIST).filter((f) => /^sitemap-.+\.xml$/.test(f))) {
    const xml = readFileSync(join(DIST, f), "utf8");
    sitemapUrls.push(...[...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]));
  }

  if (sitemapUrls.length < 500) {
    echecs.push(`les sitemaps ne totalisent que ${sitemapUrls.length} URL — build partiel ?`);
  } else {
    const absentes = [];
    const interdites = [];
    for (const loc of sitemapUrls) {
      const pathname = decodeURIComponent(new URL(loc).pathname);
      const relatif = pathname === "/"
        ? "index.html"
        : pathname.endsWith("/")
          ? `${pathname.slice(1)}index.html`
          : extname(pathname)
            ? pathname.slice(1)
            : `${pathname.slice(1)}/index.html`;
      const page = join(DIST, relatif);
      if (!existsSync(page)) {
        absentes.push(pathname);
        continue;
      }
      if (/<meta[^>]+name=["']robots["'][^>]*content=["'][^"']*noindex/i.test(readFileSync(page, "utf8"))) {
        interdites.push(pathname);
      }
    }

    if (absentes.length) {
      echecs.push(`${absentes.length} URL du sitemap n'ont pas de page construite, dont ${absentes.slice(0, 3).join(", ")}`);
    }
    if (interdites.length) {
      echecs.push(`${interdites.length} URL du sitemap portent « noindex », dont ${interdites.slice(0, 3).join(", ")}`);
    }
    if (!absentes.length && !interdites.length) {
      ok.push(`sitemaps : ${sitemapUrls.length} URL présentes et indexables`);
    }
  }
}

/* 4 — le build est-il complet ? Un shard laissé de côté vide une famille entière sans rien dire. */
for (const [nom, dossier, mini] of [["compagnies", "airlines", 90], ["pays", "countries", 138], ["races", "breeds", 170], ["aéroports", "airports", 240]]) {
  const d = join(DIST, dossier);
  const n = existsSync(d) ? readdirSync(d, { withFileTypes: true }).filter((e) => e.isDirectory()).length : 0;
  if (n < mini) echecs.push(`${nom} : ${n} page(s) construites, attendu ≥ ${mini}`);
  else ok.push(`${nom} : ${n} pages`);
}

for (const o of ok) console.log("  ✓ " + o);
if (echecs.length) {
  console.error(`\n✖ NE PAS DÉPLOYER — ${echecs.length} problème(s) :`);
  for (const e of echecs) console.error("  · " + e);
  console.error(`\nReconstruire avec :\n  cd packages/ui && PUBLIC_SITE_ENV=production npx astro build`);
  process.exit(1);
}
console.log("\n✓ build indexable et complet — déploiement autorisé");
