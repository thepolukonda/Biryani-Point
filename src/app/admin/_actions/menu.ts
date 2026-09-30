'use server';

import { refresh, updateTag } from 'next/cache';
import { z } from 'zod';
import { requireOwner, requireStaff } from '@/lib/admin/auth';
import { zonedParts, zonedTimeToUtc } from '@/lib/domain/hours';
import { parseGel } from '@/lib/domain/money';
import { getRestaurant } from '@/lib/data/restaurant';
import { reportError } from '@/lib/monitoring';
import { serverEnv } from '@/lib/env.server';
import { syncSheet } from '@/lib/sheet/sync';
import { serviceClient } from '@/lib/supabase/clients';
import type { Json } from '@/lib/supabase/database.types';
import { sessionClient } from '@/lib/supabase/session';

export type FormState = { ok?: boolean; message?: string; error?: string };

const slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and dashes.');

/** Customer pages show the change on their next request; the admin page re-renders now. */
function refreshMenu() {
  updateTag('menu');
  refresh();
}

async function menuSource() {
  const db = await sessionClient();
  const { data } = await db.from('restaurant_settings').select('menu_source').eq('id', 1).single();
  return data?.menu_source ?? 'sheet';
}

/** 05:00 tomorrow, local time: the end of "today" for a restaurant that may close after midnight. */
function endOfBusinessDay(timeZone: string, now = new Date()) {
  const p = zonedParts(now, timeZone);
  const base = new Date(Date.UTC(p.year, p.month - 1, p.day + (p.hour < 5 ? 0 : 1)));
  return zonedTimeToUtc(
    { year: base.getUTCFullYear(), month: base.getUTCMonth() + 1, day: base.getUTCDate() },
    5 * 60,
    timeZone,
  );
}

export async function setSoldOut(
  itemId: string,
  mode: 'today' | 'indefinite' | 'off',
): Promise<FormState> {
  await requireStaff();
  if (!z.uuid().safeParse(itemId).success) return { error: 'Invalid dish.' };
  const until =
    mode === 'off'
      ? null
      : mode === 'today'
        ? endOfBusinessDay((await getRestaurant()).timezone)
        : new Date('2099-12-31T00:00:00Z');
  const db = await sessionClient();
  const { error } = await db.rpc('set_item_sold_out', {
    p_item_id: itemId,
    p_until: until ? until.toISOString() : (null as unknown as string),
  });
  if (error) return { error: 'Could not update the dish.' };
  refreshMenu();
  return { ok: true };
}

export async function setItemPhoto(itemId: string, path: string): Promise<FormState> {
  await requireOwner();
  const parsed = z
    .object({ itemId: z.uuid(), path: z.string().regex(/^items\/[A-Za-z0-9._-]+$/) })
    .safeParse({ itemId, path });
  if (!parsed.success) return { error: 'Invalid photo.' };
  const db = await sessionClient();
  const old = await db.from('menu_items').select('photo_path').eq('id', itemId).single();
  const { error } = await db.from('menu_items').update({ photo_path: path }).eq('id', itemId);
  if (error) return { error: 'Could not save the photo.' };
  if (old.data?.photo_path && old.data.photo_path !== path) {
    await db.storage.from('menu-images').remove([old.data.photo_path]);
  }
  refreshMenu();
  return { ok: true, message: 'Photo updated.' };
}

const text = z.string().trim().max(400);
const itemSchema = z.object({
  id: z.uuid().optional(),
  slug,
  category_id: z.uuid(),
  name_en: z.string().trim().min(1, 'English name is required.').max(120),
  name_ka: text.optional(),
  name_ru: text.optional(),
  desc_en: text.optional(),
  desc_ka: text.optional(),
  desc_ru: text.optional(),
  price: z
    .string()
    .refine((v) => parseGel(v) !== null, 'Price must be an amount like 20 or 22.50.'),
  spice_level: z.enum(['', '0', '1', '2', '3']),
  allergens: z.string().max(300),
  is_veg: z.boolean(),
  is_popular: z.boolean(),
  is_available: z.boolean(),
  is_visible: z.boolean(),
  group_ids: z.array(z.uuid()),
});

const i18n = (en: string, ka?: string, ru?: string) => ({
  ...(en ? { en } : {}),
  ...(ka ? { ka } : {}),
  ...(ru ? { ru } : {}),
});

