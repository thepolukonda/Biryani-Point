'use server';

import { refresh, updateTag } from 'next/cache';
import { z } from 'zod';
import { requireOwner } from '@/lib/admin/auth';
import { isValidTime } from '@/lib/domain/hours';
import { parseGel } from '@/lib/domain/money';
import { normaliseGeorgianPhone } from '@/lib/domain/phone';
import { sendTestNotification } from '@/lib/notify';
import { isAllowedSheetUrl } from '@/lib/sheet/sync';
import type { Database, Json } from '@/lib/supabase/database.types';
import { sessionClient } from '@/lib/supabase/session';

export type FormState = { ok?: boolean; message?: string; error?: string };
type SettingsUpdate = Database['public']['Tables']['restaurant_settings']['Update'];

function done(message = 'Saved.'): FormState {
  updateTag('restaurant');
  refresh();
  return { ok: true, message };
}

/** Fields the Google Sheet controls are not changed from the admin panel. */
async function withoutSheetFields(
  update: SettingsUpdate,
): Promise<{ update: SettingsUpdate; skipped: string[] }> {
  const db = await sessionClient();
  const { data } = await db
    .from('restaurant_settings')
    .select('menu_source, sheet_managed_fields')
    .eq('id', 1)
    .single();
  if (!data || data.menu_source !== 'sheet') return { update, skipped: [] };
  const skipped: string[] = [];
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(update)) {
    if (data.sheet_managed_fields.includes(key)) skipped.push(key);
    else out[key] = value;
  }
  return { update: out as SettingsUpdate, skipped };
}

async function saveSettings(update: SettingsUpdate): Promise<FormState> {
  const filtered = await withoutSheetFields(update);
  if (Object.keys(filtered.update).length === 0)
    return { error: 'These settings are controlled by the Google Sheet.' };
  const db = await sessionClient();
  const { error } = await db.from('restaurant_settings').update(filtered.update).eq('id', 1);
  if (error) return { error: error.message };
  return done(
    filtered.skipped.length
      ? 'Saved. Some fields are controlled by the Google Sheet and were left as they are.'
      : 'Saved.',
  );
}

const gel = (label: string) =>
  z
    .string()
    .trim()
    .refine((v) => parseGel(v || '0') !== null, `${label} must be an amount like 5 or 2.50.`);
const i18nInput = (form: FormData, base: string) => {
  const out: Record<string, string> = {};
  for (const l of ['en', 'ka', 'ru']) {
    const v = String(form.get(`${base}_${l}`) ?? '').trim();
    if (v) out[l] = v;
  }
  return out;
};

const LOCALE_KEYS = ['en', 'ka', 'ru'] as const;
const httpsOrEmpty = (label: string) =>
  z
    .string()
    .trim()
    .max(300)
    .refine((v) => !v || /^https:\/\/\S+$/.test(v), `${label} must start with https://`);

const profileSchema = z.object({
  brand_name: z.string().trim().min(1, 'Enter the restaurant name.').max(60),
  site_name_en: z.string().trim().min(1, 'Enter the full name in English.').max(80),
  monogram: z
    .string()
    .trim()
    .min(1, 'Enter 1–3 letters for the logo.')
    .max(3, 'The logo fits at most 3 letters.'),
  order_prefix: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{1,6}$/, 'Order number prefix: 1–6 letters or digits, e.g. BP.'),
  postal_code: z.string().trim().max(20),
  country_code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z]{2}$/, 'Country: a 2-letter code, e.g. GE.'),
  timezone: z
    .string()
    .trim()
    .refine((tz) => {
      try {
        new Intl.DateTimeFormat('en', { timeZone: tz });
        return true;
      } catch {
        return false;
      }
    }, 'Time zone must look like Asia/Tbilisi.'),
  email: z
    .string()
    .trim()
    .max(120)
    .refine((v) => !v || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v), 'Check the email address.'),
  instagram_url: httpsOrEmpty('The Instagram link'),
  facebook_url: httpsOrEmpty('The Facebook link'),
  tiktok_url: httpsOrEmpty('The TikTok link'),
  cuisines: z.string().max(300),
});

