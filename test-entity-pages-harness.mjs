#!/usr/bin/env node
/**
 * Harnais DOM des pages d'ENTITÉS — le trou par lequel trois anomalies sont passées.
 *
 *   npx tsx test-entity-pages-harness.mjs
 *
 * POURQUOI CE HARNAIS EXISTE (contre-test navigateur du 15/08/2026)
 *
 * `build:ci` construit avec `BUILD_ONLY=__none__` : aucune page d'entité. Les harnais DOM
 * existants lisent l'accueil dans les quatre langues et `/tools/fiche`. Les 2 728 pages
 * compagnies, pays, races et aéroports n'étaient vérifiées par AUCUN contrôle automatique — et
 * trois anomalies y ont vécu jusqu'au contre-test humain.
 *
 * CE QU'IL EXIGE : des pages RÉELLEMENT construites. Si elles manquent, il ÉCHOUE — il ne passe
 * pas « faute de matière ». Un harnais qui se tait quand sa cible est absente est le faux vert
 * que ce dépôt refuse ailleurs.
 *
 *   PUBLIC_API_BASE=https://00000000-mydogcanfly-api-preview.fromparis.workers.dev \
 *   PUBLIC_SITE_ENV=preview BUILD_ONLY=airlines  npm -w @mydogcanfly/ui run build
 *   … idem avec BUILD_ONLY=countries pour la sentinelle `CountryOnward`.
 *
 * DURCISSEMENTS de la contre-revue (mêmes reproches que partout ailleurs dans ce dépôt) :
 *   · la surface quadrilingue est LUE dans les fichiers, jamais obtenue par multiplication ;
 *   · le statut est vérifié sur un attribut TECHNIQUE stable, puis le texte visible est contrôlé
 *     langue par langue — chercher un libellé français dans les quatre versions ne teste rien ;
 *   · l'URL auditée doit être dans le BLOC du canal, en lien visible, avec sa citation, sa date
 *     et sa confiance : la trouver quelque part dans le HTML laisserait passer un JSON invisible ;
 *   · l'auto-citation est contrôlée AUSSI sur la carte du Finder, pas seulement sur la fiche ;
 *   · « zéro erreur console » passerait si le code fautif était supprimé : le COMPORTEMENT
 *     d'`OnwardNav` est donc vérifié — ses liens doivent conserver les paramètres.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { JSDOM, VirtualConsole } from "jsdom";
import { loadKB } from "./packages/knowledge/src/index.ts";
import { evaluate } from "./packages/engine/src/evaluate.ts";
import { explain } from "./packages/engine/src/explain.ts";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, "packages", "ui", "dist");
/** La racine sert l'anglais ; les trois autres langues sont préfixées. */
const LANGUES = [["en", ""], ["fr", "fr/"], ["es", "es/"], ["pt", "pt/"]];

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};

/** Statuts TECHNIQUES du contrat runtime — stables, indépendants de la langue. */
const STATUT = { offered: "allowed", not_offered: "denied", case_by_case: "confirmation_required", undocumented: "confirmation_required" };
/** Le libellé PUBLIÉ de « à confirmer », relu des traductions — jamais réécrit ici. */
const libelleToConfirm = (langue) => JSON.parse(
  fs.readFileSync(path.join(ROOT, "packages", "knowledge", "translations", langue, "strings.json"), "utf8"),
)["air.to_confirm"];

/** SENTINELLES : une par forme de décision, pour couvrir le contrat et pas seulement le cas signalé. */
const SENTINELLES = [
  { slug: "thai-airways", id: "airline_thai_airways", placement: "cargo", statut: "confirmation_required", role: "auditée · undocumented" },
  { slug: "aegean", id: "airline_aegean", placement: "cargo", statut: "confirmation_required", role: "non revérifiée · legacy_unreviewed" },
  { slug: "air-france", id: "airline_air_france", placement: "cabin", statut: "allowed", role: "offerte · offered" },
  { slug: "thai-airways", id: "airline_thai_airways", placement: "cabin", statut: "denied", role: "non offerte · not_offered" },
];

