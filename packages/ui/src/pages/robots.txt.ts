import type { APIRoute } from "astro";
import { IS_PRODUCTION } from "../lib/env";

export const prerender = true;

/* Un seul groupe, pour tout le monde — décidé le 01/08/2026.
 *
 * Le fichier énumérait auparavant quinze robots de moteurs de réponse (GPTBot, ClaudeBot,
 * PerplexityBot…) avec un `Allow: /` chacun. C'était non seulement redondant, puisque le
 * groupe `*` leur ouvrait déjà tout, mais légèrement contre-productif : la norme veut qu'un
 * robot n'obéisse QU'AU groupe le plus spécifique le concernant. Chacun de ces quinze robots
 * ignorait donc le `Disallow: /lab/` du groupe général et explorait le laboratoire.
 *
 * Un groupe unique dit la même chose — tout est ouvert sauf /lab/ — et le dit à tout le monde.
 * Les moteurs de réponse restent aussi bienvenus qu'avant : c'est le silence qui les accueille,
 * pas une autorisation nominative. Ne pas réintroduire de groupes par robot sans nécessité :
 * en robots.txt, nommer quelqu'un revient à le soustraire aux règles communes.
 */
export const GET: APIRoute = ({ site }) => {
  const base = (site?.href ?? "https://mydogcanfly.com/").replace(/\/$/, "");
  let body: string;
  if (IS_PRODUCTION) {
    body =
      `# MyDogCanFly — search and AI answer engines welcome.\n` +
      `User-agent: *\n` +
      `Allow: /\n` +
      `Disallow: /lab/\n` +
      `Sitemap: ${base}/sitemap.xml\n`;
  } else {
    /* PRÉVERSION : le robots N'INTERDIT PLUS l'exploration (contre-revue de la porte, v2→v6,
     * constaté vivant le 28/08/2026). `Disallow: /` empêchait Google de LIRE le `noindex` que
     * chaque page porte — une page bloquée par robots.txt ne peut pas être explorée pour lire
     * sa balise, et son URL peut malgré tout apparaître dans l'index (Google Search Central,
     * block-indexing). Le mécanisme qui tient la promesse « non indexée » est le `noindex,
     * nofollow` global des pages de préversion (Base.astro) : le robots doit laisser passer
     * pour qu'il soit lu. `Disallow:` vide = tout est explorable ; AUCUNE ligne Sitemap —
     * une préversion n'annonce rien. Gardé par la porte (V2, V3) et ses contre-épreuves 13-14. */
    body = `# Preview / non-production build — deindexed via per-page noindex\nUser-agent: *\nDisallow:\n`;
  }
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
};
