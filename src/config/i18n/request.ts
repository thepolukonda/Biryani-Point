import { hasLocale } from 'next-intl';
import { getRequestConfig } from 'next-intl/server';
import { loadRestaurant } from '@/controllers/site/shop';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  const messages = (await import(`../../../messages/${locale}.json`)).default;
  // Missing Georgian/Russian strings fall back to English instead of showing a key.
  const fallback = locale === 'en' ? messages : (await import('../../../messages/en.json')).default;

  return {
    locale,
    messages: deepMerge(fallback, messages),
    // Dates and times always in the restaurant's time zone (Admin → Settings).
    timeZone: (await loadRestaurant()).timezone,
  };
});

type Messages = { [key: string]: string | string[] | Messages };

function deepMerge(base: Messages, override: Messages): Messages {
  const out: Messages = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const current = out[key];
    out[key] =
      value &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      current &&
      typeof current === 'object' &&
      !Array.isArray(current)
        ? deepMerge(current, value)
        : value;
  }
  return out;
}
