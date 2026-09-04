#!/usr/bin/env node
/**
 * LA PORTE DE LANCEMENT — dix contrôles, et pas un laboratoire général.
 *
 *   node porte-lancement.mjs [--dist=packages/ui/dist]
 *   → code 0 : rien ne s'oppose au déploiement    → code 1 : NE PAS DÉPLOYER
 *
 * Elle ne prouve PAS que le site est bon. Elle prouve que les erreurs qui coûtent cher au
 * lancement, et qu'on ne voit pas en regardant le site, ne sont pas là : une page fermée aux
 * moteurs, un canonique qui désigne quelqu'un d'autre, un sitemap qui promet des adresses
 * inexistantes, une ancienne URL indexée qui tombe en 404, un lien interne mort.
 *
 * TOUT EST VÉRIFIÉ HORS LIGNE, sur le `dist` construit. C'est délibéré et ce n'est pas un pis-
 * aller : ce conteneur n'a pas d'accès réseau ouvert, et surtout un contrôle qui interroge le
 * site EN LIGNE mesure le site d'hier. Ce qu'on veut savoir, c'est ce que le déploiement de
 * TOUT À L'HEURE va publier. Le seul artefact qui le dit est celui qu'on s'apprête à envoyer.
 *
 * L'INCIDENT QUI JUSTIFIE LE CONTRÔLE 2. Le 5 août 2026, le site est resté plusieurs jours avec
 * `Disallow: /` et `noindex` sur ses 2 776 pages. Rien n'était cassé : le build passait, le
 * déploiement passait, les pages s'affichaient. Seul Google voyait la différence, et il a mis
 * des jours à le dire. `verifier-indexation.mjs` couvre déjà ce cas et n'est pas redupliqué ici ;
 * cette porte l'APPELLE, puis va au-delà.
 */
import { readFileSync, existsSync, readdirSync, statSync } from "node:fs";
import { join, relative, dirname } from "node:path";
import { execSync } from "node:child_process";

const arg = (n, d) => (process.argv.find((a) => a.startsWith(`--${n}=`)) ?? `--${n}=${d}`).split("=").slice(1).join("=");
const DIST = arg("dist", "packages/ui/dist");
const HOTE = "https://mydogcanfly.com";
/* Le fichier d'exceptions est un PARAMÈTRE, pas une constante : le harnais d'attaques travaille
   sur un dist synthétique de six pages, où les chemins réels du site n'existent pas — le contrôle
   « chaque exception déclarée correspond à une page réelle » y rougirait sans qu'aucune faute ne
   soit en cause, et le témoin négatif deviendrait inutilisable. */
const ADMIS = arg("admis", "porte-noindex-admis.json");

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  ÉCHEC ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};
const extraits = (xs, n = 5) => xs.slice(0, n).join("\n         ") + (xs.length > n ? `\n         … et ${xs.length - n} autre(s)` : "");

if (!existsSync(DIST)) {
  console.error(`[porte] dist introuvable : ${DIST} — construisez avant d'ouvrir la porte.`);
  process.exit(2);
}

/* ---- Inventaire du dist, fait UNE fois ------------------------------------------------------ */
const pages = [];
(function marcher(d) {
  for (const e of readdirSync(d)) {
    const p = join(d, e);
    if (statSync(p).isDirectory()) marcher(p);
    else if (e.endsWith(".html")) pages.push(p);
  }
})(DIST);

/** Le chemin d'URL que sert un fichier construit : `dist/fr/x/index.html` → `/fr/x/`. */
const cheminDe = (fichier) => {
  const r = "/" + relative(DIST, fichier).split("\\").join("/");
  return r.endsWith("/index.html") ? r.slice(0, -"index.html".length) : r;
};
const servis = new Set(pages.map(cheminDe));
/* Cloudflare Pages sert `/x` comme `/x/` : les deux formes comptent comme servies. */
for (const p of [...servis]) if (p.endsWith("/") && p !== "/") servis.add(p.slice(0, -1));

const lire = (f) => readFileSync(f, "utf8");
const contenus = new Map(pages.map((f) => [f, lire(f)]));

