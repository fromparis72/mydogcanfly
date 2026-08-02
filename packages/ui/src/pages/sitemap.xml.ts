import type { APIRoute } from "astro";
import { PUBLIC_LOCALES } from "../lib/sitemapEntries";

/* /sitemap.xml — un index, plus un fichier par langue.
 *
 * L'adresse ne change pas : c'est toujours elle que `robots.txt` annonce et que la Search
 * Console a en mémoire, il n'y a donc rien à resoumettre côté structure. Ce qu'elle contient
 * change : au lieu de 2 640 URL en un bloc de 1,7 Mo, quatre renvois vers
 * /sitemap-en.xml, -fr, -es et -pt.
 *
 * L'intérêt est un intérêt de diagnostic. Un sitemap unique ne rend qu'un chiffre global —
 * « 2 640 pages découvertes » — qui ne dit pas quelle langue décroche. Quatre fichiers donnent
 * quatre lignes dans la Search Console, chacune avec son statut, sa date de lecture et son
 * compte. Le jour où le portugais cesse d'être exploré, ça se voit tout de suite.
 *
 * `lastmod` est volontairement absent de l'index : il vaudrait la date de construction pour
 * les quatre fichiers, ce qui n'apprend rien. Une date sans information est du bruit.
 */
export const prerender = true;

export const GET: APIRoute = ({ site }) => {
  const base = (site?.href ?? "https://mydogcanfly.com/").replace(/\/$/, "");
  const body = PUBLIC_LOCALES.map(
    (l) => `  <sitemap>\n    <loc>${base}/sitemap-${l}.xml</loc>\n  </sitemap>`,
  ).join("\n");

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    `${body}\n` +
    `</sitemapindex>\n`;
  return new Response(xml, { headers: { "content-type": "application/xml; charset=utf-8" } });
};
