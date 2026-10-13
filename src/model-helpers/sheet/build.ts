/**
 * Google Sheet tabs (as CSV text) -> a validated MenuSnapshot, plus a list of
 * problems written for the restaurant owner ("Menu row 7: price "abc" is not a number").
 *
 * Rules that keep a typo from breaking the live menu:
 *  - A menu row with an error is skipped, and that dish keeps its current version.
 *  - Only dishes that are completely missing from the sheet are hidden.
 *  - Hours are replaced only when every row of the Hours tab is valid.
 *  - Settings are changed only for the rows that are present and valid.
 */
import { parseGel } from '@/shared/domain/money';
import { readTable } from './csv';
import {
  readBool,
  readDateRange,
  readDays,
  readList,
  readSignedGel,
  readSpice,
  readTime,
  slugify,
} from './cells';
import {
  menuSnapshot,
  type MenuSnapshot,
  type SnapshotCategory,
  type SnapshotGroup,
  type SnapshotItem,
  type SnapshotSettings,
} from './snapshot';

export type SheetTab = 'menu' | 'categories' | 'options' | 'hours' | 'settings';

export type SheetProblem = {
  tab: SheetTab;
  row?: number;
  severity: 'error' | 'warning';
  message: string;
};

export type SheetSources = {
  menu: string;
  categories?: string | null;
  options?: string | null;
  hours?: string | null;
  settings?: string | null;
};

/** Categories already in the database, so the Menu tab can refer to them by any name. */
export type KnownCategory = { slug: string; name: { en: string; ka?: string; ru?: string } };

export type BuildResult =
  | { ok: true; snapshot: MenuSnapshot; problems: SheetProblem[] }
  | { ok: false; problems: SheetProblem[] };

const lang = (base: string) => ({
  en: { exact: [base, `${base} en`, `${base} english`] },
  ka: { exact: [`${base} ka`, `${base} ge`, `${base} georgian`, `${base} geo`] },
  ru: { exact: [`${base} ru`, `${base} russian`, `${base} rus`] },
});

const MENU_COLUMNS = {
  id: { exact: ['id', 'slug', 'code'] },
  name_en: { exact: ['name', 'name en', 'name english', 'dish', 'dish name', 'item'] },
  name_ka: lang('name').ka,
  name_ru: lang('name').ru,
  category: { prefix: ['category', 'section'] },
  price: { prefix: ['price'] },
  desc_en: { exact: ['description', 'description en', 'description english', 'desc'] },
  desc_ka: lang('description').ka,
  desc_ru: lang('description').ru,
  veg: { prefix: ['veg', 'vegetarian'] },
  popular: { prefix: ['popular'] },
  sold: { prefix: ['sold', 'sold out'] },
  show: { prefix: ['show', 'visible'] },
  photo: { prefix: ['photo', 'image', 'picture'] },
  spice: { prefix: ['spice', 'spicy'] },
  allergens: { prefix: ['allergens', 'allergen', 'allergy', 'allergies'] },
  options: { prefix: ['options', 'modifiers', 'extras', 'choices'] },
};

const CATEGORY_COLUMNS = {
  id: { exact: ['id', 'slug', 'code'] },
  name_en: { exact: ['name', 'name en', 'category', 'category en'] },
  name_ka: { exact: ['name ka', 'name ge', 'category ka', 'name georgian'] },
  name_ru: { exact: ['name ru', 'category ru', 'name russian'] },
  blurb_en: { exact: ['blurb', 'blurb en', 'description', 'description en', 'subtitle'] },
  blurb_ka: { exact: ['blurb ka', 'description ka', 'subtitle ka'] },
  blurb_ru: { exact: ['blurb ru', 'description ru', 'subtitle ru'] },
  show: { prefix: ['show', 'visible'] },
};

