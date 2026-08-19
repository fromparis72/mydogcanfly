#!/usr/bin/env node
/**
 * TOUT LIEN INTERNE MÈNE QUELQUE PART — et ce qui redirige mène quelque part aussi.
 *
 *   node test-liens-internes.mjs        (exige un site construit sous packages/ui/dist)
 *
 * POURQUOI CE HARNAIS EXISTE. Les liens internes ont été comptés une fois, à la main, dans une
 * conversation : 1 021 liens, 0 mort. C'était vrai ce jour-là et ça ne protégeait rien le lendemain
 * — exactement le reproche que `test-annonce-du-site.mjs` fait aux vérifications manuelles. Celui-ci
 * généralise le même contrôle du `hreflang` à TOUT `href`.
 *
 * TROIS ÉTATS, ET LE DEUXIÈME N'EST PAS UN DÉFAUT :
 *   · le lien vise une page construite                        → il résout ;
 *   · il vise une adresse déclarée dans `_redirects`, ET la cible de cette redirection existe
 *                                                             → il redirige, ce qui est légal ;
 *   · ni l'un ni l'autre                                      → il est MORT, et c'est un échec.
 * Cette distinction n'est pas cosmétique : j'ai déjà annoncé « quatre liens morts » alors que trois
 * d'entre eux étaient des redirections déclarées. Confondre les deux, c'est accuser à tort.
 *
 * UNE REDIRECTION QUI MÈNE AU VIDE EST UN ÉCHEC AUSSI. Un 301 vers une page inexistante est un cul-
 * de-sac de plus, pas une réparation : la cible est donc résolue à son tour, `:splat` compris.
 *
 * OÙ VIT LE LIEN COMPTE AUSSI. Une page que le site n'offre à aucun moteur — absente des quatre
 * sitemaps, comme les prototypes de `/lab/` — n'est atteinte par aucun visiteur venu de la
 * recherche. Un lien mort y est un défaut de second rang : il est LISTÉ et son nombre est FIGÉ,
 * si bien qu'un second se verrait, mais il ne bloque pas. Le partage se fait sur la présence au
 * sitemap et non sur la balise `robots` : un build de preview marque TOUTES les pages `noindex`,
 * et s'appuyer dessus rendrait le harnais aveugle une fois sur deux.
 *
 * JAMAIS VERT FAUTE DE MATIÈRE : sous 2 000 pages ou 5 000 liens, il refuse de conclure.
 */
import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join } from "node:path";

const DIST = "packages/ui/dist";
const dire = (m) => process.stdout.write(m + "\n");

/* ---- Les pages construites --------------------------------------------------------------------- */
const pages = [];
(function marcher(d) {
  if (!existsSync(d)) return;
  for (const e of readdirSync(d, { withFileTypes: true })) {
    if (e.isDirectory()) { if (e.name !== "_astro") marcher(join(d, e.name)); }
    else if (e.name.endsWith(".html")) pages.push(join(d, e.name));
  }
})(DIST);
if (pages.length < 2000) {
  process.stderr.write(`[liens] ÉCHEC — site absent ou partiel (${pages.length} pages HTML sous ${DIST}). `
    + "Ce harnais lit les octets du site : sans site, il ne prouverait rien.\n");
  process.exit(1);
}

/* ---- Les règles de redirection, lues telles que Cloudflare les lira --------------------------- */
const REDIRECTIONS = [];
for (const ligne of readFileSync(join(DIST, "_redirects"), "utf8").split("\n")) {
  const l = ligne.trim();
  if (!l || l.startsWith("#")) continue;
  const [de, vers] = l.split(/\s+/);
  if (!de || !vers) continue;
  REDIRECTIONS.push({ de, vers, splat: de.endsWith("*") });
}
if (REDIRECTIONS.length < 10) {
  process.stderr.write(`[liens] ÉCHEC — ${REDIRECTIONS.length} règle(s) de redirection lues : `
    + "le fichier `_redirects` n'a pas été compris, et tout lien redirigé serait déclaré mort.\n");
  process.exit(1);
}

/* ---- Les pages que le site OFFRE aux moteurs ---------------------------------------------------
 * Lues dans les quatre sitemaps de langue, qui ne dépendent pas de l'environnement de build. */
const OFFERTES = new Set();
for (const l of ["en", "fr", "es", "pt"]) {
  const f = join(DIST, `sitemap-${l}.xml`);
  if (!existsSync(f)) continue;
  for (const m of readFileSync(f, "utf8").matchAll(/<loc>([^<]+)<\/loc>/g)) {
    OFFERTES.add(m[1].replace(/^https?:\/\/[^/]+/, ""));
  }
}
if (OFFERTES.size < 1000) {
  process.stderr.write(`[liens] ÉCHEC — ${OFFERTES.size} URL lues dans les sitemaps de langue : `
    + "le partage entre pages offertes et pages retirées serait faux, et tout deviendrait « second rang ».\n");
  process.exit(1);
}
/** La page qui PORTE le lien est-elle offerte aux moteurs ? */
const offerte = (fichier) => {
  const chemin = fichier.slice(DIST.length).replace(/index\.html$/, "");
  return OFFERTES.has(chemin) || OFFERTES.has(chemin.replace(/\/$/, ""));
};

