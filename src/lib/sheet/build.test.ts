import { describe, expect, it } from 'vitest';
import { buildSnapshot, type SheetSources } from './build';
import { readDays, readTime } from './cells';
import { parseCsv } from './csv';
import { isAllowedSheetUrl } from './sync';

// Same header style as the original prototype sheet.
const MENU = `Name,Category,Price,Veg,Popular,Sold,Show,Photo,Description (EN),Description (KA),Description (RU),Options
Chicken Biryani,Biryani,20,no,yes,,,chicken-biryani.webp,"Fragrant rice, layered",ქართ,Рус,Spice level
Veg Dum Biryani,biryani,"18,50",yes,,,,,,,,
Chicken Noodles,Indo-Chinese,20,,,x,,,,,,`;

const CATEGORIES = `id,name,name (ka),name (ru),blurb,show
biryani,Biryani,ბირიანი,Бирьяни,Slow cooked,yes
chinese,Indo-Chinese,ინდო-ჩინური,Индо-китайская кухня,,yes`;

const OPTIONS = `group,option,price,required,max,default
Spice level,Mild,0,yes,1,
Spice level,Medium,0,,,yes
Spice level,Hot,+0.50,,,`;

const HOURS = `day,open,close,note
Mon-Thu,12:00,23:00,
Friday,12:00,01:00,
Sat,12,24:00,
Sunday,closed,,
2026-12-31 - 2027-01-02,closed,,New Year`;

const build = (overrides: Partial<SheetSources> = {}) =>
  buildSnapshot(
    { menu: MENU, categories: CATEGORIES, options: OPTIONS, hours: HOURS, ...overrides },
    [],
  );

describe('buildSnapshot', () => {
  it('imports the prototype-style sheet', () => {
    const result = build();
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const { snapshot, problems } = result;
    expect(problems.filter((p) => p.severity === 'error')).toEqual([]);

    expect(
      snapshot.items.map((i) => [i.slug, i.category_slug, i.price_tetri, i.is_available]),
    ).toEqual([
      ['chicken-biryani', 'biryani', 2000, true],
      ['veg-dum-biryani', 'biryani', 1850, true],
      ['chicken-noodles', 'chinese', 2000, false], // "x" in Sold = sold out
    ]);
    expect(snapshot.items[0]).toMatchObject({
      is_popular: true,
      photo_path: 'items/chicken-biryani.webp',
      description: { en: 'Fragrant rice, layered', ka: 'ქართ', ru: 'Рус' },
      group_slugs: ['spice-level'],
    });
    expect(snapshot.items[1]!.is_veg).toBe(true);

    expect(snapshot.groups).toEqual([
      expect.objectContaining({
        slug: 'spice-level',
        min_select: 1,
        max_select: 1,
        options: [
          expect.objectContaining({ slug: 'mild', price_delta_tetri: 0 }),
          expect.objectContaining({ slug: 'medium', is_default: true }),
          expect.objectContaining({ slug: 'hot', price_delta_tetri: 50 }),
        ],
      }),
    ]);

    expect(snapshot.hours).toEqual([
      { weekday: 1, opens_at: '12:00', closes_at: '23:00' },
      { weekday: 2, opens_at: '12:00', closes_at: '23:00' },
      { weekday: 3, opens_at: '12:00', closes_at: '23:00' },
      { weekday: 4, opens_at: '12:00', closes_at: '23:00' },
      { weekday: 5, opens_at: '12:00', closes_at: '01:00' },
      { weekday: 6, opens_at: '12:00', closes_at: '00:00' },
    ]);
    expect(snapshot.closures).toEqual([
      { starts_on: '2026-12-31', ends_on: '2027-01-02', note: { en: 'New Year' } },
    ]);
  });

  it('keeps the previous version of a dish whose row has a typo', () => {
    const menu = MENU.replace(
      'Veg Dum Biryani,biryani,"18,50"',
      'Veg Dum Biryani,biryani,eighteen',
    );
    const result = build({ menu });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.items.map((i) => i.slug)).not.toContain('veg-dum-biryani');
    expect(result.snapshot.keep_item_slugs).toEqual(['veg-dum-biryani']);
    expect(result.problems).toContainEqual(
      expect.objectContaining({
        tab: 'menu',
        row: 3,
        severity: 'error',
        message: expect.stringContaining('eighteen'),
      }),
    );
  });

  it('refuses a category that is not in the Categories tab', () => {
    const result = build({
      menu: MENU.replace('Chicken Noodles,Indo-Chinese', 'Chicken Noodles,Tandoor'),
    });
    expect(result.ok && result.snapshot.keep_item_slugs).toEqual(['chicken-noodles']);
  });

  it('creates categories from the Menu tab when there is no Categories tab', () => {
    const result = buildSnapshot({ menu: MENU }, [{ slug: 'biryani', name: { en: 'Biryani' } }]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshot.categories.map((c) => c.slug)).toEqual(['indo-chinese']);
    // No Options tab: groups are left alone rather than deleted.
    expect(result.snapshot.groups).toBeNull();
    expect(result.problems).toContainEqual(
      expect.objectContaining({ severity: 'warning', row: 2 }),
    );
  });

  it('leaves the hours untouched if any Hours row is wrong', () => {
    const result = build({ hours: HOURS.replace('Friday,12:00,01:00', 'Fryday,12:00,01:00') });
    expect(result.ok && result.snapshot.hours).toBeNull();
    expect(result.ok && result.snapshot.closures).toBeNull();
  });

  it('fails without name or price columns, and never imports an empty menu', () => {
    expect(build({ menu: 'Dish,Cost\nBiryani,20' }).ok).toBe(false);
    expect(build({ menu: 'Name,Price\n' }).ok).toBe(false);
  });

  it('reads settings, ignoring empty values and unknown names', () => {
    const settings = `setting,value
delivery fee,5
free delivery over,50.00
minimum order,
pause online orders,no
signature dishes,"Chicken Biryani, Veg Dum Biryani"
favourite colour,gold`;
    const result = build({ settings });
    expect(result.ok && result.snapshot.settings).toEqual({
      delivery_fee_tetri: 500,
      free_delivery_over_tetri: 5000,
      orders_paused: false,
      signature_item_slugs: ['chicken-biryani', 'veg-dum-biryani'],
    });
    expect(result.problems).toContainEqual(
      expect.objectContaining({ tab: 'settings', severity: 'warning' }),
    );
  });

  it('flags duplicate dishes', () => {
    const result = build({ menu: `${MENU}\nChicken Biryani,Biryani,25,,,,,,,,,` });
    expect(
      result.ok && result.snapshot.items.find((i) => i.slug === 'chicken-biryani')?.price_tetri,
    ).toBe(2000);
    expect(result.problems).toContainEqual(
      expect.objectContaining({ row: 5, message: expect.stringContaining('twice') }),
    );
  });
});

