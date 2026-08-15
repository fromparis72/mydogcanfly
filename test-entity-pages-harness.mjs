#!/usr/bin/env node
/**
 * Harnais DOM des pages d'ENTITÉS — le trou par lequel trois anomalies sont passées.
 *
 *   npx tsx test-entity-pages-harness.mjs                    → portée « sentinelles » (build de CI)
 *   HARNAIS_PORTEE=complet npx tsx test-entity-pages-harness.mjs   → les 71 fiches × 4 langues
 *
 * POURQUOI CE HARNAIS EXISTE (contre-test navigateur du 15/08/2026)
 *
 * `build:ci` construisait avec `BUILD_ONLY=__none__` : aucune page d'entité. Les harnais DOM
 * existants lisent l'accueil dans les quatre langues et `/tools/fiche`. Les 2 728 pages
 * compagnies, pays, races et aéroports n'étaient vérifiées par AUCUN contrôle automatique — et
 * trois anomalies y ont vécu jusqu'au contre-test humain. `build:ci` construit désormais les
 * pages SENTINELLES, déclarées une seule fois dans
 * `packages/knowledge/scripts/lib/sentinelles-entites.mjs` et lues des deux côtés.
 *
 * CE QU'IL EXIGE : des pages RÉELLEMENT construites. Si elles manquent, il ÉCHOUE — il ne passe
 * pas « faute de matière ». Un harnais qui se tait quand sa cible est absente est le faux vert
 * que ce dépôt refuse ailleurs. Les deux portées ont chacune une cible EXACTE, calculée sur les
 * données : ni l'une ni l'autre ne se contente de ce qui est là.
 *
 * DURCISSEMENTS de la contre-revue (mêmes reproches que partout ailleurs dans ce dépôt) :
 *   · la surface quadrilingue est LUE dans les fichiers, jamais obtenue par multiplication, et
 *     chaque bloc est vérifié — statut technique ET libellé publié — jamais seulement compté ;
 *   · le libellé est comparé à l'ÉGAL, pas par inclusion : « Accepté » est contenu dans « Non
 *     accepté », et une comparaison par inclusion validerait l'inverse de la décision ;
 *   · la preuve auditée est comparée à l'URL EXACTE du manifeste, dans le lien du bloc, et sa
 *     citation, sa date et sa confiance sont cherchées dans le TEXTE VISIBLE ;
 *   · l'auto-citation est contre-prouvée sur la CARTE RENDUE du Finder — pas sur le rapport du
 *     moteur, qui ne dit rien de ce que le visiteur voit ;
 *   · « zéro erreur console » passerait si le code fautif était supprimé : le COMPORTEMENT
 *     d'`OnwardNav` ET celui de `CountryOnward` sont donc vérifiés par un effet observable.
 */
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import YAML from "yaml";
import { JSDOM, VirtualConsole } from "jsdom";
import { loadKB, t as tt, formatDate } from "./packages/knowledge/src/index.ts";
import { evaluate } from "./packages/engine/src/evaluate.ts";
import { explain } from "./packages/engine/src/explain.ts";
import { SENTINELLES_COMPAGNIES, SENTINELLE_PAYS } from "./packages/knowledge/scripts/lib/sentinelles-entites.mjs";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const DIST = path.join(ROOT, "packages", "ui", "dist");
/** La racine sert l'anglais ; les trois autres langues sont préfixées. */
const LANGUES = [["en", ""], ["fr", "fr/"], ["es", "es/"], ["pt", "pt/"]];
/** `sentinelles` = ce que `build:ci` produit. `complet` = un build complet des compagnies. */
const PORTEE = process.env.HARNAIS_PORTEE === "complet" ? "complet" : "sentinelles";

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  FAIL ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};

/** Le libellé PUBLIÉ de chaque statut — relu des traductions, jamais réécrit ici. */
const CLE_LIBELLE = { allowed: "premium.allowed", denied: "premium.not_allowed", confirmation_required: "air.to_confirm" };
const libelle = (langue, statut) => tt(langue, CLE_LIBELLE[statut]);