/** One word or phrase per line, per language: {"en": [...], "ka": [...]} */
const i18nLines = (form: FormData, base: string) => {
  const out: Record<string, string[]> = {};
  for (const l of LOCALE_KEYS) {
    const lines = String(form.get(`${base}_${l}`) ?? '')
      .split(/\r?\n/)
      .map((w) => w.trim())
      .filter(Boolean)
      .slice(0, 12);
    if (lines.length) out[l] = lines.map((w) => w.slice(0, 60));
  }
  return out;
};

export async function saveBusinessProfile(_prev: FormState, form: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = profileSchema.safeParse(Object.fromEntries(form));
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  const p = parsed.data;

  const cards = [0, 1, 2, 3].map((i) => ({
    title: i18nInput(form, `feature${i}_title`),
    text: i18nInput(form, `feature${i}_text`),
  }));
  if (cards.some((c) => !c.title.en && (c.title.ka || c.title.ru || c.text.en)))
    return { error: 'Each "why us" card needs an English title.' };
  const features = cards.filter((c) => c.title.en);

  if (!i18nInput(form, 'site_name').en) return { error: 'Enter the full name in English.' };

  const json = (v: unknown) => v as NonNullable<Json>;
  return saveSettings({
    brand_name: p.brand_name,
    site_name: json(i18nInput(form, 'site_name')),
    monogram: p.monogram,
    order_prefix: p.order_prefix,
    tagline: json(i18nInput(form, 'tagline')),
    specialties: json(i18nInput(form, 'specialties')),
    cuisines: p.cuisines
      .split(',')
      .map((c) => c.trim())
      .filter(Boolean)
      .slice(0, 10),
    street: json(i18nInput(form, 'street')),
    city: json(i18nInput(form, 'city')),
    postal_code: p.postal_code,
    country_code: p.country_code,
    timezone: p.timezone,
    email: p.email || null,
    instagram_url: p.instagram_url || null,
    facebook_url: p.facebook_url || null,
    tiktok_url: p.tiktok_url || null,
    headline: json(i18nInput(form, 'headline')),
    intro: json(i18nInput(form, 'intro')),
    about_title: json(i18nInput(form, 'about_title')),
    about_text: json(i18nInput(form, 'about_text')),
    highlights: json(i18nLines(form, 'highlights')),
    features: json(features),
    seo_title: json(i18nInput(form, 'seo_title')),
    seo_description: json(i18nInput(form, 'seo_description')),
    menu_description: json(i18nInput(form, 'menu_description')),
  });
}

export async function saveOrdering(_prev: FormState, form: FormData): Promise<FormState> {
  await requireOwner();
  return saveSettings({
    orders_paused: form.get('orders_paused') === 'on',
    delivery_enabled: form.get('delivery_enabled') === 'on',
    pickup_enabled: form.get('pickup_enabled') === 'on',
    pause_message: i18nInput(form, 'pause_message') as NonNullable<Json>,
  });
}

/** One-tap pause from the settings header (and the kitchen). */
export async function setPaused(paused: boolean): Promise<FormState> {
  await requireOwner();
  return saveSettings({ orders_paused: paused });
}

export async function saveFees(_prev: FormState, form: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = z
    .object({
      fee: gel('Delivery fee'),
      free: gel('Free delivery amount'),
      min: gel('Minimum order'),
    })
    .safeParse({ fee: form.get('fee'), free: form.get('free'), min: form.get('min') });
  if (!parsed.success) return { error: parsed.error.issues[0]!.message };
  return saveSettings({
    delivery_fee_tetri: parseGel(parsed.data.fee || '0')!,
    free_delivery_over_tetri: parseGel(parsed.data.free || '0')!,
    min_delivery_order_tetri: parseGel(parsed.data.min || '0')!,
  });
}

