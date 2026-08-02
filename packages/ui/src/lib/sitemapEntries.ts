/* La liste des pages du sitemap, et rien d'autre.
 *
 * Extrait de sitemap.xml.ts le 01/08/2026, quand le sitemap unique a été découpé en un index
 * plus un fichier par langue. Deux routes ont désormais besoin de cette liste — l'index pour
 * savoir quelles langues existent, chaque fichier de langue pour ses propres URL — et une
 * liste de pages dupliquée dans deux fichiers finit toujours par diverger.
 *
 * Le découpage ne change aucune URL : les mêmes 2 640 adresses, les mêmes hreflang, les mêmes
 * dates. Il rend seulement la Search Console lisible — « 2 640 pages découvertes » ne disait
 * pas si c'était le portugais qui décrochait.
 */
import { loadKB, slugFor } from "@mydogcanfly/knowledge";
import { countryData } from "../data/countries";
import { LOCALES, isPreviewLocale } from "./routes";

/** Une langue en préparation ne doit ni figurer au sitemap ni apparaître en hreflang. */
export const PUBLIC_LOCALES = LOCALES.filter((l) => !isPreviewLocale(l));

export interface Meta { priority: string; changefreq: string; lastmod: string }
export interface Entry { path: string; meta: Meta }

/* `lastmod` porte la vraie date de vérification là où elle existe (pays, aéroports) ; sinon
 * la date de construction. Aucune date n'est inventée. `priority` et `changefreq` suivent une
 * hiérarchie simple : accueil > carrefours > outils > fiches > pages légales. */
const BUILD_DATE = new Date().toISOString().slice(0, 10);
const isISO = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);

export function buildEntries(): Entry[] {
  const kb = loadKB();
  const entries: Entry[] = [];
  const push = (path: string, priority: string, changefreq: string, lastmod: string = BUILD_DATE) =>
    entries.push({ path, meta: { priority, changefreq, lastmod } });

  // Accueil et carrefours principaux
  push("/", "1.0", "weekly");
  for (const hub of ["/airlines/", "/countries/", "/airports/", "/breeds/", "/tools/", "/travel-hub/"])
    push(hub, "0.9", "weekly");
  // Outils (chacun porte un schéma FAQPage — forte valeur SEO/GEO)
  for (const tool of ["/tools/destinations/", "/tools/crate/", "/tools/heat/", "/tools/pet-relief/",
                      "/tools/best-carriers/", "/tools/best-crates/"])
    push(tool, "0.8", "monthly");
  // Pages indexables qui n'appartiennent à aucune famille ci-dessus (repérées par npm run audit)
  push("/airports/pet-relief/", "0.6", "monthly");
  push("/report-error/", "0.3", "yearly");
  // Confiance / mentions légales
  push("/about/", "0.5", "yearly");
  // Presse & partenariats : page d'entrée pour les journalistes et les partenaires, elle porte
  // les fichiers à télécharger. Priorité au-dessus des pages légales, en dessous des outils.
  push("/presskit/", "0.5", "monthly");
  for (const legal of ["/privacy/", "/cookies/", "/terms/", "/legal-notice/"])
    push(legal, "0.3", "yearly");

  // Fiches — vraie date par entité quand on l'a.
  for (const a of kb.airlines.values()) push(`/airlines/${slugFor(a.id)}/`, "0.7", "monthly");
  for (const c of kb.countries.values()) {
    const d = countryData[c.id]?.verified_date;
    push(`/countries/${slugFor(c.id)}/`, "0.7", "monthly", isISO(d) ? d : BUILD_DATE);
  }
  for (const a of kb.airports.values()) {
    const d = (a as any).pet_relief?.source?.verified_date;
    push(`/airports/${slugFor(a.id)}/`, "0.6", "monthly", isISO(d) ? d : BUILD_DATE);
  }
  for (const b of kb.breeds.values()) push(`/breeds/${slugFor(b.id)}/`, "0.7", "monthly");

  return entries;
}
