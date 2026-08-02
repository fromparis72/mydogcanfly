import { getCollection, type CollectionEntry } from "astro:content";

export type Guide = CollectionEntry<"guides">;

/* Les guides n'existent qu'en français et en anglais.
 *
 * C'est le premier contenu du site qui n'est pas disponible dans les quatre langues, et c'est
 * précisément le piège à ne pas répéter : le portugais a longtemps été annoncé en `hreflang`
 * et au sitemap alors que ses pages n'existaient pas. Ici, la disponibilité est constatée
 * fichier par fichier — `languesDe()` — et jamais supposée. Ajouter l'espagnol un jour
 * consistera à déposer des fichiers dans `content/guides/es/`, rien d'autre : aucune liste à
 * tenir à jour, aucun code à modifier.
 */
export const GUIDE_LOCALES = ["en", "fr"] as const;
export type GuideLocale = (typeof GUIDE_LOCALES)[number];

/** `fr/camping-avec-chien` → { locale: "fr", slug: "camping-avec-chien" } */
export function decompose(entry: Guide): { locale: string; slug: string } {
  const i = entry.id.indexOf("/");
  return { locale: entry.id.slice(0, i), slug: entry.id.slice(i + 1).replace(/\.mdx?$/, "") };
}

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