const OPTION_COLUMNS = {
  group_en: { exact: ['group', 'group en', 'option group', 'choice'] },
  group_ka: { exact: ['group ka', 'group ge', 'group georgian'] },
  group_ru: { exact: ['group ru', 'group russian'] },
  option_en: { exact: ['option', 'option en', 'name', 'value'] },
  option_ka: { exact: ['option ka', 'option ge', 'option georgian'] },
  option_ru: { exact: ['option ru', 'option russian'] },
  price: { prefix: ['price', 'extra', 'add'] },
  required: { prefix: ['required', 'must choose'] },
  min: { exact: ['min', 'minimum', 'choose at least'] },
  max: { exact: ['max', 'maximum', 'choose up to', 'up to'] },
  default: { prefix: ['default', 'preselected'] },
  sold: { prefix: ['sold', 'sold out'] },
};

const HOURS_COLUMNS = {
  day: { prefix: ['day', 'days', 'date'] },
  open: { prefix: ['open', 'opens', 'from'] },
  close: { prefix: ['close', 'closes', 'to', 'until'] },
  note: { prefix: ['note', 'reason', 'comment'] },
};

const SETTINGS_COLUMNS = {
  key: { exact: ['setting', 'settings', 'name', 'key'] },
  value: { exact: ['value', 'values'] },
};

const i18n = (en: string, ka: string, ru: string) => ({
  en,
  ...(ka ? { ka } : {}),
  ...(ru ? { ru } : {}),
});

const optionalI18n = (en: string, ka: string, ru: string) => ({
  ...(en ? { en } : {}),
  ...(ka ? { ka } : {}),
  ...(ru ? { ru } : {}),
});

/** Menu cells may name a category by slug or by its name in any language. */
function categoryMatcher(categories: KnownCategory[]) {
  return (value: string): string | null => {
    const v = value.trim().toLowerCase();
    const found = categories.find(
      (c) =>
        c.slug === v ||
        c.slug === slugify(value) ||
        [c.name.en, c.name.ka, c.name.ru].some((n) => n && n.trim().toLowerCase() === v),
    );
    return found?.slug ?? null;
  };
}

function buildCategories(csv: string, problems: SheetProblem[]): SnapshotCategory[] {
  const table = readTable(csv, CATEGORY_COLUMNS);
  if (!table.columns.has('name_en')) {
    problems.push({
      tab: 'categories',
      severity: 'error',
      message: 'Needs a "name" column. Categories were not updated.',
    });
    return [];
  }
  const out: SnapshotCategory[] = [];
  for (const row of table.rows) {
    const name = row.get('name_en');
    const slug = slugify(row.get('id') || name);
    if (!name || !slug) {
      problems.push({
        tab: 'categories',
        row: row.rowNumber,
        severity: 'error',
        message: 'Missing an English name. Row skipped.',
      });
      continue;
    }
    if (out.some((c) => c.slug === slug)) {
      problems.push({
        tab: 'categories',
        row: row.rowNumber,
        severity: 'error',
        message: `"${name}" appears twice. Row skipped.`,
      });
      continue;
    }
    out.push({
      slug,
      name: i18n(name, row.get('name_ka'), row.get('name_ru')),
      blurb: optionalI18n(row.get('blurb_en'), row.get('blurb_ka'), row.get('blurb_ru')),
      sort_order: out.length,
      is_visible: readBool(row.get('show')) ?? true,
    });
  }
  return out;
}

