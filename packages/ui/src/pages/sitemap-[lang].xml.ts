import type { APIRoute, GetStaticPaths } from "astro";
import { localizedPath } from "../lib/routes";
import { buildEntries, PUBLIC_LOCALES, type Meta } from "../lib/sitemapEntries";
import { guidesDe, decompose, guideHref, languesDe } from "../lib/guides";

/* /sitemap-en.xml, -fr, -es, -pt — les URL d'une seule langue.
 *
 * Un point mérite d'être dit, parce qu'il a l'air d'une erreur : chaque fichier ne contient
 * que ses propres URL, mais CHAQUE entrée porte le jeu complet des `hreflang`, les quatre
 * langues plus `x-default`. C'est la règle de Google — les annotations doivent être
 * réciproques et complètes, quel que soit le fichier qui les transporte. Un sitemap français
 * qui ne déclarerait que le français romprait la réciprocité et les alternates seraient
 * ignorés en bloc.
 *
 * Conséquence : le découpage ne réduit pas le volume total, il le range. C'était le but.
 */
export const prerender = true;

export const getStaticPaths: GetStaticPaths = () =>
  PUBLIC_LOCALES.map((lang) => ({ params: { lang } }));

const urlBlock = (loc: string, altXml: string, m: Meta) =>
  `  <url>\n` +
  `    <loc>${loc}</loc>\n` +
  `    <lastmod>${m.lastmod}</lastmod>\n` +
  `    <changefreq>${m.changefreq}</changefreq>\n` +
  `    <priority>${m.priority}</priority>\n` +
  altXml +
  `  </url>`;

export const GET: APIRoute = async ({ site, params }) => {
  const lang = String(params.lang);
  if (!PUBLIC_LOCALES.includes(lang as (typeof PUBLIC_LOCALES)[number]))
    return new Response("Not found", { status: 404 });

  const base = (site?.href ?? "https://mydogcanfly.com/").replace(/\/$/, "");

  const body = buildEntries()
    .map(({ path, meta }) => {
      const alt =
        PUBLIC_LOCALES.map(
          (l) => `    <xhtml:link rel="alternate" hreflang="${l}" href="${base + localizedPath(path, l)}"/>\n`,
        ).join("") +
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${base + localizedPath(path, "en")}"/>\n`;
      return urlBlock(base + localizedPath(path, lang), alt, meta);
    })
    .join("\n");

  /* Les guides du Travel Hub, à part — et c'est la raison d'être de ce bloc.
   *
   * Deux choses les distinguent de toutes les autres pages du site : leur slug change avec la
   * langue (`camping-avec-chien` / `camping-with-a-dog`), et ils n'existent qu'en français et
   * en anglais. La boucle ci-dessus, qui déduit chaque URL du chemin, se tromperait donc deux
   * fois. Ici les adresses et les alternates sont CONSTATÉS sur les fichiers présents, jamais
   * calculés : le sitemap ne peut pas annoncer une page qui n'a pas été écrite. */
  const guides = await guidesDe(lang);
  const blocsGuides = [];
  for (const g of guides) {
    const { slug } = decompose(g);
    const langues = await languesDe(g.data.key);
    const alt =
      langues.map((a) => `    <xhtml:link rel="alternate" hreflang="${a.locale}" href="${base + a.href}"/>\n`).join("") +
      (langues.find((a) => a.locale === "en")
        ? `    <xhtml:link rel="alternate" hreflang="x-default" href="${base + langues.find((a) => a.locale === "en")!.href}"/>\n`
        : "");
    blocsGuides.push(
      urlBlock(base + guideHref(lang, slug), alt, {
        priority: "0.6",
        changefreq: "monthly",
        /* La vraie date de révision de l'article, pas celle de la construction. */
        lastmod: g.data.lastmod.slice(0, 10),
      }),
    );
  }
  const corps = blocsGuides.length ? `${body}\n${blocsGuides.join("\n")}` : body;

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"\n` +
    `        xmlns:xhtml="http://www.w3.org/1999/xhtml">\n` +
    `${corps}\n` +
    `</urlset>\n`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8" } });
};
