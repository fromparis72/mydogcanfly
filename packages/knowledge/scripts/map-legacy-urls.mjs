#!/usr/bin/env node
/* Classe les 147 anciennes URL : 301 vers un équivalent vivant, ou 410 si définitivement supprimée.
   Une cible 301 n'est retenue QUE si la page existe réellement dans dist/. */
import { readFileSync, existsSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const DIST = resolve(ROOT, "packages/ui/dist");

const src = readFileSync("/tmp/z410/mydogcanfly-410-worker.js", "utf8");
const paths = JSON.parse(src.match(/GONE_EXACT_PATHS = new Set\((\[[\s\S]*?\])\);/)[1].replace(/'/g, '"'));

const live = (p) => existsSync(resolve(DIST, p.replace(/^\//, "").replace(/\/$/, ""), "index.html"));

// --- cibles vivantes disponibles -------------------------------------------------
const obj = JSON.parse(readFileSync(resolve(ROOT, "packages/knowledge/raw/objects.json"), "utf8"));
const airlineSlugs = new Set();
for (const a of obj.airlines) {
  const m = a.id.replace(/^airline_/, "").replace(/_/g, "-");
  if (live(`/airlines/${m}/`)) airlineSlugs.add(m);
}
// nom pays (en/fr) -> iso
const cName = new Map();
for (const c of obj.countries) {
  const iso = c.id.replace(/^country_/, "");
  for (const n of [c.name?.en, c.name?.fr, c.name?.es].filter(Boolean)) {
    cName.set(String(n).toLowerCase().replace(/[^a-z]/g, ""), iso);
  }
}

// alias pour les libellés d'URL qui ne collent pas au nom officiel
const COUNTRY_ALIAS = {
  "the-usa": "us", "the-uk": "gb", "dubai-uae": "ae", "the-eu": null,
  "belgium-netherlands": null, "ireland-finland-malta-norway": null,
};
const AIRLINE_ALIAS = {
  "swiss-air": "swiss", "lot-polish-airlines": "lot", "tap-air-portugal": "tap",
  "japan-airlines": "jal", "united-airlines": "united", "american-airlines": "american",
  "turkish-airlines": "turkish", "singapore-airlines": "singapore-airlines",
  "qatar-airways": "qatar-airways", "etihad-airways": "etihad", "cathay-pacific": "cathay-pacific",
  "aegean-airlines": "aegean", "austrian-airlines": "austrian", "brussels-airlines": "brussels",
  "ethiopian-airlines": "ethiopian", "china-airlines": "china-airlines", "eva-air": "eva-air",
  "korean-air": "korean-air", "philippine-airlines": "philippine", "vietnam-airlines": "vietnam-airlines",
  "alaska-airlines": "alaska", "iberia-express": "iberia-express", "air-tahiti-nui": "air-tahiti-nui",
  "royal-air-maroc": "royal-air-maroc", "copa-airlines": "copa", "thai-airways": "thai-airways",
  "ita-airways": "ita-airways", "french-bee": "french-bee", "air-caraibes": "air-caraibes",
};

// correspondances manuelles : ancienne rubrique -> page actuelle la plus proche
const MANUAL = {
  "/airline-pet-policies/": "/airlines/",
  "/dog-travel-requirements-by-country/": "/countries/",
  "/privacy-policy/": "/privacy/",
  "/editorial-standards/": "/about/",
  "/contact/": "/report-error/",
  "/flying-with-a-dog/": "/",
  "/flying-with-a-dog-cabin-hold-cargo/": "/",
  "/international-travel-with-a-dog/": "/",
  "/airline-approved-dog-crate/": "/tools/crate/",
  "/dog-carriers-and-crates/": "/tools/crate/",
  "/dog-heatstroke/": "/tools/heat/",
  "/dog-heat-safety/": "/tools/heat/",
  "/dog-travel-vaccinations/": "/countries/",
  "/dog-friendly-france/": "/countries/fr/",
  // Anciennes pages multi-pays : l'index pays est l'équivalent pertinent.
  "/traveling-to-the-eu-with-a-dog/": "/countries/",
  "/traveling-to-belgium-netherlands-with-a-dog/": "/countries/",
  "/traveling-to-ireland-finland-malta-norway-with-a-dog/": "/countries/",
};
// Volontairement NON redirigées : les pages d'accessoires et les articles hors sujet aérien
// (/hot-pavement-dog-paws/, /road-trip-with-a-dog/, /best-dog-cooling-mats/…). Rediriger vers
// une cible non équivalente produit un soft-404 chez Google : le 410 est plus juste et plus rapide.

const R = { redirect: {}, gone: [], review: [] };

for (const p of paths) {
  if (MANUAL[p] !== undefined) {
    const t = MANUAL[p];
    if (t === "/" || live(t)) { R.redirect[p] = t; continue; }
    R.review.push(`${p} -> cible manuelle absente: ${t}`); R.gone.push(p); continue;
  }
  let m;
  if ((m = p.match(/^\/(.+)-dog-policy\/$/))) {
    const raw = m[1];
    const slug = AIRLINE_ALIAS[raw] ?? raw;
    if (slug && airlineSlugs.has(slug)) { R.redirect[p] = `/airlines/${slug}/`; continue; }
    R.review.push(`${p} -> compagnie non appariée (${raw})`); R.gone.push(p); continue;
  }
  if ((m = p.match(/^\/traveling-to-(.+)-with-a-dog\/$/))) {
    const raw = m[1];
    let iso = COUNTRY_ALIAS[raw];
    if (iso === undefined) iso = cName.get(raw.replace(/-/g, "").toLowerCase()) ?? null;
    if (iso && live(`/countries/${iso}/`)) { R.redirect[p] = `/countries/${iso}/`; continue; }
    R.review.push(`${p} -> pays non apparié (${raw})`); R.gone.push(p); continue;
  }
  R.gone.push(p);
}

writeFileSync("/tmp/legacy-map.json", JSON.stringify(R, null, 2));

// --- injection dans le Worker Pages, entre les marqueurs -------------------------
const WORKER = resolve(ROOT, "packages/ui/public/_worker.js");
const w = readFileSync(WORKER, "utf8");
const block =
  "const LEGACY_REDIRECTS = new Map([\n" +
  Object.entries(R.redirect).sort().map(([k, v]) => `  [${JSON.stringify(k)}, ${JSON.stringify(v)}],`).join("\n") +
  "\n]);\nconst GONE_EXACT = new Set([\n" +
  R.gone.sort().map((p) => `  ${JSON.stringify(p)},`).join("\n") +
  "\n]);";
const next = w.replace(
  /\/\/ >>> LEGACY-DATA-START[\s\S]*?\/\/ <<< LEGACY-DATA-END/,
  "// >>> LEGACY-DATA-START\n" + block + "\n// <<< LEGACY-DATA-END",
);
if (next === w) { console.error("!! marqueurs LEGACY-DATA introuvables dans _worker.js"); process.exit(1); }
writeFileSync(WORKER, next);
console.log("_worker.js mis à jour.\n");
console.log(`301 : ${Object.keys(R.redirect).length}   |   410 : ${R.gone.length}   |   total : ${paths.length}`);
console.log(`\n--- à revoir (${R.review.length}) ---`);
R.review.forEach((r) => console.log("  " + r));
console.log(`\n--- exemples de 301 ---`);
Object.entries(R.redirect).slice(0, 6).forEach(([k, v]) => console.log(`  ${k} -> ${v}`));
console.log(`\n--- 410 conservés (${R.gone.length}) ---`);
console.log("  " + R.gone.join("\n  "));
