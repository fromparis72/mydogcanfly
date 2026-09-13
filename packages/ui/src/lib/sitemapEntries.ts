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
import { loadKB, slugFor, countryVerifiedDate } from "@mydogcanfly/knowledge";
import { reliefIndexable } from "./reliefEtat";
import { raceIndexable, faitsDeRace } from "./raceEtat";
import { preuveAuditee } from "./decisionCanal";
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

/* LA DATE LA PLUS RÉCENTE D'UN JEU DE SOURCES, ou rien (13/09/2026).
 *
 * POURQUOI. `lastmod` retombait sur la date de construction partout où une vraie date de
 * vérification n'était pas branchée : les 103 fiches compagnie et les 172 fiches de race
 * annonçaient donc « modifiée aujourd'hui » à CHAQUE build, y compris quand rien n'avait bougé.
 * Un `lastmod` toujours égal au jour courant n'est pas une information, c'est un bruit — et
 * Google finit par cesser de le lire, ce qui pénalise aussi les pages pays, dont la date, elle,
 * est juste.
 *
 * Les deux familles portent pourtant une date réelle, déjà affichée à l'écran : la vérification
 * des preuves de canal pour les compagnies, celle des faits du registre pour les races. On la
 * lit là où elle est, et on ne se rabat sur la date de construction que si elle n'existe pas. */
const plusRecente = (dates: unknown[]): string | null => {
  const valides = dates.filter(isISO).sort();
  return valides.length ? valides[valides.length - 1] : null;
};

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
  /* Les conditions de reprise. Rangée avec « à propos » plutôt qu'avec les pages légales : c'est
   * une page qu'on veut voir citée et atteinte, pas une obligation réglementaire. */
  push("/citing/", "0.5", "yearly");
  // Presse & partenariats : page d'entrée pour les journalistes et les partenaires, elle porte
  // les fichiers à télécharger. Priorité au-dessus des pages légales, en dessous des outils.
  push("/presskit/", "0.5", "monthly");
  for (const legal of ["/privacy/", "/cookies/", "/terms/", "/legal-notice/"])
    push(legal, "0.3", "yearly");

  // Fiches — vraie date par entité quand on l'a.
  for (const a of kb.airlines.values()) {
    /* La date affichée sur la fiche : la plus récente des vérifications de canal auditées. Une
     * compagnie dont aucun canal n'est audité n'en a pas — elle retombe sur la date de
     * construction, comme avant, et c'est alors exact : sa page n'a pas d'autre repère. */
    const policy = (a as any).premium?.policy;
    const d = plusRecente(
      (["cabin", "hold", "cargo"] as const).map((c) => preuveAuditee(policy?.[c])?.verified_date),
    );
    push(`/airlines/${slugFor(a.id)}/`, "0.7", "monthly", d ?? BUILD_DATE);
  }
  for (const c of kb.countries.values()) {
    // Même date que celle affichée sur la fiche : max(relecture éditoriale, contrôle des règles
    // d'entrée du pays). Une règle revérifiée change ce que la page dit — le `lastmod` doit le
    // dire aussi, sinon on annonce à Google une page inchangée alors que son contenu a bougé.
    const d = countryVerifiedDate(kb, c.id, countryData[c.id]?.verified_date);
    push(`/countries/${slugFor(c.id)}/`, "0.7", "monthly", isISO(d) ? d : BUILD_DATE);
  }
  /* Seules les fiches qui répondent à la question entrent au sitemap : proposer à Google une
   * URL qu'on lui interdit par ailleurs en `noindex` est contradictoire, et c'est ce qu'il
   * rapporte ensuite comme « exclue par une balise noindex ». La règle est partagée avec le
   * gabarit — voir `reliefEtat.ts`, un seul endroit pour éviter qu'ils divergent. */
  for (const a of kb.airports.values()) {
    if (!reliefIndexable(a)) continue;
    const d = (a as any).pet_relief?.source?.verified_date;
    push(`/airports/${slugFor(a.id)}/`, "0.6", "monthly", isISO(d) ? d : BUILD_DATE);
  }
  /* Même principe que les aéroports ci-dessus, et le même fichier unique de règle : n'entre au
   * sitemap que la fiche qui porte un fait établi propre à sa race. Le raisonnement, les mesures
   * qui l'ont motivé et la façon dont une race y revient sont en tête de `raceEtat.ts`. */
  for (const b of kb.breeds.values()) {
    if (!raceIndexable(kb, b)) continue;
    /* Même principe : la fiche est indexée PARCE QU'elle porte des faits datés, donc sa date de
     * modification est celle de ces faits. La lecture est la même que celle qui ouvre la porte
     * et que celle qui alimente `citation` dans le JSON-LD. */
    const d = plusRecente(faitsDeRace(kb, b).map((f: any) => f?.source?.verified_date));
    push(`/breeds/${slugFor(b.id)}/`, "0.7", "monthly", d ?? BUILD_DATE);
  }

  return entries;
}
