#!/usr/bin/env node
/**
 * LES DEUX MAILLONS ENTRE LA SOURCE ET LA PAGE — ÉPROUVÉS SÉPARÉMENT, ET DITS POUR CE QU'ILS SONT.
 *
 *   node test-montants-propagation.mjs --dist=packages/ui/dist
 *
 * CE QU'IL MANQUAIT. `test-montants-sources.mjs` juge les fiches YAML ; `test-montants-publies.mjs`
 * juge le HTML servi. Aucun des deux ne montre que le PREMIER ALIMENTE LE SECOND : on pourrait
 * corriger les sources sans que la page change.
 *
 * L'AFFIRMATION « DE BOUT EN BOUT » EST RETIRÉE (contre-revue du 01/09/2026). La rédaction
 * précédente disait prouver la chaîne entière ; en réalité elle mutait la source, relançait
 * `ingest`, puis RECOLLAIT le montant à la main dans le HTML déjà construit. Le gabarit aurait pu
 * cesser de consommer `verdictNote` et écrire la phrase en dur : la contre-épreuve serait restée
 * verte. Reconstruire le site à l'intérieur d'un test coûte une demi-heure ; on ne le fait donc pas,
 * et on ne prétend plus le faire.
 *
 * CE QUI EST RÉELLEMENT PROUVÉ ICI, EN DEUX MAILLONS DISTINCTS :
 *   1. SOURCE → ARTEFACT. Un montant écrit dans une fiche traverse le VRAI générateur et se
 *      retrouve dans `airlines.generated.json`. Mutation réelle, restauration vérifiée.
 *   2. ARTEFACT → DIST. Les phrases de l'artefact — `verdictNote` et `metaDesc`, dans les quatre
 *      langues, sur toutes les fiches — sont bien celles que porte le HTML construit. Si le
 *      gabarit cessait de les consommer, ou les écrivait en dur, cette parité tomberait.
 *
 * CE QUI RESTE HORS DE PORTÉE DE CE FICHIER, ET QUI EST DIT : il ne reconstruit rien. Le maillon 2
 * juge le `dist` que la CI vient de produire ; c'est ce build-là, et lui seul, qui relie
 * réellement l'artefact muté à une page. Un changement de gabarit est donc vu par la CI complète,
 * pas par ce contrôle isolé.
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { JSDOM } from "jsdom";
import { compter, zonesDe } from "./test-lib/montants.mjs";

let defauts = 0;
const echec = (nom, detail) => { defauts++; console.error(`  ✗ ${nom} — ${detail}`); };
const ok = (nom) => console.log(`  ✓ ${nom}`);

const DIST = process.argv.slice(2).find((a) => a.startsWith("--dist="))?.slice(7);
if (!DIST || !existsSync(DIST)) {
  console.error("[montants-propagation] REFUS — `--dist=<chemin>` est obligatoire et doit exister.");
  console.error("                       Une contre-épreuve qui se saute faute d'artefact ne prouve rien.");
  process.exit(1);
}

const GENERE = "packages/ui/src/data/airlines.generated.json";

/* ---- MAILLON 1 : CE QU'ON ÉCRIT DANS LA FICHE ENTRE DANS L'ARTEFACT ------------------------- */
{
  const FICHIER = "content/airlines/jetblue.yml";
  const AVANT = "  en: Only small cats & dogs in the cabin (JetPaws) — no large dogs and no hold or cargo option.";
  const APRES = "  en: Only small cats & dogs in the cabin (JetPaws, ZAR 300 each way) — no large dogs and no hold or cargo option.";
  const source = readFileSync(FICHIER, "utf8");
  const artefact = readFileSync(GENERE, "utf8");

  if (!source.includes(AVANT)) {
    echec("1 source → artefact", "le résumé attendu est absent de la fiche JetBlue — la mutation ne prouverait rien");
  } else {
    let vu = false, erreur = null;
    try {
      writeFileSync(FICHIER, source.replace(AVANT, APRES));
      execFileSync("npm", ["run", "ingest"], { stdio: "pipe" });
      const rendu = JSON.parse(readFileSync(GENERE, "utf8")).airline_jetblue?.verdictNote?.en ?? "";
      vu = compter(rendu) === 1;
      if (!vu) erreur = `le générateur n'a pas repris le montant : « ${rendu.slice(0, 80)} »`;
    } finally {
      writeFileSync(FICHIER, source);
      writeFileSync(GENERE, artefact);
    }
    if (readFileSync(FICHIER, "utf8") !== source || readFileSync(GENERE, "utf8") !== artefact)
      echec("1 source → artefact", "la source ou l'artefact n'a pas été restauré à l'identique");
    else if (erreur) echec("1 source → artefact", erreur);
    else ok("1 source → artefact — « ZAR 300 » écrit dans la fiche JetBlue traverse le vrai générateur");
  }
}

/* ---- MAILLON 2 : CE QUE PORTE L'ARTEFACT EST CE QUE PORTE LA PAGE --------------------------- */
/* La parité est exigée sur les DEUX champs que le lot a corrigés — le résumé visible et la
 * description recopiée dans les métas et le JSON-LD —, dans les quatre langues, sur toutes les
 * fiches construites. C'est ce qui interdit au gabarit d'écrire la phrase en dur. */
const donnees = JSON.parse(readFileSync(GENERE, "utf8"));

