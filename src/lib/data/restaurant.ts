/**
 * Reading the menu and restaurant settings for customer pages.
 *
 * Raw rows are cached (tags 'menu' / 'restaurant'); the Sheet import and admin
 * edits revalidate those tags. Anything time-dependent (sold out "until",
 * open/closed) is worked out per request from the cached rows.
 */
import 'server-only';
import { unstable_cache } from 'next/cache';
import type { Closure, OpeningRange, Weekday } from '@/lib/domain/hours';
import type { I18nText, Locale } from '@/lib/domain/i18n-text';
import type { Menu, MenuItem, SpiceLevel } from '@/lib/domain/menu';
import { profileText, type BusinessProfile, type RestaurantInfo } from '@/lib/domain/restaurant';
import type { DeliveryZone } from '@/lib/domain/zones';
import { publicClient } from '@/lib/supabase/clients';
import type { Database } from '@/lib/supabase/database.types';

type Tables = Database['public']['Tables'];

export const CACHE_TAGS = { menu: 'menu', restaurant: 'restaurant' } as const;

function must<T>(result: { data: T | null; error: { message: string } | null }, what: string): T {
  if (result.error || result.data === null) {
    throw new Error(`Could not load ${what}: ${result.error?.message ?? 'no data'}`);
  }
  return result.data;
}

const i18n = (value: unknown): I18nText => value as I18nText;
const optionalI18n = (value: unknown): I18nText | null => {
  const v = value as Partial<I18nText> | null;
  return v && v.en ? (v as I18nText) : null;
};

type MenuRows = {
  categories: Tables['categories']['Row'][];
  items: Tables['menu_items']['Row'][];
  groups: Tables['modifier_groups']['Row'][];
  options: Tables['modifier_options']['Row'][];
  links: Tables['item_modifier_groups']['Row'][];
};

async function fetchMenuRows(): Promise<MenuRows> {
  const db = publicClient();
  const [categories, items, groups, options, links] = await Promise.all([
    db.from('categories').select('*').eq('is_visible', true).order('sort_order'),
    db.from('menu_items').select('*').eq('is_visible', true).order('sort_order'),
    db.from('modifier_groups').select('*').order('sort_order'),
    db.from('modifier_options').select('*').order('sort_order'),
    db.from('item_modifier_groups').select('*').order('sort_order'),
  ]);
  return {
    categories: must(categories, 'categories'),
    items: must(items, 'menu items'),
    groups: must(groups, 'modifier groups'),
    options: must(options, 'modifier options'),
    links: must(links, 'item modifier links'),
  };
}

const cachedMenuRows = unstable_cache(fetchMenuRows, ['menu-rows'], {
  tags: [CACHE_TAGS.menu],
  revalidate: 300,
});

export function menuFromRows(rows: MenuRows, now: Date): Menu {
  const categoryById = new Map(rows.categories.map((c) => [c.id, c]));
  const groups = new Map(
    rows.groups.map((g) => [
      g.id,
      {
        slug: g.slug,
        name: i18n(g.name),
        minSelect: g.min_select,
        maxSelect: g.max_select,
        options: rows.options
          .filter((o) => o.group_id === g.id)
          .map((o) => ({
            slug: o.slug,
            name: i18n(o.name),
            priceDeltaTetri: o.price_delta_tetri,
            isDefault: o.is_default,
            isAvailable: o.is_available,
          })),
      },
    ]),
  );

  const items: MenuItem[] = [];
  for (const row of rows.items) {
    const category = categoryById.get(row.category_id);
    if (!category) continue; // hidden category
    const soldOutByKitchen = row.sold_out_until !== null && new Date(row.sold_out_until) > now;
    items.push({
      slug: row.slug,
      categorySlug: category.slug,
      name: i18n(row.name),
      description: optionalI18n(row.description),
      priceTetri: row.price_tetri,
      photoPath: row.photo_path,
      isVeg: row.is_veg,
      spiceLevel: row.spice_level as SpiceLevel | null,
      allergens: row.allergens,
      isPopular: row.is_popular,
      isAvailable: row.is_available && !soldOutByKitchen,
      modifierGroups: rows.links
        .filter((l) => l.item_id === row.id)
        .map((l) => groups.get(l.group_id))
        .filter((g) => g !== undefined)
        .filter((g) => g.options.length > 0),
    });
  }

  return {
    categories: rows.categories
      .filter((c) => items.some((i) => i.categorySlug === c.slug))
      .map((c) => ({ slug: c.slug, name: i18n(c.name), blurb: optionalI18n(c.blurb) })),
    items,
  };
}

/** The visible menu with availability as of `now`. */
export async function getMenu(now = new Date()): Promise<Menu> {
  return menuFromRows(await cachedMenuRows(), now);
}

/** Fresh from the database, for pricing an order. Never cached. */
export async function getMenuUncached(now = new Date()): Promise<Menu> {
  return menuFromRows(await fetchMenuRows(), now);
}

type SettingsRow = Tables['restaurant_settings']['Row'];

const nullIfEmpty = (v: string | null) => (v?.trim() ? v.trim() : null);

