import { describe, expect, it } from 'vitest';
import { formatAmount, formatGel, parseGel } from './money';
import { formatGeorgianPhone, normaliseCustomerPhone, normaliseGeorgianPhone } from './phone';
import { distanceKm, findDeliveryZone, isInPolygon, type DeliveryZone } from './zones';

describe('money', () => {
  it.each([
    ['20', 2000],
    ['22.50', 2250],
    ['22,5', 2250],
    ['GEL 18', 1800],
    ['18 ₾', 1800],
    [' 0.99 ', 99],
    [28, 2800],
  ])('parses %s', (input, tetri) => {
    expect(parseGel(input)).toBe(tetri);
  });

  it.each(['', 'abc', '-5', '1.234', '20.5.1', '1e3'])('rejects %s', (input) => {
    expect(parseGel(input)).toBeNull();
  });

  it('formats without float drift', () => {
    expect(formatAmount(2250)).toBe('22.50');
    expect(formatAmount(5)).toBe('0.05');
    expect(formatGel(2000, 'en')).toBe('GEL\u00a020.00');
    expect(formatGel(123456, 'en')).toBe('GEL\u00a01,234.56');
    expect(formatGel(123456, 'ru')).toBe('1\u00a0234,56\u00a0GEL');
    expect(formatGel(2000, 'ka')).toBe('20,00\u00a0₾');
    expect(formatGel(-150, 'ka')).toBe('-1,50\u00a0₾');
  });

  it('refuses non-integer tetri', () => {
    expect(() => formatAmount(10.5)).toThrow();
  });
});

describe('Georgian phone numbers', () => {
  it.each([
    ['555 12 34 56', '+995555123456'],
    ['+995 555 123 456', '+995555123456'],
    ['995555123456', '+995555123456'],
    ['00995555123456', '+995555123456'],
    ['0555123456', '+995555123456'],
    ['(555) 12-34-56', '+995555123456'],
    ['422 27 11 11', '+995422271111'],
  ])('normalises %s', (input, out) => {
    expect(normaliseGeorgianPhone(input)).toBe(out);
  });

  it.each(['12345', '+7 999 123 45 67', '555 12 34 5', '955123456', 'call me'])(
    'rejects %s',
    (input) => {
      expect(normaliseGeorgianPhone(input)).toBeNull();
    },
  );

  it.each([
    ['555 12 34 56', '+995555123456'],
    ['+7 999 123 45 67', '+79991234567'],
    ['0044 7700 900123', '+447700900123'],
  ])('accepts customer number %s', (input, out) => {
    expect(normaliseCustomerPhone(input)).toBe(out);
  });

  it.each(['+995 123', '+995 955 123 456', '7 999 123 45 67', '+0 123 456 789', '+1 23'])(
    'rejects customer number %s',
    (input) => {
      expect(normaliseCustomerPhone(input)).toBeNull();
    },
  );

  it('formats for display', () => {
    expect(formatGeorgianPhone('+995500904721')).toBe('+995 500 90 47 21');
  });
});

describe('delivery zones', () => {
  const restaurant = { lat: 41.641, lng: 41.6151 };
  const zones: DeliveryZone[] = [
    {
      id: 'far',
      name: '3–6 km',
      kind: 'radius',
      radiusKm: 6,
      feeTetri: 500,
      minOrderTetri: null,
      sortOrder: 2,
    },
    {
      id: 'near',
      name: '0–3 km',
      kind: 'radius',
      radiusKm: 3,
      feeTetri: 0,
      minOrderTetri: null,
      sortOrder: 1,
    },
  ];

  it('measures distance', () => {
    // ~1.1 km per 0.01° latitude
    expect(distanceKm(restaurant, { lat: 41.651, lng: 41.6151 })).toBeCloseTo(1.11, 1);
  });

  it('picks the first zone in sort order that contains the point', () => {
    expect(findDeliveryZone({ lat: 41.651, lng: 41.6151 }, restaurant, zones)?.zone.id).toBe(
      'near',
    );
    expect(findDeliveryZone({ lat: 41.681, lng: 41.6151 }, restaurant, zones)?.zone.id).toBe('far');
    expect(findDeliveryZone({ lat: 41.8, lng: 41.6151 }, restaurant, zones)).toBeNull();
  });

  it('supports polygons', () => {
    const square: [number, number][] = [
      [41.63, 41.6],
      [41.65, 41.6],
      [41.65, 41.63],
      [41.63, 41.63],
    ];
    expect(isInPolygon(restaurant, square)).toBe(true);
    expect(isInPolygon({ lat: 41.7, lng: 41.61 }, square)).toBe(false);
  });
});
