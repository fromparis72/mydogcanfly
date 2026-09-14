import type { APIRoute } from "astro";
import { loadKB, slugFor } from "@mydogcanfly/knowledge";
import { reliefIndexable } from "../lib/reliefEtat";
import { raceIndexable } from "../lib/raceEtat";
import { compagnieIndexable } from "../lib/compagnieEtat";
import { airlineData } from "../data/airlines";
import { PUBLIC_LOCALES } from "../lib/sitemapEntries";

/* /llms.txt — la carte du site à l'usage des moteurs de réponse.
 *
 * POURQUOI CE FICHIER EST DEVENU UNE ROUTE (13/09/2026). Il vivait dans `public/`, écrit à la
 * main, et il avait dérivé de ce que le site publie réellement — ce qui, sur un fichier dont
 * l'unique fonction est d'inspirer confiance à une machine qui vérifie, est le pire des défauts.
 * Il annonçait un site « trilingue » alors que le portugais est en ligne et sitemappé depuis
 * des semaines, et quatre compteurs qui ne correspondaient à rien de mesurable : 78 compagnies
 * (le nombre de compagnies NOTÉES, pas le nombre de fiches), 169 races, 249 aéroports (le
 * nombre de fiches écrites, dont la moitié sont en `noindex`).
 *
 * Ces nombres sont désormais COMPTÉS sur la même base que les sitemaps, à chaque construction.
 * Ils ne peuvent plus diverger, parce qu'il n'y a plus deux endroits où les écrire.
 *
 * CE QUI RESTE ÉCRIT À LA MAIN, et doit le rester : les phrases qui disent comment ce site
 * travaille — la distinction entre ce que la loi exige et ce qu'une compagnie impose, la
 * périodicité de revérification, le fait qu'une source non confirmée est annoncée comme telle.
 * Un moteur de réponse ne cite pas un inventaire, il cite une méthode.
 */
export const prerender = true;

const BASE = "https://mydogcanfly.com";

/** Les compagnies les mieux notées, telles que la base les note — aucune sélection éditoriale. */
function topAirlines(airlines: any[], n: number) {
  return airlines
    .filter((a: any) => typeof a.rating === "number")
    .sort((a: any, b: any) => b.rating - a.rating || String(a.name).localeCompare(String(b.name)))
    .slice(0, n);
}

/** Les destinations les plus desservies, mesurées sur `serves_country_ids` — pas sur une intuition. */
function topCountries(kb: any, n: number) {
  const desserte = new Map<string, number>();
  for (const a of kb.airlines.values())
    for (const id of ((a as any).serves_country_ids ?? [])) desserte.set(id, (desserte.get(id) ?? 0) + 1);
  return [...kb.countries.values()]
    .map((c: any) => ({ c, n: desserte.get(c.id) ?? 0 }))
    .sort((x, y) => y.n - x.n || String(x.c.name?.en ?? x.c.name).localeCompare(String(y.c.name?.en ?? y.c.name)))
    .slice(0, n)
    .map((x) => x.c);
}

const nom = (e: any): string =>
  typeof e.name === "string" ? e.name : (e.name?.en ?? String(e.id));