/** La preuve auditée du fret Thai, telle que le manifeste approuvé la fige. */
const AUDIT = (() => {
  const m = JSON.parse(fs.readFileSync(path.join(ROOT, "test-baselines", "t0b-migration-matrice.json"), "utf8"));
  return m.rows.find((r) => r.identity.airline_id === "airline_thai_airways" && r.identity.placement === "cargo").decision.source;
})();

const kb = loadKB();
const politique = (airlineId, placement) => kb.airlines.get(airlineId)?.premium?.policy?.[placement];

const lire = (rel) => fs.readFileSync(path.join(DIST, rel), "utf8");
const existe = (rel) => fs.existsSync(path.join(DIST, rel));
function charger(rel, url) {
  const erreurs = [];
  const vc = new VirtualConsole();
  vc.on("jsdomError", (e) => erreurs.push(String(e.message || e)));
  vc.on("error", (...a) => erreurs.push(a.map(String).join(" ")));
  const dom = new JSDOM(lire(rel), { url, runScripts: "dangerously", virtualConsole: vc, pretendToBeVisual: true });
  return { dom, doc: dom.window.document, erreurs };
}
/** Lit la page APRÈS `load`. Le report des paramètres sur les liens `data-carry` s'y fait ;
 *  lire aussitôt après la construction ne voyait que le rendu serveur — un faux rouge, et pire,
 *  un faux vert le jour où l'on aurait « corrigé » l'assertion pour la faire passer. */
async function chargerCharge(rel, url) {
  const r = charger(rel, url);
  await new Promise((res) => {
    if (r.dom.window.document.readyState === "complete") return res();
    r.dom.window.addEventListener("load", res, { once: true });
  });
  for (let i = 0; i < 3; i++) await new Promise((res) => setTimeout(res, 10));
  return r;
}

/**
 * Les canaux dont l'ÉDITORIAL contredit la décision canonique — relus des fiches YAML pour la
 * partie éditoriale, et de la POLITIQUE RUNTIME pour la décision. Comparer la fiche à elle-même
 * ne prouverait rien : c'est le contrat que la page doit rendre, pas un second calcul.
 */
function contradictoires() {
  const litDeCls = (cls) => (cls === "no" ? "denied" : cls === "neutral" ? "neutral" : "allowed");
  const out = [];
  for (const f of fs.readdirSync(path.join(ROOT, "content", "airlines")).filter((x) => x.endsWith(".yml") && !x.startsWith("_")).sort()) {
    const fiche = YAML.parse(fs.readFileSync(path.join(ROOT, "content", "airlines", f), "utf8"));
    for (const c of fiche.channels || []) {
      const p = politique(fiche.id, c.placement);
      if (!p) continue;
      if (litDeCls(c.cls) !== p.status) {
        out.push({ id: fiche.id, slug: f.replace(/\.yml$/, "").replace(/_/g, "-"), placement: c.placement, statut: p.status });
      }
    }
  }
  return out;
}

const CONTRADICTOIRES = contradictoires();
const SLUGS_SENTINELLES = [...new Set(SENTINELLES_COMPAGNIES.map((s) => s.slug))];
/** La cible EXACTE de la portée courante — calculée sur les données, jamais sur ce qui est là. */
const CIBLE = PORTEE === "complet"
  ? CONTRADICTOIRES
  : CONTRADICTOIRES.filter((c) => SLUGS_SENTINELLES.includes(c.slug));
const FICHES_CIBLE = [...new Set(CIBLE.map((c) => c.slug))];

console.log(`portée : ${PORTEE} · ${CIBLE.length} canaux contradictoires sur ${FICHES_CIBLE.length} fiche(s)`);
if (PORTEE === "sentinelles") {
  /* Pas de plafond silencieux : ce qui n'est PAS couvert est dit, et chiffré. */
  console.log(`         NON COUVERT ici : ${CONTRADICTOIRES.length - CIBLE.length} canaux sur ` +
    `${new Set(CONTRADICTOIRES.map((c) => c.slug)).size - FICHES_CIBLE.length} fiches — ` +
    "lancer HARNAIS_PORTEE=complet sur un build complet des compagnies.");
}