/** Les écarts de parité d'UNE page. La contre-épreuve 2bis appelle CETTE fonction, pas une copie :
 *  une parité qui rougirait ici sans rougir là ne prouverait rien.
 *
 *  ON COMPARE DU TEXTE DÉCODÉ, PAS DU HTML. Ma première rédaction cherchait la phrase dans le HTML
 *  brut après avoir échappé « & », « < » et « > » à la main. Elle rougissait sur 65 fiches : Astro
 *  écrit aussi l'apostrophe en « &#39; », et « isn't » ne se trouvait donc jamais. Refaire à la
 *  main le travail du parseur est précisément la faute que la contre-revue du 01/09/2026 a relevée
 *  dans `zonesDe` ; on emploie donc `zonesDe`, qui rend le texte tel que le lecteur le voit.
 *  CHAQUE CHAMP EST CHERCHÉ DANS SA ZONE : le résumé dans le corps, la description dans les métas.
 *  C'est plus exigeant qu'un « quelque part dans la page » — cela dit AUSSI où la phrase paraît. */
function ecartsDeParite(html, langue, slug) {
  const cle = `airline_${slug.replace(/-/g, "_")}`;
  const d = donnees[cle];
  if (!d) return { ecarts: [`${langue}/${slug} : aucune entrée « ${cle} » dans l'artefact`], comparees: 0 };
  const z = zonesDe(html);
  const ZONE = { verdictNote: ["corps", z.corps], metaDesc: ["métas", z.metas] };
  const ecarts = [];
  let comparees = 0;
  for (const champ of ["verdictNote", "metaDesc"]) {
    const attendu = d[champ]?.[langue];
    if (typeof attendu !== "string" || !attendu) { ecarts.push(`${langue}/${slug} : ${champ} absent de l'artefact`); continue; }
    comparees++;
    const [nomZone, texte] = ZONE[champ];
    if (!texte.includes(attendu)) ecarts.push(`${langue}/${slug} : ${champ} de l'artefact absent du ${nomZone} de la page`);
  }
  return { ecarts, comparees };
}

const FICHE = /(?:^|\/)(?:([a-z]{2})\/)?airlines\/([^/]+)\/index\.html$/;
const fiches = [];
{
  const pages = [];
  (function marcher(d) {
    for (const e of [...readdirSync(d)].sort()) {
      const p = join(d, e);
      if (statSync(p).isDirectory()) marcher(p);
      else if (e === "index.html") pages.push(p);
    }
  })(DIST);
  for (const p of pages) {
    const m = p.slice(DIST.length).replace(/^\/+/, "").match(FICHE);
    if (m) fiches.push({ chemin: p, langue: m[1] ?? "en", slug: m[2] });
  }
}

{
  const ecarts = [];
  let comparees = 0;
  for (const f of fiches) {
    const r = ecartsDeParite(readFileSync(f.chemin, "utf8"), f.langue, f.slug);
    ecarts.push(...r.ecarts); comparees += r.comparees;
  }
  if (!comparees) echec("2 artefact → dist", "aucune phrase comparée — le contrôle ne prouverait rien");
  else if (ecarts.length) {
    echec("2 artefact → dist", `${ecarts.length} phrase(s) de l'artefact absente(s) du HTML construit`);
    for (const l of ecarts.slice(0, 10)) console.error(`      ${l}`);
    if (ecarts.length > 10) console.error(`      … et ${ecarts.length - 10} autres`);
  } else ok(`2 artefact → dist — les ${comparees} phrases de l'artefact (verdictNote + metaDesc × 4 langues) sont bien celles du HTML`);
}

/* ---- 2bis. UNE PARITÉ QUI NE SAIT PAS ROUGIR NE PROUVE RIEN --------------------------------- */
/* L'attaque exacte que le maillon 2 doit voir : le gabarit cesse de consommer l'artefact et écrit
 * sa propre phrase. On la simule sur une page réelle et on exige que LA MÊME fonction la voie. */
{
  const f = fiches.find((x) => x.slug === "jetblue" && x.langue === "en") ?? fiches[0];
  const html = readFileSync(f.chemin, "utf8");
  const attendu = donnees[`airline_${f.slug.replace(/-/g, "_")}`]?.verdictNote?.[f.langue];
  if (!attendu) { echec("2bis", `verdictNote absent de l'artefact pour ${f.langue}/${f.slug}`); }
  else {
    /* LA MUTATION SE FAIT DANS L'ARBRE, PAS SUR LA CHAÎNE. Réécrire le nœud de texte produit
     * exactement le HTML qu'un gabarit modifié aurait servi, échappements compris. */
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const marcheur = doc.createTreeWalker(doc.body, dom.window.NodeFilter.SHOW_TEXT);
    let touche = 0;
    for (let n = marcheur.nextNode(); n; n = marcheur.nextNode()) {
      if (n.nodeValue?.includes(attendu)) { n.nodeValue = "Le gabarit écrit désormais sa propre phrase."; touche++; }
    }
    if (!touche) echec("2bis", "la phrase de l'artefact n'était dans aucun nœud de texte : le maillon 2 était vide");
    else {
      const avant = ecartsDeParite(html, f.langue, f.slug).ecarts;
      const apres = ecartsDeParite(dom.serialize(), f.langue, f.slug).ecarts;
      if (avant.length !== 0) echec("2bis", `la page non mutée portait déjà ${avant.length} écart(s) : la contre-épreuve ne prouverait rien`);
      else if (apres.length !== 1 || !apres[0].includes("verdictNote")) echec("2bis", `la mutation produit ${JSON.stringify(apres)} au lieu du seul écart sur verdictNote`);
      else ok(`2bis — un gabarit qui cesserait de consommer verdictNote est vu (${f.langue}/${f.slug}, ${touche} nœud(s) réécrit(s))`);
    }
  }
}

if (defauts) { console.error(`\n[montants-propagation] ÉCHEC — ${defauts} contrôle(s) en défaut`); process.exit(1); }
console.log("\n[montants-propagation] deux maillons éprouvés : la fiche alimente l'artefact, l'artefact alimente la page.\n"
  + "                       Ce fichier ne reconstruit rien — c'est le build de la CI qui les relie.");
