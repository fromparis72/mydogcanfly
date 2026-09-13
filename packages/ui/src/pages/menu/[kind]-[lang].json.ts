import type { APIRoute, GetStaticPaths } from "astro";
import { loadKB } from "@mydogcanfly/knowledge";
import { menuList } from "../../lib/pagedata";
import { LOCALES } from "../../lib/routes";

/* Les listes du menu déroulant, servies à la demande — et non écrites dans chaque page.
 *
 * POURQUOI (13/09/2026). Le panneau du menu listait l'intégralité des compagnies, des pays et
 * des races dans le HTML de CHAQUE page : 466 balises `<a>` par page, 1 419 770 liens internes
 * sur les 3 121 pages construites, et un profil de maillage parfaitement plat — mesuré sur le
 * build du 13/09 — où une fiche pays reçoit 461 liens entrants quand l'accueil en reçoit 597.
 * Aucune hiérarchie n'était transmise à Google, et la part de HTML identique d'une page à
 * l'autre écrasait le peu de contenu propre à chacune.
 *
 * CE QUI N'EST PAS REVENU EN ARRIÈRE. La variante « dix plus consultés + lien vers l'index »
 * avait été essayée le 30/07/2026 puis abandonnée, parce qu'elle retirait au visiteur la
 * possibilité d'atteindre n'importe quelle fiche depuis n'importe quelle page — qui est la
 * raison d'être de ce menu. Elle reste abandonnée : la liste servie ici est COMPLÈTE. Seul son
 * mode de livraison change. Le visiteur ouvre le panneau, la liste arrive, il filtre comme
 * avant ; Google, lui, ne voit plus 466 liens répétés mais le lien vers l'index de la famille,
 * qui est l'annuaire complet et crawlable.
 *
 * CE QUE ÇA COÛTE, dit franchement : sans JavaScript, le panneau reste vide. Le lien de
 * l'en-tête mène alors à l'index de la famille, qui liste tout en HTML — personne ne se
 * retrouve sans chemin. Sous 820 px le panneau était de toute façon masqué par le CSS depuis
 * toujours : ces 466 liens n'y servaient déjà à rien.
 */
export const prerender = true;

const KINDS = ["airline", "country", "breed"] as const;

export const getStaticPaths: GetStaticPaths = () =>
  LOCALES.flatMap((lang) => KINDS.map((kind) => ({ params: { kind, lang } })));

/** Clés courtes : ces fichiers sont téléchargés, pas lus par un humain. */
const sansAccent = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

export const GET: APIRoute = ({ params }) => {
  const kind = String(params.kind);
  const lang = String(params.lang);
  if (!KINDS.includes(kind as (typeof KINDS)[number]) || !LOCALES.includes(lang as any))
    return new Response("Not found", { status: 404 });

  const items = menuList(loadKB(), kind, lang).map((it) => ({
    h: it.href,
    l: it.label,
    n: sansAccent(it.label),
    ...(it.flag ? { f: it.flag } : {}),
    ...(it.badge ? { b: it.badge } : {}),
  }));

  return new Response(JSON.stringify(items), {
    headers: { "content-type": "application/json; charset=utf-8" },
  });
};
