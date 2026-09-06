#!/usr/bin/env node
/**
 * CE QUE LE SITE ANNONCE — et qui doit exister.
 *
 *   node test-annonce-du-site.mjs        (exige un site construit sous packages/ui/dist)
 *
 * POURQUOI CE HARNAIS EXISTE. La plus vieille leçon de ce chantier est un portugais ANNONCÉ avant
 * d'exister : des `hreflang` promettaient des pages qu'aucun fichier ne servait. Depuis, la
 * vérification n'a jamais été qu'un script lancé à la main dans une conversation. Rien, dans le
 * dépôt, n'empêchait la régression de revenir.
 *
 * CE QU'IL VÉRIFIE, DANS LES DEUX SENS :
 *   · tout `hreflang` annoncé vise une page RÉELLEMENT construite ;
 *   · toute page construite est listée au sitemap de SA langue ;
 *   · aucun sitemap n'annonce une URL sans page.
 * Un seul sens ne suffirait pas : annoncer trop et annoncer trop peu sont deux défauts distincts.
 *
 * UNE EXIGENCE EST AUJOURD'HUI INFALSIFIABLE, ET JE LE DIS PLUTÔT QUE DE LA MAQUILLER.
 * « chaque guide annonce EXACTEMENT les langues où sa clé existe » est vraie, mais le corpus est
 * devenu symétrique — 72 clés × 4 langues, aucune asymétrie nulle part sur le site. Muter
 * `languesDe()` pour qu'elle renvoie les quatre langues sans les constater ne changerait donc RIEN
 * à la sortie : la garantie ne peut pas être mise en défaut tant que les données sont symétriques.
 * Elle est conservée parce qu'elle redeviendra falsifiable au premier contenu partiel — mais elle
 * n'est PAS présentée comme éprouvée, et aucune contre-épreuve ne la revendique.
 *
 * LES DEUX GARANTIES RÉELLEMENT ÉPROUVABLES sont celles que les contre-épreuves visent :
 *   `href-annonce`  l'adresse annoncée est fabriquée autrement → « vise une page construite » tombe
 *   `sitemap`       une famille disparaît du sitemap           → « listée au sitemap de sa langue » tombe
 */
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";

const DIST = "packages/ui/dist";
const LANGUES = ["en", "fr", "es", "pt"];
const SOURCE_GUIDES = "packages/ui/src/content/guides";
const SITE = "https://mydogcanfly.com";

let echecs = 0;
const dire = (m) => process.stdout.write(m + "\n");
const exiger = (label, cond, detail = "") => {
  if (cond) return;
  echecs++;
  process.stdout.write(`  ✗ ${label}${detail ? `\n      ${detail}` : ""}\n`);
};

/* ---- JAMAIS VERT FAUTE DE MATIÈRE ------------------------------------------------------------
 * Sans site construit, tous les contrôles ci-dessous passeraient sur des ensembles vides. Un
 * harnais qui se tait parce qu'il n'a rien à lire est pire qu'un harnais absent. */
const pagesHtml = (d) => {
  if (!existsSync(d)) return 0;
  let n = 0;
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) n += pagesHtml(join(d, e.name));
    else if (e.name.endsWith(".html")) n++;
  }
  return n;
};
const total = pagesHtml(DIST);
if (total < 2000) {
  process.stderr.write(`[annonce] ÉCHEC — site absent ou partiel (${total} pages HTML sous ${DIST}). `
    + "Ce harnais lit les octets du site : sans site, il ne prouverait rien.\n");
  process.exit(1);
}

/* ---- L'inventaire de ce qui EXISTE ------------------------------------------------------------ */
const cheminDe = (url) => url.replace(SITE, "");
const pageExiste = (url) => {
  const p = cheminDe(url).split("#")[0];
  return existsSync(join(DIST, p, "index.html")) || existsSync(join(DIST, p));
};

/* Les guides, groupés par CLÉ — leurs slugs sont traduits, donc grouper par slug n'apparierait
   rien entre langues. C'est une erreur que j'ai commise avant de l'écrire ici. */