// ---- 0. La cible existe-t-elle ? ------------------------------------------------------------
console.log("\n=== 0. Les pages d'entités sont-elles construites ? ===");
{
  const manquantes = [];
  for (const slug of [...new Set([...SLUGS_SENTINELLES, ...FICHES_CIBLE])]) {
    for (const [, p] of LANGUES) {
      const rel = path.join(p, "airlines", slug, "index.html");
      if (!existe(rel)) manquantes.push(rel);
    }
  }
  const attendues = new Set([...SLUGS_SENTINELLES, ...FICHES_CIBLE]).size * 4;
  check(`les ${attendues} pages compagnies de la portée « ${PORTEE} », quatre langues`, manquantes.length === 0,
    manquantes.length ? `${manquantes.length} manquante(s) — ex. ${manquantes[0]}` : "");
  const paysManquantes = LANGUES.map(([, p]) => path.join(p, "countries", SENTINELLE_PAYS.slug, "index.html")).filter((r) => !existe(r));
  check("la page pays sentinelle, quatre langues (CountryOnward)", paysManquantes.length === 0,
    paysManquantes.join(" | ") || "construire avec npm run build:ci");
  if (manquantes.length || paysManquantes.length) { console.log(`\n${pass} OK, ${fail} FAIL`); process.exit(1); }
}