/** La preuve auditée du fret Thai, telle que le manifeste approuvé la fige. */
const AUDIT = (() => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, "test-baselines", "t0b-migration-matrice.json"), "utf8"));
  return m.rows.find((r) => r.identity.airline_id === "airline_thai_airways" && r.identity.placement === "cargo").decision.source;
})();

const lire = (rel) => fs.readFileSync(path.join(DIST, rel), "utf8");
const existe = (rel) => fs.existsSync(path.join(DIST, rel));
function charger(rel, url) {
  const erreurs = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => erreurs.push(String(e.message || e)));
  vc.on("error", (...a) => erreurs.push(a.map(String).join(" ")));
  const dom = new JSDOM(lire(rel), { url, runScripts: "dangerously", virtualConsole: vc, pretendToBeVisual: true });
  return { dom, doc: dom.window.document, html: dom.serialize(), erreurs };
}

/** Les 78 canaux contradictoires et leurs 71 fiches, relus des fiches YAML. */
function contradictoires() {
  const litDeCls = (cls) => (cls === "no" ? "denied" : cls === "neutral" ? "neutral" : "allowed");
  const out = [];
  for (const f of fs.readdirSync(path.join(ROOT, "content", "airlines")).filter((x) => x.endsWith(".yml") && !x.startsWith("_")).sort()) {
    const fiche = YAML.parse(fs.readFileSync(path.join(ROOT, "content", "airlines", f), "utf8"));
    for (const c of fiche.channels || []) {
      const d = fiche.policies?.[c.placement];
      if (!d) continue;
      const canonique = "review_state" in d ? "confirmation_required" : STATUT[d.availability];
      if (litDeCls(c.cls) !== canonique) out.push({ id: fiche.id, slug: f.replace(/\.yml$/, "").replace(/_/g, "-"), placement: c.placement, canonique });
    }
  }
  return out;
}

// ---- 0. La cible existe-t-elle ? ------------------------------------------------------------
console.log("=== 0. Les pages d'entités sont-elles construites ? ===");
const manquantes = [];
for (const s of SENTINELLES) for (const [, p] of LANGUES) {
  const rel = path.join(p, "airlines", s.slug, "index.html");
  if (!existe(rel)) manquantes.push(rel);
}
check("les pages sentinelles compagnies, quatre langues", manquantes.length === 0,
  manquantes.length ? `${manquantes.length} manquante(s) — ex. ${manquantes[0]}` : "");
const paysDispo = existe("countries/fr/index.html") ? "countries/fr/index.html" : null;
check("une page pays sentinelle est construite (CountryOnward)", paysDispo !== null,
  "construisez BUILD_ONLY=countries");
if (manquantes.length || !paysDispo) { console.log(`\n${pass} OK, ${fail} FAIL`); process.exit(1); }

