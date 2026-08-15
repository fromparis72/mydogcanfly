#!/usr/bin/env node
/**
 * Harnais DOM des pages d'ENTITÉS — le trou par lequel trois anomalies sont passées.
 *
 *   node test-entity-pages-harness.cjs
 *
 * POURQUOI CE HARNAIS EXISTE (contre-test navigateur du 15/08/2026)
 *
 * `build:ci` construit avec `BUILD_ONLY=__none__` : aucune page d'entité. Les harnais DOM
 * existants lisent l'accueil dans les quatre langues et `/tools/fiche`. Les 2 728 pages
 * compagnies, pays, races et aéroports n'étaient donc vérifiées par AUCUN contrôle automatique —
 * et trois anomalies y ont vécu jusqu'au contre-test humain :
 *
 *   1. la fiche affichait `channels[].cls/statusLabel` comme s'ils étaient le statut, alors que
 *      T0-B2 a déplacé la décision dans `policies:` — 78 canaux sur 71 fiches annonçaient
 *      « disponible » là où le moteur dit « à confirmer » ;
 *   2. la source auditée du canal (Thai fret : URL officielle, 13/08, confiance 4) n'était rendue
 *      nulle part, et la carte du Finder citait `a.source.url`, une AUTO-CITATION MyDogCanFly ;
 *   3. `window.mdcfQuery is not a function`, de façon déterministe.
 *
 * CE QU'IL EXIGE : des pages d'entités RÉELLEMENT construites. Si elles manquent, il ÉCHOUE —
 * il ne passe pas « faute de matière ». Un harnais qui se tait quand sa cible est absente est
 * précisément le faux vert que ce dépôt refuse ailleurs.
 *
 *   PUBLIC_API_BASE=https://00000000-mydogcanfly-api-preview.fromparis.workers.dev \
 *   PUBLIC_SITE_ENV=preview BUILD_ONLY=airlines npm -w @mydogcanfly/ui run build
 */
const fs = require("node:fs");
const path = require("node:path");
const YAML = require("yaml");
const { JSDOM, VirtualConsole } = require("jsdom");

const ROOT = __dirname;
const DIST = path.join(ROOT, "packages", "ui", "dist");
/** La racine sert l'anglais ; les trois autres langues sont préfixées. */
const LANGUES = [["en", ""], ["fr", "fr/"], ["es", "es/"], ["pt", "pt/"]];

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};

/**
 * SENTINELLES — une par forme de décision, pour que le contrôle couvre le contrat entier et pas
 * seulement le cas qui a été signalé. Chacune est vérifiée dans les quatre langues.
 */
const SENTINELLES = [
  { slug: "thai-airways", id: "airline_thai_airways", placement: "cargo", attendu: "à confirmer",
    role: "auditée — availability: undocumented, avec source citée" },
  { slug: "aegean", id: "airline_aegean", placement: "cargo", attendu: "à confirmer",
    role: "non revérifiée — review_state: legacy_unreviewed" },
  { slug: "air-france", id: "airline_air_france", placement: "cabin", attendu: "disponible",
    role: "offerte — availability: offered" },
  { slug: "thai-airways", id: "airline_thai_airways", placement: "cabin", attendu: "indisponible",
    role: "non offerte — availability: not_offered" },
];

/** L'URL officielle auditée du fret Thai, telle que le manifeste approuvé la fige. */
const URL_AUDITEE = "pets-as-checked-baggage-avih";

// ---- 0. La cible existe-t-elle ? Sinon on échoue, on ne se tait pas ------------------------
console.log("=== 0. Les pages d'entités sont-elles construites ? ===");
const manquantes = [];
for (const s of SENTINELLES) {
  for (const [, prefixe] of LANGUES) {
    const p = path.join(DIST, prefixe, "airlines", s.slug, "index.html");
    if (!fs.existsSync(p)) manquantes.push(path.relative(DIST, p));
  }
}
check("les pages sentinelles des quatre langues sont présentes", manquantes.length === 0,
  manquantes.length ? `${manquantes.length} manquante(s) — ex. ${manquantes[0]}\n         `
    + "Construisez-les : BUILD_ONLY=airlines npm -w @mydogcanfly/ui run build" : "");
if (manquantes.length) {
  console.log(`\n${pass} OK, ${fail} FAIL`);
  process.exit(1);
}

