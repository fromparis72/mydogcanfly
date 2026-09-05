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
  const ptTable = JSON.parse(fs.readFileSync(
    path.join(ROOT, "packages", "knowledge", "translations", "pt", "inline.json"), "utf8"));
  const phrasesT = [...code.matchAll(/\bT\(\s*"((?:[^"\\]|\\.)+)"/g)].map((m) => m[1].replace(/\\"/g, '"'));
  const sansPt = [...new Set(phrasesT)].filter((ph) => !(ph in ptTable));
  check(`témoin : des phrases \`T(...)\` ont été relevées dans le gabarit (${new Set(phrasesT).size})`,
    new Set(phrasesT).size > 5);
  check("aucune phrase du gabarit ne retombera en anglais sur la page portugaise",
    sansPt.length === 0, sansPt.slice(0, 3).map((x) => `« ${x.slice(0, 60)}… »`).join(" | "));
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
      && cleLibelleStatut("confirmation_required") === "air.to_confirm");
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
  const TEMOIN_SANS_SOURCE = "airline_air_china";
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
  const liensSources = rendues.flatMap((c) => [...c.querySelectorAll(".acard__psrc a[href]")].map((a) => a.getAttribute("href")));
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
  check("ce lien est VISIBLE et nommé par son canal", (lienSource?.textContent || "").includes("thaiairways.com")
    && /cargo|fret|carga/i.test(lienSource?.textContent || ""), lienSource ? `« ${lienSource.textContent} »` : "absent");
  /* Le témoin : aucun canal sourcé → AUCUN bloc de sources, pas un lien « par défaut ». */
  check(`la carte ${TEMOIN_SANS_SOURCE} n'affiche AUCUN bloc de sources`,
    carteTemoin.querySelector(".acard__psrc") === null,
    carteTemoin.querySelector(".acard__psrc")?.innerHTML?.slice(0, 120) ?? "");
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
  check("295 canaux contradictoires sur 102 fiches, relus des fiches et du contrat runtime",
    CONTRADICTOIRES.length === 295 && new Set(CONTRADICTOIRES.map((c) => c.slug)).size === 102,
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