// ---- 1. Zéro erreur console, ET le comportement qui en dépend --------------------------------
console.log("\n=== 1. Zéro erreur console, et les DEUX composants qui appellent mdcfQuery ===");
for (const [langue, p] of LANGUES) {
  const rel = path.join(p, "airlines", "thai-airways", "index.html");
  /* `to=de` et NON `to=th` : la Thaïlande est le pays de Thai Airways, donc le lien pointe déjà
     statiquement vers `/countries/th/`. Un contrôle sur `th` passait sans que le script ne
     s'exécute — faux vert relevé en écrivant ce harnais. Une destination DIFFÉRENTE du défaut
     ne peut être obtenue que par le script, donc elle le teste vraiment. */
  const { dom, doc, erreurs } = await chargerCharge(rel, `https://mydogcanfly.com/${p}airlines/thai-airways/#?breed=breed_pug&to=de`);
  check(`${langue} : zéro erreur console sur la fiche compagnie`, erreurs.length === 0,
    erreurs.map((e) => e.split("\n")[0]).join(" | ").slice(0, 180));
  const dest = doc.getElementById("onav-dest");
  const href = dest?.getAttribute("href") ?? "";
  check(`${langue} : OnwardNav — « to=de » RÉÉCRIT le lien de destination`,
    dest !== null && /\/countries\/de\//.test(href), dest ? `href=${href}` : "#onav-dest absent");
  const versFinder = doc.querySelector("a.onav__finder");
  check(`${langue} : OnwardNav — le lien Finder conserve la race`,
    versFinder !== null && /breed=breed_pug/.test(versFinder.getAttribute("href") || ""),
    versFinder ? versFinder.getAttribute("href") : "lien .onav__finder absent");
  dom.window.close();
}
for (const [langue, p] of LANGUES) {
  /* `CountryOnward` n'était vérifié que par « zéro erreur » : supprimer son script entier aurait
     rendu le contrôle VERT. On exige donc un effet que seul le script produit — le titre statique
     « France : trouver un vol » devient « Tu envisageais Air France ? », et le bouton de
     réservation, caché au rendu, apparaît avec l'URL de la compagnie. */
  const rel = path.join(p, "countries", SENTINELLE_PAYS.slug, "index.html");
  const statique = new JSDOM(lire(rel)).window.document.getElementById("conav-title")?.textContent ?? "";
  const { dom, doc, erreurs } = await chargerCharge(rel, `https://mydogcanfly.com/${p}countries/${SENTINELLE_PAYS.slug}/#?via=airline_air_france`);
  check(`${langue} : zéro erreur console sur la page pays`, erreurs.length === 0,
    erreurs.map((e) => e.split("\n")[0]).join(" | ").slice(0, 180));
  const titre = doc.getElementById("conav-title")?.textContent ?? "";
  check(`${langue} : CountryOnward — « via=airline_air_france » RÉÉCRIT le titre`,
    titre !== "" && titre !== statique && /Air France/.test(titre), `statique « ${statique} » · après « ${titre} »`);
  const book = doc.getElementById("conav-book");
  check(`${langue} : CountryOnward — le bouton de réservation devient visible, avec son URL`,
    book !== null && book.hidden === false && /^https?:\/\//.test(book.getAttribute("href") || ""),
    book ? `hidden=${book.hidden} href=${book.getAttribute("href")}` : "#conav-book absent");
  dom.window.close();
}

// ---- 2. Statut TECHNIQUE, puis libellé publié, comparé à l'ÉGAL ------------------------------
console.log("\n=== 2. Les quatre formes de décision : attribut technique + libellé publié exact ===");
for (const s of SENTINELLES_COMPAGNIES) {
  const attenduRuntime = politique(s.id, s.placement)?.status;
  check(`${s.id}.${s.placement} : la politique canonique vaut bien ${s.statut} (${s.role})`,
    attenduRuntime === s.statut, String(attenduRuntime));
  for (const [langue, p] of LANGUES) {
    const { dom, doc } = charger(path.join(p, "airlines", s.slug, "index.html"),
      `https://mydogcanfly.com/${p}airlines/${s.slug}/`);
    const blocs = doc.querySelectorAll(`[data-placement="${s.placement}"]`);
    check(`  ${langue} : un seul bloc pour ce placement`, blocs.length === 1, `${blocs.length} bloc(s)`);
    const statut = blocs[0]?.getAttribute("data-status") ?? null;
    check(`  ${langue} : data-status = ${s.statut}`, statut === s.statut, statut === null ? "absent" : statut);
    /* Comparaison à l'ÉGAL : « Accepté » est un sous-texte de « Non accepté ». Une vérification
       par inclusion validerait donc l'inverse exact de la décision. */
    const pastille = blocs[0]?.querySelector(".t .pill")?.textContent?.trim() ?? null;
    check(`  ${langue} : la pastille porte EXACTEMENT le libellé publié « ${libelle(langue, s.statut)} »`,
      pastille === libelle(langue, s.statut), pastille === null ? "aucune pastille" : `« ${pastille} »`);
    dom.window.close();
  }
}

// ---- 3. La preuve auditée, DANS le bloc du canal, à l'URL EXACTE ------------------------------
console.log("\n=== 3. La preuve auditée du fret Thai : lien exact, texte visible, confiance nommée ===");
{
  const ficheThai = JSON.parse(fs.readFileSync(path.join(ROOT, "packages", "ui", "src", "data", "airlines.generated.json"), "utf8")).airline_thai_airways;
  const dateFiche = ficheThai.verified_date;
  check("la date de vérification de la FICHE est distincte de celle du canal audité",
    dateFiche !== AUDIT.verified_date, `fiche ${dateFiche} · canal ${AUDIT.verified_date}`);
  for (const [langue, p] of LANGUES) {
    const { dom, doc } = charger(path.join(p, "airlines", "thai-airways", "index.html"),
      `https://mydogcanfly.com/${p}airlines/thai-airways/`);
    const bloc = doc.querySelector('[data-placement="cargo"]');
    const visible = (bloc?.textContent ?? "").replace(/\s+/g, " ");
    /* Le lien est comparé à l'URL EXACTE du manifeste — pas à un fragment, qui laisserait passer
       une URL tronquée, une redirection ou une page voisine. */
    const liens = [...(bloc?.querySelectorAll("a[href]") ?? [])];
    const lien = liens.find((a) => a.getAttribute("href") === AUDIT.url) ?? null;
    check(`${langue} : le bloc fret porte un lien dont le href EST l'URL auditée`,
      lien !== null && (lien.textContent || "").trim().length > 0,
      lien === null ? `hrefs présents : ${liens.map((a) => a.getAttribute("href")).join(" | ") || "aucun"}` : "lien sans texte visible");
    check(`${langue} : la citation officielle est dans le TEXTE VISIBLE du bloc`, visible.includes(AUDIT.quote),
      `attendu : ${AUDIT.quote.slice(0, 50)}…`);
    /* La date est comparée à sa forme RENDUE dans cette langue, produite par le même formateur
       que la page — pas à une expression régulière qui accepterait n'importe quel « 13 ». */
    const dateRendue = formatDate(langue, AUDIT.verified_date);
    check(`${langue} : la date du canal, telle que rendue (« ${dateRendue} »), est visible`,
      visible.includes(dateRendue), visible.slice(0, 140));
    /* Un libellé de confiance EXPLICITE, pas le chiffre 4 : « 4 » se trouve dans une cote de sac,
       un tarif ou une année. Le libellé publié, lui, ne peut venir que d'ici. */
    const libelleConfiance = tt(langue, "premium.confidence").replace("{n}", String(AUDIT.confidence));
    check(`${langue} : la confiance est NOMMÉE (« ${libelleConfiance} »), pas juste chiffrée`,
      visible.includes(libelleConfiance), visible.slice(0, 140));
    check(`${langue} : aucune auto-citation MyDogCanFly dans le bloc décisionnel`,
      !/mydogcanfly\.com/i.test(bloc?.innerHTML ?? ""));
    /* La date de la FICHE reste visible ailleurs sur la page, et ne se substitue pas à celle du
       canal : les confondre présenterait une vérification de juillet comme l'audit du 13 août. */
    const page = doc.body.textContent.replace(/\s+/g, " ");
    check(`${langue} : la date de la fiche (« ${formatDate(langue, dateFiche)} ») est visible et distincte`,
      page.includes(formatDate(langue, dateFiche)) && !visible.includes(formatDate(langue, dateFiche)));
    dom.window.close();
  }
  /* Contre-épreuve : une politique NON REVÉRIFIÉE ne reçoit aucune source, dans aucune langue. */
  for (const [langue, p] of LANGUES) {
    const { dom, doc } = charger(path.join(p, "airlines", "aegean", "index.html"),
      `https://mydogcanfly.com/${p}airlines/aegean/`);
    const bloc = doc.querySelector('[data-placement="cargo"]');
    check(`${langue} : le fret NON REVÉRIFIÉ d'Aegean n'affiche AUCUNE source`,
      bloc !== null && bloc.querySelector(".proof") === null && !/mydogcanfly\.com/i.test(bloc.innerHTML));
    dom.window.close();
  }
}

// ---- 4. La CARTE RENDUE du Finder : la preuve du canal, jamais une auto-citation --------------
console.log("\n=== 4. Carte RENDUE du Finder : le lien de source est celui du canal ===");
{
  /* Le défaut relevé au contre-test : la carte affichait `host(a.source_url)` — la source RACINE
     de la compagnie, `https://mydogcanfly.com/thai-airways-dog-policy/`, type « other ».
     Ce contrôle interroge le DOM RÉELLEMENT PRODUIT : rapport calculé par le VRAI moteur, injecté
     dans le VRAI bundle client par un `fetch` mocké, cartes rendues, puis lecture des liens. Un
     contrôle sur le rapport du moteur ne dirait rien de ce que le visiteur voit. */
  const require_ = createRequire(import.meta.url);
  const { rendreCartes } = require_("./test-lib/finder-dom.cjs");
  const annee = new Date().getUTCFullYear() + 1;
  const rapport = explain(evaluate(kb, {
    origin: "airport_cdg", destination: "airport_bkk",
    dog: { breed_id: "breed_golden_retriever", weight_kg: 8 },
    travel_type: "pet", placement: "any", locale: "en", date: `${annee}-01-15`,
  }), "en");
  const carte = (rapport.airlines ?? []).find((a) => a.airline_id === "airline_thai_airways");
  check("le moteur sert bien une carte Thai sur CDG→BKK", !!carte);
  check("le rapport ne contient AUCUNE auto-citation dans ses sources",
    !(rapport.sources ?? []).some((s) => /mydogcanfly\.com/i.test(s.url)),
    (rapport.sources ?? []).filter((s) => /mydogcanfly\.com/i.test(s.url)).map((s) => s.url).slice(0, 2).join(" | "));
  const fret = (carte?.placement_decisions ?? []).find((d) => d.placement === "cargo");
  check("la décision fret porte la source AUDITÉE du canal", fret?.source?.url === AUDIT.url,
    JSON.stringify(fret?.source ?? null));

  const dom = await rendreCartes("", { ...rapport, airlines: [carte] });
  const cartes = [...dom.window.document.querySelectorAll(".acard")];
  check("une carte est RENDUE dans le DOM", cartes.length === 1, `${cartes.length} carte(s)`);
  const html = cartes[0]?.innerHTML ?? "";
  const hrefs = [...(cartes[0]?.querySelectorAll("a[href]") ?? [])].map((a) => a.getAttribute("href"));
  check("la carte rendue ne contient AUCUN lien MyDogCanFly",
    !hrefs.some((h) => /mydogcanfly\.com/i.test(h || "")),
    hrefs.filter((h) => /mydogcanfly\.com/i.test(h || "")).join(" | "));
  check("la carte rendue ne mentionne nulle part mydogcanfly.com", !/mydogcanfly\.com/i.test(html),
    (html.match(/https?:\/\/[^"']*mydogcanfly\.com[^"']*/) || ["(dans le texte)"])[0]);
  check("la carte rendue porte un lien vers l'URL auditée du fret", hrefs.includes(AUDIT.url),
    hrefs.join(" | ") || "aucun lien");
  const lienSource = [...(cartes[0]?.querySelectorAll("a[href]") ?? [])].find((a) => a.getAttribute("href") === AUDIT.url);
  check("ce lien est VISIBLE et nommé par son canal", (lienSource?.textContent || "").includes("thaiairways.com")
    && /cargo|fret|carga/i.test(lienSource?.textContent || ""), lienSource ? `« ${lienSource.textContent} »` : "absent");
  dom.window.close();
}

// ---- 5. Chaque bloc contradictoire, dans chaque langue, VÉRIFIÉ et non compté -----------------
console.log(`\n=== 5. Les ${CIBLE.length} canaux contradictoires × 4 langues : statut ET libellé ===`);
{
  check("78 canaux contradictoires sur 71 fiches, relus des fiches et du contrat runtime",
    CONTRADICTOIRES.length === 78 && new Set(CONTRADICTOIRES.map((c) => c.slug)).size === 71,
    `${CONTRADICTOIRES.length} canaux · ${new Set(CONTRADICTOIRES.map((c) => c.slug)).size} fiches`);
  let pagesLues = 0, blocsVerifies = 0;
  const absentes = [], anomalies = [];
  for (const slug of FICHES_CIBLE) {
    for (const [langue, p] of LANGUES) {
      const rel = path.join(p, "airlines", slug, "index.html");
      if (!existe(rel)) { absentes.push(rel); continue; }
      pagesLues++;
      const doc = new JSDOM(lire(rel)).window.document;
      for (const c of CIBLE.filter((x) => x.slug === slug)) {
        const blocs = doc.querySelectorAll(`[data-placement="${c.placement}"]`);
        if (blocs.length !== 1) { anomalies.push(`${rel}#${c.placement} : ${blocs.length} bloc(s)`); continue; }
        const statut = blocs[0].getAttribute("data-status");
        if (statut !== c.statut) { anomalies.push(`${rel}#${c.placement} : data-status=${statut} ≠ ${c.statut}`); continue; }
        const pastille = blocs[0].querySelector(".t .pill")?.textContent?.trim() ?? null;
        if (pastille !== libelle(langue, c.statut)) {
          anomalies.push(`${rel}#${c.placement} : pastille « ${pastille} » ≠ « ${libelle(langue, c.statut)} »`);
          continue;
        }
        blocsVerifies++;
      }
    }
  }
  const pagesAttendues = FICHES_CIBLE.length * 4, blocsAttendus = CIBLE.length * 4;
  check(`${pagesAttendues} pages localisées RÉELLEMENT lues, aucune absente`,
    pagesLues === pagesAttendues && absentes.length === 0,
    `lues ${pagesLues} · absentes ${absentes.length}${absentes[0] ? " — ex. " + absentes[0] : ""}`);
  check(`${blocsAttendus} blocs vérifiés (statut technique ET libellé publié), aucune anomalie`,
    blocsVerifies === blocsAttendus && anomalies.length === 0,
    `vérifiés ${blocsVerifies}/${blocsAttendus}${anomalies.length ? " — " + anomalies.slice(0, 3).join(" | ") : ""}`);
  /* Une cible vide passerait tous les contrôles ci-dessus sans rien prouver. */
  check("la cible de cette portée n'est pas vide", CIBLE.length > 0, String(CIBLE.length));
}

console.log(`\n${pass} OK, ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