function buildGroups(csv: string, problems: SheetProblem[]): SnapshotGroup[] {
  const table = readTable(csv, OPTION_COLUMNS);
  if (!table.columns.has('group_en') || !table.columns.has('option_en')) {
    problems.push({
      tab: 'options',
      severity: 'error',
      message: 'Needs "group" and "option" columns. Options were not updated.',
    });
    return [];
  }
  const groups = new Map<string, SnapshotGroup & { explicitMin: boolean }>();
  for (const row of table.rows) {
    const groupName = row.get('group_en');
    const optionName = row.get('option_en');
    const groupSlug = slugify(groupName);
    const optionSlug = slugify(optionName);
    if (!groupSlug || !optionSlug) {
      problems.push({
        tab: 'options',
        row: row.rowNumber,
        severity: 'error',
        message: 'Needs both a group and an option name. Row skipped.',
      });
      continue;
    }
    const delta = readSignedGel(row.get('price'));
    if (delta === null) {
      problems.push({
        tab: 'options',
        row: row.rowNumber,
        severity: 'error',
        message: `Price "${row.get('price')}" is not an amount like 2 or +2.50. Row skipped.`,
      });
      continue;
    }

    let group = groups.get(groupSlug);
    if (!group) {
      group = {
        slug: groupSlug,
        name: i18n(groupName, row.get('group_ka'), row.get('group_ru')),
        min_select: 0,
        max_select: 1,
        sort_order: groups.size,
        options: [],
        explicitMin: false,
      };
      groups.set(groupSlug, group);
    }
    // Group settings may be written on any row of the group (usually the first).
    const required = readBool(row.get('required'));
    if (required !== null && !group.explicitMin) group.min_select = required ? 1 : 0;
    const min = row.get('min');
    if (min) {
      if (/^\d{1,2}$/.test(min)) {
        group.min_select = Number(min);
        group.explicitMin = true;
      } else
        problems.push({
          tab: 'options',
          row: row.rowNumber,
          severity: 'warning',
          message: `"min" should be a whole number, got "${min}". Ignored.`,
        });
    }
    const max = row.get('max');
    if (max) {
      if (/^\d{1,2}$/.test(max) && Number(max) >= 1) group.max_select = Number(max);
      else
        problems.push({
          tab: 'options',
          row: row.rowNumber,
          severity: 'warning',
          message: `"max" should be a whole number of 1 or more, got "${max}". Ignored.`,
        });
    }
    if (group.options.some((o) => o.slug === optionSlug)) {
      problems.push({
        tab: 'options',
        row: row.rowNumber,
        severity: 'error',
        message: `"${optionName}" appears twice in "${groupName}". Row skipped.`,
      });
      continue;
    }
    group.options.push({
      slug: optionSlug,
      name: i18n(optionName, row.get('option_ka'), row.get('option_ru')),
      price_delta_tetri: delta,
      is_default: readBool(row.get('default')) ?? false,
      is_available: !(readBool(row.get('sold')) ?? false),
      sort_order: group.options.length,
    });
  }

  const out: SnapshotGroup[] = [];
  for (const { explicitMin: _explicitMin, ...group } of groups.values()) {
    if (group.min_select > group.max_select) {
      problems.push({
        tab: 'options',
        severity: 'warning',
        message: `"${group.name.en}": at least ${group.min_select} but at most ${group.max_select} doesn't work. Using at most ${group.min_select}.`,
      });
      group.max_select = group.min_select;
    }
    if (group.max_select > group.options.length)
      group.max_select = Math.max(1, group.options.length);
    if (group.min_select > group.options.length) group.min_select = group.options.length;
    out.push(group);
  }
  return out;
}

