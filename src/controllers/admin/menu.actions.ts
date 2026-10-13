'use server';

import { refresh, updateTag } from 'next/cache';
import { z } from 'zod';
import { parseGel } from '@/shared/domain/money';
import { reportError } from '@/shared/monitoring';
import * as menuAdmin from '@/model-helpers/menu-admin';
import { importNow } from '@/model-helpers/sheet/import';
import type { Json } from '@/models/db/core';
import type { FormState } from './form-state';
import { requireOwner, requireStaff } from './guard';

export type { FormState };

const slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and dashes.');

/** Customer pages show the change on their next request; the admin page re-renders now. */
function refreshMenu() {
  updateTag('menu');
  refresh();
}

type EditOutcome =
  { ok: true } | { ok: false; reason: 'from_sheet' | 'duplicate_slug' | 'not_found' };

/** Turns a helper's outcome into the form's message. */
function result(
  outcome: EditOutcome,
  messages: { ok?: string; from_sheet: string; duplicate_slug?: string },
): FormState {
  if (!outcome.ok) {
    if (outcome.reason === 'not_found') return { error: 'Not found.' };
    return { error: messages[outcome.reason] ?? 'Another entry already uses that id.' };
  }
  refreshMenu();
  return { ok: true, message: messages.ok };
}

function unexpected(where: string, e: unknown): FormState {
  reportError(e, { where });
  return { error: 'Could not save. Please try again.' };
}

const SHEET_MENU =
  'The menu comes from the Google Sheet. Edit it there, or switch the menu source in Settings.';

export async function setSoldOut(
  itemId: string,
  mode: 'today' | 'indefinite' | 'off',
): Promise<FormState> {
  await requireStaff();
  if (!z.uuid().safeParse(itemId).success) return { error: 'Invalid dish.' };
  if (!z.enum(['today', 'indefinite', 'off']).safeParse(mode).success)
    return { error: 'Invalid dish.' };
  try {
    await menuAdmin.setSoldOut(itemId, mode);
  } catch (e) {
    reportError(e, { where: 'setSoldOut', itemId });
    return { error: 'Could not update the dish.' };
  }
  refreshMenu();
  return { ok: true };
}

export async function setItemPhoto(itemId: string, path: string): Promise<FormState> {
  await requireOwner();
  const parsed = z
    .object({ itemId: z.uuid(), path: z.string().regex(/^items\/[A-Za-z0-9._-]+$/) })
    .safeParse({ itemId, path });
  if (!parsed.success) return { error: 'Invalid photo.' };
  try {
    await menuAdmin.setItemPhoto(itemId, path);
  } catch (e) {
    reportError(e, { where: 'setItemPhoto', itemId });
    return { error: 'Could not save the photo.' };
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

const i18n = (en: string, ka?: string, ru?: string) =>
  ({
    ...(en ? { en } : {}),
    ...(ka ? { ka } : {}),
    ...(ru ? { ru } : {}),
  }) as NonNullable<Json>;

export async function saveItem(_prev: FormState, form: FormData): Promise<FormState> {
  await requireOwner();
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

  try {
    const outcome = await menuAdmin.saveItem({
      id: v.id,
      slug: v.slug,
      category_id: v.category_id,
      name: i18n(v.name_en, v.name_ka, v.name_ru),
      description: i18n(v.desc_en ?? '', v.desc_ka, v.desc_ru),
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
      groupIds: v.group_ids,
    });
    return result(outcome, {
      ok: v.id ? 'Dish saved.' : 'Dish added.',
      from_sheet: SHEET_MENU,
      duplicate_slug: 'Another dish already uses that id.',
    });
  } catch (e) {
    return unexpected('saveItem', e);
  }
}

/** Move a dish (within its category) or a category up/down one place. */
export async function move(
  kind: 'menu_items' | 'categories',
  id: string,
  direction: -1 | 1,
): Promise<FormState> {
  await requireOwner();
  const parsed = z
    .object({
      kind: z.enum(['menu_items', 'categories']),
      id: z.uuid(),
      direction: z.union([z.literal(-1), z.literal(1)]),
    })
    .safeParse({ kind, id, direction });
  if (!parsed.success) return { error: 'Not found.' };
  try {
    const outcome = await menuAdmin.move(kind, id, direction);
    return result(outcome, { from_sheet: 'The order comes from the Google Sheet row order.' });
  } catch (e) {
    return unexpected('move', e);
  }
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
  try {
    const outcome = await menuAdmin.saveCategory({
      id: v.id,
      slug: v.slug,
      name: i18n(v.name_en, v.name_ka, v.name_ru),
      blurb: i18n(v.blurb_en ?? '', v.blurb_ka, v.blurb_ru),
      is_visible: v.is_visible,
    });
    return result(outcome, {
      ok: 'Category saved.',
      from_sheet: 'Categories come from the Google Sheet.',
      duplicate_slug: 'Another category already uses that id.',
    });
  } catch (e) {
    return unexpected('saveCategory', e);
  }
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

/** "+2.50", "-1" or "" -> tetri, or null when it is not an amount. */
function priceDelta(input: string): number | null {
  const clean = input.trim().replace(/^\+/, '');
  const negative = clean.startsWith('-');
  const t = parseGel(negative ? clean.slice(1) : clean || '0');
  return t === null ? null : negative ? -t : t;
}

/** Option group with its options (sent as JSON from the group editor). */
export async function saveGroup(raw: unknown): Promise<FormState> {
  await requireOwner();
  const parsed = groupSchema.safeParse(raw);
  if (!parsed.success)
    return { error: parsed.error.issues[0]?.message ?? 'Please check the options.' };
  const v = parsed.data;
  if (v.min_select > v.max_select) return { error: '"At least" cannot be more than "at most".' };
  const prices = v.options.map((o) => priceDelta(o.price));
  if (prices.some((p) => p === null))
    return { error: 'Option prices must be amounts like 2 or +2.50.' };

  try {
    const outcome = await menuAdmin.saveGroup({
      id: v.id,
      group: {
        slug: v.slug,
        name: i18n(v.name_en, v.name_ka, v.name_ru),
        min_select: v.min_select,
        max_select: v.max_select,
      },
      options: v.options.map((o, i) => ({
        slug: o.slug,
        name: i18n(o.name_en, o.name_ka, o.name_ru),
        price_delta_tetri: prices[i]!,
        is_default: o.is_default,
        is_available: o.is_available,
        sort_order: i,
      })),
    });
    return result(outcome, {
      ok: 'Options saved.',
      from_sheet: 'Options come from the Google Sheet.',
      duplicate_slug: 'Another group already uses that id.',
    });
  } catch (e) {
    return unexpected('saveGroup', e);
  }
}

export async function deleteGroup(groupId: string): Promise<FormState> {
  await requireOwner();
  if (!z.uuid().safeParse(groupId).success) return { error: 'Not found.' };
  try {
    const outcome = await menuAdmin.deleteGroup(groupId);
    return result(outcome, { from_sheet: 'Options come from the Google Sheet.' });
  } catch (e) {
    return unexpected('deleteGroup', e);
  }
}

/** "Sync now" from the admin panel. */
export async function syncSheetNow(): Promise<
  FormState & { problems?: { tab: string; row?: number; severity: string; message: string }[] }
> {
  await requireOwner();
  try {
    const result = await importNow(() => {
      updateTag('menu');
      updateTag('restaurant');
      refresh();
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