const languesParCle = new Map();
for (const l of LANGUES) {
  for (const f of readdirSync(join(SOURCE_GUIDES, l)).filter((x) => /\.mdx?$/.test(x))) {
    const k = /^key:\s*"([^"]+)"/m.exec(readFileSync(join(SOURCE_GUIDES, l, f), "utf8"))?.[1];
    if (!k) continue;
    if (!languesParCle.has(k)) languesParCle.set(k, new Map());
    languesParCle.get(k).set(l, f.replace(/\.mdx?$/, ""));
  }
}
exiger("le corpus de guides est lisible et non vide", languesParCle.size >= 62, `${languesParCle.size} clés`);

const dossierGuides = (l) => (l === "en" ? join(DIST, "travel-hub") : join(DIST, l, "travel-hub"));
const pagesGuides = [];
for (const l of LANGUES) {
  const d = dossierGuides(l);
  if (!existsSync(d)) continue;
  for (const s of readdirSync(d)) {
    const f = join(d, s, "index.html");
    if (existsSync(f)) pagesGuides.push({ locale: l, slug: s, fichier: f });
  }
}
exiger("les pages de guides construites sont là", pagesGuides.length >= 240, `${pagesGuides.length} pages`);

/* ---- 1. TOUT CE QUI EST ANNONCÉ EXISTE -------------------------------------------------------- */
const ALTERNATE = /<link rel="alternate" hreflang="([a-z-]+)" href="([^"]+)"/g;
const morts = [];
const sansAlternate = [];
let alternatesLus = 0;
for (const pg of pagesGuides) {
  const html = readFileSync(pg.fichier, "utf8");
  const alts = [...html.matchAll(ALTERNATE)];
  if (!alts.length) { sansAlternate.push(`${pg.locale}/${pg.slug}`); continue; }
  for (const [, lang, url] of alts) {
    alternatesLus++;
    if (!pageExiste(url)) morts.push(`${pg.locale}/${pg.slug} → ${lang} ${url}`);
  }
}
exiger("chaque page de guide déclare ses alternates", sansAlternate.length === 0,
  sansAlternate.slice(0, 5).join(", "));
exiger("tout `hreflang` annoncé vise une page réellement construite",
  morts.length === 0, `${morts.length} mort(s) · ${morts.slice(0, 3).join(" · ")}`);
exiger("les alternates ont bien été lus — sinon le contrôle ci-dessus porterait sur le vide",
  alternatesLus >= pagesGuides.length, `${alternatesLus} alternates pour ${pagesGuides.length} pages`);

/* ---- 2. L'ANNONCE ÉPOUSE LA DISPONIBILITÉ RÉELLE ----------------------------------------------
 * INFALSIFIABLE AUJOURD'HUI (voir l'en-tête) : le corpus est symétrique. Conservée pour le jour où
 * il ne le sera plus, et revendiquée par AUCUNE contre-épreuve. */
const slugVersCle = new Map();
for (const [k, m] of languesParCle) for (const [l, s] of m) slugVersCle.set(`${l}/${s}`, k);
const ecarts = [];
for (const pg of pagesGuides) {
  const cle = slugVersCle.get(`${pg.locale}/${pg.slug}`);
  if (!cle) continue;
  const attendues = [...languesParCle.get(cle).keys()].sort();
  const annoncees = [...new Set([...readFileSync(pg.fichier, "utf8").matchAll(ALTERNATE)]
    .map((m) => m[1]).filter((l) => l !== "x-default"))].sort();
  if (attendues.join(",") !== annoncees.join(","))
    ecarts.push(`${pg.locale}/${pg.slug} : annonce ${annoncees.join("+")}, existe en ${attendues.join("+")}`);
}
exiger("chaque guide annonce EXACTEMENT les langues où sa clé existe",
  ecarts.length === 0, ecarts.slice(0, 4).join(" · "));