export const GET: APIRoute = () => {
  const kb: any = loadKB();
  const compagniesIndexables = [...kb.airlines.values()]
    .filter((a: any) => airlineData[a.id] && compagnieIndexable(a, airlineData[a.id]));
  const nCompagnies = compagniesIndexables.length;
  const nPays = kb.countries.size;
  const nRaces = [...kb.breeds.values()].filter((b: any) => raceIndexable(kb, b)).length;
  const nAeroports = [...kb.airports.values()].filter((a: any) => reliefIndexable(a)).length;
  const langues = PUBLIC_LOCALES;
  const prefixes = langues.filter((l) => l !== "en");

  const l: string[] = [];
  const w = (s = "") => l.push(s);

  w("# MyDogCanFly");
  w();
  w(
    `> The reference for flying with a dog. MyDogCanFly documents ${nCompagnies} airlines, ` +
      `${nPays} country entry regimes, ${nRaces} dog breeds and ${nAeroports} airports, and answers one ` +
      `question: can this dog fly on this route, in the cabin, the hold or as cargo? Rules presented ` +
      `as verified carry their official source, a verification date and a confidence level.`,
  );
  w();
  w(
    `The site is published in ${langues.length} languages. English lives at the root, the others under ` +
      `${prefixes.map((p) => `/${p}/`).join(", ")}; every URL below exists in each language by prefixing the locale.`,
  );
  w();
  w(
    "Editorial rules worth knowing when citing this site: airline policies are re-verified every 90 days " +
      "and country rules every 180; a distinction is always drawn between what the law requires and what " +
      "an airline imposes commercially; and where an official source could not be confirmed, the page says " +
      "so rather than guessing. Pages that do not yet carry a verified answer are served `noindex` and are " +
      "absent from the sitemaps — the counts above are what is published, not what is drafted.",
  );
  w();
  w("## Start here");
  w();
  w(`- [Flight Finder](${BASE}/): the decision engine — enter route, breed and weight, get a sourced verdict per airline`);
  w(`- [About and editorial standards](${BASE}/about/): who publishes this, how rules are sourced and reviewed`);
  w(`- [Report an error](${BASE}/report-error/): corrections are welcome and reviewed`);
  w();
  w("## Airlines");
  w();
  w(`- [Airline directory](${BASE}/airlines/): ${nCompagnies} sourced carrier profiles currently eligible for indexing; draft profiles remain marked to confirm`);
  for (const a of topAirlines(compagniesIndexables, 12))
    w(`- [${nom(a)}](${BASE}/airlines/${slugFor(a.id)}/): rated ${(a as any).rating}/5`);
  w();
  w("## Countries");
  w();
  w(`- [All destinations](${BASE}/countries/): ${nPays} countries — entry requirements, exit formalities, domestic-flight rules and breed bans`);
  for (const c of topCountries(kb, 10)) w(`- [${nom(c)}](${BASE}/countries/${slugFor(c.id)}/)`);
  w();
  w("## Airports");
  w();
  w(`- [Pet relief areas](${BASE}/airports/): ${nAeroports} airports with a verified relief-area answer, landside and airside`);
  w();
  w("## Dog breeds");
  w();
  w(`- [All breeds](${BASE}/breeds/): ${nRaces} breeds, with brachycephalic status and the airline restrictions that name them`);
  w();
  w("## Tools");
  w();
  w(`- [Tools index](${BASE}/tools/)`);
  w(`- [Crate size calculator](${BASE}/tools/crate/): the crate size an airline will accept, computed from the dog's own measurements`);
  w(`- [Heat risk calculator](${BASE}/tools/heat/): whether it is too hot to fly a dog on a given route and date`);
  w(`- [Pet relief areas](${BASE}/tools/pet-relief/): where a dog can relieve itself in an airport, landside and airside`);
  w(`- [Destination finder](${BASE}/tools/destinations/): where a dog can realistically travel from a given airport`);
  w();
  /* LA SECTION QUI DIT COMMENT CITER (13/09/2026).
   *
   * Un rédacteur humain trouve le bloc « Citer cette page » juste après le résumé de chaque fiche
   * indexable et datée ; un moteur de réponse ne dépend pas de ce placement. Jusqu'ici rien ne lui indiquait qu'il
   * devait nommer le site ni transporter la date de vérification du fait qu'il rapporte — et il
   * ne le faisait pas. Ces quelques lignes sont l'exact pendant machine du bloc visible, et le
   * `license` posé dans le JSON-LD de chaque page datée pointe vers la même adresse. */
  w("## Citing this site");
  w();
  w(`Cite as: MyDogCanFly, <page title>, verified <date>, <URL>.`);
  w(
    "Verified facts may be reused with credit and the verification date. Systematic reproduction " +
      "of the database and republication of the editorial text require permission. A dated fact " +
      "reported without its date is a different claim from the one published here. Full terms: " +
      `${BASE}/citing/`,
  );
  w();
  w("## Legal");
  w();
  w(`- [Legal notice](${BASE}/legal-notice/)`);
  w(`- [Privacy](${BASE}/privacy/)`);
  w(`- [Terms](${BASE}/terms/)`);
  w();
  w("## Optional");
  w();
  w(`- [Sitemap index](${BASE}/sitemap.xml): one sitemap per language (${langues.join(", ")})`);
  w(`- [Travel hub](${BASE}/travel-hub/): long-form guidance`);
  w(`- [Press kit](${BASE}/presskit/): logos, figures and contact for journalists and partners`);
  w();

  return new Response(l.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
};
