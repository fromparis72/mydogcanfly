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
import { loadKB, preuveAuditee, t as tt, formatDate } from "./packages/knowledge/src/index.ts";
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
/* MOUVEMENT NOMMÉ (10/09/2026, arbitrage Codex — pastilles courtes) : la capsule « à confirmer » lit `premium.to_confirm_short`
   (« À confirmer ») ; `air.to_confirm` reste la phrase du bandeau de tête quand rien n'est décidé. */
const CLE_LIBELLE = { allowed: "premium.allowed", accepted_with_conditions: "premium.accepted_conditions", denied: "premium.not_allowed", confirmation_required: "premium.to_confirm_short" };
const libelle = (langue, statut) => tt(langue, CLE_LIBELLE[statut]);

/** La preuve du fret Thai, telle que le CORRECTIF D'ARBITRAGES la fixe (09/09/2026, Codex, tranché par Philippe).
 *  MOUVEMENT NOMMÉ : jusqu'ici, ce témoin relisait la source auditée du manifeste de migration (page passager AVIH,
 *  « contactez Cargo », 13/08). L'arbitrage l'a SUPERSÉDÉE par la page THAI Cargo ; le manifeste garde l'ancienne, la
 *  page construite doit servir la nouvelle — lien, citation visible, date rendue, confiance. La forme du témoin ne
 *  change pas : ce que la page affiche EST la preuve de référence, champ par champ. */
