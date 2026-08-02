// Routing lives in the UI (knowledge stays framework/URL-agnostic).
// Locale model: English is the default and lives at the root (no prefix); every other
// locale is served under its own prefix (/fr/…, /es/…, /pt/…). Add a locale here + a translations
// table and the whole routing layer (hreflang, sitemap, switcher) follows.
export const LOCALES = ["en", "fr", "es", "pt"] as const;

/** Langues encore incomplètes : les pages existent et se visitent, mais elles sont en
 *  noindex et absentes du sitemap et des hreflang, tant que le contenu des fiches n'est
 *  pas traduit. Sans ce garde-fou, Google indexerait une coquille remplie de texte anglais —
 *  pire pour le site que de ne rien publier du tout.
 *
 *  Le portugais en est sorti le 01/08/2026 : 140 fiches pays, 78 fiches compagnies,
 *  173 races, 251 aéroports, l'accueil, les outils et la presse sont traduits. Il reste
 *  0,09 % de texte anglais sur 22 176 segments, et ce sont des noms de textes réglementaires
 *  qui ne doivent PAS être traduits. La liste est vide, et c'est voulu : elle reste en place
 *  pour la prochaine langue. */
export const PREVIEW_LOCALES: readonly string[] = [];
export const isPreviewLocale = (l: string): boolean => PREVIEW_LOCALES.includes(l);
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const PREFIXED_LOCALES = LOCALES.filter((l) => l !== DEFAULT_LOCALE); // ["fr", "es", "pt"]

export const KIND_PLURAL: Record<string, string> = {
  airline: "airlines",
  country: "countries",
  airport: "airports",
  breed: "breeds",
};

/** Entity id → page URL, locale-prefixed. "airline_air_france" → "/airlines/air-france/" or "/fr/airlines/air-france/". */
export function hrefFor(id: string, locale = "en"): string {
  const kind = id.split("_")[0] ?? "";
  const slug = id.split("_").slice(1).join("-");
  const plural = KIND_PLURAL[kind] ?? kind;
  return localizeHref(`/${plural}/${slug}/`, locale);
}

/** Prefix a root-relative href with the locale segment (EN = no prefix, default). */
export function localizeHref(href: string, locale = "en"): string {
  if (locale === DEFAULT_LOCALE) return href;
  return href === "/" ? `/${locale}/` : `/${locale}${href}`;
}

/** Strip any non-default locale prefix from a pathname → the logical (EN) path. */
export function stripLocale(pathname: string): string {
  for (const l of PREFIXED_LOCALES) {
    if (pathname === `/${l}` || pathname === `/${l}/`) return "/";
    if (pathname.startsWith(`/${l}/`)) return pathname.slice(l.length + 1);
  }
  return pathname;
}

/** The same page in another locale (used for hreflang + language switcher). */
export function localizedPath(pathname: string, locale: string): string {
  const base = stripLocale(pathname);
  if (locale === DEFAULT_LOCALE) return base;
  return base === "/" ? `/${locale}/` : `/${locale}${base}`;
}
