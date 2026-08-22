import { getCollection, type CollectionEntry } from "astro:content";

export type Guide = CollectionEntry<"guides">;

/* Les quatre langues du site sont désormais ouvertes aux guides — mais OUVERTES n'est pas
 * PEUPLÉES, et toute la prudence tient dans cette distinction.
 *
 * Le portugais a longtemps été annoncé en `hreflang` et au sitemap alors que ses pages
 * n'existaient pas. Rien ici ne répète cette faute : `GUIDE_LOCALES` n'annonce rien, elle
 * autorise. Ce qui est ANNONCÉ vient de `languesDe()`, qui constate la disponibilité fichier
 * par fichier. Un guide traduit en espagnol mais pas en portugais aura donc trois alternates,
 * pas quatre, sans qu'aucune liste soit à tenir à jour.
 *
 * Conséquence directe : la traduction peut avancer guide par guide, et chaque état
 * intermédiaire est correct — jamais une adresse promise qui n'existe pas.
 */
export const GUIDE_LOCALES = ["en", "fr", "es", "pt"] as const;
export type GuideLocale = (typeof GUIDE_LOCALES)[number];

/** `fr/camping-avec-chien` → { locale: "fr", slug: "camping-avec-chien" } */
export function decompose(entry: Guide): { locale: string; slug: string } {
  const i = entry.id.indexOf("/");
  return { locale: entry.id.slice(0, i), slug: entry.id.slice(i + 1).replace(/\.mdx?$/, "") };
}

/**
 * L'étiquette BCP-47 de chaque langue publiée, pour `Intl`.
 *
 * Elle vivait en double, dans deux ternaires : le hub couvrait les quatre langues, la page de
 * guide s'arrêtait à « français, sinon en-GB ». Les dates des 144 pages espagnoles et portugaises
 * sortaient donc en anglais — « 17 August 2026 » au lieu de « 17 de agosto de 2026 ». Relevé par
 * la contre-revue du 20/08/2026. Une liste écrite deux fois finit toujours par diverger : elle
 * n'est plus écrite qu'ici. `pt-BR` suit `HTML_LANG` de Base.astro, qui déclare déjà le portugais
 * brésilien.
 */
export const ETIQUETTE_BCP47: Record<string, string> = { en: "en-GB", fr: "fr-FR", es: "es-ES", pt: "pt-BR" };

/** Le formateur de date d'une langue, `Intl` compris. `style` distingue le hub (court) de la page. */
export const formateurDeDate = (locale: string, mois: "long" | "short" = "long") =>
  new Intl.DateTimeFormat(ETIQUETTE_BCP47[locale] ?? ETIQUETTE_BCP47.en,
    { day: "numeric", month: mois, year: "numeric" });

/** L'URL publique d'un guide, dans sa langue. L'anglais vit à la racine, comme partout. */
export const guideHref = (locale: string, slug: string) =>
  locale === "en" ? `/travel-hub/${slug}/` : `/${locale}/travel-hub/${slug}/`;

/** Tous les guides d'une langue, du plus récent au plus ancien. */
export async function guidesDe(locale: string): Promise<Guide[]> {
  const tous = await getCollection("guides");
  return tous
    .filter((g) => decompose(g).locale === locale)
    .sort((a, b) => (a.data.date < b.data.date ? 1 : -1));
}

/** key → { locale → guide }. Le pivot de tout ce qui est multilingue ici. */
export async function parCle(): Promise<Map<string, Map<string, Guide>>> {
  const m = new Map<string, Map<string, Guide>>();
  for (const g of await getCollection("guides")) {
    const { locale } = decompose(g);
    if (!m.has(g.data.key)) m.set(g.data.key, new Map());
    m.get(g.data.key)!.set(locale, g);
  }
  return m;
}

/**
 * Les langues dans lesquelles CE guide existe vraiment, avec leur URL.
 * Sert à la fois aux `hreflang` et au sitemap : les deux doivent dire la même chose, et
 * cette chose doit être vérifiable sur le disque.
 */
export async function languesDe(key: string): Promise<{ locale: string; href: string }[]> {
  const versions = (await parCle()).get(key);
  if (!versions) return [];
  return [...versions.entries()]
    .map(([locale, g]) => ({ locale, href: guideHref(locale, decompose(g).slug) }))
    /* Ordre stable : l'anglais d'abord, puisque c'est lui qui porte le `x-default`. */
    .sort((a, b) => (a.locale === "en" ? -1 : b.locale === "en" ? 1 : a.locale.localeCompare(b.locale)));
}
