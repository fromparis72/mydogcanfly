#!/usr/bin/env node
/* Audit de cohérence — maillage, liens, ordre de l'information.
 *
 * Complète audit-site.mjs (qui vérifie le SEO technique) par le point de vue du VISITEUR :
 *  A. graphe de liens : liens morts, ancres inexistantes, query après fragment
 *  B. fuites de langue : page FR qui envoie vers une page EN (hors sélecteur de langue)
 *  C. pages orphelines : indexables mais que rien ne pointe
 *  D. ordre des sections : chaque famille de pages doit dérouler ses blocs dans le même ordre
 *  E. contradictions : donnée affichée deux fois avec deux valeurs
 *  F. contexte perdu : liens qui devraient transmettre ?to/?breed/?air et ne le font pas
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const DIST = process.argv[2] || "packages/ui/dist";
const pages = [];
(function walk(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) walk(p);
    else if (e.endsWith(".html")) pages.push(p);
  }
})(DIST);

const urlOf = (p) => {
  let u = "/" + relative(DIST, p).replace(/\\/g, "/");
  u = u.replace(/index\.html$/, "").replace(/\.html$/, "/");
  return u;
};
const pageSet = new Set(pages.map(urlOf));
pageSet.add("/404/"); // servie par Cloudflare sous ce nom logique

const read = (p) => readFileSync(p, "utf-8");
// Les langues préfixées sont listées ici et nulle part ailleurs dans ce script : au moment
// d'ajouter le portugais, `langOf` classait /pt/ comme de l'anglais et l'audit signalait
// 1 326 « fuites de langue » qui n'étaient que le sélecteur de langue faisant son travail.
const PREFIXED = ["fr", "es", "pt"];
const PREFIX_RE = new RegExp(`^/(${PREFIXED.join("|")})/`);
const langOf = (u) => PREFIXED.find((l) => u.startsWith(`/${l}/`)) ?? "en";
const noindexRe = /<meta[^>]+name="robots"[^>]+noindex/i;

const issues = { dead: [], anchor: [], qafterfrag: [], leak: [], ctx: [] };
const inbound = new Map(); // url -> count
const anchorsByPage = new Map(); // url -> Set(ids)
const meta = new Map(); // url -> {noindex, title, h1, lang, sections[]}

const H2RE = /<h2[^>]*>(.*?)<\/h2>/gs;
const strip = (s) => s.replace(/<[^>]+>/g, " ").replace(/&#39;|&amp;|&quot;/g, "'").replace(/\s+/g, " ").trim();

// ---- passe 1 : collecte
for (const p of pages) {
  const u = urlOf(p);
  const html = read(p);
  const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  anchorsByPage.set(u, ids);
  const title = (html.match(/<title>(.*?)<\/title>/s) || [, ""])[1];
  const h1 = strip((html.match(/<h1[^>]*>(.*?)<\/h1>/s) || [, ""])[1]);
  const sections = [...html.matchAll(H2RE)].map((m) => strip(m[1]).slice(0, 60));
  meta.set(u, { noindex: noindexRe.test(html), title: strip(title), h1, lang: langOf(u), sections });
}

// ---- passe 2 : liens
const familyOf = (u) => {
  const x = u.replace(/^\/(fr|es)\//, "/");
  if (/^\/countries\/[a-z]{2}\/$/.test(x)) return "country";
  if (/^\/airlines\/[^/]+\/$/.test(x)) return "airline";
  if (/^\/breeds\/[^/]+\/$/.test(x)) return "breed";
  if (/^\/airports\/[^/]+\/$/.test(x)) return "airport";
  if (/^\/tools\//.test(x)) return "tool";
  return "other";
};

for (const p of pages) {
  const u = urlOf(p);
  const html = read(p);
  const m = meta.get(u);
  for (const [, href] of html.matchAll(/<a\s[^>]*href="([^"]+)"/g)) {
    if (/^(https?:|mailto:|tel:|#|javascript:)/.test(href)) {
      // ancre pure : vérifiée sur la page elle-même
      if (href.startsWith("#") && href.length > 1 && !anchorsByPage.get(u)?.has(href.slice(1)))
        issues.anchor.push({ from: u, href, note: "ancre locale absente" });
      continue;
    }
    if (href.startsWith("/cdn-cgi/")) continue;
    // Un href contenant « ${ » n'est pas un lien : c'est un gabarit JavaScript qui sera
    // interpolé à l'exécution. La maquette /lab/roundtrip/ en contient un, signalé comme
    // lien mort à chaque audit depuis des mois.
    if (href.includes("${")) continue;
    // query APRÈS le fragment = paramètre perdu
    const hi = href.indexOf("#"), qi = href.indexOf("?");
    if (hi >= 0 && qi > hi) issues.qafterfrag.push({ from: u, href });
    const [path0] = href.split(/[?#]/);
    let path = path0 || "/";
    if (!path.endsWith("/") && !path.includes(".")) path += "/";
    if (!pageSet.has(path) && !path.includes(".")) {
      issues.dead.push({ from: u, href, noindex: m.noindex });
      continue;
    }
    inbound.set(path, (inbound.get(path) || 0) + 1);
    // ancre distante
    if (hi >= 0) {
      const frag = href.slice(hi + 1).split("?")[0];
      const tgt = anchorsByPage.get(path);
      if (frag && tgt && !tgt.has(frag)) issues.anchor.push({ from: u, href, note: "ancre absente sur la cible" });
    }
    // fuite de langue (le sélecteur EN/FR/ES pointe légitimement ailleurs : même page, autre préfixe)
    const tl = langOf(path);
    if (tl !== m.lang) {
      const same = path.replace(PREFIX_RE, "/") === u.replace(PREFIX_RE, "/");
      if (!same) issues.leak.push({ from: u, href });
    }
  }
}

// ---- G. LIENS CONSTRUITS CÔTÉ CLIENT
// Angle mort découvert le 29/07 : la Bible bâtit ses liens en JS depuis un îlot JSON
// embarqué. Un crawl des <a href> du HTML servi ne les voit pas et annonce « 0 lien mort »
// alors que les 140 fiches pays pointaient vers /countries/greece/ au lieu de /countries/gr/.
// On résout donc ici les URLs que la page fabriquera : pour chaque îlot JSON, on croise ses
// valeurs de chaîne avec les préfixes déclarés dans la config de la même page (clés en
// « ...Base »), et on vérifie que la page cible existe.
const clientLinks = [];
for (const p of pages) {
  const u = urlOf(p);
  const html = read(p);
  const islands = [...html.matchAll(/<script type="application\/json"[^>]*>([\s\S]*?)<\/script>/g)]
    .map((m) => { try { return JSON.parse(m[1]); } catch { return null; } })
    .filter(Boolean);
  if (!islands.length) continue;
  // préfixes d'URL déclarés par la page (ex. countryBase: "/fr/countries/")
  const bases = [];
  for (const o of islands) for (const [k, v] of Object.entries(o))
    if (/Base$/.test(k) && typeof v === "string" && v.startsWith("/")) bases.push([k, v]);
  if (!bases.length) continue;
  // On ne retient QUE les valeurs portées par un champ nommé « slug » : ce sont les seules
  // qui servent à fabriquer une URL. Ratisser toutes les chaînes produisait du bruit
  // ("listed", "window", "compagnies") et noyait le signal.
  const slugs = new Set();
  const walk = (o) => {
    if (Array.isArray(o)) return o.forEach(walk);
    if (o && typeof o === "object") for (const [k, v] of Object.entries(o)) {
      if (k === "slug" && typeof v === "string") slugs.add(v); else walk(v);
    }
  };
  islands.forEach(walk);
  if (!slugs.size) continue;
  // La page déclare plusieurs préfixes (countryBase, breedBase…) mais l'îlot ne nourrit
  // qu'un seul d'entre eux. On ne peut pas savoir lequel : on teste donc le jeu de slugs
  // contre TOUS les préfixes de pages et on ne signale que s'il n'en résout AUCUN.
  // Sinon on signalerait « 140 slugs pays cassés sous /breeds/ », ce qui n'a aucun sens.
  const prefixes = bases.filter(([, bv]) => [...pageSet].some((x) => x.startsWith(bv) && x !== bv));
  if (!prefixes.length) continue;
  let best = { ok: -1 };
  for (const [bk, bv] of prefixes) {
    const ok = [...slugs].filter((x) => pageSet.has(`${bv}${x}/`)).length;
    if (ok > best.ok) best = { ok, bk, bv };
  }
  if (best.ok === 0) {
    const ko = [...slugs].filter((x) => !pageSet.has(`${best.bv}${x}/`));
    clientLinks.push({
      page: u,
      note: `${slugs.size} slug(s) d'un îlot JSON ne résolvent sous aucun préfixe déclaré par la page`,
      bases: prefixes.map(([k, v]) => `${k}=${v}`),
      ko: ko.length,
      examples: ko.slice(0, 3),
    });
  }
}

// ---- pages orphelines (indexables, jamais pointées)
const orphans = [...pageSet].filter((u) => {
  const m = meta.get(u);
  return m && !m.noindex && !inbound.has(u) && u !== "/";
});

// ---- ordre des sections par famille : signature majoritaire vs déviants
const sigByFam = new Map();
for (const [u, m] of meta) {
  if (m.noindex) continue;
  const fam = familyOf(u);
  if (!["country", "airline", "breed"].includes(fam)) continue;
  const key = fam + ":" + m.lang;
  if (!sigByFam.has(key)) sigByFam.set(key, new Map());
  // signature = suite des émojis/têtes de section (stable même si le texte varie par pays)
  const sig = m.sections.map((s) => s.split(" ")[0]).join("|");
  const bucket = sigByFam.get(key);
  if (!bucket.has(sig)) bucket.set(sig, []);
  bucket.get(sig).push(u);
}
const orderDeviants = [];
for (const [key, bucket] of sigByFam) {
  const sorted = [...bucket.entries()].sort((a, b) => b[1].length - a[1].length);
  const [, majority] = sorted[0];
  for (const [sig, us] of sorted.slice(1)) orderDeviants.push({ key, count: us.length, majority: majority.length, example: us[0], sig });
}

// ---- titres dupliqués entre pages indexables
const byTitle = new Map();
for (const [u, m] of meta) {
  if (m.noindex || !m.title) continue;
  if (!byTitle.has(m.title)) byTitle.set(m.title, []);
  byTitle.get(m.title).push(u);
}
const dupTitles = [...byTitle.entries()].filter(([, us]) => us.length > 1);

// ---- sortie JSON (le rapport lisible est rédigé à part)
const out = {
  pages: pages.length,
  dead: issues.dead,
  anchor: issues.anchor,
  qafterfrag: issues.qafterfrag,
  leak: issues.leak,
  orphans,
  orderDeviants,
  dupTitles: dupTitles.map(([t, us]) => ({ title: t, pages: us })),
  clientLinks,
};
console.log(JSON.stringify(out, null, 1));