export async function saveItem(_prev: FormState, form: FormData): Promise<FormState> {
  await requireOwner();
  if ((await menuSource()) === 'sheet')
    return {
      error:
        'The menu comes from the Google Sheet. Edit it there, or switch the menu source in Settings.',
    };
  const parsed = itemSchema.safeParse({
    id: form.get('id') || undefined,
    slug: form.get('slug'),
    category_id: form.get('category_id'),
    name_en: form.get('name_en'),
    name_ka: form.get('name_ka') || undefined,
    name_ru: form.get('name_ru') || undefined,
    desc_en: form.get('desc_en') || undefined,
    desc_ka: form.get('desc_ka') || undefined,
    desc_ru: form.get('desc_ru') || undefined,
    price: form.get('price'),
    spice_level: form.get('spice_level') ?? '',
    allergens: form.get('allergens') ?? '',
    is_veg: form.get('is_veg') === 'on',
    is_popular: form.get('is_popular') === 'on',
    is_available: form.get('is_available') === 'on',
    is_visible: form.get('is_visible') === 'on',
    group_ids: form.getAll('group_ids'),
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  const v = parsed.data;

  const db = await sessionClient();
  const row = {
    slug: v.slug,
    category_id: v.category_id,
    name: i18n(v.name_en, v.name_ka, v.name_ru) as NonNullable<Json>,
    description: i18n(v.desc_en ?? '', v.desc_ka, v.desc_ru) as NonNullable<Json>,
    price_tetri: parseGel(v.price)!,
    spice_level: v.spice_level === '' ? null : Number(v.spice_level),
    allergens: v.allergens
      .split(',')
      .map((a) => a.trim().toLowerCase())
      .filter(Boolean),
    is_veg: v.is_veg,
    is_popular: v.is_popular,
    is_available: v.is_available,
    is_visible: v.is_visible,
  };

  let id = v.id;
  if (id) {
    const { error } = await db.from('menu_items').update(row).eq('id', id);
    if (error)
      return {
        error: error.code === '23505' ? 'Another dish already uses that id.' : error.message,
      };
  } else {
    const last = await db
      .from('menu_items')
      .select('sort_order')
      .order('sort_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    const { data, error } = await db
      .from('menu_items')
      .insert({ ...row, sort_order: (last.data?.sort_order ?? 0) + 1 })
      .select('id')
      .single();
    if (error)
      return {
        error: error.code === '23505' ? 'Another dish already uses that id.' : error.message,
      };
    id = data.id;
  }

  await db.from('item_modifier_groups').delete().eq('item_id', id);
  if (v.group_ids.length) {
    await db
      .from('item_modifier_groups')
      .insert(v.group_ids.map((group_id, i) => ({ item_id: id!, group_id, sort_order: i })));
  }
  refreshMenu();
  return { ok: true, message: v.id ? 'Dish saved.' : 'Dish added.' };
}

/** Move a dish (within its category) or a category up/down one place. */
export async function move(
  kind: 'menu_items' | 'categories',
  id: string,
  direction: -1 | 1,
): Promise<FormState> {
  await requireOwner();
  if ((await menuSource()) === 'sheet')
    return { error: 'The order comes from the Google Sheet row order.' };
  const db = await sessionClient();

  let list: { id: string; sort_order: number }[];
  if (kind === 'menu_items') {
    const current = await db.from('menu_items').select('category_id').eq('id', id).single();
    if (current.error) return { error: 'Not found.' };
    const { data } = await db
      .from('menu_items')
      .select('id, sort_order')
      .eq('category_id', current.data.category_id)
      .order('sort_order')
      .order('id');
    list = data ?? [];
  } else {
    const { data } = await db
      .from('categories')
      .select('id, sort_order')
      .order('sort_order')
      .order('id');
    list = data ?? [];
  }

  const index = list.findIndex((s) => s.id === id);
  if (index < 0 || !list[index + direction]) return { ok: true };
  // Swap and renumber, so equal sort orders can't get stuck.
  const reordered = [...list];
  [reordered[index], reordered[index + direction]] = [
    reordered[index + direction]!,
    reordered[index]!,
  ];
  await Promise.all(
    reordered.map((row, i) => db.from(kind).update({ sort_order: i }).eq('id', row.id)),
  );
  refreshMenu();
  return { ok: true };
}

const categorySchema = z.object({
  id: z.uuid().optional(),
  slug,
  name_en: z.string().trim().min(1, 'English name is required.').max(80),
  name_ka: text.optional(),
  name_ru: text.optional(),
  blurb_en: text.optional(),
  blurb_ka: text.optional(),
  blurb_ru: text.optional(),
  is_visible: z.boolean(),
});

export async function saveCategory(_prev: FormState, form: FormData): Promise<FormState> {
  await requireOwner();
  if ((await menuSource()) === 'sheet') return { error: 'Categories come from the Google Sheet.' };
  const parsed = categorySchema.safeParse({
    id: form.get('id') || undefined,
    slug: form.get('slug'),
    name_en: form.get('name_en'),
    name_ka: form.get('name_ka') || undefined,
    name_ru: form.get('name_ru') || undefined,
    blurb_en: form.get('blurb_en') || undefined,
    blurb_ka: form.get('blurb_ka') || undefined,
    blurb_ru: form.get('blurb_ru') || undefined,
    is_visible: form.get('is_visible') === 'on',
  });
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? 'Please check the form.' };
  const v = parsed.data;
  const db = await sessionClient();
  const row = {
    slug: v.slug,
    name: i18n(v.name_en, v.name_ka, v.name_ru) as NonNullable<Json>,
    blurb: i18n(v.blurb_en ?? '', v.blurb_ka, v.blurb_ru) as NonNullable<Json>,
    is_visible: v.is_visible,
  };
  const { error } = v.id
    ? await db.from('categories').update(row).eq('id', v.id)
    : await db.from('categories').insert({ ...row, sort_order: 999 });
  if (error)
    return {
      error: error.code === '23505' ? 'Another category already uses that id.' : error.message,
    };
  refreshMenu();
  return { ok: true, message: 'Category saved.' };
}

const optionRow = z.object({
  slug,
  name_en: z.string().trim().min(1).max(80),
  name_ka: text.optional(),
  name_ru: text.optional(),
  price: z.string(),
  is_default: z.boolean(),
  is_available: z.boolean(),
});
const groupSchema = z.object({
  id: z.uuid().optional(),
  slug,
  name_en: z.string().trim().min(1, 'English name is required.').max(80),
  name_ka: text.optional(),
  name_ru: text.optional(),
  min_select: z.number().int().min(0).max(20),
  max_select: z.number().int().min(1).max(20),
  options: z.array(optionRow).min(1, 'Add at least one option.'),
});

/** Option group with its options (sent as JSON from the group editor). */
export async function saveGroup(raw: unknown): Promise<FormState> {
  await requireOwner();
  if ((await menuSource()) === 'sheet') return { error: 'Options come from the Google Sheet.' };
  const parsed = groupSchema.safeParse(raw);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? 'Please check the options.' };
  const v = parsed.data;
  if (v.min_select > v.max_select) return { error: '"At least" cannot be more than "at most".' };
  const prices = v.options.map((o) => {
    const clean = o.price.trim().replace(/^\+/, '');
    const negative = clean.startsWith('-');
    const t = parseGel(negative ? clean.slice(1) : clean || '0');
    return t === null ? null : negative ? -t : t;
  });
  if (prices.some((p) => p === null))
    return { error: 'Option prices must be amounts like 2 or +2.50.' };

  const db = await sessionClient();
  const groupRow = {
    slug: v.slug,
    name: i18n(v.name_en, v.name_ka, v.name_ru) as NonNullable<Json>,
    min_select: v.min_select,
    max_select: v.max_select,
  };
  const saved = v.id
    ? await db.from('modifier_groups').update(groupRow).eq('id', v.id).select('id').single()
    : await db.from('modifier_groups').insert(groupRow).select('id').single();
  if (saved.error)
    return {
      error:
        saved.error.code === '23505' ? 'Another group already uses that id.' : saved.error.message,
    };
  const groupId = saved.data.id;

  await db
    .from('modifier_options')
    .delete()
    .eq('group_id', groupId)
    .not('slug', 'in', `(${v.options.map((o) => `"${o.slug}"`).join(',')})`);
  const { error } = await db.from('modifier_options').upsert(
    v.options.map((o, i) => ({
      group_id: groupId,
      slug: o.slug,
      name: i18n(o.name_en, o.name_ka, o.name_ru) as NonNullable<Json>,
      price_delta_tetri: prices[i]!,
      is_default: o.is_default,
      is_available: o.is_available,
      sort_order: i,
    })),
    { onConflict: 'group_id,slug' },
  );
  if (error) return { error: error.message };
  refreshMenu();
  return { ok: true, message: 'Options saved.' };
}

export async function deleteGroup(groupId: string): Promise<FormState> {
  await requireOwner();
  if ((await menuSource()) === 'sheet') return { error: 'Options come from the Google Sheet.' };
  const db = await sessionClient();
  const { error } = await db.from('modifier_groups').delete().eq('id', groupId);
  if (error) return { error: error.message };
  refreshMenu();
  return { ok: true };
}

/** "Sync now" from the admin panel. */
export async function syncSheetNow(): Promise<
  FormState & { problems?: { tab: string; row?: number; severity: string; message: string }[] }
> {
  await requireOwner();
  const db = serviceClient();
  const env = serverEnv();
  const { data: s } = await db.from('integration_settings').select('*').eq('id', 1).single();
  try {
    const result = await syncSheet({
      db,
      trigger: 'manual',
      force: true,
      urls: {
        menu: s?.sheet_menu_csv_url || env.SHEET_MENU_CSV_URL,
        categories: s?.sheet_categories_csv_url || env.SHEET_CATEGORIES_CSV_URL,
        options: s?.sheet_options_csv_url || env.SHEET_OPTIONS_CSV_URL,
        hours: s?.sheet_hours_csv_url || env.SHEET_HOURS_CSV_URL,
        settings: s?.sheet_settings_csv_url || env.SHEET_SETTINGS_CSV_URL,
      },
      onChanged: () => {
        updateTag('menu');
        updateTag('restaurant');
        refresh();
      },
    });
    if (result.status === 'not_configured')
      return { error: 'Add the Menu tab link in Settings → Google Sheet first.' };
    if (result.status === 'error')
      return {
        error: 'The sheet could not be imported. See the problems below.',
        problems: result.problems,
      };
    return {
      ok: true,
      message:
        result.status === 'unchanged' ? 'Nothing changed.' : 'Menu updated from the Google Sheet.',
      problems: result.problems,
    };
  } catch (e) {
    reportError(e, { where: 'syncSheetNow' });
    return { error: 'The import failed. Try again in a minute.' };
  }
}
