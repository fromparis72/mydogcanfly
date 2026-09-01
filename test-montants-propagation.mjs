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
 *      langues, sur toutes les fiches — sont bien celles que porte le HTML construit, À L'ÉGALITÉ
 *      ET SUR DES CIBLES NOMMÉES : le paragraphe du bloc verdict, les trois balises de description
 *      une à une, et la description de L'UNIQUE nœud « WebPage » du JSON-LD — les nœuds y sont
 *      collectés récursivement, « @graph » compris, et leur cardinal est exigé avant toute
 *      comparaison. Si le gabarit cessait de les consommer, ou les écrivait en dur, cette parité
 *      tomberait.
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

/** Les écarts de parité d'UNE page, SUR DES CIBLES EXACTES. La contre-épreuve 2bis appelle CETTE
 *  fonction, pas une copie : une parité qui rougirait ici sans rougir là ne prouverait rien.
 *
 *  ON COMPARE DU TEXTE DÉCODÉ, PAS DU HTML. Ma première rédaction cherchait la phrase dans le HTML
 *  brut après avoir échappé « & », « < » et « > » à la main. Elle rougissait sur 65 fiches : Astro
 *  écrit aussi l'apostrophe en « &#39; », et « isn't » ne se trouvait donc jamais. Refaire à la
 *  main le travail du parseur est précisément la faute relevée dans `zonesDe`.
 *
 *  ET ON NE CHERCHE PLUS « QUELQUE PART » (contre-revue du 01/09/2026). La deuxième rédaction
 *  demandait que le résumé figure dans LE CORPS et la description dans L'AGRÉGAT des métas. Deux
 *  faux verts restaient possibles, et ils ne sont pas théoriques :
 *    · le résumé attendu subsiste dans un élément caché pendant que `.hero-verdict p` affiche une
 *      phrase écrite en dur — le corps contient bien la phrase, et la page ment quand même ;
 *    · une seule méta garde la bonne description pendant qu'`og:description` ou `twitter:description`
 *      divergent — l'agrégat contient bien la phrase, et deux aperçus de partage sur trois mentent.
 *  Chaque champ est donc comparé à SA cible, et à l'ÉGALITÉ : le paragraphe du verdict, les trois
 *  métas une à une, et la description de l'unique « WebPage ». Cinq comparaisons par page. */