export async function saveKitchen(_prev: FormState, form: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = z
    .object({
      prep_minutes_pickup: z.coerce.number().int().min(5).max(240),
      prep_minutes_delivery: z.coerce.number().int().min(5).max(240),
      slot_interval_minutes: z.coerce
        .number()
        .pipe(
          z.union([
            z.literal(5),
            z.literal(10),
            z.literal(15),
            z.literal(20),
            z.literal(30),
            z.literal(60),
          ]),
        ),
      schedule_days_ahead: z.coerce.number().int().min(0).max(14),
      last_order_minutes_before_close: z.coerce.number().int().min(0).max(120),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success)
    return { error: 'Please check the numbers (prep time 5–240 minutes, up to 14 days ahead).' };
  return saveSettings(parsed.data);
}

export async function saveRestaurant(_prev: FormState, form: FormData): Promise<FormState> {
  await requireOwner();
  const phone = normaliseGeorgianPhone(String(form.get('phone') ?? ''));
  const whatsapp = String(form.get('whatsapp') ?? '').replace(/\D/g, '');
  const lat = Number(form.get('latitude'));
  const lng = Number(form.get('longitude'));
  const review = String(form.get('google_review_url') ?? '').trim();
  if (!phone) return { error: 'Phone must be a Georgian number, e.g. +995 5XX XX XX XX.' };
  if (!/^\d{8,15}$/.test(whatsapp))
    return {
      error: 'WhatsApp must be the full number with country code, digits only, e.g. 9955XXXXXXXX.',
    };
  if (!(lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180))
    return { error: 'Check the map location numbers.' };
  if (review && !/^https:\/\/\S+$/.test(review))
    return { error: 'The review link must start with https://' };
  return saveSettings({
    phone,
    whatsapp,
    latitude: lat,
    longitude: lng,
    google_review_url: review || null,
    signature_item_slugs: form.getAll('signature').map(String).slice(0, 8),
    owner_name: String(form.get('owner_name') ?? '').trim() || null,
    owner_note: i18nInput(form, 'owner_note') as NonNullable<Json>,
  });
}

const rangeSchema = z.object({
  weekday: z.number().int().min(1).max(7),
  opens: z.string(),
  closes: z.string(),
});

export async function saveHours(ranges: z.input<typeof rangeSchema>[]): Promise<FormState> {
  await requireOwner();
  const parsed = z.array(rangeSchema).max(28).safeParse(ranges);
  if (!parsed.success) return { error: 'Invalid hours.' };
  for (const r of parsed.data) {
    if (!isValidTime(r.opens) || !isValidTime(r.closes))
      return { error: 'Times must look like 12:00.' };
    if (r.opens === r.closes) return { error: 'Opening and closing time cannot be the same.' };
  }
  const db = await sessionClient();
  const settings = await db.from('restaurant_settings').select('menu_source').eq('id', 1).single();
  const fromSheet = await db.from('opening_hours').select('id').eq('source', 'sheet').limit(1);
  if (settings.data?.menu_source === 'sheet' && (fromSheet.data?.length ?? 0) > 0) {
    return { error: 'Opening hours come from the Google Sheet "Hours" tab. Change them there.' };
  }
  const del = await db.from('opening_hours').delete().gte('weekday', 1);
  if (del.error) return { error: del.error.message };
  if (parsed.data.length) {
    const { error } = await db.from('opening_hours').insert(
      parsed.data.map((r) => ({
        weekday: r.weekday,
        opens_at: r.opens,
        closes_at: r.closes,
        source: 'admin',
      })),
    );
    if (error) return { error: error.message };
  }
  return done('Opening hours saved.');
}

export async function addClosure(_prev: FormState, form: FormData): Promise<FormState> {
  await requireOwner();
  const parsed = z
    .object({ starts_on: z.iso.date(), ends_on: z.iso.date(), note: z.string().trim().max(120) })
    .safeParse({
      starts_on: form.get('starts_on'),
      ends_on: form.get('ends_on') || form.get('starts_on'),
      note: form.get('note') ?? '',
    });
  if (!parsed.success) return { error: 'Choose the dates.' };
  if (parsed.data.ends_on < parsed.data.starts_on)
    return { error: 'The last day is before the first day.' };
  const db = await sessionClient();
  const { error } = await db.from('closures').insert({
    starts_on: parsed.data.starts_on,
    ends_on: parsed.data.ends_on,
    note: (parsed.data.note ? { en: parsed.data.note } : {}) as NonNullable<Json>,
    source: 'admin',
  });
  return error ? { error: error.message } : done('Closure added.');
}

export async function deleteClosure(id: string): Promise<FormState> {
  await requireOwner();
  const db = await sessionClient();
  const { error } = await db.from('closures').delete().eq('id', id).eq('source', 'admin');
  return error ? { error: error.message } : done('Closure removed.');
}

export async function saveZone(_prev: FormState, form: FormData): Promise<FormState> {
  await requireOwner();
  const kind = form.get('kind') === 'polygon' ? 'polygon' : 'radius';
  const name = String(form.get('name') ?? '').trim();
  if (!name) return { error: 'Give the zone a name.' };
  const fee = String(form.get('fee') ?? '').trim();
  const min = String(form.get('min') ?? '').trim();
  if (fee && parseGel(fee) === null)
    return { error: 'Fee must be an amount, or empty to use the default.' };
  if (min && parseGel(min) === null)
    return { error: 'Minimum must be an amount, or empty to use the default.' };

  let radius_km: number | null = null;
  let polygon: Json | null = null;
  if (kind === 'radius') {
    radius_km = Number(String(form.get('radius_km')).replace(',', '.'));
    if (!(radius_km > 0 && radius_km <= 100))
      return { error: 'Radius must be between 0.1 and 100 km.' };
  } else {
    try {
      const points = JSON.parse(String(form.get('polygon'))) as unknown;
      const valid = z
        .array(z.tuple([z.number().min(-90).max(90), z.number().min(-180).max(180)]))
        .min(3)
        .safeParse(points);
      if (!valid.success) throw new Error();
      polygon = valid.data as Json;
    } catch {
      return { error: 'Polygon must be a list of at least 3 [latitude, longitude] points.' };
    }
  }

  const row = {
    name,
    kind: kind as 'radius' | 'polygon',
    radius_km,
    polygon,
    fee_tetri: fee ? parseGel(fee) : null,
    min_order_tetri: min ? parseGel(min) : null,
    sort_order: Number(form.get('sort_order') ?? 0) || 0,
    is_active: form.get('is_active') === 'on',
  };
  const db = await sessionClient();
  const id = String(form.get('id') ?? '');
  const { error } = id
    ? await db.from('delivery_zones').update(row).eq('id', id)
    : await db.from('delivery_zones').insert(row);
  return error ? { error: error.message } : done('Delivery zone saved.');
}

export async function deleteZone(id: string): Promise<FormState> {
  await requireOwner();
  const db = await sessionClient();
  const { error } = await db.from('delivery_zones').delete().eq('id', id);
  return error ? { error: error.message } : done('Delivery zone removed.');
}

export async function saveIntegrations(_prev: FormState, form: FormData): Promise<FormState> {
  await requireOwner();
  const tabs = ['menu', 'categories', 'options', 'hours', 'settings'] as const;
  const urls: Database['public']['Tables']['integration_settings']['Update'] = {};
  for (const tab of tabs) {
    const value = String(form.get(`sheet_${tab}`) ?? '').trim();
    if (value && !isAllowedSheetUrl(value))
      return {
        error: `The ${tab} link must be a Google Sheets "Publish to web" link (https://docs.google.com/…).`,
      };
    urls[`sheet_${tab}_csv_url`] = value || null;
  }
  const source = form.get('menu_source') === 'admin' ? 'admin' : 'sheet';
  const db = await sessionClient();
  const [a, b] = await Promise.all([
    db.from('integration_settings').update(urls).eq('id', 1),
    db
      .from('restaurant_settings')
      .update({ menu_source: source, ...(source === 'admin' ? { sheet_managed_fields: [] } : {}) })
      .eq('id', 1),
  ]);
  if (a.error || b.error) return { error: (a.error ?? b.error)!.message };
  updateTag('menu');
  return done(
    source === 'sheet'
      ? 'Saved. Use "Sync now" on the Menu page to import straight away.'
      : 'Saved. The menu is now edited in the admin panel.',
  );
}

export async function testNotifications(): Promise<FormState> {
  await requireOwner();
  const result = await sendTestNotification();
  return { ok: true, message: `Telegram: ${result.telegram}. Email: ${result.email}.` };
}