// ---- 1. Zéro erreur console, ET le comportement qui en dépend --------------------------------
console.log("\n=== 1. Zéro erreur console, et le comportement d'OnwardNav ===");
for (const [langue, p] of LANGUES) {
  const rel = path.join(p, "airlines", "thai-airways", "index.html");
  /* `to=de` et NON `to=th` : la Thaïlande est le pays de Thai Airways, donc le lien pointe déjà
     statiquement vers `/countries/th/`. Un contrôle sur `th` passait sans que le script ne
     s'exécute — faux vert relevé en écrivant ce harnais. Une destination DIFFÉRENTE du défaut
     ne peut être obtenue que par le script, donc elle le teste vraiment. */
  const { dom, doc, erreurs } = charger(rel, `https://mydogcanfly.com/${p}airlines/thai-airways/#?breed=breed_pug&to=de`);
  check(`${langue} : zéro erreur console sur la fiche compagnie`, erreurs.length === 0,
    erreurs.map((e) => e.split("\n")[0]).join(" | ").slice(0, 180));
  const dest = doc.getElementById("onav-dest");
  const href = dest?.getAttribute("href") ?? "";
  check(`${langue} : « to=de » RÉÉCRIT le lien de destination (effet observable du script)`,
    dest !== null && /\/countries\/de\//.test(href), dest ? `href=${href}` : "#onav-dest absent");
  const versFinder = doc.querySelector("a.onav__finder");
  check(`${langue} : le lien Finder conserve la race`,
    versFinder !== null && /breed=breed_pug/.test(versFinder.getAttribute("href") || ""),
    versFinder ? versFinder.getAttribute("href") : "lien .onav__finder absent");
  dom.window.close();
}
{
  const { dom, erreurs } = charger(paysDispo, "https://mydogcanfly.com/countries/fr/#?via=cdg");
  check("page pays : zéro erreur console (CountryOnward)", erreurs.length === 0,
    erreurs.map((e) => e.split("\n")[0]).join(" | ").slice(0, 180));
  dom.window.close();
}

// ---- 2. Statut TECHNIQUE, puis texte visible langue par langue -------------------------------
console.log("\n=== 2. Statut canonique : attribut technique, puis libellé de chaque langue ===");
for (const s of SENTINELLES) {
  for (const [langue, p] of LANGUES) {
    const { dom, doc } = charger(path.join(p, "airlines", s.slug, "index.html"),
      `https://mydogcanfly.com/${p}airlines/${s.slug}/`);
    const blocs = doc.querySelectorAll(`[data-placement="${s.placement}"]`);
    check(`${s.id}.${s.placement} ${langue} : un seul bloc pour ce placement (${s.role})`, blocs.length === 1,
      `${blocs.length} bloc(s)`);
    const statut = blocs[0]?.getAttribute("data-status") ?? null;
    check(`  ${langue} : data-status = ${s.statut}`, statut === s.statut, statut === null ? "absent" : statut);
    if (s.statut === "confirmation_required") {
      const attendu = libelleToConfirm(langue);
      const visible = blocs[0]?.textContent?.replace(/\s+/g, " ") ?? "";
      check(`  ${langue} : le libellé PUBLIÉ « ${attendu.slice(0, 34)}… » est visible`, visible.includes(attendu),
        visible.slice(0, 120));
      if (langue !== "en") {
        check(`  ${langue} : aucun résidu du libellé anglais`, !visible.includes(libelleToConfirm("en")));
      }
    }
    dom.window.close();
  }
}

// ---- 3. La preuve auditée, DANS le bloc du canal ---------------------------------------------
console.log("\n=== 3. La preuve auditée est dans le bloc du canal, visible et complète ===");
for (const [langue, p] of LANGUES) {
  const { dom, doc } = charger(path.join(p, "airlines", "thai-airways", "index.html"),
    `https://mydogcanfly.com/${p}airlines/thai-airways/`);
  const bloc = doc.querySelector('[data-placement="cargo"]');
  const dansLeBloc = bloc?.innerHTML ?? "";
  const lien = bloc?.querySelector(`a[href*="${AUDIT.url.slice(8, 60)}"]`) ?? null;
  check(`${langue} : le bloc fret porte un LIEN visible vers l'URL officielle auditée`,
    lien !== null && (lien.textContent || "").trim().length > 0,
    lien === null ? "aucun lien vers l'URL auditée dans le bloc" : "lien sans texte");
  check(`${langue} : la citation officielle est dans le bloc fret`, dansLeBloc.includes(AUDIT.quote),
    `attendu : ${AUDIT.quote.slice(0, 50)}…`);
  check(`${langue} : la date de vérification du canal (${AUDIT.verified_date}) est dans le bloc`,
    /2026-08-13|13[\/. ]0?8[\/. ]2026|13 (août|de agosto|de agosto de|August)/i.test(dansLeBloc));
  check(`${langue} : la confiance ${AUDIT.confidence} est dans le bloc`, /\b4\b/.test(dansLeBloc));
  /* La date de la FICHE (11/07) ne doit pas être présentée comme celle du canal audité. */
  check(`${langue} : aucune auto-citation MyDogCanFly dans le bloc décisionnel`,
    !/mydogcanfly\.com/i.test(dansLeBloc));
  dom.window.close();
}

// ---- 4. La carte du Finder : la preuve du CANAL, jamais une auto-citation ---------------------
console.log("\n=== 4. Carte du Finder : la preuve est celle du canal, sans auto-citation ===");
{
  /* Le défaut relevé au contre-test : la carte expose `a.source.url`, la source RACINE de la
     compagnie — `https://mydogcanfly.com/thai-airways-dog-policy/`, type « other ». Une
     auto-citation ne peut pas fonder une décision : la règle existe déjà dans le contrat de
     provenance, elle doit valoir aussi à l'écran.
     Ce contrôle interroge le MOTEUR, pas le code source : une expression régulière sur
     `explain.ts` passerait au vert sur une refactorisation qui ne corrige rien. */
  const kb = loadKB();
  const annee = new Date().getUTCFullYear() + 1;
  const rapport = explain(evaluate(kb, {
    origin: "airport_cdg", destination: "airport_bkk",
    dog: { breed_id: "breed_golden_retriever", weight_kg: 8 },
    travel_type: "pet", placement: "any", locale: "fr", date: `${annee}-01-15`,
  }), "fr");
  const carte = (rapport.airlines ?? []).find((a) => a.airline_id === "airline_thai_airways");
  check("la carte Thai est servie par le moteur", !!carte);
  const brut = JSON.stringify(carte ?? {});
  check("la carte ne cite AUCUN domaine MyDogCanFly", !/mydogcanfly\.com/i.test(brut),
    (brut.match(/https:\/\/mydogcanfly\.com[^"]*/) || ["(aucune)"])[0]);
  /* La preuve doit être attachée au CANAL, avec son statut, sa cause et son policy_ref — pas
     posée à la racine de la carte comme une seconde URL globale. */
  const fret = (carte?.placement_decisions ?? []).find((d) => d.placement === "cargo");
  check("la décision fret est présente avec sa cause", fret?.status === "confirmation_required"
    && (fret?.confirmation_causes ?? []).some((c) => c.policy_ref === "airline_thai_airways#cargo"),
    JSON.stringify(fret));
  check("la décision fret porte la source AUDITÉE du canal",
    (fret)?.source?.url === AUDIT.url, JSON.stringify((fret)?.source ?? null));
  /* Et la source du canal ne doit pas être présentée comme la vérification de toute la fiche. */
  const globales = (rapport.sources ?? []).map((s) => s.url);
  check("la liste de sources du rapport ne contient aucune auto-citation",
    !globales.some((u) => /mydogcanfly\.com/i.test(u)),
    globales.filter((u) => /mydogcanfly\.com/i.test(u)).slice(0, 2).join(" | "));
}

// ---- 5. Surface quadrilingue LUE, jamais multipliée -------------------------------------------
console.log("\n=== 5. Les 78 canaux × 4 langues, lus dans les fichiers ===");
{
  const cont = contradictoires();
  const fiches = [...new Set(cont.map((c) => c.slug))];
  check("78 canaux contradictoires relus des fiches", cont.length === 78, String(cont.length));
  check("71 fiches concernées", fiches.length === 71, String(fiches.length));
  let pagesLues = 0, blocsTrouves = 0;
  const absentes = [], doublons = [];
  for (const slug of fiches) {
    for (const [, p] of LANGUES) {
      const rel = path.join(p, "airlines", slug, "index.html");
      if (!existe(rel)) { absentes.push(rel); continue; }
      pagesLues++;
      const doc = new JSDOM(lire(rel)).window.document;
      for (const c of cont.filter((x) => x.slug === slug)) {
        const n = doc.querySelectorAll(`[data-placement="${c.placement}"]`).length;
        if (n === 1) blocsTrouves++;
        else if (n > 1) doublons.push(`${rel}#${c.placement}×${n}`);
      }
    }
  }
  check("284 pages localisées RÉELLEMENT lues, aucune absente", pagesLues === 284 && absentes.length === 0,
    `lues ${pagesLues} · absentes ${absentes.length}${absentes[0] ? " — ex. " + absentes[0] : ""}`);
  check("aucun placement dupliqué dans une page", doublons.length === 0, doublons.slice(0, 3).join(" | "));
  check("312 blocs de canal contradictoires trouvés (78 × 4), un par page et par canal",
    blocsTrouves === 312, String(blocsTrouves));
}

console.log(`\n${pass} OK, ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