function ecartsDeParite(html, langue, slug) {
  const cle = `airline_${slug.replace(/-/g, "_")}`;
  const d = donnees[cle];
  if (!d) return { ecarts: [`${langue}/${slug} : aucune entrée « ${cle} » dans l'artefact`], comparees: 0 };
  const doc = new JSDOM(html).window.document;
  const ecarts = [];
  let comparees = 0;
  const ici = (quoi) => `${langue}/${slug} : ${quoi}`;

  /* 1. LE RÉSUMÉ — le paragraphe du bloc verdict, et lui seul. */
  {
    const attendu = d.verdictNote?.[langue];
    const cibles = doc.querySelectorAll(".hero-verdict p");
    if (typeof attendu !== "string" || !attendu) ecarts.push(ici("verdictNote absent de l'artefact"));
    else if (cibles.length !== 1) ecarts.push(ici(`${cibles.length} paragraphe(s) « .hero-verdict p » au lieu d'un seul`));
    else {
      comparees++;
      const servi = cibles[0].textContent?.trim() ?? "";
      if (servi !== attendu.trim()) ecarts.push(ici(`« .hero-verdict p » ≠ verdictNote de l'artefact — servi « ${servi.slice(0, 60)}… »`));
    }
  }

  /* 2. LA DESCRIPTION — les trois métas, une à une. */
  {
    const attendu = d.metaDesc?.[langue];
    const METAS = [
      ["description", 'meta[name="description"]'],
      ["og:description", 'meta[property="og:description"]'],
      ["twitter:description", 'meta[name="twitter:description"]'],
    ];
    if (typeof attendu !== "string" || !attendu) ecarts.push(ici("metaDesc absent de l'artefact"));
    else for (const [nom, sel] of METAS) {
      const els = doc.querySelectorAll(sel);
      if (els.length !== 1) { ecarts.push(ici(`${els.length} balise(s) « ${nom} » au lieu d'une seule`)); continue; }
      comparees++;
      const servi = els[0].getAttribute("content") ?? "";
      if (servi !== attendu) ecarts.push(ici(`« ${nom} » ≠ metaDesc de l'artefact — servi « ${servi.slice(0, 60)}… »`));
    }
  }

  /* 3. LA DESCRIPTION DU WEBPAGE, dans le JSON-LD — la quatrième copie publique de la même phrase.
   *
   * ON COMPTE LES NŒUDS AVANT DE LES LIRE (contre-revue du 01/09/2026). Ma rédaction précédente
   * parcourait les nœuds de premier niveau et gardait SILENCIEUSEMENT le dernier « WebPage »
   * rencontré : deux nœuds, l'un périmé et l'autre juste, seraient passés au vert, et le moteur,
   * lui, aurait lu les deux. Un « WebPage » rangé dans « @graph » n'était pas vu du tout.
   * On les collecte donc RÉCURSIVEMENT, « @graph » compris, et l'on exige le cardinal attendu —
   * un seul — avant toute comparaison. */
  {
    const attendu = d.metaDesc?.[langue];
    const trouves = [];
    let illisible = 0;
    const collecter = (v) => {
      if (Array.isArray(v)) { v.forEach(collecter); return; }
      if (!v || typeof v !== "object") return;
      const type = Array.isArray(v["@type"]) ? v["@type"] : [v["@type"]];
      if (type.includes("WebPage")) trouves.push(v);
      for (const x of Object.values(v)) collecter(x);
    };
    for (const sc of doc.querySelectorAll('script[type="application/ld+json"]')) {
      try { collecter(JSON.parse(sc.textContent ?? "")); } catch { illisible++; }
    }
    if (illisible) ecarts.push(ici(`${illisible} bloc(s) JSON-LD illisible(s)`));
    else if (trouves.length !== 1) ecarts.push(ici(`${trouves.length} nœud(s) « WebPage » dans le JSON-LD au lieu d'un seul`));
    else if (typeof attendu === "string" && attendu) {
      comparees++;
      if (trouves[0].description !== attendu)
        ecarts.push(ici(`WebPage.description ≠ metaDesc de l'artefact — servi « ${String(trouves[0].description).slice(0, 60)}… »`));
    }
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
  } else ok(`2 artefact → dist — ${comparees} comparaisons à l'égalité sur ${fiches.length} fiches : `
    + `« .hero-verdict p », les trois métas de description et l'unique WebPage.description portent `
    + `exactement ce que dit l'artefact`);
}