/* ---- 3. LES SITEMAPS, DANS LES DEUX SENS ------------------------------------------------------ */
const urlsSitemap = {};
for (const l of LANGUES) {
  const f = join(DIST, `sitemap-${l}.xml`);
  exiger(`le sitemap ${l} existe`, existsSync(f), f);
  if (!existsSync(f)) continue;
  urlsSitemap[l] = new Set([...readFileSync(f, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map((m) => (m[1].endsWith("/") ? m[1] : `${m[1]}/`)));
}
const absentes = [];
for (const pg of pagesGuides) {
  const prefixe = pg.locale === "en" ? "/" : `/${pg.locale}/`;
  const url = `${SITE}${prefixe}travel-hub/${pg.slug}/`;
  if (!urlsSitemap[pg.locale]?.has(url)) absentes.push(`${pg.locale}/${pg.slug}`);
}
exiger("toute page de guide construite est listée au sitemap de SA langue",
  absentes.length === 0, `${absentes.length} absente(s) · ${absentes.slice(0, 3).join(" · ")}`);

const fantomes = [];
for (const l of LANGUES) for (const u of urlsSitemap[l] ?? []) if (!pageExiste(u)) fantomes.push(`${l} → ${u}`);
exiger("aucun sitemap n'annonce une URL sans page construite",
  fantomes.length === 0, `${fantomes.length} fantôme(s) · ${fantomes.slice(0, 3).join(" · ")}`);

/* ---- Verdict ---------------------------------------------------------------------------------- */
dire("");
dire(`  site : ${total} pages HTML · guides : ${pagesGuides.length} pages, ${languesParCle.size} clés`);
dire(`  alternates lus : ${alternatesLus} · URL au sitemap : ${Object.values(urlsSitemap).reduce((a, s) => a + s.size, 0)}`);
/* ---- 6. LES CHIFFRES QUE LE SITE ANNONCE SUR LUI-MÊME ----------------------------------------
 *
 * `HomeSections.astro` majorait chaque compte de 20 % avant de l'afficher, et le press kit
 * portait quatre valeurs écrites à la main dont deux SUPÉRIEURES au corpus réel. Le contrôle
 * porte donc sur les trois surfaces à la fois — accueil, page press kit, documents
 * téléchargeables — parce que corriger la première en laissant les autres est exactement ce qui
 * s'est produit : la page dynamique avait été refaite, les quatre HTML statiques non.
 *
 * LE SUFFIXE « + » EST INTERDIT sur ces chiffres. « 102+ » se lit « au moins 102 » : c'est une
 * borne inférieure présentée comme un compte, et c'est ce que faisait `boost()` en arrondissant
 * vers le haut. Un compte exact n'a pas besoin d'être arrondi. */
{
  /* LES COMPTES VIENNENT DE LA SOURCE BRUTE, pas d'un import de la base. Ce contrôle tourne en
     Node pur — `node test-annonce-du-site.mjs`, sans `tsx` — et `@mydogcanfly/knowledge` est du
     TypeScript : l'importer faisait tomber le contrôle sur un `ERR_MODULE_NOT_FOUND`. Or
     `raw/objects.json` est précisément ce que `normalize()` reçoit : même origine, un cran plus
     tôt, lisible sans compilateur. */
  const brut = JSON.parse(readFileSync(join("packages", "knowledge", "raw", "objects.json"), "utf8"));
  const REELS = {
    compagnies: brut.airlines.length, pays: brut.countries.length,
    races: brut.breeds.length, aeroports: brut.airports.length,
  };
  dire(`\n=== 6. Les chiffres annoncés — base : ${REELS.compagnies} compagnies, ${REELS.pays} pays, ${REELS.races} races, ${REELS.aeroports} aéroports ===`);

  /* Les majorations exactes que `boost()` produisait, plus les valeurs jadis écrites à la main. */
  const FAUX = ["120+", "160+", "200+", "300+", "90+", "250+", "169"];
  const texteDe = (html) => html
    .replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&#(\d+);/g, (_, d) => String.fromCharCode(+d))
    .replace(/&[a-z]+;/g, " ").replace(/\s+/g, " ");

  const surfaces = [];
  for (const l of LANGUES) {
    const acc = l === "en" ? join(DIST, "index.html") : join(DIST, l, "index.html");
    const prs = l === "en" ? join(DIST, "presskit", "index.html") : join(DIST, l, "presskit", "index.html");
    for (const [nom, f] of [[`accueil ${l}`, acc], [`press kit ${l}`, prs]])
      if (existsSync(f)) surfaces.push([nom, texteDe(readFileSync(f, "utf8"))]);
  }
  for (const l of LANGUES) {
    const stat = join("packages", "ui", "public", "presskit", `press-kit-${l}.html`);
    if (existsSync(stat)) surfaces.push([`press kit téléchargeable ${l}`, texteDe(readFileSync(stat, "utf8"))]);
  }
  dire(`  surfaces lues : ${surfaces.map(([n]) => n).join(", ")}`);
  exiger("les trois surfaces sont lues (accueil, page press kit, documents)", surfaces.length >= 12,
    `${surfaces.length} surface(s) — le contrôle ne saurait pas conclure`);

  /* Un compte majoré ne doit apparaître nulle part. */
  const majores = [];
  for (const [nom, texte] of surfaces)
    for (const f of FAUX)
      if (new RegExp(`(?<![\\d.,])${f.replace("+", "\\+")}(?![\\d])`).test(texte)) majores.push(`${nom} : « ${f} »`);
  exiger("aucun compte majoré ni écrit à la main ne subsiste", majores.length === 0, majores.slice(0, 4).join(" | "));

  /* Et le suffixe « + » collé à l'un des quatre comptes réels. */
  const avecPlus = [];
  for (const [nom, texte] of surfaces)
    for (const n of Object.values(REELS))
      if (new RegExp(`(?<![\\d.,])${n}\\+`).test(texte)) avecPlus.push(`${nom} : « ${n}+ »`);
  exiger("aucun compte réel n'est suivi d'un « + »", avecPlus.length === 0, avecPlus.slice(0, 4).join(" | "));

  /* Les comptes réels sont bien SERVIS, sans quoi les deux interdictions ci-dessus seraient
     satisfaites par une page qui n'annonce plus rien du tout. */
  const accueils = surfaces.filter(([n]) => n.startsWith("accueil"));
  const servis = accueils.filter(([, t]) =>
    Object.values(REELS).filter((n) => new RegExp(`(?<![\\d.,])${n}(?![\\d])`).test(t)).length >= 3);
  exiger("chaque accueil sert au moins trois des quatre comptes réels", servis.length === accueils.length,
    `${servis.length}/${accueils.length} accueil(s)`);

  /* ATTAQUES — les deux interdictions doivent savoir échouer. */
  {
    const [, unAccueil] = accueils[0] ?? [];
    if (unAccueil) {
      const falsifie = unAccueil.replace(new RegExp(`(?<![\\d.,])${REELS.compagnies}(?![\\d])`), "120+");
      const vuFalsifie = FAUX.some((f) => new RegExp(`(?<![\\d.,])${f.replace("+", "\\+")}(?![\\d])`).test(falsifie));
      exiger("attaque : un compte falsifié en « 120+ » est vu", vuFalsifie,
        "la falsification passe inaperçue — l'interdiction ne garde rien");
      const avecSuffixe = unAccueil.replace(new RegExp(`(?<![\\d.,])${REELS.compagnies}(?![\\d])`), `${REELS.compagnies}+`);
      const vuSuffixe = new RegExp(`(?<![\\d.,])${REELS.compagnies}\\+`).test(avecSuffixe);
      exiger("attaque : le retour du suffixe « + » est vu", vuSuffixe,
        "le « + » réintroduit passe inaperçu");
    }
  }
}

if (echecs) {
  process.stderr.write(`\n[annonce] ÉCHEC — ${echecs} contrôle(s) non tenu(s)\n`);
  process.exit(1);
}
dire("[annonce] ce que le site annonce existe, et ce qui existe est annoncé.");
