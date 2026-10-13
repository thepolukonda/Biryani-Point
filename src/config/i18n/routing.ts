import { defineRouting } from 'next-intl/routing';
import { DEFAULT_LOCALE, LOCALES } from '@/shared/domain/i18n-text';

export const routing = defineRouting({
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  // Every page lives under /en, /ka or /ru, so each language has its own URL for search engines.
  localePrefix: 'always',
  // First visit: pick the language from the browser (like the prototype), then remember the choice.
  localeDetection: true,
});
