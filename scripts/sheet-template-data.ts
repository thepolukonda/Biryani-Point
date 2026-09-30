/**
 * The starting Google Sheet, built from the original prototype menu
 * (scripts/prototype-data.json). Used by the template generator and the seed.
 */
import fs from 'node:fs';
import path from 'node:path';

type Proto = {
  categories: { id: string; name: Record<string, string>; blurb: Record<string, string> }[];
  menu: {
    id: string;
    name: string;
    cat: string;
    price: number;
    veg: boolean;
    popular?: boolean;
    desc: Record<string, string>;
  }[];
  T: Record<string, Record<string, string>>;
};

export const proto: Proto = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'prototype-data.json'), 'utf8'),
);

/** Dish photos from the prototype, uploaded to Storage as items/<slug>.webp. */
export const SEED_IMAGE_DIR = path.join(__dirname, '..', 'supabase', 'seed', 'images');

export type Tab = {
  name: string;
  header: string[];
  rows: (string | number)[][];
  widths?: number[];
};

const t = (key: string) => proto.T[key] ?? { en: key };

export const SIGNATURE = [
  'chicken-biryani',
  'raju-gari-kodi-pulao',
  'arabic-kushka',
  'kerala-mandi',
  'ambur-biryani',
];

export function templateTabs(): Tab[] {
  const categories: Tab = {
    name: 'Categories',
    header: ['id', 'name', 'name (ka)', 'name (ru)', 'blurb', 'blurb (ka)', 'blurb (ru)', 'show'],
    rows: proto.categories.map((c) => [
      c.id,
      c.name.en ?? '',
      c.name.ka ?? '',
      c.name.ru ?? '',
      c.blurb.en ?? '',
      c.blurb.ka ?? '',
      c.blurb.ru ?? '',
      'yes',
    ]),
    widths: [12, 18, 18, 22, 40, 40, 40, 8],
  };

  const menu: Tab = {
    name: 'Menu',
    header: [
      'id',
      'name',
      'name (ka)',
      'name (ru)',
      'category',
      'price',
      'description (en)',
      'description (ka)',
      'description (ru)',
      'veg',
      'spice',
      'allergens',
      'popular',
      'sold out',
      'show',
      'photo',
      'options',
    ],
    rows: proto.menu.map((d) => [
      d.id,
      d.name,
      '',
      '',
      d.cat,
      d.price,
      d.desc.en ?? '',
      d.desc.ka ?? '',
      d.desc.ru ?? '',
      d.veg ? 'yes' : 'no',
      '',
      '',
      d.popular ? 'yes' : 'no',
      'no',
      'yes',
      `${d.id}.webp`,
      'Spice level',
    ]),
    widths: [26, 30, 22, 22, 12, 8, 50, 50, 50, 6, 8, 16, 9, 9, 6, 32, 16],
  };

  // The prototype asked for one spice level per order; here it becomes a per-dish choice.
  const spice = t('spice');
  const options: Tab = {
    name: 'Options',
    header: [
      'group',
      'group (ka)',
      'group (ru)',
      'option',
      'option (ka)',
      'option (ru)',
      'price',
      'required',
      'max',
      'default',
      'sold out',
    ],
    rows: (['mild', 'medium', 'spicy'] as const).map((key, i) => [
      spice.en ?? '',
      spice.ka ?? '',
      spice.ru ?? '',
      t(key).en ?? '',
      t(key).ka ?? '',
      t(key).ru ?? '',
      0,
      i === 0 ? 'yes' : '',
      i === 0 ? 1 : '',
      key === 'medium' ? 'yes' : 'no',
      'no',
    ]),
    widths: [16, 14, 14, 14, 14, 14, 8, 9, 6, 8, 9],
  };

  // Placeholder hours from the prototype (marked TODO there). Replace with the real ones.
  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  const hours: Tab = {
    name: 'Hours',
    header: ['day', 'open', 'close', 'note'],
    rows: days.map((d) => [d, '12:00', '23:00', '']),
    widths: [22, 10, 10, 40],
  };

  const settings: Tab = {
    name: 'Settings',
    header: ['setting', 'value', 'help'],
    rows: [
      ['delivery fee', 0, 'GEL added to delivery orders. 0 = free delivery.'],
      ['free delivery over', 0, 'Free delivery when the food costs at least this much. 0 = off.'],
      [
        'minimum order',
        0,
        'Smallest delivery order in GEL. 0 = no minimum. Pickup has no minimum.',
      ],
      ['prep time pickup', 30, 'Minutes until a pickup order is usually ready.'],
      ['prep time delivery', 45, 'Minutes until a delivery order usually arrives.'],
      ['pause online orders', 'no', 'yes = the menu stays visible but nobody can order.'],
      ['delivery', 'yes', 'Offer delivery (yes / no).'],
      ['pickup', 'yes', 'Offer pickup (yes / no).'],
      [
        'signature dishes',
        SIGNATURE.map((s) => proto.menu.find((m) => m.id === s)?.name ?? s).join(', '),
        'Dishes shown big on the home page.',
      ],
      ['google review link', '', 'Your "Write a review" link from Google Business Profile.'],
    ],
    widths: [22, 60, 70],
  };

  return [menu, categories, options, hours, settings];
}

export function toCsv(tab: Tab): string {
  const cell = (v: string | number) => {
    const s = String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [tab.header, ...tab.rows].map((r) => r.map(cell).join(',')).join('\r\n') + '\r\n';
}
