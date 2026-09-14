#!/usr/bin/env node
/**
 * Frontières publiques de crédibilité SEO/GEO.
 *
 * Ce harnais lit le site COMPLET construit. En preview, toutes les pages portent volontairement
 * `noindex, nofollow` : l'appartenance au sitemap reste donc la partition canonique. Sur un build
 * de production, la balise robots est contrôlée en plus, page par page.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { loadKB, slugFor } from "./packages/knowledge/src/index.ts";
import { airlineData } from "./packages/ui/src/data/airlines.ts";
import { compagnieIndexable, preuvesDeCompagnie } from "./packages/ui/src/lib/compagnieEtat.ts";
import { raceIndexable } from "./packages/ui/src/lib/raceEtat.ts";
import { reliefIndexable } from "./packages/ui/src/lib/reliefEtat.ts";

const DIST = "packages/ui/dist";
const SITE = "https://mydogcanfly.com";
const LANGUES = ["en", "fr", "es", "pt"];
let echecs = 0;
const exiger = (message, condition, detail = "") => {
  if (condition) return;
  echecs++;
  process.stderr.write(`  ✗ ${message}${detail ? ` — ${detail}` : ""}\n`);
};
const lire = (path) => readFileSync(path, "utf8");
const page = (langue, famille, slug) =>
  join(DIST, ...(langue === "en" ? [] : [langue]), famille, slug, "index.html");
const url = (langue, famille, slug) =>
  `${SITE}${langue === "en" ? "/" : `/${langue}/`}${famille}/${slug}/`;
const noindex = (html) => /<meta\s+name="robots"\s+content="[^"]*noindex/i.test(html);

exiger("le site complet existe", existsSync(join(DIST, "sitemap-en.xml")));
if (echecs) process.exit(1);

const sitemaps = Object.fromEntries(LANGUES.map((langue) => [
  langue,
  new Set([...lire(join(DIST, `sitemap-${langue}.xml`)).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])),
]));
const accueil = lire(join(DIST, "index.html"));
const production = !noindex(accueil);
const kb = loadKB();

// Une règle, deux consommateurs, quatre langues : page et sitemap ne peuvent pas diverger.
const compagnies = [...kb.airlines.values()].map((airline) => {
  const fiche = airlineData[airline.id];
  exiger(`la fiche UI existe pour ${airline.id}`, !!fiche);
  return { airline, fiche, indexable: !!fiche && compagnieIndexable(airline, fiche) };
});
const retirees = compagnies.filter((x) => !x.indexable).map((x) => x.airline.name).sort();
const RETRAITEES_ATTENDUES = [
  "Air Serbia", "Batik Air Malaysia", "EL AL Israel Airlines", "Icelandair",
  "Pegasus Airlines", "Saudia", "Wizz Air",
].sort();
exiger("sept compagnies sans preuve restent hors index", retirees.join("|") === RETRAITEES_ATTENDUES.join("|"), retirees.join(", "));

for (const { airline, fiche, indexable } of compagnies) {
  const slug = slugFor(airline.id);
  const presence = LANGUES.map((langue) => sitemaps[langue].has(url(langue, "airlines", slug)));
  exiger(`${airline.name} suit la porte dans les quatre sitemaps`, presence.every((v) => v === indexable), presence.join(","));
  exiger(`${airline.name} est symétrique entre les langues`, new Set(presence).size === 1);
  for (const langue of LANGUES) {
    const fichier = page(langue, "airlines", slug);
    exiger(`la page ${langue} de ${airline.name} existe`, existsSync(fichier));
    if (!existsSync(fichier)) continue;
    const html = lire(fichier);
    if (production) exiger(`robots et sitemap concordent pour ${langue}/${airline.name}`, noindex(html) === !indexable);
    if (indexable) {
      for (const preuve of preuvesDeCompagnie(airline, fiche))
        exiger(`${langue}/${airline.name} publie sa source`, html.includes(preuve.url), preuve.url);
    }
  }
}

// Les deux arbitrages documentaires reçus le 13 septembre ne sont pas des exceptions SEO.
for (const id of ["airline_air_new_zealand", "airline_norwegian"]) {
  const airline = kb.airlines.get(id);
  exiger(`${id} existe`, !!airline);
  if (airline) exiger(`${id} porte au moins deux preuves visibles`, preuvesDeCompagnie(airline, airlineData[id]).length >= 2);
}
const norwegian = kb.airlines.get("airline_norwegian");
exiger("Norwegian refuse le fret animal sur une preuve officielle", norwegian?.premium?.policy?.cargo?.status === "denied");

// llms.txt ne compte et ne recommande que ce que les sitemaps proposent réellement.
const llms = lire(join(DIST, "llms.txt"));
const nCompagnies = compagnies.filter((x) => x.indexable).length;
const nPays = kb.countries.size;
const nRaces = [...kb.breeds.values()].filter((breed) => raceIndexable(kb, breed)).length;
const nAeroports = [...kb.airports.values()].filter(reliefIndexable).length;
exiger("llms.txt annonce les comptes indexables", llms.includes(`documents ${nCompagnies} airlines, ${nPays} country entry regimes, ${nRaces} dog breeds and ${nAeroports} airports`));
for (const { airline } of compagnies.filter((x) => !x.indexable))
  exiger(`llms.txt ne recommande pas ${airline.name}`, !llms.includes(`/airlines/${slugFor(airline.id)}/`));

// L'identité publique est unique ; les anciens champs restent seulement des données internes.
const guides = [];
for (const langue of LANGUES) {
  const dossier = join(DIST, ...(langue === "en" ? [] : [langue]), "travel-hub");
  if (!existsSync(dossier)) continue;
  for (const entree of readdirSync(dossier, { withFileTypes: true })) {
    const fichier = join(dossier, entree.name, "index.html");
    if (entree.isDirectory() && existsSync(fichier)) guides.push(fichier);
  }
}
exiger("les 288 guides construits sont présents", guides.length === 288, String(guides.length));
for (const fichier of guides) {
  const html = lire(fichier);
  exiger("aucun guide ne publie Camille Roussel", !html.includes("Camille Roussel"), fichier);
  exiger("chaque guide attribue Phil Albert-Benoist", html.includes("Phil Albert-Benoist"), fichier);
  exiger("chaque guide relie l'auteur à l'entité fondatrice", html.includes(`${SITE}/#founder`), fichier);
}

for (const langue of LANGUES) for (const country of kb.countries.values()) {
  const fichier = page(langue, "countries", slugFor(country.id));
  if (!existsSync(fichier)) continue;
  const html = lire(fichier);
  exiger("une fiche pays ne publie pas le relecteur interne", !html.includes("MyDogCanFly Data Team") && !html.includes('"reviewedBy"'), fichier);
}

// Une seule politique de cache partagé : les règles Pages qui se chevauchent cumulent sinon les valeurs.
const headers = lire("packages/ui/public/_headers");
exiger("_headers ne déclare qu'un seul s-maxage", (headers.match(/^\s*Cache-Control:.*s-maxage=/gm) ?? []).length === 1);

process.stdout.write(
  `  ✓ ${nCompagnies}/102 compagnies au sitemap dans 4 langues ; ${retirees.length} retirées\n` +
  `  ✓ ${guides.length} guides attribués à Phil Albert-Benoist ; aucun faux relecteur public\n` +
  `  ✓ llms.txt : ${nCompagnies} compagnies, ${nPays} pays, ${nRaces} races, ${nAeroports} aéroports indexables\n` +
  `  · build ${production ? "production : balises robots contrôlées" : "preview : partition robots lue dans les sitemaps"}\n`,
);
if (echecs) {
  process.stderr.write(`[credibilite-seo] ÉCHEC — ${echecs} contrôle(s) non tenu(s)\n`);
  process.exit(1);
}
process.stdout.write("[credibilite-seo] frontières publiques cohérentes.\n");
