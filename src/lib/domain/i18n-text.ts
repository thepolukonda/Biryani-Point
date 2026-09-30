export const LOCALES = ['en', 'ka', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

/** Translatable database text. English is always present; others fall back to it. */
export type I18nText = { en: string; ka?: string; ru?: string };

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

export function pickText(text: I18nText | null | undefined, locale: Locale): string {
  if (!text) return '';
  return text[locale]?.trim() || text.en;
}
