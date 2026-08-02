#!/usr/bin/env node
/* Vérifie qu'aucune URL vivante ne peut être tuée, et que chaque ancienne URL répond bien.
   Reproduit le routage Pages (_routes.json) puis exécute le vrai _worker.js. */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const DIST = resolve(ROOT, "packages/ui/dist");

const routes = JSON.parse(readFileSync(resolve(ROOT, "packages/ui/public/_routes.json"), "utf8"));
const worker = (await import(pathToFileURL(resolve(ROOT, "packages/ui/public/_worker.js")).href)).default;

const toRe = (r) => new RegExp("^" + r.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
const inc = routes.include.map(toRe), exc = routes.exclude.map(toRe);
// true => la requête invoque le Worker
const hitsWorker = (p) => inc.some((r) => r.test(p)) && !exc.some((r) => r.test(p));

const ASSET = "__ASSET__";
const env = { ASSETS: { fetch: async () => new Response(ASSET, { status: 200 }) } };

async function probe(pathname) {
  if (!hitsWorker(pathname)) return { status: 200, via: "static" }; // servi directement par Pages
  const res = await worker.fetch(new Request("https://mydogcanfly.com" + pathname), env);
  return { status: res.status, via: "worker", loc: res.headers.get("Location") };
}

let fail = 0;
const bad = [];

// 1) toutes les URL du sitemap doivent rester servies (200), jamais 301/410
const sitemap = [...readFileSync(resolve(DIST, "sitemap.xml"), "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)]
  .map((m) => m[1].replace("https://mydogcanfly.com", "")).filter(Boolean);
let workerSeen = 0;
for (const p of sitemap) {
  const r = await probe(p);
  if (r.via === "worker") workerSeen++;
  if (r.status !== 200 && !(p === "/" && r.status === 200)) {
    // "/" peut légitimement rediriger selon la langue : on l'exclut du test
    if (p !== "/") { bad.push(`SITEMAP ${p} -> ${r.status} ${r.loc || ""}`); fail++; }
  }
}
console.log(`Sitemap : ${sitemap.length} URLs testées — ${workerSeen} passent par le Worker — ${bad.length} anomalie(s)`);

// 2) les anciennes URL doivent répondre 301 (avec cible vivante) ou 410.
// La liste est lue dans le Worker lui-même : le test ne peut pas diverger de ce qui est déployé.
const wsrc = readFileSync(resolve(ROOT, "packages/ui/public/_worker.js"), "utf8");
const map = {
  // La lecture doit être bornée au bloc LEGACY_REDIRECTS. Sans cela, le motif de paire
  // attrapait aussi GONE_PREFIXES tant qu'il ne contenait que deux entrées, et le test
  // annonçait « 301 attendu /tags/ » : une fausse anomalie qui a disparu d'elle-même en
  // ajoutant un troisième préfixe. Un test qui change de verdict pour cette raison ne vaut rien.
  redirect: Object.fromEntries(
    [...wsrc.match(/const LEGACY_REDIRECTS = new Map\(\[([\s\S]*?)\]\);/)[1]
      .matchAll(/\[\s*"(\/[^"]*)",\s*"(\/[^"]*)"\s*\]/g)].map((m) => [m[1], m[2]]),
  ),
  gone: [...wsrc.match(/const GONE_EXACT = new Set\(\[([\s\S]*?)\]\);/)[1]
    .matchAll(/"(\/[^"]*)"/g)].map((m) => m[1]),
};
let n301 = 0, n410 = 0;
for (const [from, to] of Object.entries(map.redirect)) {
  const r = await probe(from);
  if (r.status !== 301) { bad.push(`301 attendu ${from} -> ${r.status}`); fail++; continue; }
  if (r.loc !== to) { bad.push(`cible ${from} -> ${r.loc} (attendu ${to})`); fail++; continue; }
  const t = to === "/" ? "index.html" : to.replace(/^\//, "").replace(/\/$/, "") + "/index.html";
  if (!existsSync(resolve(DIST, t))) { bad.push(`CIBLE MORTE ${from} -> ${to}`); fail++; continue; }
  n301++;
}
for (const p of map.gone) {
  const r = await probe(p);
  if (r.status !== 410) { bad.push(`410 attendu ${p} -> ${r.status}`); fail++; continue; }
  n410++;
}
console.log(`Anciennes URL : ${n301} en 301 vers une cible vivante — ${n410} en 410`);

// 3) familles par préfixe
for (const p of ["/tags/air-france/", "/categories/health/", "/dog-heat-safety/whatever/"]) {
  const r = await probe(p);
  if (r.status !== 410) { bad.push(`préfixe 410 attendu ${p} -> ${r.status}`); fail++; }
}
// 4) non-régression : les pages vivantes ne sont ni redirigées ni supprimées.
// Note : ASSETS est simulé et renvoie toujours 200 — ce test vérifie que le Worker LAISSE PASSER,
// pas le statut réel. En production, une URL inconnue tombe sur dist/404.html, donc un vrai 404.
for (const p of ["/about/", "/tools/", "/legal-notice/", "/tools/heat/", "/fr/countries/br/",
                 "/une-page-inexistante/", "/llms.txt"]) {
  const r = await probe(p);
  if (r.status !== 200) { bad.push(`régression ${p} -> ${r.status} (le Worker aurait dû laisser passer)`); fail++; }
}

if (bad.length) { console.log("\n--- ANOMALIES ---"); bad.slice(0, 25).forEach((b) => console.log("  " + b)); }
console.log(fail === 0 ? "\n✅ Aucune anomalie." : `\n❌ ${fail} anomalie(s).`);
process.exit(fail ? 1 : 0);
