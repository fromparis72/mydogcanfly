#!/usr/bin/env node
/**
 * LA PORTE DOIT MORDRE — sinon elle ne prouve rien.
 *
 *   node test-porte-lancement.mjs
 *
 * Une porte verte sur un site sain est indiscernable d'une porte qui ne regarde rien. Ce harnais
 * construit un `dist` MINIMAL et sain, vérifie qu'elle le laisse passer, puis lui inflige une
 * faute à la fois — quatorze — et exige qu'elle rougisse à chaque fois, SUR LE BON CONTRÔLE.
 *
 * POURQUOI UN DIST SYNTHÉTIQUE ET NON UNE COPIE DU VRAI. Copier 3 121 pages pour muter une balise
 * coûte des secondes à chaque attaque et rend l'échec illisible : on ne saurait pas si la porte a
 * rougi pour la faute injectée ou pour l'une des mille autres du site réel. Ici, le dist tient en
 * six pages dont on connaît chaque octet, et un échec ne peut venir que de l'attaque.
 *
 * ON VÉRIFIE LE LIBELLÉ, PAS SEULEMENT LE CODE DE SORTIE. Une porte qui rougit pour la mauvaise
 * raison est une porte qui laissera passer la bonne faute le jour venu.
 */
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";

let pass = 0, fail = 0;
const check = (label, cond, detail = "") => {
  console.log((cond ? "  OK   " : "  ÉCHEC ") + label + (cond || !detail ? "" : `\n         ${detail}`));
  cond ? pass++ : fail++;
};

const HOTE = "https://mydogcanfly.com";
/* Le dist synthétique n'a AUCUNE page fermée aux moteurs : sa liste d'exceptions est donc vide.
   Passer celle du site réel ferait rougir le témoin sur des chemins qui n'existent pas ici. */
const ADMIS_VIDE = join(mkdtempSync(join(tmpdir(), "porte-admis-")), "admis.json");
writeFileSync(ADMIS_VIDE, JSON.stringify({ chemins: [], prefixes: [] }));
const ecrire = (racine, chemin, contenu) => {
  const f = join(racine, chemin);
  mkdirSync(dirname(f), { recursive: true });
  writeFileSync(f, contenu);
};

/** Une page saine : canonique auto-référent, quatre `hreflang` + x-default, JSON-LD concordant. */
const page = (chemin, titre, alternatives) => `<!doctype html><html><head>
<title>${titre}</title>
<link rel="canonical" href="${HOTE}${chemin}">
${Object.entries(alternatives).map(([l, h]) => `<link rel="alternate" hreflang="${l}" href="${HOTE}${h}">`).join("\n")}
<link rel="alternate" hreflang="x-default" href="${HOTE}${alternatives.en}">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"WebPage","name":"${titre}","publisher":{"@type":"Organization","name":"MyDogCanFly"}}</script>
</head><body><h1>${titre}</h1><a href="/fr/">Version française</a></body></html>`;

const ALT = { en: "/", fr: "/fr/", es: "/es/", pt: "/pt/" };

function distSain() {
  const d = mkdtempSync(join(tmpdir(), "porte-"));
  ecrire(d, "index.html", page("/", "Flying with a dog", ALT));
  ecrire(d, "fr/index.html", page("/fr/", "Voyager avec un chien", ALT));
  ecrire(d, "es/index.html", page("/es/", "Volar con un perro", ALT));
  ecrire(d, "pt/index.html", page("/pt/", "Viajar com um cachorro", ALT));
  ecrire(d, "404.html", "<!doctype html><html><head><title>404</title></head><body>404</body></html>");
  ecrire(d, "robots.txt", `User-agent: *\nAllow: /\nSitemap: ${HOTE}/sitemap.xml\n`);
  ecrire(d, "sitemap.xml", `<?xml version="1.0"?><sitemapindex><sitemap><loc>${HOTE}/sitemap-en.xml</loc></sitemap></sitemapindex>`);
  ecrire(d, "sitemap-en.xml", `<?xml version="1.0"?><urlset>${Object.values(ALT).map((u) => `<loc>${HOTE}${u}</loc>`).join("")}</urlset>`);
  ecrire(d, "_redirects", "/ancien/ / 301\n");
  return d;
}

