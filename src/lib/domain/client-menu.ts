/**
 * The menu as sent to the browser: only the visitor's language (plus English dish
 * names, so search still finds "biryani" on the Georgian page). Keeps every page's
 * payload small; the full three-language menu stays on the server.
 */
import { pickText, type I18nText, type Locale } from './i18n-text';
import type { Menu } from './menu';

const only = (text: I18nText, locale: Locale): I18nText =>
  locale === 'en' ? { en: text.en } : { en: text.en, [locale]: pickText(text, locale) };

const localOnly = (text: I18nText, locale: Locale): I18nText => {
  const value = pickText(text, locale);
  return locale === 'en' ? { en: value } : { en: value, [locale]: value };
};

export function menuForLocale(menu: Menu, locale: Locale): Menu {
  return {
    categories: menu.categories.map((c) => ({
      ...c,
      name: localOnly(c.name, locale),
      blurb: c.blurb ? localOnly(c.blurb, locale) : null,
    })),
    items: menu.items.map((item) => ({
      ...item,
      name: only(item.name, locale),
      description: item.description ? localOnly(item.description, locale) : null,
      modifierGroups: item.modifierGroups.map((g) => ({
        ...g,
        name: localOnly(g.name, locale),
        options: g.options.map((o) => ({ ...o, name: localOnly(o.name, locale) })),
      })),
    })),
  };
}
