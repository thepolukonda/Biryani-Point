/**
 * Money is always an integer number of tetri (1 GEL = 100 tetri).
 * Floats never touch prices; conversion happens only at the edges (Sheet input, display).
 */
export type Tetri = number;

export function assertTetri(value: number): asserts value is Tetri {
  if (!Number.isSafeInteger(value)) throw new Error(`Invalid tetri amount: ${value}`);
}

/**
 * Parse a lari amount as typed by a person ("20", "22.50", "22,5", "GEL 18", "18 ₾") into tetri.
 * Returns null for anything that isn't a clear, non-negative amount with at most 2 decimals.
 */
export function parseGel(input: string | number): Tetri | null {
  const raw = String(input)
    .trim()
    .replace(/gel|lari|ლარი|₾|лари/gi, '')
    .replace(/\s+/g, '')
    .replace(',', '.');
  if (!/^\d{1,7}(\.\d{1,2})?$/.test(raw)) return null;
  const [whole = '0', frac = ''] = raw.split('.');
  return Number(whole) * 100 + Number(frac.padEnd(2, '0'));
}

/** "20.00" style amount without currency, for compact UI and the WhatsApp message. */
export function formatAmount(tetri: Tetri): string {
  assertTetri(tetri);
  const sign = tetri < 0 ? '-' : '';
  const abs = Math.abs(tetri);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

type MoneyLocale = 'en' | 'ka' | 'ru';

const NBSP = ' ';

/** 1234567 -> "1,234,567" with the given separator. */
function group(digits: string, separator: string): string {
  let out = '';
  for (let i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 === 0) out += separator;
    out += digits[i];
  }
  return out;
}

/**
 * Localised price: "GEL 20.00" (en), "20,00 ₾" (ka), "20,00 GEL" (ru), with
 * non-breaking spaces. Written by hand rather than with Intl, because Node and
 * browsers ship different locale data and a one-character difference breaks hydration.
 */
export function formatGel(tetri: Tetri, locale: MoneyLocale = 'en'): string {
  assertTetri(tetri);
  const sign = tetri < 0 ? '-' : '';
  const abs = Math.abs(tetri);
  const whole = group(String(Math.floor(abs / 100)), locale === 'en' ? ',' : NBSP);
  const amount = `${sign}${whole}${locale === 'en' ? '.' : ','}${String(abs % 100).padStart(2, '0')}`;
  if (locale === 'ka') return `${amount}${NBSP}₾`;
  if (locale === 'ru') return `${amount}${NBSP}GEL`;
  return `GEL${NBSP}${amount}`;
}
