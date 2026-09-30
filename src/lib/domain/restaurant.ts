/** Everything customer pages and the order server need to know about the restaurant. */
import type { Schedule } from './hours';
import { pickText, type I18nText, type Locale } from './i18n-text';
import type { FeeSettings } from './pricing';
import type { DeliveryZone } from './zones';

/** Name, address and texts, edited in Admin → Settings → Business profile. */
export type BusinessProfile = {
  /** Short name, e.g. "Biryani Point". */
  brandName: string;
  /** Full name for titles, e.g. "Biryani Point Batumi". */
  siteName: I18nText;
  /** 1–3 letters in the round logo, e.g. "BP". */
  monogram: string;
  /** Order numbers are shown as `<prefix>-1042`. */
  orderPrefix: string;
  tagline: I18nText | null;
  specialties: I18nText | null;
  cuisines: string[];
  street: I18nText | null;
  city: I18nText | null;
  postalCode: string;
  /** ISO 3166 code, e.g. "GE". */
  countryCode: string;
  email: string | null;
  social: { instagram: string | null; facebook: string | null; tiktok: string | null };
  headline: I18nText | null;
  intro: I18nText | null;
  aboutTitle: I18nText | null;
  aboutText: I18nText | null;
  highlights: Partial<Record<Locale, string[]>>;
  features: { title: I18nText; text: I18nText | null }[];
  seoTitle: I18nText | null;
  seoDescription: I18nText | null;
  menuDescription: I18nText | null;
};

export type RestaurantInfo = {
  profile: BusinessProfile;
  timezone: string;
  phone: string;
  whatsapp: string;
  location: { lat: number; lng: number };
  schedule: Schedule;
  fees: FeeSettings;
  zones: DeliveryZone[];
  prepMinutes: { pickup: number; delivery: number };
  slotIntervalMinutes: number;
  scheduleDaysAhead: number;
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  ordersPaused: boolean;
  pauseMessage: I18nText | null;
  signatureItemSlugs: string[];
  googleReviewUrl: string | null;
  owner: { name: string | null; note: I18nText | null };
};

/** The profile's texts in one language (empty strings for anything not filled in). */
export function profileText(profile: BusinessProfile, locale: Locale) {
  const text = (v: I18nText | null) => pickText(v, locale);
  const country = countryName(profile.countryCode, locale);
  const city = text(profile.city);
  const street = text(profile.street);
  const cityLine = [[city, profile.postalCode].filter(Boolean).join(' '), country]
    .filter(Boolean)
    .join(', ');
  return {
    brandName: profile.brandName,
    siteName: text(profile.siteName),
    tagline: text(profile.tagline),
    specialties: text(profile.specialties) || text(profile.tagline),
    street,
    city,
    /** "Batumi 6010, Georgia" */
    cityLine,
    /** "7 Sherif Khimshiashvili St, Batumi 6010, Georgia" */
    address: [street, cityLine].filter(Boolean).join(', '),
    country,
    headline: text(profile.headline),
    intro: text(profile.intro),
    aboutTitle: text(profile.aboutTitle),
    aboutParagraphs: text(profile.aboutText)
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean),
    highlights: (profile.highlights[locale]?.length
      ? profile.highlights[locale]
      : (profile.highlights.en ?? [])
    ).filter(Boolean),
    features: profile.features.map((f) => ({ title: text(f.title), text: text(f.text) })),
    seoTitle:
      text(profile.seoTitle) ||
      [text(profile.siteName), text(profile.tagline)].filter(Boolean).join(' | '),
    seoDescription: text(profile.seoDescription) || text(profile.intro),
    menuDescription:
      text(profile.menuDescription) || text(profile.seoDescription) || text(profile.intro),
  };
}

export type BrandText = ReturnType<typeof profileText>;

function countryName(code: string, locale: Locale): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(code) ?? code;
  } catch {
    return code;
  }
}

/** What the logo shows. The wordmark is always Latin, like on the sign. */
export function logoBrand(profile: BusinessProfile) {
  return { name: profile.brandName, monogram: profile.monogram, city: profile.city?.en ?? '' };
}