/** Lance la porte sur un dist et rend { code, sortie }. L'arbre sale est neutralisé : ce harnais
 *  teste les contrôles de CONTENU, et le contrôle d'arbre propre a le sien, plus bas. */
function porte(d) {
  try {
    const sortie = execFileSync("node", ["porte-lancement.mjs", `--dist=${d}`, `--admis=${ADMIS_VIDE}`], { encoding: "utf8" });
    return { code: 0, sortie };
  } catch (e) {
    return { code: e.status ?? 1, sortie: (e.stdout ?? "") + (e.stderr ?? "") };
  }
}

/* ---- 0. Le témoin : un dist sain passe (sauf l'arbre, qui est sale pendant qu'on travaille) -- */
const sain = distSain();
{
  const { sortie } = porte(sain);
  const echecs = sortie.split("\n").filter((l) => l.startsWith("  ÉCHEC"));
  const horsArbre = echecs.filter((l) => !/arbre de travail/.test(l));
  check("TÉMOIN : un dist sain ne déclenche aucun contrôle de contenu", horsArbre.length === 0,
    horsArbre.join("\n         "));
  /* Sans ce témoin, chaque attaque ci-dessous serait satisfaite par une porte qui rougit
     toujours — le piège classique d'un harnais d'attaques sans cas négatif. */
}

/** Applique une mutation à une copie du dist sain, et rend la sortie de la porte. */
function attaque(nom, mutation, motifAttendu) {
  const d = mkdtempSync(join(tmpdir(), "porte-att-"));
  rmSync(d, { recursive: true, force: true });
  cpSync(sain, d, { recursive: true });
  mutation(d);
  const { sortie } = porte(d);
  const lignes = sortie.split("\n");
  const rougies = lignes.filter((l) => l.startsWith("  ÉCHEC") && !/arbre de travail/.test(l));
  const bonne = rougies.some((l) => motifAttendu.test(l));
  check(nom, bonne, rougies.length ? `rougi sur : ${rougies.join(" | ").trim()}` : "AUCUN contrôle n'a rougi");
  rmSync(d, { recursive: true, force: true });
}

console.log("\n— dix-neuf attaques, une faute à la fois —\n");

attaque("1. une URL de sitemap qui ne mène nulle part",
  (d) => ecrire(d, "sitemap-en.xml", `<?xml version="1.0"?><urlset><loc>${HOTE}/fantome/</loc></urlset>`),
  /page inexistante/);

attaque("2. une page listée au sitemap alors qu'elle REDIRIGE",
  (d) => {
    ecrire(d, "_redirects", "/ancien/ / 301\n/fantome/ / 301\n");
    ecrire(d, "sitemap-en.xml", `<?xml version="1.0"?><urlset><loc>${HOTE}/fantome/</loc></urlset>`);
  },
  /adresse qui redirige/);

attaque("3. un sous-sitemap annoncé mais absent du build",
  (d) => ecrire(d, "sitemap.xml", `<?xml version="1.0"?><sitemapindex><sitemap><loc>${HOTE}/sitemap-absent.xml</loc></sitemap></sitemapindex>`),
  /sous-sitemap annoncé existe/);

attaque("4. `noindex` sur une page de production non déclarée",
  (d) => ecrire(d, "fr/index.html", page("/fr/", "Voyager avec un chien", ALT)
    .replace("<head>", '<head><meta name="robots" content="noindex, nofollow">')),
  /noindex/);

attaque("5. `Disallow: /` — la panne du 5 août 2026",
  (d) => ecrire(d, "robots.txt", `User-agent: *\nDisallow: /\nSitemap: ${HOTE}/sitemap.xml\n`),
  /Disallow/);

attaque("6. robots.txt qui n'annonce plus le sitemap",
  (d) => ecrire(d, "robots.txt", "User-agent: *\nAllow: /\n"),
  /annonce le sitemap/);

attaque("7. une page sans canonique",
  (d) => ecrire(d, "es/index.html", page("/es/", "Volar con un perro", ALT)
    .replace(/<link rel="canonical"[^>]*>/, "")),
  /porte un canonique/);

attaque("8. un canonique qui désigne UNE AUTRE page — un `noindex` déguisé",
  (d) => ecrire(d, "es/index.html", page("/es/", "Volar con un perro", ALT)
    .replace(`href="${HOTE}/es/"`, `href="${HOTE}/fr/"`)),
  /désigne la page elle-même/);