function buildItems(
  csv: string,
  categories: KnownCategory[],
  newCategories: SnapshotCategory[] | null,
  groups: SnapshotGroup[] | null,
  problems: SheetProblem[],
): {
  items: SnapshotItem[];
  keep: string[];
  fatal: boolean;
  categoriesFromMenu: SnapshotCategory[];
} {
  const table = readTable(csv, MENU_COLUMNS);
  if (!table.columns.has('name_en') || !table.columns.has('price')) {
    problems.push({
      tab: 'menu',
      severity: 'error',
      message: 'The Menu tab needs at least a "name" and a "price" column. Nothing was imported.',
    });
    return { items: [], keep: [], fatal: true, categoriesFromMenu: [] };
  }

  const matchCategory = categoryMatcher(categories);
  const derived: SnapshotCategory[] = [];
  const items: SnapshotItem[] = [];
  const keep: string[] = [];
  const hasPhotoColumn = table.columns.has('photo');
  const groupBySlugOrName = (value: string) =>
    groups?.find(
      (g) =>
        g.slug === slugify(value) ||
        [g.name.en, g.name.ka, g.name.ru].some((n) => n?.toLowerCase() === value.toLowerCase()),
    );

  for (const row of table.rows) {
    const name = row.get('name_en');
    const slug = slugify(row.get('id') || name);
    const where = { tab: 'menu' as const, row: row.rowNumber };
    const errors: string[] = [];

    if (!name || !slug) {
      problems.push({
        ...where,
        severity: 'error',
        message: 'Missing an English name. Row skipped.',
      });
      continue;
    }
    if (items.some((i) => i.slug === slug) || keep.includes(slug)) {
      problems.push({
        ...where,
        severity: 'error',
        message: `"${name}" appears twice. Only the first row is used.`,
      });
      continue;
    }

    const price = parseGel(row.get('price'));
    if (price === null)
      errors.push(`price "${row.get('price')}" is not an amount like 20 or 22.50`);

    // Category: must exist in the Categories tab if there is one; otherwise it's created from the name.
    const cell = row.get('category') || 'Other';
    let categorySlug = matchCategory(cell);
    if (!categorySlug) {
      if (newCategories) {
        errors.push(`category "${cell}" is not in the Categories tab`);
      } else {
        categorySlug = slugify(cell) || 'other';
        if (
          !derived.some((c) => c.slug === categorySlug) &&
          !categories.some((c) => c.slug === categorySlug)
        ) {
          derived.push({
            slug: categorySlug,
            name: { en: cell },
            blurb: {},
            sort_order: 0,
            is_visible: true,
          });
        }
      }
    }

    const spice = readSpice(row.get('spice'));
    if (spice === 'invalid')
      errors.push(`spice "${row.get('spice')}" should be 0-3 or mild / medium / hot`);

    let photoPath: string | null = null;
    const photo = row.get('photo');
    if (photo) {
      const file = photo.split(/[\\/]/).pop()!;
      if (/^https?:/i.test(photo) || !/^[A-Za-z0-9._-]+$/.test(file)) {
        errors.push(
          `photo "${photo}" should be the file name of a photo uploaded in the admin panel, like chicken-biryani.webp`,
        );
      } else photoPath = `items/${/\.[a-z0-9]+$/i.test(file) ? file : `${file}.webp`}`;
    }

    const groupSlugs: string[] = [];
    if (!groups && row.get('options')) {
      problems.push({
        ...where,
        severity: 'warning',
        message: 'The "options" column needs an Options tab to be connected. Ignored.',
      });
    }
    for (const g of groups ? readList(row.get('options')) : []) {
      const group = groupBySlugOrName(g);
      if (!group) {
        problems.push({
          ...where,
          severity: 'warning',
          message: `Option group "${g}" is not in the Options tab. "${name}" is shown without it.`,
        });
      } else if (!groupSlugs.includes(group.slug)) groupSlugs.push(group.slug);
    }

    if (errors.length > 0 || price === null || !categorySlug || spice === 'invalid') {
      problems.push({
        ...where,
        severity: 'error',
        message: `"${name}": ${errors.join('; ')}. This dish keeps its previous version until the row is fixed.`,
      });
      keep.push(slug);
      continue;
    }

    const show = readBool(row.get('show'));
    items.push({
      slug,
      category_slug: categorySlug,
      name: i18n(name, row.get('name_ka'), row.get('name_ru')),
      description: optionalI18n(row.get('desc_en'), row.get('desc_ka'), row.get('desc_ru')),
      price_tetri: price,
      photo_path: hasPhotoColumn ? photoPath : null,
      is_veg: readBool(row.get('veg')) ?? false,
      spice_level: spice,
      allergens: readList(row.get('allergens')).map((a) => a.toLowerCase()),
      is_popular: readBool(row.get('popular')) ?? false,
      is_available: !(readBool(row.get('sold')) ?? false),
      is_visible: show ?? true,
      sort_order: items.length + keep.length,
      group_slugs: groupSlugs,
    });
  }

  if (items.length === 0 && keep.length === 0) {
    problems.push({
      tab: 'menu',
      severity: 'error',
      message: 'The Menu tab has no dishes. Nothing was imported.',
    });
    return { items, keep, fatal: true, categoriesFromMenu: derived };
  }
  return { items, keep, fatal: false, categoriesFromMenu: derived };
}

