import { describe, expect, it } from 'vitest';
import type { MenuItem } from './menu';
import { cartLineKey, deliveryFeeFor, priceOrder, type FeeSettings } from './pricing';

const biryani: MenuItem = {
  slug: 'chicken-biryani',
  categorySlug: 'biryani',
  name: { en: 'Chicken Biryani' },
  description: null,
  priceTetri: 2000,
  photoPath: null,
  isVeg: false,
  spiceLevel: 2,
  allergens: [],
  isPopular: true,
  isAvailable: true,
  modifierGroups: [
    {
      slug: 'size',
      name: { en: 'Size' },
      minSelect: 1,
      maxSelect: 1,
      options: [
        {
          slug: 'regular',
          name: { en: 'Regular' },
          priceDeltaTetri: 0,
          isDefault: true,
          isAvailable: true,
        },
        {
          slug: 'family',
          name: { en: 'Family' },
          priceDeltaTetri: 2500,
          isDefault: false,
          isAvailable: true,
        },
      ],
    },
    {
      slug: 'add-ons',
      name: { en: 'Add-ons' },
      minSelect: 0,
      maxSelect: 2,
      options: [
        {
          slug: 'raita',
          name: { en: 'Extra raita' },
          priceDeltaTetri: 200,
          isDefault: false,
          isAvailable: true,
        },
        {
          slug: 'egg',
          name: { en: 'Boiled egg' },
          priceDeltaTetri: 150,
          isDefault: false,
          isAvailable: true,
        },
        {
          slug: 'salan',
          name: { en: 'Mirchi salan' },
          priceDeltaTetri: 300,
          isDefault: false,
          isAvailable: false,
        },
      ],
    },
  ],
};

const manchurian: MenuItem = {
  ...biryani,
  slug: 'chicken-manchurian',
  name: { en: 'Chicken Manchurian' },
  priceTetri: 1950,
  modifierGroups: [],
};

const menu = new Map([biryani, manchurian].map((i) => [i.slug, i]));
const noFees: FeeSettings = {
  deliveryFeeTetri: 0,
  freeDeliveryOverTetri: 0,
  minDeliveryOrderTetri: 0,
};
const regular = { group: 'size', option: 'regular' };