/* ---- Les redirections déclarées -------------------------------------------------------------- */
const redirections = [];
if (existsSync(join(DIST, "_redirects"))) {
  for (const ligne of lire(join(DIST, "_redirects")).split("\n")) {
    const t = ligne.trim();
    if (!t || t.startsWith("#")) continue;
    const [de, vers, code] = t.split(/\s+/);
    if (de && vers) redirections.push({ de, vers, code: code ?? "301" });
  }
}
/** Une URL est-elle rattrapée par une règle de redirection ? L'ordre compte, comme chez Pages. */
const redirigee = (chemin) => redirections.find((r) =>
  r.de === chemin || (r.de.endsWith("/*") && chemin.startsWith(r.de.slice(0, -1))));

console.log(`— porte de lancement — ${pages.length} pages, ${redirections.length} redirection(s) —\n`);

/* ---- 1. Toutes les URL des sitemaps répondent ----------------------------------------------- */
{
  const locs = [];
  for (const f of readdirSync(DIST).filter((x) => /^sitemap.*\.xml$/.test(x))) {
    for (const m of lire(join(DIST, f)).matchAll(/<loc>([^<]+)<\/loc>/g)) locs.push({ url: m[1], dans: f });
  }
  const index = locs.filter((l) => /sitemap.*\.xml$/.test(l.url));
  const pagesListees = locs.filter((l) => !/sitemap.*\.xml$/.test(l.url));
  check(`les sitemaps listent ${pagesListees.length} page(s) et ${index.length} sous-sitemap(s)`,
    pagesListees.length > 0 && index.length > 0);
  /* Un sous-sitemap annoncé mais absent du build est une promesse vide faite à Google. */
  const sousManquants = index.filter((l) => !existsSync(join(DIST, l.url.replace(HOTE + "/", ""))));
  check("chaque sous-sitemap annoncé existe réellement", sousManquants.length === 0,
    extraits(sousManquants.map((l) => l.url)));
  const morts = pagesListees.filter((l) => {
    const chemin = l.url.startsWith(HOTE) ? l.url.slice(HOTE.length) : null;
    return !chemin || (!servis.has(chemin) && !redirigee(chemin));
  });
  check("aucune URL de sitemap ne mène à une page inexistante", morts.length === 0,
    extraits(morts.map((l) => `${l.url}  (${l.dans})`)));
  /* ET L'INVERSE, qui est la vraie faute de 2026 : une page listée qui REDIRIGE. Google la
     signale « URL envoyée avec redirection » et ne l'indexe pas — le sitemap doit ne contenir
     que des adresses finales. */
  const redirigees = pagesListees.filter((l) => {
    const chemin = l.url.slice(HOTE.length);
    return !servis.has(chemin) && redirigee(chemin);
  });
  check("aucune URL de sitemap n'est une adresse qui redirige", redirigees.length === 0,
    extraits(redirigees.map((l) => l.url)));
}