/* ---- 2bis ET 2ter. LES DEUX FAUX VERTS QUE LA PARITÉ « QUELQUE PART » LAISSAIT PASSER -------- */
/* Ils viennent de la contre-revue du 01/09/2026, et chacun mute une page réelle. Les deux
 * exigent que LA MÊME fonction de parité voie l'écart — et un seul écart, celui qu'on a créé. */
{
  const f = fiches.find((x) => x.slug === "jetblue" && x.langue === "en") ?? fiches[0];
  const html = readFileSync(f.chemin, "utf8");
  const propre = ecartsDeParite(html, f.langue, f.slug);
  if (propre.ecarts.length) {
    echec("2bis/2ter", `la page témoin ${f.langue}/${f.slug} porte déjà ${propre.ecarts.length} écart(s) : les contre-épreuves ne prouveraient rien`);
  } else {
    /* 2bis — LE TÉMOIN DÉPLACÉ DANS UN ÉLÉMENT CACHÉ. Le gabarit écrit sa propre phrase dans le
     * bloc verdict ; la phrase de l'artefact, elle, subsiste ailleurs, invisible. Une parité qui
     * cherche « quelque part dans le corps » reste verte. La parité exacte doit rougir. */
    {
      const dom = new JSDOM(html);
      const doc = dom.window.document;
      const attendu = donnees[`airline_${f.slug.replace(/-/g, "_")}`]?.verdictNote?.[f.langue];
      const cible = doc.querySelector(".hero-verdict p");
      if (!attendu || !cible) echec("2bis", "verdictNote ou « .hero-verdict p » introuvable sur la page témoin");
      else {
        cible.textContent = "Le gabarit écrit désormais sa propre phrase.";
        const cache = doc.createElement("div");
        cache.hidden = true;
        cache.textContent = attendu;                       // le témoin survit, mais caché
        doc.body.appendChild(cache);
        const mute = dom.serialize();
        if (!zonesDe(mute).corps.includes(attendu))
          echec("2bis", "le témoin caché n'est pas dans le corps : l'attaque n'est pas celle qu'on croit reproduire");
        else {
          const r = ecartsDeParite(mute, f.langue, f.slug).ecarts;
          if (r.length !== 1 || !r[0].includes("hero-verdict")) echec("2bis", `la mutation produit ${JSON.stringify(r)} au lieu du seul écart sur « .hero-verdict p »`);
          else ok("2bis — un résumé écrit en dur est vu, même si la phrase de l'artefact survit dans un élément caché");
        }
      }
    }

    /* 2ter — UN SEUL EXEMPLAIRE DE LA DESCRIPTION QUI DIVERGE. `og:description` ment, les deux
     * autres disent vrai : l'agrégat des métas contient toujours la bonne phrase. */
    {
      const dom = new JSDOM(html);
      const doc = dom.window.document;
      const og = doc.querySelector('meta[property="og:description"]');
      if (!og) echec("2ter", "pas d'og:description sur la page témoin");
      else {
        og.setAttribute("content", "Une description que l'artefact n'a jamais écrite.");
        const r = ecartsDeParite(dom.serialize(), f.langue, f.slug).ecarts;
        if (r.length !== 1 || !r[0].includes("og:description")) echec("2ter", `la mutation produit ${JSON.stringify(r)} au lieu du seul écart sur og:description`);
        else ok("2ter — une seule méta qui diverge est vue, les deux autres et le JSON-LD restant justes");
      }
    }
    /* 2quater — UN SECOND « WebPage » PÉRIMÉ, glissé dans le JSON-LD. Le nœud juste est toujours
     * là ; un contrôle qui garde « le dernier rencontré » resterait vert, et le moteur lirait
     * pourtant les deux descriptions. Il est placé dans « @graph » : c'est aussi la profondeur que
     * la rédaction précédente ne parcourait pas. */
    {
      const dom = new JSDOM(html);
      const doc = dom.window.document;
      const sc = doc.querySelector('script[type="application/ld+json"]');
      if (!sc) echec("2quater", "pas de bloc ld+json sur la page témoin");
      else {
        let objet;
        try { objet = JSON.parse(sc.textContent ?? ""); } catch { objet = null; }
        if (!objet) echec("2quater", "le bloc ld+json de la page témoin ne se parse pas");
        else {
          const perime = { "@type": "WebPage", description: "Une description périmée que l'artefact a cessé d'écrire." };
          const noeuds = Array.isArray(objet) ? objet : [objet];
          sc.textContent = JSON.stringify([...noeuds, { "@graph": [perime] }]);
          const r = ecartsDeParite(dom.serialize(), f.langue, f.slug).ecarts;
          if (r.length !== 1 || !r[0].includes("2 nœud(s) « WebPage »"))
            echec("2quater", `la mutation produit ${JSON.stringify(r)} au lieu du seul écart de cardinal`);
          else ok("2quater — un second « WebPage » périmé, jusque dans « @graph », est vu");
        }
      }
    }
  }
}

if (defauts) { console.error(`\n[montants-propagation] ÉCHEC — ${defauts} contrôle(s) en défaut`); process.exit(1); }
console.log("\n[montants-propagation] deux maillons éprouvés : la fiche alimente l'artefact, l'artefact alimente la page.\n"
  + "                       Ce fichier ne reconstruit rien — c'est le build de la CI qui les relie.");