describe('cell readers', () => {
  it('reads day names and ranges in three languages', () => {
    expect(readDays('Mon-Fri')).toEqual([1, 2, 3, 4, 5]);
    expect(readDays('Sat, Sun')).toEqual([6, 7]);
    expect(readDays('Fri–Mon')).toEqual([1, 5, 6, 7]);
    expect(readDays('every day')).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(readDays('ორშაბათი')).toEqual([1]);
    expect(readDays('Воскресенье')).toEqual([7]);
    expect(readDays('Someday')).toBeNull();
  });

  it('reads times', () => {
    expect(readTime('12')).toBe('12:00');
    expect(readTime('9.30')).toBe('09:30');
    expect(readTime('24:00')).toBe('00:00');
    expect(readTime('25:00')).toBeNull();
  });

  it('parses quoted CSV with commas, quotes and newlines', () => {
    expect(parseCsv('a,"b, c","say ""hi""","two\nlines"\r\n1,2,3,4')).toEqual([
      ['a', 'b, c', 'say "hi"', 'two\nlines'],
      ['1', '2', '3', '4'],
    ]);
  });
});

describe('sheet links', () => {
  it('only accepts Google Sheets links over https', () => {
    expect(
      isAllowedSheetUrl(
        'https://docs.google.com/spreadsheets/d/e/2PACX-x/pub?gid=0&single=true&output=csv',
      ),
    ).toBe(true);
    expect(isAllowedSheetUrl('http://docs.google.com/spreadsheets/d/e/x/pub')).toBe(false);
    expect(isAllowedSheetUrl('https://example.com/menu.csv')).toBe(false);
    expect(isAllowedSheetUrl('https://169.254.169.254/latest')).toBe(false);
  });
});
