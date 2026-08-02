import en from "../translations/en/strings.json";
import fr from "../translations/fr/strings.json";
import es from "../translations/es/strings.json";
import pt from "../translations/pt/strings.json";

/** UI strings live in translations/ (ADR-0005). Entity data stays language-neutral. */
export const UI_LOCALES = ["en", "fr", "es", "pt"] as const;
export type UiLocale = (typeof UI_LOCALES)[number];

const TABLES: Record<string, Record<string, string>> = { en, fr, es, pt };

/** Translate a UI key; falls back to English, then to the provided fallback, then the key. */
export function t(locale: string, key: string, fallback?: string): string {
  return TABLES[locale]?.[key] ?? TABLES.en[key] ?? fallback ?? key;
}