function buildHours(
  csv: string,
  problems: SheetProblem[],
): Pick<MenuSnapshot, 'hours' | 'closures'> {
  const table = readTable(csv, HOURS_COLUMNS);
  if (!table.columns.has('day') || !table.columns.has('open') || !table.columns.has('close')) {
    problems.push({
      tab: 'hours',
      severity: 'error',
      message: 'Needs "day", "open" and "close" columns. Hours were not updated.',
    });
    return { hours: null, closures: null };
  }
  const hours: NonNullable<MenuSnapshot['hours']> = [];
  const closures: NonNullable<MenuSnapshot['closures']> = [];
  let bad = false;

  for (const row of table.rows) {
    const where = { tab: 'hours' as const, row: row.rowNumber };
    const dayCell = row.get('day');
    const open = row.get('open');
    const close = row.get('close');
    const closedWords = /^(closed|close|off|—|-|დაკეტილია|დაკეტილი|закрыто|выходной)$/i;

    const dates = readDateRange(dayCell);
    if (dates) {
      if (open && !closedWords.test(open)) {
        problems.push({
          ...where,
          severity: 'warning',
          message: `${dayCell}: special opening times on a date are not supported yet, so this is treated as closed all day.`,
        });
      }
      const note = row.get('note');
      closures.push({ starts_on: dates.from, ends_on: dates.to, note: note ? { en: note } : {} });
      continue;
    }

    const days = readDays(dayCell);
    if (!days) {
      problems.push({
        ...where,
        severity: 'error',
        message: `"${dayCell}" is not a day (use Mon, Monday, Mon-Fri or a date like 2026-12-31).`,
      });
      bad = true;
      continue;
    }
    if (closedWords.test(open) || (!open && !close)) continue; // closed that day
    const opensAt = readTime(open);
    const closesAt = readTime(close);
    if (!opensAt || !closesAt || opensAt === closesAt) {
      problems.push({
        ...where,
        severity: 'error',
        message: `"${open}" – "${close}" are not valid times (use 12:00 and 23:00; after midnight is fine, e.g. 01:00).`,
      });
      bad = true;
      continue;
    }
    for (const weekday of days) hours.push({ weekday, opens_at: opensAt, closes_at: closesAt });
  }

  if (bad) {
    problems.push({
      tab: 'hours',
      severity: 'error',
      message:
        'Opening hours were not changed because of the problems above. The website keeps the previous hours.',
    });
    return { hours: null, closures: null };
  }
  if (hours.length === 0) {
    problems.push({
      tab: 'hours',
      severity: 'warning',
      message: 'No opening hours are listed, so the restaurant shows as closed every day.',
    });
  }
  return { hours, closures };
}

const SETTING_KEYS: {
  keys: RegExp;
  field: keyof SnapshotSettings;
  kind: 'gel' | 'minutes' | 'bool' | 'slugs' | 'url';
}[] = [
  { keys: /^delivery (fee|charge|price)/, field: 'delivery_fee_tetri', kind: 'gel' },
  { keys: /^free delivery/, field: 'free_delivery_over_tetri', kind: 'gel' },
  { keys: /^(min|minimum)( delivery)? order/, field: 'min_delivery_order_tetri', kind: 'gel' },
  {
    keys: /^(prep|preparation)( time)? pickup|^pickup (prep|time|minutes)/,
    field: 'prep_minutes_pickup',
    kind: 'minutes',
  },
  {
    keys: /^(prep|preparation)( time)? delivery|^delivery (prep|time|minutes)/,
    field: 'prep_minutes_delivery',
    kind: 'minutes',
  },
  {
    keys: /^(pause|paused|orders paused|pause online orders)/,
    field: 'orders_paused',
    kind: 'bool',
  },
  { keys: /^(delivery|delivery on|offer delivery)$/, field: 'delivery_enabled', kind: 'bool' },
  { keys: /^(pickup|pick up|pickup on|offer pickup)$/, field: 'pickup_enabled', kind: 'bool' },
  { keys: /^signature/, field: 'signature_item_slugs', kind: 'slugs' },
  { keys: /^(google )?review/, field: 'google_review_url', kind: 'url' },
];

