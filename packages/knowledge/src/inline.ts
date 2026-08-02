import ptInline from "../translations/pt/inline.json";

/* Deuxième mécanisme de traduction du site, à côté de `t(locale, clé)`.
 *
 * Les gabarits écrivent leurs phrases en dur, les trois langues côte à côte :
 *   T("Why trust us", "Pourquoi nous faire confiance", "Por qué confiar")
 * C'est lisible et ça évite d'aller chercher une clé dans un autre fichier, mais toute
 * langue non prévue par la signature retombe sur l'anglais — et il y a 598 sites d'appel.
 *
 * Plutôt que de les réécrire tous, on garde la version anglaise comme clé et on superpose
 * une table pour les langues suivantes. Une chaîne absente de la table retombe sur
 * l'anglais : la page reste juste, elle n'est simplement pas encore traduite.
 */
const INLINE: Record<string, Record<string, string>> = { pt: ptInline as Record<string, string> };

export function inlineT(locale: string) {
  const table = INLINE[locale];
  return (en: string, fr: string, es?: string): string =>
    locale === "fr" ? fr : locale === "es" ? (es ?? en) : table ? table[en] || en : en;
}

/** Variante à trous, pour les phrases qui incorporent une donnée (`{0}`, `{1}`, …). */
export function inlineF(locale: string) {
  const base = inlineT(locale);
  return (en: string, fr: string, es: string, ...args: (string | number)[]): string =>
    base(en, fr, es).replace(/\{(\d+)\}/g, (m, i) => String(args[Number(i)] ?? m));
}

/** Nombre de chaînes couvertes pour une langue — utilisé par les scripts d'audit. */
export const inlineCoverage = (locale: string): number => Object.keys(INLINE[locale] ?? {}).length;

/* Troisième cas : le texte porté par les DONNÉES. Les fiches pays, compagnies et races
 * transportent leurs libellés sous la forme `{ en, fr, es, … }`. Chaque gabarit relisait
 * cet objet avec son propre ternaire — sept copies de la même ligne, et autant d'endroits
 * qui ignoraient toute langue non énumérée. Ici la langue est une clé, pas une branche :
 * ajouter une langue devient un travail de données, plus un travail de code.
 *
 * Le repli est l'anglais, jamais une chaîne vide : une fiche partiellement traduite reste
 * lisible et exacte, elle est simplement en deux langues.
 */
export type Localized = { en: string; [lang: string]: string | undefined };

export function localized(locale: string, v: Localized | undefined | null): string {
  if (!v) return "";
  return v[locale] ?? v.en ?? "";
}

/** Version liée à une langue, pour éviter de répéter `locale` à chaque appel dans un gabarit. */
export const localizer = (locale: string) => (v: Localized | undefined | null) => localized(locale, v);

/* Les dates de vérification étaient affichées telles qu'elles sont stockées : « 2026-07-11 ».
 * C'est le bon format pour Schema.org et pour un fichier de données, ce n'est celui d'aucun
 * lecteur. La date visible se met donc à la langue de la page ; le balisage JSON-LD, lui,
 * garde l'ISO — les deux ont des destinataires différents.
 *
 * Table de mois explicite plutôt qu'`Intl` : le rendu est statique, il doit être identique
 * d'une machine de build à l'autre, quelle que soit l'ICU installée.
 */
const MONTHS: Record<string, string[]> = {
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
  fr: ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"],
  es: ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"],
  pt: ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"],
};

/** « 2026-07-11 » → « 11 July 2026 » / « 11 juillet 2026 » / « 11 de julho de 2026 ». */
export function formatDate(locale: string, iso: string | undefined | null): string {
  if (!iso) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso).trim());
  if (!m) return String(iso); // format inattendu : on n'invente pas, on rend tel quel
  const [, y, mo, d] = m;
  const months = MONTHS[locale] ?? MONTHS.en;
  const month = months[Number(mo) - 1];
  if (!month) return String(iso);
  const day = String(Number(d));
  return locale === "es" || locale === "pt" ? `${day} de ${month} de ${y}` : `${day} ${month} ${y}`;
}

export const dateFormatter = (locale: string) => (iso: string | undefined | null) => formatDate(locale, iso);