const AUDIT = (() => {
  const c = JSON.parse(fs.readFileSync(path.join(ROOT, "mesures", "preuves", "correctif-arbitrages-2026-09-09", "CORRECTIF_ARBITRAGES_POLITIQUES_COMPAGNIES_2026-09-09.json"), "utf8"));
  const f = c.replace_facts.find((x) => x.airline_id === "airline_thai_airways" && x.placement === "cargo");
  return { url: f.url, source_type: c.provenance_defaults.source_type, verified_date: c.provenance_defaults.verified_date, review_due: c.provenance_defaults.review_due,
    confidence: c.provenance_defaults.confidence, reviewer: c.provenance_defaults.reviewer, quote: f.quote, quote_language: f.quote_language, locator: f.locator };
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
  const domStatique = new JSDOM(lire(rel));
  const statique = domStatique.window.document.getElementById("conav-title")?.textContent ?? "";
  domStatique.window.close();
  const { dom, doc, erreurs } = await chargerCharge(rel, `https://mydogcanfly.com/${p}countries/${SENTINELLE_PAYS.slug}/#?via=airline_air_france`);
  check(`${langue} : zéro erreur console sur la page pays`, erreurs.length === 0,
    erreurs.map((e) => e.split("\n")[0]).join(" | ").slice(0, 180));
  const titre = doc.getElementById("conav-title")?.textContent ?? "";
  /* Le texte EXACT, langue par langue. Chercher « Air France » ne testait que la substitution du
     nom : la faute d'accord « Tu envisagiez », relevée au contre-test navigateur du 16/08/2026,
     passait au vert et pouvait revenir.

     Les trois premières formes sont écrites en clair dans `CountryOnward` (`T(en, fr, es)`) ; la
     portugaise vient de la table `ptInline`, superposée par `inlineT`. Les quatre sont figées ici
     à leur texte EXACT — c'est le patron déjà retenu pour les badges d'itinéraire dans
     `test-flightfinder-harness.cjs` : vérifier que deux libellés « diffèrent » laisserait passer
     une clé manquante retombant sur l'anglais, ou deux langues inversées. */
  const TITRE_VIA = {
    en: "Considering Air France?",
    fr: "Tu envisageais Air France ?",
    es: "¿Estás considerando Air France?",
    pt: "Pensando na Air France?",
  };
  check(`${langue} : CountryOnward — le titre devient EXACTEMENT « ${TITRE_VIA[langue]} »`,
    titre === TITRE_VIA[langue] && titre !== statique, `statique « ${statique} » · après « ${titre} »`);
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

// ---- 2 bis. AUCUN SEUIL NON PROUVÉ NE SORT SUR UNE FICHE ------------------------------------
console.log("\n=== 2 bis. Une fiche « à confirmer » ne publie AUCUN seuil, dimension ni modalité ===");
{
  /* LE DÉFAUT QUE CE PARAGRAPHE FERME, ET QUE J'AVAIS MANQUÉ.
   *
   * J'ai écrit que « rien de faux n'atteint l'écran » après n'avoir regardé que la PASTILLE.
   * C'était inexact : sous une pastille « à confirmer », la fiche publiait encore le texte
   * éditorial historique — « moins de 8 kg », « 46 × 28 × 24 cm », « soute jusqu'à 75 kg » chez
   * Air France, l'âge minimal et les exceptions de routes chez Thai Airways — par SIX surfaces :
   * `channels[].detail`, la FAQ (et son balisage `FAQPage`), `crate`, `temperature`,
   * `assistance` et `goodToKnow`. Masquer la première en republiant les cinq autres n'aurait
   * rien fermé : c'est ce contrôle, sur le DOM CONSTRUIT, qui les a toutes trouvées.
   *
   * La lecture a lieu dans un PROCESSUS COURT (`test-lib/verifier-seuils-fiches.mjs`) : écrite
   * d'abord ici, elle a fait passer le processus principal de 355 à 565 Mo et rougir son propre
   * plafond de 400 Mo — j'avais introduit, en écrivant un contrôle, la régression que le harnais
   * surveille ailleurs. Les motifs cherchés sont ceux des fiches elles-mêmes. */
  const MOTIFS = [
    ["\\b\\d+\\s*(?:kg|kilos?)\\b", "i", "un seuil de poids"],
    ["\\d+\\s*[×x]\\s*\\d+\\s*[×x]\\s*\\d+", "i", "des dimensions de caisse"],
    ["Updated \\d|Mise à jour le|Actualizado el|Atualizado em", "i", "une date de mise à jour globale"],
    ["No cabin, no hold|Cargo only|No pets in the cabin|No cabin, anywhere|No hold\\b", "i", "une puce de refus"],
  ];
  /* Le désaveu, dans les quatre langues — la phrase par laquelle le bloc des races se déclare
     NÔTRE et non celui de la compagnie. Sans elle, son texte reste dans l'examen. */
  const CLASSIF = ["MyDogCanFly's own brachycephalic|classification brachycéphale de MyDogCanFly|clasificación braquicéfala propia|classificação braquicefálica do pr", ""];

  const FICHES = [...new Set(SENTINELLES_COMPAGNIES.map((x) => x.slug))];
  const taches = [];
  for (const slug of FICHES) for (const [langue, pfx] of LANGUES) {
    taches.push({ rel: path.join(pfx, "airlines", slug, "index.html"), slug, langue });
  }
  const require2 = createRequire(import.meta.url);
  const { spawnSync: spawn2 } = require2("node:child_process");
  const os2 = require2("node:os");
  const dossier2 = fs.mkdtempSync(path.join(os2.tmpdir(), "mdcf-seuils-"));
  let res2 = null;
  try {
    const f2 = path.join(dossier2, "taches.json");
    fs.writeFileSync(f2, JSON.stringify({ dist: DIST, motifs: MOTIFS, classif: CLASSIF, taches }));
    const r2 = spawn2(process.execPath, ["--max-old-space-size=512",
      path.join(ROOT, "test-lib", "verifier-seuils-fiches.mjs"), f2],
      { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    check("le lot de lecture des fiches a abouti sous 512 Mo de tas", r2.status === 0,
      (r2.stderr || "").split("\n").find((l) => /heap|Error/i.test(l)) ?? `code ${r2.status}`);
    if (r2.status === 0) res2 = JSON.parse(r2.stdout);
  } finally {
    fs.rmSync(dossier2, { recursive: true, force: true });
  }

  if (res2) {
    /* Chaque fuite est NOMMÉE avec son extrait : un compte seul ne dirait pas quoi corriger. */
    for (const f of res2.fuites) {
      check(`${f.slug} · ${f.langue} : aucune publication ${f.quoi}`, false, `« …${f.extrait}… »`);
    }
    check(`aucune fiche sentinelle ne publie de seuil, dimension, date ou refus non prouvé`,
      res2.fuites.length === 0, `${res2.fuites.length} fuite(s)`);
    /* ── ET AUCUN TEXTE DE DÉVELOPPEMENT (contre-test navigateur du 06/09/2026) ─────────────
       Un commentaire que j'avais écrit pour expliquer une correction s'est publié lui-même, sur
       toutes les fiches et dans les quatre langues, parce qu'il citait la syntaxe de commentaire
       et l'a donc refermé par anticipation. Les tests DOM cherchaient des éléments nommés ;
       aucun ne lisait ce qu'un visiteur LIT. Celui-ci le fait. */
    for (const f of res2.fuitesDev) {
      check(`${f.slug} · ${f.langue} : aucun texte de développement publié`, false, `« …${f.extrait}… »`);
    }
    check("aucune fiche ne publie de texte de développement",
      res2.fuitesDev.length === 0, `${res2.fuitesDev.length} fuite(s)`);
    /* JAMAIS VERT FAUTE DE MATIÈRE : sans pages lues, tout ce qui précède ne prouve rien. */
    check(`témoin : des fiches ont RÉELLEMENT été lues (${res2.pagesLues})`,
      res2.pagesLues === taches.length, `${res2.pagesLues}/${taches.length}`);
    /* Et le témoin de l'EXCLUSION : elle a porté sur des blocs réels, tous munis de leur désaveu. */
    /* Le bloc brachycéphale est SUPPRIMÉ des fiches compagnies : sa présence même — déclenchée
       par une restriction non prouvée — associait ces races à la compagnie. Le compteur
       `blocsNotres` reste lu comme contre-épreuve : il doit valoir 0 ici. */
    check("aucun bloc brachycéphale sur les fiches compagnies (sa présence associait ces races à la compagnie)",
      res2.brachyPresents.length === 0 && res2.blocsNotres === 0,
      res2.brachyPresents.slice(0, 3).join(" | "));
    check("les 4 zones publiques ne portent plus l'ancienne `metaDesc`",
      res2.metaAnciennes.length === 0, res2.metaAnciennes.slice(0, 3).join(" | "));
    check("les 4 zones publiques sont toutes RENSEIGNÉES", res2.zonesVides.length === 0,
      res2.zonesVides.slice(0, 3).join(" | "));
    check("…et portent EXACTEMENT la même description — une seule définition",
      res2.metaDivergentes.length === 0, res2.metaDivergentes.slice(0, 3).join(" | "));
    check("aucune section vide sur les fiches sentinelles", res2.sectionsVides.length === 0,
      res2.sectionsVides.slice(0, 4).join(" | "));
    /* NON-VACUITÉ : « aucune section vide » passerait aussi s'il n'y avait AUCUNE carte à lire. */
    check(`témoin : des cartes ont RÉELLEMENT été examinées (${res2.cartesExaminees})`,
      res2.cartesExaminees >= res2.pagesLues);

    /* ═══ LA SYNTHÈSE LOCALISÉE PROUVÉE — les témoins DOM quadrilingues (annexe 51) ═══════════
       Arbitrage de Philippe du 11/09/2026, relayé par Codex, pris sur la fiche Air France lue en
       portugais : le visiteur y lisait un état traduit, puis une phrase en français, et repartait
       sans le chiffre. La citation verbatim reste dans sa langue — une citation traduite n'est plus
       une citation — et chaque fait EFFECTIVEMENT PROUVÉ est remis en mots dans la langue de la
       page, juste sous l'état.

       Ces contrôles lisent le DOM CONSTRUIT, pas le YAML. C'est délibéré, et c'est une erreur déjà
       payée : le 11/09, j'ai affirmé que le visiteur portugais voyait le seuil de 8 kg après avoir
       mesuré 296 blocs `detail` dans quatre langues DANS LES FICHES. La capture de Philippe a
       montré l'inverse — `channels[].detail` avait été retiré de la carte le 05/09. Une donnée
       présente à la source ne prouve rien de ce qui est rendu. */
    const canaux = res2.canaux;
    const AF = canaux.filter((c) => c.slug === "air-france");
    const dim = (c) => AF.filter((x) => x.placement === c);
    check(`témoin : les 12 canaux d'Air France ont été lus (3 × 4 langues)`, AF.length === 12, `${AF.length}`);

    for (const placement of ["cabin", "hold"]) {
      const lot = dim(placement);
      check(`air-france.${placement} : les quatre langues publient une synthèse`,
        lot.length === 4 && lot.every((c) => c.fait && c.fait.length > 0),
        lot.map((c) => `${c.langue}=${c.fait ?? "(aucune)"}`).join(" | "));
      /* LOCALISÉE, et pas seulement présente : quatre textes DIFFÉRENTS. Une synthèse rendue en
         anglais sur les quatre pages passerait le contrôle précédent sans rien résoudre. */
      check(`air-france.${placement} : les quatre synthèses sont RÉELLEMENT distinctes`,
        new Set(lot.map((c) => c.fait)).size === 4, lot.map((c) => `${c.langue}: ${c.fait}`).join(" | "));
      /* LE RATTACHEMENT, VU DEPUIS LA PAGE. Tout nombre affiché en synthèse doit se retrouver dans
         la phrase citée de LA MÊME carte. C'est la contre-épreuve de la permutation, au niveau du
         rendu : déplacer une preuve d'un canal à l'autre ferait tomber celui-ci même si le contrat
         d'ingestion venait à être contourné. */
      for (const c of lot) {
        check(`air-france.${placement} · ${c.langue} : chaque nombre de la synthèse est dans la citation de la MÊME carte`,
          c.faitNombres.length > 0 && c.faitNombres.every((n) => c.citationNombres.includes(n)),
          `synthèse ${JSON.stringify(c.faitNombres)} / citation ${JSON.stringify(c.citationNombres)}`);
      }
      /* LA CITATION N'EST PAS TRADUITE : le même texte, au caractère près, sur les quatre pages. */
      check(`air-france.${placement} : la citation est IDENTIQUE dans les quatre langues`,
        new Set(lot.map((c) => c.citation)).size === 1, `${new Set(lot.map((c) => c.citation)).size} versions`);
      /* …et elle DIT sa langue, pour le lecteur d'écran comme pour le navigateur. */
      const langueSource = politique("airline_air_france", placement)?.source?.quote_language ?? null;
      check(`air-france.${placement} : la citation porte lang="${langueSource}" partout`,
        langueSource !== null && lot.every((c) => c.citationLangue === langueSource),
        lot.map((c) => `${c.langue}→${c.citationLangue}`).join(" | "));
      /* L'EN-TÊTE ANNONCE LA LANGUE DU TEXTE ORIGINAL, dans la langue de la page. */
      check(`air-france.${placement} : l'en-tête de preuve annonce la langue, et diffère d'une page à l'autre`,
        new Set(lot.map((c) => c.enTetePreuve)).size === 4, lot.map((c) => `${c.langue}: ${c.enTetePreuve}`).join(" | "));
      /* L'ORDRE DE LECTURE : la synthèse AVANT la preuve, jamais l'inverse. */
      check(`air-france.${placement} : la synthèse précède le volet de preuve dans les quatre langues`,
        lot.every((c) => c.faitAvantPreuve === true), lot.map((c) => `${c.langue}=${c.faitAvantPreuve}`).join(" | "));
      /* LE LOCALISATEUR reste une métadonnée : « Important! » ne prend plus une ligne à lui seul. */
      check(`air-france.${placement} : le localisateur vit dans les métadonnées, pas sur sa propre ligne`,
        lot.every((c) => c.locatorHorsMeta === false) && lot.some((c) => c.locatorDansMeta === true),
        lot.map((c) => `${c.langue}: hors=${c.locatorHorsMeta} dans=${c.locatorDansMeta}`).join(" | "));
    }

    /* LA DIMENSION INTERDITE. L'arbitrage est explicite : « Pour Air France, ne pas afficher
       46 × 28 × 24 cm » — la fiche les porte, aucune citation ne les établit. Le contrôle général
       de seuils ne les verrait plus dans `.fait`, puisque `.fait` est retiré de son examen : c'est
       donc ici, sur le texte retiré lui-même, qu'on vérifie qu'elles n'y sont pas. */
    check("aucune synthèse ne publie les dimensions non citées d'Air France (46 × 28 × 24)",
      AF.every((c) => !/46|28|24/.test(c.fait ?? "")), AF.map((c) => c.fait).filter(Boolean).join(" | "));

    /* LE TÉMOIN NÉGATIF, sur la même page construite : un canal SANS rattachement ne publie aucune
       synthèse. Sans lui, « la synthèse paraît » serait vrai d'un gabarit qui en met partout. */
    check("air-france.cargo : aucune synthèse, dans aucune langue — rien n'y est attesté",
      dim("cargo").length === 4 && dim("cargo").every((c) => c.fait === null),
      dim("cargo").map((c) => `${c.langue}=${c.fait}`).join(" | "));
    const autres = canaux.filter((c) => c.slug !== "air-france");
    check(`aucune autre fiche sentinelle ne publie de synthèse (${autres.length} canaux lus)`,
      autres.length > 0 && autres.every((c) => c.fait === null),
      autres.filter((c) => c.fait).map((c) => `${c.slug}.${c.placement} ${c.langue}: ${c.fait}`).join(" | "));

    /* LES EXCLUSIONS DU CONTRÔLE DE SEUILS SONT CHIFFRÉES — une exclusion muette est une porte. */
    check(`témoin : 8 synthèses et ${res2.citationsRetirees} citations retirées de l'examen des seuils`,
      res2.faitsRetires === 8 && res2.citationsRetirees > 0,
      `faits=${res2.faitsRetires} citations=${res2.citationsRetirees}`);
    /* …ET LA TROISIÈME EXCLUSION, celle du balisage `FAQPage`, contre-prouvée phrase par phrase :
       chacune doit être MOT POUR MOT une preuve déjà affichée sur la même page. Une réponse de FAQ
       qui inventerait une citation, ou qui recopierait celle d'un autre canal, ne trouverait pas
       son jumeau et rougirait ici. */
    {
      const affichees = new Map();
      for (const c of res2.canaux) {
        if (!c.citation) continue;
        const cle = `${c.slug}·${c.langue}`;
        if (!affichees.has(cle)) affichees.set(cle, new Set());
        affichees.get(cle).add(c.citation.replace(/^«\s*/, "").replace(/\s*»$/, ""));
      }
      const orphelines = res2.citationsBalisage.filter(
        (x) => !affichees.get(`${x.slug}·${x.langue}`)?.has(x.phrase));
      check(`témoin : ${res2.citationsBalisage.length} citations retirées de la FAQ, toutes affichées par ailleurs`,
        res2.citationsBalisage.length > 0 && orphelines.length === 0,
        orphelines.slice(0, 3).map((x) => `${x.slug}·${x.langue} : « ${x.phrase.slice(0, 60)} »`).join(" | "));
      /* LES DEUX SURFACES, EN NOMBRE ÉGAL. La FAQ publie sa réponse deux fois — pour la machine et
         pour le visiteur. N'en exclure qu'une laissait les quatre pages rouges et m'avait fait
         croire l'exclusion inopérante ; ce compte dit qu'aucune des deux n'a été oubliée. */
      const parSurface = (ou) => res2.citationsBalisage.filter((x) => x.ou === ou).length;
      check(`témoin : la FAQ est lue sur ses DEUX surfaces — ${parSurface("balisage")} en balisage, ${parSurface("visible")} visibles`,
        parSurface("balisage") > 0 && parSurface("balisage") === parSurface("visible"),
        `balisage=${parSurface("balisage")} visible=${parSurface("visible")}`);
    }
  }
}

// ---- 2 quater. LES LECTEURS RETIRÉS NE PEUVENT PAS REVENIR PAR UN INTERRUPTEUR --------------
console.log("\n=== 2 quater. Le gabarit ne LIT plus les champs éditoriaux non sourcés ===");
{
  /* POURQUOI CE CONTRÔLE PORTE SUR LA SOURCE, ET PAS SUR LE DOM.
   *
   * Premier geste : j'avais mis ces blocs derrière `surfacesEditorialesAffichables = false`. Le
   * DOM était propre — et la contre-revue a refusé la fermeture, avec raison : la dette n'était
   * pas devenue inatteignable, elle était à UN BOOLÉEN de distance. Repasser la constante à
   * `true` aurait republié d'un coup les 201 restrictions, les échelles de poids, les gabarits de
   * caisse et les règles de « bon à savoir » — sans qu'aucun contrôle DOM ne bouge avant le fait.
   *
   * Un contrôle sur le rendu ne peut pas dire cela : il constate ce qui sort aujourd'hui, pas ce
   * qu'un booléen ferait sortir demain. C'est donc la SOURCE du gabarit qui est lue, et l'absence
   * de lecteur qui est exigée. Le retour public de ces champs demandera une implémentation neuve,
   * alimentée par des preuves — le coût est voulu.
   *
   * LES COMMENTAIRES SONT RETIRÉS AVANT LA RECHERCHE. Sans cela le contrôle s'accuserait
   * lui-même : chaque suppression est expliquée sur place, en nommant le champ supprimé. Je m'y
   * suis déjà fait prendre une fois dans ce dépôt. */
  const GABARIT = path.join(ROOT, "packages", "ui", "src", "components", "AirlinePremiumPage.astro");
  const brut = fs.readFileSync(GABARIT, "utf8");
  const code = brut
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")   // commentaires JSX
    .replace(/\/\*[\s\S]*?\*\//g, " ")         // blocs /* … */
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");    // lignes // … (sans casser « https:// »)

  /* NON-VACUITÉ : si le décommentage avait vidé le fichier, tout ce qui suit passerait au vert.
     On exige donc que le code utile survive — et avec lui le lecteur CANONIQUE, qui doit rester. */
  check("témoin : le gabarit dépouillé de ses commentaires contient encore son code",
    code.includes("d.channels.map") && code.includes("politiqueDuCanal("), `${code.length} caractères`);

  /* Le score, ses points et la note éditoriale rejoignent la liste : ils vivaient derrière une
     SECONDE constante, `scoreEtNoteAffichables`, que je n'avais pas vue en supprimant la
     première — le même défaut, au même endroit, dans le même fichier. Une seule liste désormais,
     et les deux constantes y sont nommées pour qu'aucune ne puisse reparaître. */
  const RETIRES = ["d.ladder", "d.restrictions", "d.crate", "d.temperature", "d.assistance",
    "d.goodToKnow", "d.chips", "d.metaDesc", "surfacesEditorialesAffichables",
    "rating.score", "rating.points", "d.verdictNote", "scoreEtNoteAffichables", "scoreCls"];
  for (const champ of RETIRES) {
    check(`aucun lecteur de \`${champ}\` dans le gabarit`, !code.includes(champ),
      code.includes(champ) ? code.slice(Math.max(0, code.indexOf(champ) - 50), code.indexOf(champ) + 50).replace(/\s+/g, " ") : "");
  }
  /* CONTRE-ÉPREUVE DU CONTRÔLE LUI-MÊME : il doit savoir attraper un lecteur réintroduit. */
  const sabote = code.replace("d.channels.map", "d.restrictions.map");
  check("contre-épreuve : un lecteur réintroduit SERAIT attrapé", sabote.includes("d.restrictions"));

  /* ── LE PIÈGE DU PORTUGAIS, RENDU IMPOSSIBLE À REFAIRE SANS ÊTRE VU ─────────────────────────
   *
   * `T(en, fr, es)` n'a pas d'argument portugais : `inlineT("pt")` cherche la phrase ANGLAISE
   * dans `translations/pt/inline.json` et, si la clé manque, publie l'anglais sur la page
   * portugaise — sans rien signaler. Ce lot en a produit DEUX occurrences : la phrase d'état vide
   * des fiches races, et le libellé du lien vers l'outil de caisse que j'avais reformulé — perdant
   * au passage la traduction que l'ancien libellé avait. Deux fois la même faute, dont une
   * commise APRÈS l'avoir documentée.
   *
   * On lit donc les phrases anglaises que CE gabarit passe à `T(...)` et on exige qu'elles soient
   * toutes connues de la table portugaise. Le contrôle est borné à ce fichier : il ne prétend pas
   * couvrir le dépôt, et il le dit. */
  /* ── LA PORTÉE BORNÉE A COÛTÉ CE QU'ELLE LAISSAIT OUVERT (07/09/2026) ───────────────────────
   *
   * La version précédente de ce contrôle ne lisait QU'`AirlinePremiumPage.astro`, et le disait :
   * « borné à ce fichier, il ne prétend pas couvrir le dépôt ». Le contre-test navigateur de la
   * préversion 82fcf408 a trouvé trois phrases anglaises sur `/pt/about/` — un gabarit hors de
   * cette portée, et dont j'avais moi-même réécrit ces trois phrases au lot d'avant. La mesure
   * complète, faite après coup, en a relevé 56 sur 12 gabarits.
   *
   * La borne est donc levée : le contrôle lit TOUT fichier de `packages/ui/src` qui appelle
   * `inlineT` ou `inlineF`, et exige que chaque phrase anglaise passée à `T(...)`, `L(...)` ou
   * `F(...)` existe dans la table portugaise. Ces trois noms sont les alias locaux réellement
   * employés dans le dépôt ; les chercher par leur nom d'appel, et non par le nom de l'import,
   * est ce qui permet de couvrir des gabarits qui les nomment différemment.
   *
   * Ce que le contrôle ne prétend pas faire : juger la QUALITÉ d'une traduction, ni couvrir les
   * textes qui ne passent pas par ce mécanisme (contenu Markdown des guides, données de la base).
   * Il ferme un trou précis — la clé absente qui publie l'anglais sans rien dire — et rien de plus. */
  const ptTable = JSON.parse(fs.readFileSync(
    path.join(ROOT, "packages", "knowledge", "translations", "pt", "inline.json"), "utf8"));
  const sansCommentaires = (t) => t
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, " ")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");
  const fichiersUI = [];
  (function balayer(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const chemin = path.join(dir, e.name);
      if (e.isDirectory()) balayer(chemin);
      else if (/\.(astro|ts)$/.test(e.name)) fichiersUI.push(chemin);
    }
  })(path.join(ROOT, "packages", "ui", "src"));

  /* LES ALIAS SONT DÉCOUVERTS, PAS DEVINÉS (07/09/2026, deuxième rédaction).
   *
   * La première liste était écrite en dur : `T`, `L`, `F`. Le dépôt en emploie deux autres —
   * `Q` et `q` — et appelle aussi `inlineT(locale)(…)` sans passer par une constante. Neuf appels
   * échappaient donc au balayage : 852 vus pour 861 réels, et le contrôle annonçait pourtant une
   * couverture complète. Un nom d'alias écrit à la main est une supposition sur le code ; le code
   * le déclare, il suffit de le lire.
   *
   * LES LITTÉRAUX SONT DÉCODÉS PAR JSON, PAS PAR DEUX `replace`. Les deux que j'avais écrits ne
   * traitaient que `\'` et `\"`. Une clé contenant `\n` — le corps du courriel des fiches
   * aéroport — était donc comparée avec ses barres obliques inverses intactes, tandis que la
   * table portugaise porte le vrai saut de ligne : les clés diffèrent, `inlineT` ne trouve rien,
   * et les 268 fiches d'aéroport portugaises préremplissaient le courriel EN ANGLAIS pendant que
   * cette garde restait verte. */
  /* LES ALIAS SE DÉCOUVRENT PAR FICHIER, ET C'EST UNE SECONDE CORRECTION. Une première version
     les collectait pour tout le dépôt : `q` est un alias de traduction dans un fichier, et le
     CONSTRUCTEUR de chaîne de requête dans `RelatedTools.astro` — quatre appels — plus un
     paramètre de fonction dans `faq.ts`. Un même nom, deux choses. Réunis globalement, ces cinq
     homonymes gonflaient le compte sans être des traductions. C'est l'écart entre les 861 appels
     annoncés en contre-revue et les 854 que je mesure : 854 + 5 homonymes + les deux définitions
     `Q`/`q` comptées à part. Le nom d'un alias n'a de sens que dans la portée où il est déclaré. */
  /* UN ALIAS EST `const T = inlineT(locale);` — PAS `const q = inlineT(locale)(en, fr, es);`.
     Le second est le RÉSULTAT d'un appel direct : `q` y contient une chaîne traduite, pas une
     fonction. Ma première découverte confondait les deux et déclarait `q` alias de `faq.ts`,
     puis s'étonnait qu'il ne serve à aucun appel. La parenthèse fermante doit donc être suivie
     d'autre chose qu'une nouvelle parenthèse ouvrante. L'appel direct lui-même reste lu : il est
     la seconde branche du motif d'appel. */
  const aliasDe = (src) => [...new Set([...src.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*inline[TF]\s*\([^)]*\)\s*(?!\()/g)].map((m) => m[1]))];
  const alias = new Set();
  for (const f of fichiersUI) for (const a of aliasDe(fs.readFileSync(f, "utf8"))) alias.add(a);
  /* UN DÉCODEUR D'ÉCHAPPEMENTS EXPLICITE, ET C'EST LA TROISIÈME RÉDACTION DE CE DÉTAIL.
     La première ne traitait que `\'` et `\"` : la clé multiligne du courriel échappait. La
     deuxième passait par `JSON.parse` après avoir ré-échappé les guillemets — elle cassait sur
     les littéraux qui en contiennent DÉJÀ d'échappés (`privacy.astro`, `terms.astro`). Un
     littéral JavaScript se décode selon ses propres règles ; les emprunter à JSON était un
     raccourci, et un raccourci de plus dans un contrôle qui doit être exact. */
  const ECHAPPES = { n: "\n", t: "\t", r: "\r", b: "\b", f: "\f", v: "\v", 0: "\0" };
  const decoder = (brut) => {
    let out = "";
    for (let k = 0; k < brut.length; k++) {
      if (brut[k] !== "\\") { out += brut[k]; continue; }
      const c = brut[++k];
      if (c === undefined) return null;                       // barre oblique finale : illisible
      if (c === "u") {
        if (brut[k + 1] === "{") {
          const fin = brut.indexOf("}", k);
          if (fin === -1) return null;
          out += String.fromCodePoint(parseInt(brut.slice(k + 2, fin), 16)); k = fin;
        } else { out += String.fromCharCode(parseInt(brut.slice(k + 1, k + 5), 16)); k += 4; }
      } else if (c === "x") { out += String.fromCharCode(parseInt(brut.slice(k + 1, k + 3), 16)); k += 2; }
      else if (c === "\n") { /* continuation de ligne : rien */ }
      else out += (c in ECHAPPES ? ECHAPPES[c] : c);          // \' \" \` \\ \$ et tout le reste
    }
    return out;
  };
  const motifPour = (al) => new RegExp(
    `(?:\\b(?:${al.join("|")})|inline[TF]\\s*\\([^)]*\\))\\(\\s*(["'\`])((?:\\\\.|(?!\\1)[\\s\\S])*)\\1\\s*,`, "g");

  let gabaritsLus = 0, phrasesLues = 0, indecodables = 0;
  const fuitesPt = [];
  for (const f of fichiersUI) {
    const src = sansCommentaires(fs.readFileSync(f, "utf8"));
    if (!/inlineT\(|inlineF\(/.test(src)) continue;
    const al = aliasDe(src);
    if (!al.length) continue;
    gabaritsLus++;
    for (const m of src.matchAll(motifPour(al))) {
      const en = decoder(m[2]);
      phrasesLues++;
      if (en === null) { indecodables++; continue; }
      if (!(en in ptTable)) fuitesPt.push(`${path.relative(ROOT, f)} : « ${en.slice(0, 55)}… »`);
    }
  }
  /* LE COMPTE EST EXIGÉ, PAS DÉCORATIF. 861 est la mesure du 07/09/2026 ; il ne peut que MONTER
     (un gabarit qui ajoute une phrase) et jamais descendre sans qu'on le sache. */
  check(`témoin : ${alias.size} alias découverts (${[...alias].sort().join(", ")}), ${gabaritsLus} gabarits, ${phrasesLues} appels lus`,
    alias.size >= 4 && gabaritsLus >= 12 && phrasesLues >= 854,
    `alias=${alias.size} gabarits=${gabaritsLus} appels=${phrasesLues} (plancher : 854, mesuré le 07/09/2026 — voir le commentaire sur les homonymes)`);
  check("tout littéral passé à un alias est décodable", indecodables === 0, `${indecodables} littéral(aux) illisible(s)`);
  check("aucune phrase d'aucun gabarit ne retombera en anglais sur une page portugaise",
    fuitesPt.length === 0, `${fuitesPt.length} fuite(s) — ${fuitesPt.slice(0, 3).join(" | ")}`);

  /* TÉMOINS, UN PAR TROU RÉELLEMENT MESURÉ.
     Ils ne présument aucun nom d'alias : le premier exige que CHAQUE alias découvert serve à au
     moins un appel effectivement lu — un alias qu'on découvre mais qu'on ne lit jamais serait un
     trou silencieux, exactement celui que `Q` et `q` ouvraient. */
  {
    const parAlias = new Map([...alias].map((a) => [a, 0]));
    for (const f of fichiersUI) {
      const src = sansCommentaires(fs.readFileSync(f, "utf8"));
      const al = aliasDe(src);
      if (!al.length) continue;
      for (const m of src.matchAll(motifPour(al))) {
        const nom = /^([A-Za-z_$][\w$]*)\s*\(/.exec(m[0])?.[1];
        if (nom && parAlias.has(nom)) parAlias.set(nom, parAlias.get(nom) + 1);
      }
    }
    const muets = [...parAlias].filter(([, n]) => n === 0).map(([a]) => a);
    check(`témoin d'alias : les ${alias.size} alias découverts servent tous à au moins un appel lu (${[...parAlias].map(([a, n]) => `${a}:${n}`).join(", ")})`,
      muets.length === 0, `alias sans aucun appel lu : ${muets.join(", ")}`);

    const MULTILIGNE = "Airport: {A}\nTerminal:";
    const cleMultiligne = Object.keys(ptTable).find((k) => k.startsWith(MULTILIGNE));
    check("témoin de littéral : la clé multiligne du courriel des fiches aéroport est décodée et traduite",
      Boolean(cleMultiligne), "la clé à vrais sauts de ligne n'existe pas dans la table portugaise");

    /* Le décodeur doit rendre EXACTEMENT ce qu'un moteur JavaScript rendrait, y compris sur les
       trois formes qui l'ont fait échouer : saut de ligne, guillemet déjà échappé, apostrophe. */
    const eprouves = [
      ["a\\nb", "a\nb"], ['il dit \\"oui\\"', 'il dit "oui"'], ["l\\'an", "l'an"],
      ["\\u00e9t\\u00e9", "été"], ["100\\\\%", "100\\%"],
    ];
    const faux = eprouves.filter(([brut, attendu]) => decoder(brut) !== attendu);
    check("témoin de décodage : saut de ligne, guillemet échappé, apostrophe, \\u et barre oblique",
      faux.length === 0, `${faux.length} forme(s) mal décodée(s)`);
  }

  /* NON-VACUITÉ : une phrase absente de la table DOIT être vue. On sabote une copie de la table
   * en retirant une clé réellement employée, et on rejoue le même balayage. */
  {
    const uneClePresente = [...fs.readFileSync(
      path.join(ROOT, "packages", "ui", "src", "components", "FlightFinder.astro"), "utf8")
      .matchAll(/\bT\(\s*"((?:[^"\\]|\\.)+)"\s*,/g)]
      .map((m) => m[1].replace(/\\"/g, '"')).find((ph) => ph in ptTable);
    const tableSabotee = { ...ptTable };
    delete tableSabotee[uneClePresente];
    let vue = false;
    for (const f of fichiersUI) {
      const src = sansCommentaires(fs.readFileSync(f, "utf8"));
      if (!/inlineT\(|inlineF\(/.test(src)) continue;
      for (const m of src.matchAll(motifPour(aliasDe(src)))) {
        const en = decoder(m[2]);
        if (en !== null && !(en in tableSabotee)) vue = true;
      }
    }
    check("contre-épreuve : retirer une clé de la table portugaise fait rougir le balayage",
      Boolean(uneClePresente) && vue);

    /* CONTRE-ÉPREUVE DU FICHIER JETABLE — un gabarit qui n'emploie QUE l'appel direct, sans
       déclarer le moindre alias, doit être lu. C'est le cas que le `continue` supprimé laissait
       passer ; il n'existe dans aucun fichier réel, on le fabrique donc pour l'éprouver. */
    {
      const jetable = path.join(ROOT, "packages", "ui", "src", `.balayage-temoin-${process.pid}.astro`);
      const phraseInconnue = `Phrase qui n'existe dans aucune table — témoin ${process.pid}`;
      fs.writeFileSync(jetable,
        `---
import { inlineT } from "@mydogcanfly/knowledge";
const titre = inlineT(locale)("${phraseInconnue}", "fr", "es");
---
<p>{titre}</p>
`);
      try {
        const src = sansCommentaires(fs.readFileSync(jetable, "utf8"));
        const aucunAlias = aliasDe(src).length === 0;
        let vueSansAlias = false;
        for (const m of src.matchAll(motifPour(aliasDe(src))))
          if (decoder(m[2]) === phraseInconnue) vueSansAlias = true;
        check("contre-épreuve : un gabarit sans alias déclaré, n'employant que l'appel direct, est lu",
          aucunAlias && vueSansAlias,
          aucunAlias ? "l'appel direct n'est PAS lu — un tel gabarit publierait l'anglais sans être vu"
                     : "le fichier témoin déclare un alias : il n'éprouve pas le cas visé");
      } finally { fs.rmSync(jetable, { force: true }); }
    }
  }
}

// ---- 2 ter. LA BRANCHE `allowed` N'A PLUS DE PORTEUR RÉEL — TÉMOIN SYNTHÉTIQUE ---------------
console.log("\n=== 2 ter. La branche `allowed`, éprouvée par un témoin SYNTHÉTIQUE nommé ===");
{
  /* Air France cabine portait `allowed` : depuis la frontière, plus AUCUNE des 302 politiques ne
   * l'est. La sentinelle a donc changé d'état (mouvement nommé dans `sentinelles-entites.mjs`),
   * et la couverture d'un vrai refus est passée à British Airways cabine, seule décision fondée
   * sur une citation stricte. La branche `allowed`, elle, n'a plus de porteur : elle est éprouvée
   * ICI, sur une politique SYNTHÉTIQUE explicitement nommée, jamais sur une page du site. Sans ce
   * paragraphe, le rendu d'un canal accepté ne serait plus éprouvé nulle part. */
  const { cleLibelleStatut, classeStatut } = await import("./packages/ui/src/lib/decisionCanal.ts");
  check("SYNTHÉTIQUE : un canal `allowed` porte la classe et le libellé publiés de l'acceptation",
    classeStatut("allowed") === "ok" && cleLibelleStatut("allowed") === "premium.allowed");
  check("…et les deux autres états gardent les leurs",
    classeStatut("denied") === "no" && cleLibelleStatut("denied") === "premium.not_allowed"
      && classeStatut("confirmation_required") === "warn"
      && cleLibelleStatut("confirmation_required") === "premium.to_confirm_short");
  /* ET LA MESURE QUI JUSTIFIE LE TÉMOIN : aucune fiche réelle ne porte `allowed`. Le jour où une
     citation en produira un, ce contrôle rougira et la sentinelle redeviendra réelle. */
  /* La base déjà chargée en tête de fichier, pas une seconde copie : `loadKB()` n'est pas
     mémoïsé, et deux instances coûtaient ~70 Mo au processus principal — assez pour faire
     rougir son propre plafond de 400 Mo. Une seule base, un seul instrument. */
  const allowedReels = [...kb.airlines.values()].flatMap((a) =>
    ["cabin", "hold", "cargo"].filter((pl) => a.premium?.policy?.[pl]?.status === "allowed").map((pl) => `${a.id}#${pl}`));
  check("état figé : AUCUN canal réel n'est `allowed` — d'où le témoin synthétique",
    allowedReels.length === 0, JSON.stringify(allowedReels.slice(0, 3)));
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
    /* MOUVEMENT NOMMÉ (05/09/2026) : LA DATE GLOBALE DE LA FICHE N'EST PLUS PUBLIÉE, ET NE DOIT
       PLUS L'ÊTRE. Ce contrôle EXIGEAIT qu'elle soit visible. Or une date de fiche ne se rattache
       à aucune preuve précise : affichée en tête, elle laisse croire que tout ce que la page
       affirme a été vérifié à cette date. Seule une date ATTACHÉE À UNE PREUVE peut paraître —
       celle du canal audité, contrôlée juste au-dessus. L'exigence est donc inversée. */
    const page = doc.body.textContent.replace(/\s+/g, " ");
    check(`${langue} : la date globale de la fiche (« ${formatDate(langue, dateFiche)} ») n'est PAS publiée`,
      !page.includes(formatDate(langue, dateFiche)), formatDate(langue, dateFiche));
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

// ---- 4. La CARTE RENDUE du Finder : la preuve du canal, ou AUCUNE ----------------------------
console.log("\n=== 4. Carte RENDUE du Finder : les sources des canaux, et rien d'autre ===");
{
  /* Le défaut relevé au contre-test : la carte affichait `host(a.source_url)` — la source RACINE
     de la compagnie. La première correction n'en retirait que les auto-citations MyDogCanFly ;
     la contre-revue a montré que le critère était faux. Sur les 50 racines restantes, 35 sont de
     simples pages d'accueil (`aerlingus.com`, `airchina.com`) : elles ne prouvent pas davantage
     une politique. Ce qui les disqualifie n'est pas leur domaine, c'est qu'elles ne sont
     rattachées à AUCUN canal. Le champ a donc disparu du contrat moteur.

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

  /* TOUTES les sources racines de la base, auto-citations comprises : aucune ne doit apparaître,
     ni dans le rapport, ni dans une carte. La liste est RELUE de la base, jamais recopiée. */
  const racines = new Map();
  for (const a of kb.airlines.values()) if (a.source?.url) racines.set(a.source.url, a.id);
  check(`les ${racines.size} sources racines de la base sont connues du contrôle`, racines.size >= 100, String(racines.size));

  check("le moteur sert bien une carte Thai sur CDG→BKK",
    (rapport.airlines ?? []).some((a) => a.airline_id === "airline_thai_airways"));
  /* Le champ n'existe plus dans le contrat : aucune carte ne peut le porter, même officielle. */
  const avecChamp = (rapport.airlines ?? []).filter((a) => a.source_url !== undefined).map((a) => a.airline_id);
  check("AUCUNE carte du rapport ne porte `source_url`, même officielle", avecChamp.length === 0,
    avecChamp.slice(0, 3).join(" | "));
  /* Nuance qui compte : 41 URL sont À LA FOIS la racine d'une fiche et la source d'un de ses
     canaux — la page « animaux » de British Airways, par exemple. Elles ont le droit de rester,
     mais parce qu'un CANAL les cite, jamais parce que la fiche les porte. La référence est donc
     l'ensemble des preuves AUDITÉES, calculé par `preuveAuditee` — la fonction du moteur. */
  const auditees = new Set();
  for (const a of kb.airlines.values()) {
    for (const p of Object.values(a.premium?.policy ?? {})) {
      const preuve = preuveAuditee(p);
      if (preuve?.url) auditees.add(preuve.url);
    }
  }
  const racinesDansSources = (rapport.sources ?? []).map((s) => s.url).filter((u) => racines.has(u) && !auditees.has(u));
  check("aucune URL n'est dans les sources du rapport AU TITRE de racine", racinesDansSources.length === 0,
    racinesDansSources.slice(0, 3).join(" | "));
  const fret = (rapport.airlines ?? []).find((a) => a.airline_id === "airline_thai_airways")
    ?.placement_decisions?.find((d) => d.placement === "cargo");
  check("la décision fret Thai porte la source AUDITÉE du canal", fret?.source?.url === AUDIT.url,
    JSON.stringify(fret?.source ?? null));

  /* DEUX cartes, choisies pour être opposées : Thai porte une source auditée sur son fret ;
     Air China n'a AUCUN canal sourcé et une racine qui est une page d'accueil. Sans la seconde,
     le contrôle « aucune racine affichée » passerait sur une carte qui n'en a jamais eu. */
  /* TÉMOIN RE-FONDÉ PAR MESURE (09/09/2026, import strict lot 6) : Air China porte désormais une
     soute CITÉE (« …pets will only be carried following approval by Air China. ») — elle ne peut
     plus témoigner qu'une carte sans canal sourcé n'affiche aucun bloc de sources. Mesuré sur les
     35 cartes de CDG→BKK : cinq compagnies n'ont aucun canal sourcé, trois avec une racine qui est
     une page d'accueil (Aircalin, China Southern, El Al ; LOT et Singapore ont une racine
     mydogcanfly.com). China Southern est retenue. Jamais abaissé. */
  /* RE-FONDÉ ENCORE (09/09/2026, lot 8) : China Southern est citée (cabine refusée, soute sous conditions).
     Mesuré sur CDG→BKK : quatre cartes sans canal sourcé, une seule à racine page d'accueil hors des
     lots 7 et 8 — El Al. Retenue. */
  const TEMOIN_SANS_SOURCE = "airline_el_al";
  const cartes2 = ["airline_thai_airways", TEMOIN_SANS_SOURCE]
    .map((id) => (rapport.airlines ?? []).find((a) => a.airline_id === id));
  check(`le témoin ${TEMOIN_SANS_SOURCE} est servi, sans aucun canal sourcé`,
    !!cartes2[1] && (cartes2[1].placement_decisions ?? []).every((d) => !d.source));
  const racineTemoin = kb.airlines.get(TEMOIN_SANS_SOURCE)?.source?.url ?? "";
  check(`et sa racine EST une page d'accueil — le contrôle a donc quelque chose à attraper`,
    racineTemoin !== "" && new URL(racineTemoin).pathname.replace(/\/$/, "") === "",
    racineTemoin || "racine absente");

  const dom = await rendreCartes("", { ...rapport, airlines: cartes2.filter(Boolean) });
  const rendues = [...dom.window.document.querySelectorAll(".acard")];
  check("les deux cartes sont RENDUES dans le DOM", rendues.length === 2, `${rendues.length} carte(s)`);
  const htmlTotal = rendues.map((c) => c.innerHTML).join("\n");
  const dedans = [...racines.keys()].filter((u) => !auditees.has(u) && htmlTotal.includes(u));
  check("AUCUNE source racine non auditée n'apparaît dans les cartes rendues", dedans.length === 0,
    dedans.slice(0, 3).join(" | "));
  /* La forme POSITIVE, qui ne dépend d'aucune liste noire : tout lien du bloc de sources d'une
     carte DOIT être une preuve auditée de canal. Un lien inventé, emprunté ou par défaut échoue. */
  /* MOUVEMENT NOMMÉ (10/09/2026, annexe 38) : la ligne des sources `acard__psrc` n'existe plus ; les liens de
     source vivent dans la liste du volet fermé « Voir les preuves » (`.acard__proofs ul`). Le lien vers la fiche
     détaillée, dans le même volet mais hors de la liste, n'est pas une source et n'est pas compté. */
  const liensSources = rendues.flatMap((c) => [...c.querySelectorAll(".acard__proofs ul a[href]")].map((a) => a.getAttribute("href")));
  const intrus = liensSources.filter((u) => !auditees.has(u));
  check("tout lien de source affiché sur une carte EST une preuve auditée de canal",
    liensSources.length > 0 && intrus.length === 0, intrus.slice(0, 3).join(" | ") || "aucun lien affiché");
  check("aucune mention de mydogcanfly.com dans les cartes rendues", !/mydogcanfly\.com/i.test(htmlTotal),
    (htmlTotal.match(/https?:\/\/[^"']*mydogcanfly\.com[^"']*/) || ["(dans le texte)"])[0]);

  const [carteThai, carteTemoin] = rendues;
  const hrefs = (c) => [...c.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"));
  check("la carte Thai porte un lien vers l'URL auditée du fret", hrefs(carteThai).includes(AUDIT.url),
    hrefs(carteThai).join(" | ") || "aucun lien");
  const lienSource = [...carteThai.querySelectorAll("a[href]")].find((a) => a.getAttribute("href") === AUDIT.url);
  check("ce lien est VISIBLE et nommé par son canal", (lienSource?.textContent || "").includes("thaicargo.com")
    && /cargo|fret|carga/i.test(lienSource?.textContent || ""), lienSource ? `« ${lienSource.textContent} »` : "absent");
  /* Le témoin : aucun canal sourcé → AUCUN bloc de sources, pas un lien « par défaut ». */
  /* P0-2 DE LA CONTRE-REVUE (Codex, 10/09/2026) : ce témoin lisait encore `.acard__psrc`, retiré de TOUTES
     les cartes par l'annexe 38 — il était vert à vide. Il lit désormais ce qui existe : ni ligne de
     provenance (`.acard__prov`) ni volet des preuves (`details.acard__proofs`) sur la carte sans source. */
  check(`la carte ${TEMOIN_SANS_SOURCE} n'affiche AUCUNE ligne de provenance ni volet des preuves`,
    carteTemoin.querySelector(".acard__prov") === null && carteTemoin.querySelector("details.acard__proofs") === null,
    (carteTemoin.querySelector(".acard__prov") ?? carteTemoin.querySelector("details.acard__proofs"))?.innerHTML?.slice(0, 120) ?? "");
  check(`et ce témoin négatif n'est pas vacant : la carte Thai, elle, porte la ligne de provenance ET le volet`,
    carteThai.querySelector(".acard__prov") !== null && carteThai.querySelector("details.acard__proofs") !== null);
  dom.window.close();
}

// ---- 5. Chaque bloc contradictoire, dans chaque langue, VÉRIFIÉ et non compté -----------------
console.log(`\n=== 5. Les ${CIBLE.length} canaux contradictoires × 4 langues : statut ET libellé ===`);
{
  /* 78 → 79 (28/08/2026, lot RC) : la cabine Virgin Australia passe de « offered » à
   * « case_by_case » (arbitrage A-bis — « Pets in Cabin » n'est ni interdit ni universel).
   * Son canal éditorial (cls `ok`, « Trial ») contredit désormais la décision canonique
   * `confirmation_required` — c'est EXACT et voulu : la page rend la pastille canonique
   * « à confirmer », vérifiée bloc par bloc ci-dessous, et l'éditorial garde sa couleur
   * d'époque comme les 78 autres dettes scellées. Compte figé, mouvement nommé.
   * 79 → 80 (28/08/2026, 2e passe de contre-revue Codex) : la cabine Garuda Indonesia
   * passe de « not_offered » à l'héritage non re-vérifié (l'interdiction n'est prouvée par
   * aucune page officielle lisible). Son éditorial requalifié (cls `warn`, « À confirmer »)
   * se lit « allowed » au sens de litDeCls face à `confirmation_required` : le canal rejoint
   * le registre où la soute et le fret de la même fiche vivaient déjà — 71 fiches, inchangé. */
  /* 80 → 295, 71 fiches → 102 (05/09/2026, FRONTIÈRE DE CONFIANCE). MOUVEMENT NOMMÉ, et le
   * plus large de ce dépôt. Aucune des 302 politiques n'est plus `allowed`, et `denied` ne
   * s'obtient que sur une phrase citée : 301 canaux valent « à confirmer ». Le `cls` éditorial,
   * lui, garde la couleur de son époque — d'où 295 divergences sur 102 fiches, c'est-à-dire
   * presque toutes. Ce n'est pas une régression : c'est la mesure de la dette éditoriale que la
   * frontière vient de rendre visible d'un coup.
   *
   * CETTE DETTE EST INTERNE ET NE PEUT PLUS ATTEINDRE L'INTERFACE. Aucun sous-système de
   * réconciliation n'a été construit — ç'aurait été traiter le symptôme. Ce sont les LECTEURS
   * qui ont disparu : la carte de canal lit `politiqueDuCanal`, la FAQ aussi depuis ce lot, et
   * `ladder`, `restrictions`, `crate`, `temperature`, `assistance`, `goodToKnow` et les puces
   * de date sont masqués par `surfacesEditorialesAffichables`. Le contrôle ci-dessous continue
   * de prouver, bloc par bloc et langue par langue, que c'est bien la décision CANONIQUE qui
   * est publiée sur chacun de ces 295 canaux — donc que la dette reste muette.
   *
   * Ce compte ne bougera plus que par une donnée : chaque citation obtenue en retirera un. */
  /* 295 → 288, 102 → 101 fiches (08/09/2026, import strict V3). Exactement ce que la ligne
   * précédente annonçait : « chaque citation obtenue en retirera un ». Sept canaux dont le
   * `cls` éditorial disait déjà « non » ont reçu la citation qui le prouve — Ryanair ×3 (la fiche
   * sort du registre), easyJet cabine et soute, Qatar cabine, Vueling soute. Les 18 canaux
   * acceptés sous conditions, eux, restent contradictoires : leur éditorial dit « Autorisé ». */
  /* 288 → 285 (08/09/2026, lots 2 et 3) : Cathay Pacific, EVA Air et ANA cabines — l'éditorial
   * disait déjà « non », la citation le prouve. Toujours 101 fiches. */
  /* 285 → 282 (09/09/2026, lot 4) : Emirates, Qantas et Aer Lingus cabines — l'éditorial disait
   * déjà « non », la citation le prouve. Toujours 101 fiches. */
  /* 282 → 279 (09/09/2026, lot 5) : Malaysia, China Eastern et Air Mauritius cabines — même cause. */
  /* 279 → 274 (09/09/2026, lot 6) : South African cabine, Kenya Airways cabine et soute, Gulf Air
   * cabine et soute — l'éditorial disait déjà « non », la citation le prouve. Saudia cabine reste
   * contradictoire : son éditorial dit « chats uniquement » (warn) là où le canal est refusé aux
   * chiens sur citation. Toujours 101 fiches. */
  /* 274 → 271 (09/09/2026, lot 7) : Aircalin cabine et soute, La Compagnie soute — l'éditorial disait déjà
   * « non », la citation le prouve. Toujours 101 fiches. */
  /* 271 → 265 (09/09/2026, lot 8) : China Southern cabine, Copa soute, IndiGo cabine, soute et fret, Thai
   * Airways cabine — l'éditorial disait déjà « non », la citation le prouve. 101 → 100 fiches : IndiGo
   * SORT du registre, ses trois canaux étant désormais prouvés (comme Ryanair au lot V3). */
  /* 265 → 263 (09/09/2026, lot 9, clôture) : Batik Air Indonesia cabine et soute — l'éditorial disait déjà « non », la
   * citation le prouve ; son fret, non décidé, reste contradictoire (100 fiches). */
  check("263 canaux contradictoires sur 100 fiches, relus des fiches et du contrat runtime",
    CONTRADICTOIRES.length === 263 && new Set(CONTRADICTOIRES.map((c) => c.slug)).size === 100,
    `${CONTRADICTOIRES.length} canaux · ${new Set(CONTRADICTOIRES.map((c) => c.slug)).size} fiches`);

  /* LA LECTURE SE FAIT PAR LOTS, DANS DES PROCESSUS COURTS (CI du 16/08/2026, run 31 sur main).
   *
   * Ouvrir 284 fenêtres JSDOM dans ce processus l'a tué en « heap out of memory » au premier
   * passage complet en CI. Fermer chaque fenêtre est indispensable mais insuffisant : la mesure
   * donne ~5 Mo retenus PAR PAGE après `close()` ET ramasse-miettes forcé, et V8 meurt plutôt que
   * de les reprendre sous une limite basse. La fuite est dans JSDOM ; ce qui la ferme, c'est la
   * fin du processus. Voir `test-lib/verifier-blocs-entites.mjs` pour les trois mesures.
   *
   * Chaque lot tourne donc sous une limite de tas BASSE : elle est le contrôle, pas un confort.
   * Un lot qui grossirait au-delà de ce que sa taille justifie meurt, et son échec est lu ici. */
  const TAILLE_LOT = 40;
  const HEAP_LOT_MO = 512;
  const taches = [];
  for (const slug of FICHES_CIBLE) {
    for (const [langue, p] of LANGUES) {
      taches.push({
        rel: path.join(p, "airlines", slug, "index.html"),
        attendus: CIBLE.filter((x) => x.slug === slug)
          .map((c) => ({ placement: c.placement, statut: c.statut, libelle: libelle(langue, c.statut) })),
      });
    }
  }

  const require_ = createRequire(import.meta.url);
  const { spawnSync } = require_("node:child_process");
  const os = require_("node:os");
  const total = { pagesLues: 0, blocsVerifies: 0, absentes: [], anomalies: [], picMo: 0 };
  const lotsMorts = [];
  /* Un répertoire temporaire PROPRE à cette exécution. Un nom fixe (« mdcf-lot-0.json ») entrait
     en collision entre deux exécutions simultanées — la CI et une session locale, deux portées
     lancées côte à côte — et l'une lisait le lot de l'autre. `mkdtempSync` rend la collision
     impossible plutôt qu'improbable. */
  const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "mdcf-lots-"));
  try {
  for (let i = 0; i < taches.length; i += TAILLE_LOT) {
    const lot = taches.slice(i, i + TAILLE_LOT);
    const fichier = path.join(dossier, `lot-${i}.json`);
    fs.writeFileSync(fichier, JSON.stringify({ dist: DIST, taches: lot }));
    const r = spawnSync(process.execPath, [`--max-old-space-size=${HEAP_LOT_MO}`,
      path.join(ROOT, "test-lib", "verifier-blocs-entites.mjs"), fichier], { encoding: "utf8", maxBuffer: 32 * 1024 * 1024 });
    if (r.status !== 0) {
      lotsMorts.push(`lot ${i / TAILLE_LOT} (${lot.length} pages) : code ${r.status} — ${(r.stderr || "").split("\n").find((l) => /heap|Error/i.test(l)) ?? "sortie vide"}`);
      continue;
    }
    const res = JSON.parse(r.stdout);
    total.pagesLues += res.pagesLues;
    total.blocsVerifies += res.blocsVerifies;
    total.absentes.push(...res.absentes);
    total.anomalies.push(...res.anomalies);
    total.picMo = Math.max(total.picMo, res.picMo);
  }
  } finally {
    /* Le ménage a lieu même si une assertion lève : un répertoire temporaire abandonné à chaque
       exécution finit par peser, et surtout il masque la prochaine collision. */
    fs.rmSync(dossier, { recursive: true, force: true });
  }

  /* Un lot mort ne doit JAMAIS se lire comme « moins de pages à vérifier » : c'est un échec. */
  check(`les ${Math.ceil(taches.length / TAILLE_LOT)} lots ont tous abouti sous ${HEAP_LOT_MO} Mo de tas`,
    lotsMorts.length === 0, lotsMorts.slice(0, 3).join(" | "));
  check(`pic mémoire d'un lot : ${total.picMo} Mo (plafond ${HEAP_LOT_MO} Mo)`,
    total.picMo > 0 && total.picMo < HEAP_LOT_MO, `${total.picMo} Mo`);

  const pagesAttendues = FICHES_CIBLE.length * 4, blocsAttendus = CIBLE.length * 4;
  check(`${pagesAttendues} pages localisées RÉELLEMENT lues, aucune absente`,
    total.pagesLues === pagesAttendues && total.absentes.length === 0,
    `lues ${total.pagesLues} · absentes ${total.absentes.length}${total.absentes[0] ? " — ex. " + total.absentes[0] : ""}`);
  check(`${blocsAttendus} blocs vérifiés (statut technique ET libellé publié), aucune anomalie`,
    total.blocsVerifies === blocsAttendus && total.anomalies.length === 0,
    `vérifiés ${total.blocsVerifies}/${blocsAttendus}${total.anomalies.length ? " — " + total.anomalies.slice(0, 3).join(" | ") : ""}`);
  /* Une cible vide passerait tous les contrôles ci-dessus sans rien prouver. */
  check("la cible de cette portée n'est pas vide", CIBLE.length > 0, String(CIBLE.length));
  /* Et le PROCESSUS PRINCIPAL, lui, doit rester léger : c'est la preuve que la lecture des pages
     ne laisse plus rien derrière elle ici. */
  /* CE QUE CETTE MESURE DIT — ET CE QU'ELLE DISAIT AVANT (correction du 05/09/2026).
   *
   * Elle lisait `heapUsed` tel quel, c'est-à-dire à un instant qui dépend de QUAND le ramasse-
   * miettes a tourné. Trois exécutions IDENTIQUES du même code ont donné 365, 371 puis 420 Mo :
   * le contrôle rendait donc un verdict tiré au sort autour de son seuil. Un contrôle qui rougit
   * une fois sur trois sans que rien ne change finit désactivé — et emporte avec lui la garantie
   * qu'il portait.
   *
   * On mesure désormais ce que la section VOULAIT dire : ce qui reste RETENU après une collecte
   * forcée. C'est une quantité définie, reproductible, et plus SÉVÈRE que la précédente — elle
   * ne peut plus être flattée par un ramasse-miettes opportun. Le plafond n'a pas bougé. */
  const v8 = require_("node:v8"), vm = require_("node:vm");
  v8.setFlagsFromString("--expose-gc");
  vm.runInNewContext("gc")();
  v8.setFlagsFromString("--no-expose-gc");
  const picParent = Math.round(process.memoryUsage().heapUsed / 1048576);
  check(`le processus principal ne RETIENT pas plus de 400 Mo après collecte (${picParent} Mo)`,
    picParent < 400, `${picParent} Mo`);
}

console.log(`\n${pass} OK, ${fail} FAIL`);
process.exit(fail === 0 ? 0 : 1);