/* ---- 2. Aucune page de production ne porte `noindex` ---------------------------------------- */
{
  const admis = existsSync(ADMIS) ? JSON.parse(lire(ADMIS)) : { chemins: [], prefixes: [] };
  const estAdmis = (c) => admis.chemins.includes(c) || admis.prefixes.some((p) => c.startsWith(p));
  const fautives = [];
  for (const [f, html] of contenus) {
    if (!/<meta[^>]+name=["']robots["'][^>]*noindex/i.test(html)) continue;
    const c = cheminDe(f);
    if (!estAdmis(c)) fautives.push(c);
  }
  check(`aucune page destinée à la production ne porte \`noindex\` (${admis.chemins.length + admis.prefixes.length} exception(s) déclarée(s))`,
    fautives.length === 0, extraits(fautives));
  /* Une exception déclarée qui ne correspond à rien est une exception oubliée : elle donnerait
     un blanc-seing à une page future portant ce chemin. */
  const orphelines = admis.chemins.filter((c) => !servis.has(c));
  check("chaque exception déclarée correspond à une page réelle", orphelines.length === 0, extraits(orphelines));
}

/* ---- 3. robots.txt autorise l'exploration ---------------------------------------------------- */
{
  const f = join(DIST, "robots.txt");
  check("robots.txt existe", existsSync(f));
  if (existsSync(f)) {
    const txt = lire(f);
    check("robots.txt ne porte AUCUN `Disallow: /` global", !/^\s*Disallow:\s*\/\s*$/m.test(txt), txt.trim());
    check("robots.txt annonce le sitemap", /^\s*Sitemap:\s*https?:\/\//m.test(txt));
  }
}

/* ---- 4. Les canoniques désignent la bonne URL de production ---------------------------------- */
{
  /* Pages HORS PARCOURS PUBLIC, déclarées : bac à sable de composants et pages de dossier de
     presse servies comme fichiers autonomes. Elles ne sont pas dans les sitemaps et n'ont pas
     vocation à être indexées ; les exiger canoniques ferait rougir la porte sans rien protéger.
     La liste est COURTE et NOMMÉE — une exception qui n'est pas écrite ici fait échouer. */
  const HORS_PARCOURS = ["/button-lab.html", "/presskit/press-kit-en.html",
    "/presskit/press-kit-fr.html", "/presskit/press-kit-es.html", "/presskit/press-kit-pt.html"];
  const exempt = (c) => HORS_PARCOURS.includes(c);
  const sans = [], mauvaisHote = [], nonAutoreferent = [];
  for (const [f, html] of contenus) {
    const c = cheminDe(f);
    /* Les pages d'ERREUR sont hors sujet : Google ne les indexe pas, et un canonique
       auto-référent sur une 404 n'aurait aucun sens. Elles sont exemptées, nommément. */
    if (/(^|\/)404\.html$/.test(c)) continue;
    if (exempt(c)) continue;
    const m = html.match(/<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']+)["']/i);
    if (!m) { sans.push(c); continue; }
    const href = m[1];
    if (!href.startsWith(HOTE)) { mauvaisHote.push(`${c} → ${href}`); continue; }
    /* Le canonique doit désigner LA PAGE ELLE-MÊME. Un canonique qui pointe ailleurs demande à
       Google de ne pas indexer cette page — c'est un `noindex` déguisé, et il ne se voit pas. */
    const cible = href.slice(HOTE.length) || "/";
    if (cible !== c && cible !== c.replace(/\/$/, "")) nonAutoreferent.push(`${c} → ${cible}`);
  }
  check("chaque page porte un canonique", sans.length === 0, extraits(sans));
  check(`chaque canonique est sur ${HOTE}`, mauvaisHote.length === 0, extraits(mauvaisHote));
  check("chaque canonique désigne la page elle-même", nonAutoreferent.length === 0, extraits(nonAutoreferent));
}

/* ---- 5. Les `hreflang` sont cohérents dans les quatre langues -------------------------------- */
{
  const LANGUES = ["en", "fr", "es", "pt"];
  const alternatesDe = (html) => {
    const out = new Map();
    for (const m of html.matchAll(/<link[^>]+rel=["']alternate["'][^>]*hreflang=["']([^"']+)["'][^>]*href=["']([^"']+)["']/gi)) {
      out.set(m[1], m[2]);
    }
    return out;
  };
  const incompletes = [], morts = [], sansDefaut = [];
  for (const [f, html] of contenus) {
    const alt = alternatesDe(html);
    if (alt.size === 0) continue;                      // page sans variantes déclarées : hors sujet
    const c = cheminDe(f);
    if (LANGUES.some((l) => !alt.has(l))) incompletes.push(`${c} : ${[...alt.keys()].join(",")}`);
    if (!alt.has("x-default")) sansDefaut.push(c);
    for (const [lang, href] of alt) {
      if (!href.startsWith(HOTE)) { morts.push(`${c} [${lang}] → ${href}`); continue; }
      const cible = href.slice(HOTE.length) || "/";
      if (!servis.has(cible) && !redirigee(cible)) morts.push(`${c} [${lang}] → ${cible}`);
    }
  }
  check("toute page à variantes les déclare dans les QUATRE langues", incompletes.length === 0, extraits(incompletes));
  check("…et déclare `x-default`", sansDefaut.length === 0, extraits(sansDefaut));
  check("aucun `hreflang` ne désigne une page inexistante", morts.length === 0, extraits(morts));
}

/* ---- 6. Le JSON-LD correspond au contenu visible ---------------------------------------------- */
{
  const illisibles = [], discordants = [];
  for (const [f, html] of contenus) {
    const c = cheminDe(f);
    for (const m of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
      let donnees;
      try { donnees = JSON.parse(m[1]); } catch { illisibles.push(c); continue; }
      /* Le contrôle utile n'est pas « le schéma est complet » — c'est « il ne raconte pas autre
         chose que la page ». On compare donc le nom annoncé au titre visible. */
      /* NE COMPARER QUE L'ENTITÉ PRINCIPALE. Ma première rédaction comparait TOUS les nœuds et
         signalait 6 149 « discordances » : le nœud `Organization` s'appelle « MyDogCanFly » et
         le nœud `Person` porte le nom de l'auteur — ni l'un ni l'autre n'a de raison de figurer
         dans le titre de la page, et les exiger n'aurait mesuré que ma méconnaissance du
         balisage. Les types de SUPPORT sont donc écartés, nommément, et ce qui reste est ce que
         le contrôle veut vraiment dire : la page ne se présente pas à Google sous un autre nom
         que celui qu'elle affiche. */
      const SUPPORT = new Set(["Organization", "Person", "ContactPoint", "PostalAddress",
        "ImageObject", "WebSite", "BreadcrumbList", "ListItem", "Question", "Answer",
        "FAQPage", "SearchAction", "OpeningHoursSpecification", "GeoCoordinates", "Offer",
        "AggregateRating", "Rating", "Brand", "PropertyValue"]);
      const noeuds = Array.isArray(donnees) ? donnees : [donnees];
      for (const n of noeuds) {
        if (SUPPORT.has(n?.["@type"])) continue;
        const nom = n?.headline ?? n?.name;
        if (typeof nom !== "string" || nom.length < 4) continue;
        const titre = (html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? "")
          + " " + (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1] ?? "");
        const nu = (s) => s.replace(/<[^>]+>/g, " ").replace(/&[a-z]+;/gi, " ").replace(/\s+/g, " ").toLowerCase();
        const mots = nu(nom).split(" ").filter((w) => w.length > 3);
        if (!mots.length) continue;
        const vus = mots.filter((w) => nu(titre).includes(w)).length;
        if (vus / mots.length < 0.5) discordants.push(`${c} : « ${nom} » absent du titre visible`);
      }
    }
  }
  check("tout JSON-LD est lisible", illisibles.length === 0, extraits(illisibles));
  check("aucun JSON-LD ne décrit autre chose que la page", discordants.length === 0, extraits(discordants));
}

/* ---- 7 et 8. Les anciennes URL, et les 404 voulues ------------------------------------------- */
{
  /* Trois formes de cible qu'on ne peut pas résoudre littéralement, et qui ne sont pas des
     fautes : une cible EXTERNE, une ANCRE (`/#flight-finder` — la page est `/`, le fragment ne
     regarde que le navigateur), et un JOKER (`/breeds/:splat` — la cible dépend de l'URL
     entrante). Pour le joker on vérifie le PRÉFIXE : que le dossier de destination existe. */
  const resoudre = (vers) => {
    const sansFragment = vers.split("#")[0] || "/";
    if (sansFragment.includes(":splat") || sansFragment.includes(":")) {
      const prefixe = sansFragment.split(":")[0];
      return [...servis].some((c) => c.startsWith(prefixe)) ? null : `préfixe ${prefixe} ne sert rien`;
    }
    const avecSlash = sansFragment.endsWith("/") ? sansFragment : sansFragment + "/";
    return (servis.has(sansFragment) || servis.has(avecSlash)) ? null : "cible absente";
  };
  const cassees = redirections.filter((r) => {
    if (r.code !== "301" && r.code !== "308") return false;
    if (r.vers.startsWith("http")) return false;                 // cible externe : hors de portée
    return resoudre(r.vers) !== null;
  });
  check(`les ${redirections.length} redirections mènent à une page qui existe`, cassees.length === 0,
    extraits(cassees.map((r) => `${r.de} → ${r.vers}`)));
  /* Une redirection qui pointe vers une autre redirection fait perdre à Google un saut, et
     parfois la page : on les interdit. */
  const chaines = redirections.filter((r) => !r.vers.startsWith("http") && !r.vers.includes(":")
    && redirigee(r.vers.split("#")[0]) && !servis.has(r.vers.split("#")[0]));
  check("aucune redirection n'en vise une autre (pas de chaîne)", chaines.length === 0,
    extraits(chaines.map((r) => `${r.de} → ${r.vers} → …`)));
  /* Les 404 VOULUES sont une décision, pas un oubli : elles sont écrites, et le contrôle vérifie
     qu'elles ne sont PAS redirigées en douce. `/tools/is-it-too-hot-for-my-dog/` en fait partie —
     rediriger cette page est explicitement interdit, la 404 propre EST le contrat. */
  const VOULUES = ["/tools/is-it-too-hot-for-my-dog/", "/api/weather"];
  const trahies = VOULUES.filter((c) => servis.has(c) || redirigee(c));
  check(`les ${VOULUES.length} 404 intentionnelles le sont restées`, trahies.length === 0, extraits(trahies));
  check("la page 404 existe", existsSync(join(DIST, "404.html")));
}

/* ---- 9. Aucun lien interne ne mène à une erreur ---------------------------------------------- */
{
  const morts = new Map();
  for (const [f, htmlBrut] of contenus) {
    const c = cheminDe(f);
    /* LES `<script>` SONT RETIRÉS AVANT DE CHERCHER DES LIENS. Ma première rédaction lisait le
       document entier et signalait `/fr/countries/${d}/` comme lien mort : ce `<a>` vit dans un
       gabarit JavaScript, à l'intérieur d'une chaîne, et `${d}` y est interpolé à l'exécution.
       Ce n'était pas un lien cassé, c'était du CODE lu comme du contenu — la porte accusait le
       site d'une faute qui était la sienne. Un contrôle qui se trompe finit désactivé. */
    const html = htmlBrut.replace(/<script[\s\S]*?<\/script>/gi, " ");
    for (const m of html.matchAll(/<a[^>]+href=["']([^"']+)["']/gi)) {
      let href = m[1];
      if (/^(https?:|mailto:|tel:|#|javascript:)/i.test(href)) {
        if (!href.startsWith(HOTE)) continue;
        href = href.slice(HOTE.length) || "/";
      }
      if (!href.startsWith("/")) continue;                        // relatif : rare, et non ambigu ici
      const chemin = href.split("#")[0].split("?")[0];
      if (!chemin || chemin === "/") continue;
      if (servis.has(chemin) || redirigee(chemin)) continue;
      /* Un lien vers un FICHIER (archive de presse, image, feuille de style) n'est pas une page :
         il suffit qu'il existe dans le dist. Ma première rédaction n'admettait pas `.zip` et
         signalait les trois archives du dossier de presse — elles sont bien là. */
      if (/\.[a-z0-9]{2,5}$/i.test(chemin) && existsSync(join(DIST, chemin))) continue;
      if (!morts.has(chemin)) morts.set(chemin, []);
      morts.get(chemin).push(c);
    }
  }
  check("aucun lien interne ne mène à une erreur", morts.size === 0,
    extraits([...morts].map(([cible, depuis]) => `${cible}  ← ${depuis.length} page(s), ex. ${depuis[0]}`)));
}

/* ---- 10. Le déploiement correspond au SHA et au dist vérifiés -------------------------------- */
{
  let sha = "inconnu", propre = false;
  try {
    sha = execSync("git rev-parse HEAD", { encoding: "utf8" }).trim();
    propre = execSync("git status --porcelain", { encoding: "utf8" }).trim() === "";
  } catch { /* hors dépôt : on le dira */ }
  check("le SHA de l'arbre est lisible", sha !== "inconnu", sha);
  /* Un arbre sale veut dire qu'on ne saura pas dire, demain, ce qui a été publié. Ce n'est pas
     une question de propreté : c'est la seule chose qui rend un retour arrière possible. */
  check("l'arbre de travail est PROPRE — sans quoi le contenu publié n'est rattachable à rien", propre,
    propre ? "" : "des modifications non validées existent");
  console.log(`\n  empreinte : ${sha}  ·  ${pages.length} pages  ·  dist ${DIST}`);
}

console.log(`\n${pass} contrôle(s) OK, ${fail} en échec`);
if (fail > 0) {
  console.log("\nNE PAS DÉPLOYER.");
  process.exit(1);
}
console.log("\nRien ne s'oppose au déploiement. La décision reste celle de Philippe.");