/** Une adresse est-elle servie par un fichier construit ? */
const sert = (chemin) => {
  const p = chemin.replace(/\/+$/, "");
  return existsSync(join(DIST, p, "index.html"))
    || (existsSync(join(DIST, p)) && statSync(join(DIST, p)).isFile())
    || (p === "" && existsSync(join(DIST, "index.html")));
};

/** La cible d'une redirection, `:splat` substitué — ou null si aucune règle ne s'applique. */
const redirigeVers = (chemin) => {
  for (const r of REDIRECTIONS) {
    if (!r.splat && (r.de === chemin || r.de === chemin.replace(/\/$/, "") || `${r.de}/` === chemin)) return r.vers;
    if (r.splat) {
      const prefixe = r.de.slice(0, -1);
      if (chemin.startsWith(prefixe)) return r.vers.replace(":splat", chemin.slice(prefixe.length));
    }
  }
  return null;
};

/* ---- Le relevé ---------------------------------------------------------------------------------- */
const EXTENSION = /\.(?:js|mjs|css|png|jpe?g|webp|avif|gif|svg|ico|txt|xml|json|pdf|zip|woff2?|ttf|mp4|webm)$/i;
const resolus = new Set(), redirigent = new Map(), morts = new Map(), mortsRetires = new Map();
/** Les liens morts tolérés parce qu'ils vivent sur des pages retirées des sitemaps — FIGÉ. */
const MORTS_HORS_SITEMAP = 1;
let liens = 0;

for (const page of pages) {
  const html = readFileSync(page, "utf8");
  for (const m of html.matchAll(/<a\b[^>]*?\shref="([^"]+)"/gi)) {
    const brut = m[1];
    if (!brut.startsWith("/") || brut.startsWith("//")) continue;   // externe, ancre, mailto, tel
    const chemin = brut.split("#")[0].split("?")[0];
    if (!chemin || chemin.startsWith("/_astro/") || EXTENSION.test(chemin)) continue;
    liens++;
    if (sert(chemin)) { resolus.add(chemin); continue; }
    const cible = redirigeVers(chemin);
    const source = page.slice(DIST.length) || "/";
    const tas = offerte(page) ? morts : mortsRetires;
    if (cible === null) { (tas.get(chemin) ?? tas.set(chemin, new Set()).get(chemin)).add(source); continue; }
    /* Une redirection qui mène au vide est un cul-de-sac de plus, pas une réparation. */
    const versChemin = cible.split("#")[0].split("?")[0];
    if (versChemin.startsWith("http") || sert(versChemin)) {
      (redirigent.get(chemin) ?? redirigent.set(chemin, new Set()).get(chemin)).add(source);
    } else {
      (tas.get(chemin) ?? tas.set(chemin, new Set()).get(chemin))
        .add(`${source} → redirige vers ${versChemin}, qui n'existe pas`);
    }
  }
}

dire("");
dire(`  ${pages.length} pages · ${liens} liens internes relevés`);
dire(`  ${resolus.size} adresses distinctes résolvent · ${redirigent.size} passent par une redirection déclarée`);

if (liens < 5000) {
  process.stderr.write(`[liens] ÉCHEC — ${liens} liens relevés seulement : le relevé n'a pas compris le site, `
    + "et un total trop bas ferait passer ce harnais pour vert alors qu'il n'a presque rien lu.\n");
  process.exit(1);
}
let sorti = 0;
if (mortsRetires.size !== MORTS_HORS_SITEMAP) {
  process.stderr.write(`\n[liens] ÉCHEC — ${mortsRetires.size} lien(s) mort(s) sur des pages retirées des `
    + `sitemaps, ${MORTS_HORS_SITEMAP} attendu(s) au sceau :\n`
    + [...mortsRetires].map(([c, ou]) => `  · ${c}\n      porté par ${[...ou].slice(0, 2).join(", ")}`).join("\n") + "\n");
  sorti = 1;
} else if (mortsRetires.size) {
  dire(`  ${mortsRetires.size} lien mort TOLÉRÉ sur une page retirée des sitemaps, et il est nommé :`);
  for (const [c, ou] of mortsRetires) dire(`    · ${c}  (porté par ${[...ou][0]})`);
}
if (morts.size) {
  process.stderr.write(`\n[liens] ÉCHEC — ${morts.size} adresse(s) interne(s) ne mènent nulle part :\n`
    + [...morts].slice(0, 25).map(([c, ou]) =>
      `  · ${c}\n      cité par ${ou.size} page(s), dont ${[...ou].slice(0, 2).join(", ")}`).join("\n") + "\n");
  process.exit(1);
}
if (sorti) process.exit(1);
dire("[liens] tout lien interne mène à une page construite, directement ou par une redirection déclarée.");