/** La décision canonique que la fiche DOIT refléter, relue de la fiche YAML elle-même. */
function decisionCanonique(id, placement) {
  const base = id.replace(/^airline_/, "");
  for (const nom of [`${base}.yml`, `${base.replace(/_/g, "-")}.yml`]) {
    const p = path.join(ROOT, "content", "airlines", nom);
    if (!fs.existsSync(p)) continue;
    const d = YAML.parse(fs.readFileSync(p, "utf8")).policies?.[placement];
    if (!d) return null;
    if ("review_state" in d) return "à confirmer";
    return { offered: "disponible", not_offered: "indisponible", case_by_case: "à confirmer", undocumented: "à confirmer" }[d.availability] ?? null;
  }
  return null;
}

/** Charge une page construite en exécutant ses scripts, et rend son DOM + les erreurs console. */
function charger(rel, url) {
  const html = fs.readFileSync(path.join(DIST, rel), "utf8");
  const erreurs = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => erreurs.push(String(e.message || e)));
  vc.on("error", (...a) => erreurs.push(a.map(String).join(" ")));
  const dom = new JSDOM(html, { url, runScripts: "dangerously", virtualConsole: vc, pretendToBeVisual: true });
  return { dom, doc: dom.window.document, html, erreurs };
}

// ---- 1. Aucune erreur console sur une page d'entité -----------------------------------------
console.log("\n=== 1. Aucune erreur console (window.mdcfQuery) ===");
for (const [langue, prefixe] of LANGUES) {
  const { dom, erreurs } = charger(path.join(prefixe, "airlines", "thai-airways", "index.html"),
    `https://mydogcanfly.com/${prefixe}airlines/thai-airways/`);
  check(`${langue} : zéro erreur console sur la fiche compagnie`, erreurs.length === 0,
    erreurs.map((e) => e.split("\n")[0]).join(" | ").slice(0, 200));
  dom.window.close();
}

// ---- 2. Le statut affiché EST la décision canonique -----------------------------------------
console.log("\n=== 2. Le statut affiché est la décision canonique, jamais l'éditorial ===");
for (const s of SENTINELLES) {
  const canonique = decisionCanonique(s.id, s.placement);
  check(`${s.id}.${s.placement} : la fiche YAML décide « ${s.attendu} » (${s.role})`, canonique === s.attendu,
    `contrat = ${canonique}`);
  for (const [langue, prefixe] of LANGUES) {
    const { dom, doc } = charger(path.join(prefixe, "airlines", s.slug, "index.html"),
      `https://mydogcanfly.com/${prefixe}airlines/${s.slug}/`);
    /* Le canal est retrouvé par son PLACEMENT, jamais par son libellé — c'est tout l'objet de
       T0-B2 : plus aucune lecture décisionnelle du texte anglais. */
    const bloc = doc.querySelector(`[data-placement="${s.placement}"]`);
    const statut = bloc?.getAttribute("data-status") ?? null;
    check(`  ${langue} : le canal ${s.placement} porte son statut canonique dans le DOM`,
      statut === s.attendu, statut === null ? "aucun [data-placement] rendu" : `rendu = ${statut}`);
    dom.window.close();
  }
}

// ---- 3. La preuve auditée accompagne la décision --------------------------------------------
console.log("\n=== 3. La décision auditée arrive avec sa preuve, et sans auto-citation ===");
for (const [langue, prefixe] of LANGUES) {
  const { dom, doc, html } = charger(path.join(prefixe, "airlines", "thai-airways", "index.html"),
    `https://mydogcanfly.com/${prefixe}airlines/thai-airways/`);
  check(`${langue} : l'URL officielle auditée du fret est citée`, html.includes(URL_AUDITEE));
  /* Une auto-citation ne peut pas fonder une décision : la règle existe déjà dans le contrat de
     provenance (`isForbiddenSource`), elle doit valoir aussi à l'écran. */
  const zone = doc.querySelector('[data-role="policy-sources"]');
  check(`${langue} : aucune auto-citation MyDogCanFly dans la zone qui justifie la décision`,
    zone !== null && !/mydogcanfly\.com/i.test(zone.innerHTML),
    zone === null ? "zone [data-role=policy-sources] absente" : "auto-citation présente");
  dom.window.close();
}

console.log(`\n${pass} OK, ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