attaque("9. un canonique posé sur un autre domaine",
  (d) => ecrire(d, "pt/index.html", page("/pt/", "Viajar com um cachorro", ALT)
    .replace(`<link rel="canonical" href="${HOTE}/pt/">`, '<link rel="canonical" href="https://exemple.example/pt/">')),
  /est sur https/);

attaque("10. une langue manquante dans les `hreflang`",
  (d) => ecrire(d, "fr/index.html", page("/fr/", "Voyager avec un chien", { en: "/", fr: "/fr/", es: "/es/" })),
  /QUATRE langues/);

attaque("11. un `hreflang` qui désigne une page inexistante",
  (d) => ecrire(d, "fr/index.html", page("/fr/", "Voyager avec un chien", { ...ALT, pt: "/pt-absent/" })),
  /hreflang. ne désigne une page inexistante/);

attaque("12. un JSON-LD qui décrit autre chose que la page",
  (d) => ecrire(d, "index.html", page("/", "Flying with a dog", ALT)
    .replace('"name":"Flying with a dog"', '"name":"Assurance automobile pas chère"')),
  /décrit autre chose/);

attaque("13. une redirection vers une page qui n'existe pas",
  (d) => ecrire(d, "_redirects", "/ancien/ /nulle-part/ 301\n"),
  /mènent à une page qui existe/);

attaque("14. un lien interne mort",
  (d) => ecrire(d, "index.html", page("/", "Flying with a dog", ALT)
    .replace('<a href="/fr/">', '<a href="/page-morte/">')),
  /lien interne ne mène à une erreur/);

attaque("15. une page indexable ABSENTE des sitemaps — Google ne la trouvera peut-être jamais",
  (d) => ecrire(d, "sitemap-en.xml", `<?xml version="1.0"?><urlset><loc>${HOTE}/</loc><loc>${HOTE}/fr/</loc><loc>${HOTE}/es/</loc></urlset>`),
  /page indexable figure dans un sitemap/);

attaque("16. une page listée au sitemap ET porteuse de `noindex` — deux ordres contraires",
  (d) => ecrire(d, "pt/index.html", page("/pt/", "Viajar com um cachorro", ALT)
    .replace("<head>", '<head><meta name="robots" content="noindex, nofollow">')),
  /listée au sitemap ne porte .noindex|noindex/);

attaque("17. la même URL listée DEUX FOIS",
  (d) => ecrire(d, "sitemap-en.xml", `<?xml version="1.0"?><urlset>${Object.values(ALT).map((u) => `<loc>${HOTE}${u}</loc>`).join("")}<loc>${HOTE}/fr/</loc></urlset>`),
  /listée DEUX FOIS/);

attaque("18. une grappe de langues NON réciproque — Google écarte la grappe entière, en silence",
  (d) => ecrire(d, "es/index.html", page("/es/", "Volar con un perro", { en: "/", fr: "/fr/", es: "/es/", pt: "/" })),
  /RÉCIPROQUES/);

attaque("19. une page qui ne se déclare pas elle-même dans sa grappe",
  (d) => ecrire(d, "pt/index.html", page("/pt/", "Viajar com um cachorro", { en: "/", fr: "/fr/", es: "/es/", pt: "/es/" })),
  /se déclare elle-même/);

/* ---- Le contrôle d'arbre propre, à part : il ne dépend pas du dist ------------------------- */
{
  const { sortie } = porte(sain);
  check("le contrôle d'arbre propre EXISTE et s'exprime", /arbre de travail/.test(sortie));
}

/* ---- Et la porte doit sortir en ERREUR, pas seulement écrire « ÉCHEC » --------------------- */
{
  const d = mkdtempSync(join(tmpdir(), "porte-code-"));
  rmSync(d, { recursive: true, force: true });
  cpSync(sain, d, { recursive: true });
  ecrire(d, "robots.txt", "User-agent: *\nDisallow: /\n");
  const { code, sortie } = porte(d);
  check("une faute fait sortir la porte en code 1 — pas seulement un message",
    code === 1 && /NE PAS DÉPLOYER/.test(sortie), `code ${code}`);
  rmSync(d, { recursive: true, force: true });
}

rmSync(sain, { recursive: true, force: true });
console.log(`\n${pass} OK, ${fail} ÉCHEC`);
if (fail > 0) process.exit(1);