function buildSettings(csv: string, problems: SheetProblem[]): SnapshotSettings | null {
  const table = readTable(csv, SETTINGS_COLUMNS);
  if (!table.columns.has('key') || !table.columns.has('value')) {
    problems.push({
      tab: 'settings',
      severity: 'error',
      message: 'Needs "setting" and "value" columns. Settings were not updated.',
    });
    return null;
  }
  const out: Record<string, unknown> = {};
  for (const row of table.rows) {
    const where = { tab: 'settings' as const, row: row.rowNumber };
    const key = row
      .get('key')
      .toLowerCase()
      .replace(/[()_:]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const value = row.get('value');
    const rule = SETTING_KEYS.find((r) => r.keys.test(key));
    if (!rule) {
      problems.push({
        ...where,
        severity: 'warning',
        message: `Unknown setting "${row.get('key')}". Ignored.`,
      });
      continue;
    }
    if (!value) continue; // empty = leave as set in the admin panel
    const fail = (hint: string) =>
      problems.push({
        ...where,
        severity: 'error',
        message: `"${row.get('key')}": ${hint}. Not changed.`,
      });
    switch (rule.kind) {
      case 'gel': {
        const t = parseGel(value);
        if (t === null) fail(`"${value}" is not an amount like 5 or 2.50`);
        else out[rule.field] = t;
        break;
      }
      case 'minutes': {
        const n = Number(value.replace(/\s*(min|mins|minutes|წთ|мин)\.?$/i, ''));
        if (!Number.isInteger(n) || n < 5 || n > 240)
          fail(`"${value}" should be minutes between 5 and 240`);
        else out[rule.field] = n;
        break;
      }
      case 'bool': {
        const b = readBool(value);
        if (b === null) fail(`"${value}" should be yes or no`);
        else out[rule.field] = b;
        break;
      }
      case 'slugs':
        out[rule.field] = readList(value).map(slugify).filter(Boolean);
        break;
      case 'url':
        if (!/^https:\/\/\S+$/.test(value))
          fail(`"${value}" should be a link starting with https://`);
        else out[rule.field] = value;
        break;
    }
  }
  return out as SnapshotSettings;
}

export function buildSnapshot(sources: SheetSources, known: KnownCategory[]): BuildResult {
  const problems: SheetProblem[] = [];

  const sheetCategories = sources.categories ? buildCategories(sources.categories, problems) : null;
  const usableSheetCategories =
    sheetCategories && sheetCategories.length > 0 ? sheetCategories : null;
  const groups = sources.options ? buildGroups(sources.options, problems) : null;

  const categoryPool: KnownCategory[] = usableSheetCategories ?? known;
  const menu = buildItems(sources.menu, categoryPool, usableSheetCategories, groups, problems);
  if (menu.fatal) return { ok: false, problems };

  // Without a Categories tab, existing categories are left as they are (names and order are
  // managed in the admin panel) and only brand-new ones from the Menu tab are created.
  const categories: SnapshotCategory[] =
    usableSheetCategories ??
    menu.categoriesFromMenu.map((c, i) => ({ ...c, sort_order: 1000 + i }));

  const hours = sources.hours
    ? buildHours(sources.hours, problems)
    : { hours: null, closures: null };
  const settings = sources.settings ? buildSettings(sources.settings, problems) : null;

  if (settings?.signature_item_slugs) {
    const slugs = new Set([...menu.items.map((i) => i.slug), ...menu.keep]);
    for (const s of settings.signature_item_slugs) {
      if (!slugs.has(s))
        problems.push({
          tab: 'settings',
          severity: 'warning',
          message: `Signature dish "${s}" is not on the menu.`,
        });
    }
  }

  const candidate: MenuSnapshot = {
    categories,
    // null = no Options tab: existing option groups and dish links are left alone.
    groups,
    items: menu.items,
    keep_item_slugs: menu.keep,
    ...hours,
    settings: settings && Object.keys(settings).length > 0 ? settings : null,
    prune: true,
  };

  const parsed = menuSnapshot.safeParse(candidate);
  if (!parsed.success) {
    for (const issue of parsed.error.issues.slice(0, 10)) {
      problems.push({
        tab: 'menu',
        severity: 'error',
        message: `Unexpected data at ${issue.path.join('.')}: ${issue.message}`,
      });
    }
    return { ok: false, problems };
  }
  return { ok: true, snapshot: parsed.data, problems };
}