export function profileFromRow(s: SettingsRow): BusinessProfile {
  const highlights = (s.highlights ?? {}) as Partial<Record<Locale, unknown>>;
  const features = Array.isArray(s.features)
    ? (s.features as { title?: unknown; text?: unknown }[])
    : [];
  return {
    brandName: s.brand_name,
    siteName: i18n(s.site_name),
    monogram: s.monogram,
    orderPrefix: s.order_prefix,
    tagline: optionalI18n(s.tagline),
    specialties: optionalI18n(s.specialties),
    cuisines: s.cuisines,
    street: optionalI18n(s.street),
    city: optionalI18n(s.city),
    postalCode: s.postal_code,
    countryCode: s.country_code,
    email: nullIfEmpty(s.email),
    social: {
      instagram: nullIfEmpty(s.instagram_url),
      facebook: nullIfEmpty(s.facebook_url),
      tiktok: nullIfEmpty(s.tiktok_url),
    },
    headline: optionalI18n(s.headline),
    intro: optionalI18n(s.intro),
    aboutTitle: optionalI18n(s.about_title),
    aboutText: optionalI18n(s.about_text),
    highlights: Object.fromEntries(
      Object.entries(highlights).map(([l, words]) => [
        l,
        Array.isArray(words) ? words.filter((w): w is string => typeof w === 'string') : [],
      ]),
    ),
    features: features.flatMap((f) => {
      const title = optionalI18n(f.title);
      return title ? [{ title, text: optionalI18n(f.text) }] : [];
    }),
    seoTitle: optionalI18n(s.seo_title),
    seoDescription: optionalI18n(s.seo_description),
    menuDescription: optionalI18n(s.menu_description),
  };
}

async function fetchRestaurant(): Promise<RestaurantInfo> {
  const db = publicClient();
  const [settingsResult, hoursResult, closuresResult, zonesResult] = await Promise.all([
    db.from('restaurant_settings').select('*').eq('id', 1).single(),
    db.from('opening_hours').select('*').order('weekday').order('opens_at'),
    db
      .from('closures')
      .select('*')
      .gte('ends_on', new Date(Date.now() - 2 * 86_400_000).toISOString().slice(0, 10)),
    db.from('delivery_zones').select('*').eq('is_active', true).order('sort_order'),
  ]);
  const s = must(settingsResult, 'restaurant settings');
  const hours: OpeningRange[] = must(hoursResult, 'opening hours').map((h) => ({
    weekday: h.weekday as Weekday,
    opens: h.opens_at.slice(0, 5),
    closes: h.closes_at.slice(0, 5),
  }));
  const closures: Closure[] = must(closuresResult, 'closures').map((c) => ({
    startsOn: c.starts_on,
    endsOn: c.ends_on,
  }));
  const zones: DeliveryZone[] = must(zonesResult, 'delivery zones').flatMap((z): DeliveryZone[] => {
    const base = {
      id: z.id,
      name: z.name,
      sortOrder: z.sort_order,
      feeTetri: z.fee_tetri,
      minOrderTetri: z.min_order_tetri,
    };
    if (z.kind === 'radius' && z.radius_km !== null)
      return [{ ...base, kind: 'radius', radiusKm: Number(z.radius_km) }];
    if (z.kind === 'polygon' && Array.isArray(z.polygon)) {
      return [{ ...base, kind: 'polygon', polygon: z.polygon as [number, number][] }];
    }
    return [];
  });

  return {
    profile: profileFromRow(s),
    timezone: s.timezone,
    phone: s.phone,
    whatsapp: s.whatsapp,
    location: { lat: s.latitude, lng: s.longitude },
    schedule: {
      timezone: s.timezone,
      hours,
      closures,
      lastOrderMinutesBeforeClose: s.last_order_minutes_before_close,
    },
    fees: {
      deliveryFeeTetri: s.delivery_fee_tetri,
      freeDeliveryOverTetri: s.free_delivery_over_tetri,
      minDeliveryOrderTetri: s.min_delivery_order_tetri,
    },
    zones,
    prepMinutes: { pickup: s.prep_minutes_pickup, delivery: s.prep_minutes_delivery },
    slotIntervalMinutes: s.slot_interval_minutes,
    scheduleDaysAhead: s.schedule_days_ahead,
    deliveryEnabled: s.delivery_enabled,
    pickupEnabled: s.pickup_enabled,
    ordersPaused: s.orders_paused,
    pauseMessage: optionalI18n(s.pause_message),
    signatureItemSlugs: s.signature_item_slugs,
    googleReviewUrl: s.google_review_url,
    owner: { name: s.owner_name, note: optionalI18n(s.owner_note) },
  };
}

const cachedRestaurant = unstable_cache(fetchRestaurant, ['restaurant'], {
  tags: [CACHE_TAGS.restaurant],
  revalidate: 300,
});

export function getRestaurant(): Promise<RestaurantInfo> {
  return cachedRestaurant();
}

export function getRestaurantUncached(): Promise<RestaurantInfo> {
  return fetchRestaurant();
}

export type { RestaurantInfo };

/** The business profile's texts in one language (name, address, SEO texts…). */
export async function getBrand(locale: Locale) {
  return profileText((await getRestaurant()).profile, locale);
}