describe('priceOrder', () => {
  it('adds modifier deltas and multiplies by quantity, in integer tetri', () => {
    const result = priceOrder({
      lines: [
        {
          itemSlug: 'chicken-biryani',
          quantity: 2,
          options: [
            { group: 'size', option: 'family' },
            { group: 'add-ons', option: 'raita' },
          ],
        },
        { itemSlug: 'chicken-manchurian', quantity: 3, options: [] },
      ],
      menu,
      orderType: 'pickup',
      fees: noFees,
    });
    expect(result.problems).toEqual([]);
    expect(result.lines[0]).toMatchObject({ unitPriceTetri: 4700, lineTotalTetri: 9400 });
    expect(result.lines[1]).toMatchObject({ unitPriceTetri: 1950, lineTotalTetri: 5850 });
    expect(result.subtotalTetri).toBe(15250);
    expect(result.totalTetri).toBe(15250);
    expect(Number.isInteger(result.totalTetri)).toBe(true);
  });

  it('requires required groups and enforces max selections', () => {
    const missing = priceOrder({
      lines: [{ itemSlug: 'chicken-biryani', quantity: 1, options: [] }],
      menu,
      orderType: 'pickup',
      fees: noFees,
    });
    expect(missing.problems).toContainEqual(
      expect.objectContaining({ code: 'too_few_options', groupSlug: 'size' }),
    );

    const tooMany = priceOrder({
      lines: [
        {
          itemSlug: 'chicken-biryani',
          quantity: 1,
          options: [regular, { group: 'size', option: 'family' }],
        },
      ],
      menu,
      orderType: 'pickup',
      fees: noFees,
    });
    expect(tooMany.problems).toContainEqual(
      expect.objectContaining({ code: 'too_many_options', groupSlug: 'size' }),
    );
  });

  it('rejects unknown, duplicate and sold-out options', () => {
    const result = priceOrder({
      lines: [
        {
          itemSlug: 'chicken-biryani',
          quantity: 1,
          options: [
            regular,
            regular,
            { group: 'add-ons', option: 'salan' },
            { group: 'size', option: 'mega' },
          ],
        },
      ],
      menu,
      orderType: 'pickup',
      fees: noFees,
    });
    const codes = result.problems.map((p) => p.code);
    expect(codes).toEqual(
      expect.arrayContaining(['duplicate_option', 'option_unavailable', 'unknown_option']),
    );
  });

  it('flags unknown items, sold-out items and bad quantities', () => {
    const soldOut = new Map(menu).set('chicken-manchurian', { ...manchurian, isAvailable: false });
    const result = priceOrder({
      lines: [
        { itemSlug: 'mystery', quantity: 1, options: [] },
        { itemSlug: 'chicken-manchurian', quantity: 1, options: [] },
        { itemSlug: 'chicken-biryani', quantity: 0, options: [regular] },
        { itemSlug: 'chicken-biryani', quantity: 1.5, options: [regular] },
        { itemSlug: 'chicken-biryani', quantity: 51, options: [regular] },
      ],
      menu: soldOut,
      orderType: 'pickup',
      fees: noFees,
    });
    expect(result.problems.map((p) => [p.code, p.line])).toEqual([
      ['item_not_found', 0],
      ['item_unavailable', 1],
      ['invalid_quantity', 2],
      ['invalid_quantity', 3],
      ['invalid_quantity', 4],
    ]);
  });

  it('flags an empty cart', () => {
    const result = priceOrder({ lines: [], menu, orderType: 'pickup', fees: noFees });
    expect(result.problems).toEqual([{ code: 'empty_cart' }]);
  });

  it('applies the delivery minimum, but not for pickup', () => {
    const fees = { ...noFees, minDeliveryOrderTetri: 3000 };
    const line = [{ itemSlug: 'chicken-manchurian', quantity: 1, options: [] }];
    const delivery = priceOrder({ lines: line, menu, orderType: 'delivery', fees });
    expect(delivery.problems).toEqual([
      { code: 'below_minimum', minimumTetri: 3000, shortByTetri: 1050 },
    ]);
    expect(priceOrder({ lines: line, menu, orderType: 'pickup', fees }).problems).toEqual([]);
  });

  it('lets a delivery zone override fee and minimum', () => {
    const fees = { deliveryFeeTetri: 300, freeDeliveryOverTetri: 0, minDeliveryOrderTetri: 0 };
    const result = priceOrder({
      lines: [{ itemSlug: 'chicken-manchurian', quantity: 1, options: [] }],
      menu,
      orderType: 'delivery',
      fees,
      zone: { feeTetri: 500, minOrderTetri: 2500 },
    });
    expect(result.deliveryFeeTetri).toBe(500);
    expect(result.totalTetri).toBe(2450);
    expect(result.problems[0]).toMatchObject({ code: 'below_minimum', minimumTetri: 2500 });
  });
});

describe('deliveryFeeFor', () => {
  const fees = { deliveryFeeTetri: 500, freeDeliveryOverTetri: 5000, minDeliveryOrderTetri: 0 };
  it('charges the fee below the free-delivery threshold', () => {
    expect(deliveryFeeFor('delivery', 4999, fees)).toBe(500);
  });
  it('is free at or above the threshold', () => {
    expect(deliveryFeeFor('delivery', 5000, fees)).toBe(0);
  });
  it('is never charged for pickup', () => {
    expect(deliveryFeeFor('pickup', 100, fees)).toBe(0);
  });
  it('is free when the fee is 0 (launch settings)', () => {
    expect(deliveryFeeFor('delivery', 100, noFees)).toBe(0);
  });
});

describe('cartLineKey', () => {
  it('ignores option order so identical choices merge', () => {
    const a = cartLineKey({
      itemSlug: 'x',
      options: [
        { group: 'a', option: '1' },
        { group: 'b', option: '2' },
      ],
    });
    const b = cartLineKey({
      itemSlug: 'x',
      options: [
        { group: 'b', option: '2' },
        { group: 'a', option: '1' },
      ],
    });
    expect(a).toBe(b);
    expect(cartLineKey({ itemSlug: 'x', options: [], notes: 'no onion' })).not.toBe(
      cartLineKey({ itemSlug: 'x', options: [] }),
    );
  });
});
