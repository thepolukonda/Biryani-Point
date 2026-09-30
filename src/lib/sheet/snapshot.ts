/**
 * The normalised menu snapshot passed to the database function
 * public.apply_menu_snapshot (supabase/migrations/*_menu_sync.sql).
 * Keys are snake_case to match the SQL side.
 */
import { z } from 'zod';

const slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'must be lowercase letters, digits and dashes');
const i18n = z.object({
  en: z.string().trim().min(1),
  ka: z.string().trim().min(1).optional(),
  ru: z.string().trim().min(1).optional(),
});
const optionalI18n = z.object({
  en: z.string().trim().min(1).optional(),
  ka: z.string().trim().min(1).optional(),
  ru: z.string().trim().min(1).optional(),
});
const tetri = z.number().int().min(0).max(10_000_000);

export const snapshotCategory = z.object({
  slug,
  name: i18n,
  blurb: optionalI18n,
  sort_order: z.number().int(),
  is_visible: z.boolean(),
});

export const snapshotOption = z.object({
  slug,
  name: i18n,
  price_delta_tetri: z.number().int().min(-10_000_000).max(10_000_000),
  is_default: z.boolean(),
  is_available: z.boolean(),
  sort_order: z.number().int(),
});

export const snapshotGroup = z
  .object({
    slug,
    name: i18n,
    min_select: z.number().int().min(0).max(20),
    max_select: z.number().int().min(1).max(20),
    sort_order: z.number().int(),
    options: z.array(snapshotOption).min(1),
  })
  .refine((g) => g.min_select <= g.max_select, 'min_select must not exceed max_select');

export const snapshotItem = z.object({
  slug,
  category_slug: slug,
  name: i18n,
  description: optionalI18n,
  price_tetri: tetri,
  photo_path: z
    .string()
    .regex(/^items\/[A-Za-z0-9._-]+$/)
    .nullable(),
  is_veg: z.boolean(),
  spice_level: z.number().int().min(0).max(3).nullable(),
  allergens: z.array(z.string().trim().min(1).max(40)),
  is_popular: z.boolean(),
  is_available: z.boolean(),
  is_visible: z.boolean(),
  sort_order: z.number().int(),
  group_slugs: z.array(slug),
});

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const snapshotSettings = z
  .object({
    delivery_fee_tetri: tetri,
    free_delivery_over_tetri: tetri,
    min_delivery_order_tetri: tetri,
    prep_minutes_pickup: z.number().int().min(5).max(240),
    prep_minutes_delivery: z.number().int().min(5).max(240),
    orders_paused: z.boolean(),
    delivery_enabled: z.boolean(),
    pickup_enabled: z.boolean(),
    signature_item_slugs: z.array(slug),
    google_review_url: z.string().url().or(z.literal('')),
  })
  .partial();

export const menuSnapshot = z.object({
  categories: z.array(snapshotCategory),
  groups: z.array(snapshotGroup).nullable(),
  items: z.array(snapshotItem),
  keep_item_slugs: z.array(slug),
  hours: z
    .array(z.object({ weekday: z.number().int().min(1).max(7), opens_at: time, closes_at: time }))
    .nullable(),
  closures: z.array(z.object({ starts_on: date, ends_on: date, note: optionalI18n })).nullable(),
  settings: snapshotSettings.nullable(),
  prune: z.boolean(),
});

export type MenuSnapshot = z.infer<typeof menuSnapshot>;
export type SnapshotItem = z.infer<typeof snapshotItem>;
export type SnapshotCategory = z.infer<typeof snapshotCategory>;
export type SnapshotGroup = z.infer<typeof snapshotGroup>;
export type SnapshotSettings = z.infer<typeof snapshotSettings>;
