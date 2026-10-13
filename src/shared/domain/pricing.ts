/**
 * Order pricing. The browser uses this for the running total; the server runs the
 * same code against the database menu and ignores any totals the browser sends.
 */
import type { I18nText } from './i18n-text';
import type { MenuItem } from './menu';
import type { Tetri } from './money';

export const MAX_QUANTITY_PER_LINE = 50;
export const MAX_LINES = 30;

export type OrderType = 'delivery' | 'pickup';

export type SelectedOption = { group: string; option: string };

export type CartLineInput = {
  itemSlug: string;
  quantity: number;
  options: SelectedOption[];
  notes?: string;
};

export type PricedModifier = {
  groupSlug: string;
  optionSlug: string;
  group: I18nText;
  option: I18nText;
  priceDeltaTetri: Tetri;
};

export type PricedLine = {
  itemSlug: string;
  name: I18nText;
  quantity: number;
  basePriceTetri: Tetri;
  unitPriceTetri: Tetri;
  lineTotalTetri: Tetri;
  modifiers: PricedModifier[];
  notes?: string;
};

export type LineProblemCode =
  | 'item_not_found'
  | 'item_unavailable'
  | 'invalid_quantity'
  | 'unknown_option'
  | 'option_unavailable'
  | 'duplicate_option'
  | 'too_few_options'
  | 'too_many_options';

export type OrderProblemCode = 'empty_cart' | 'too_many_lines' | 'below_minimum' | LineProblemCode;

export type PricingProblem = {
  code: OrderProblemCode;
  /** Index of the cart line, for line-level problems. */
  line?: number;
  itemSlug?: string;
  groupSlug?: string;
  /** For below_minimum: the minimum and how much more is needed. */
  minimumTetri?: Tetri;
  shortByTetri?: Tetri;
};

export type FeeSettings = {
  deliveryFeeTetri: Tetri;
  /** 0 = no free-delivery threshold. */
  freeDeliveryOverTetri: Tetri;
  /** 0 = no minimum. */
  minDeliveryOrderTetri: Tetri;
};

/** A delivery zone may override the default fee and minimum. */
export type ZoneFees = { feeTetri: Tetri | null; minOrderTetri: Tetri | null } | null;

export type PricedOrder = {
  lines: PricedLine[];
  subtotalTetri: Tetri;
  deliveryFeeTetri: Tetri;
  discountTetri: Tetri;
  totalTetri: Tetri;
  problems: PricingProblem[];
};

export function priceLine(
  input: CartLineInput,
  item: MenuItem | undefined,
  index = 0,
): { line: PricedLine | null; problems: PricingProblem[] } {
  const problems: PricingProblem[] = [];
  const at = { line: index, itemSlug: input.itemSlug };

  if (!item) return { line: null, problems: [{ code: 'item_not_found', ...at }] };
  if (!item.isAvailable) problems.push({ code: 'item_unavailable', ...at });
  if (
    !Number.isInteger(input.quantity) ||
    input.quantity < 1 ||
    input.quantity > MAX_QUANTITY_PER_LINE
  ) {
    problems.push({ code: 'invalid_quantity', ...at });
  }

  const seen = new Set<string>();
  const modifiers: PricedModifier[] = [];
  for (const selected of input.options) {
    const key = `${selected.group}:${selected.option}`;
    if (seen.has(key)) {
      problems.push({ code: 'duplicate_option', ...at, groupSlug: selected.group });
      continue;
    }
    seen.add(key);
    const group = item.modifierGroups.find((g) => g.slug === selected.group);
    const option = group?.options.find((o) => o.slug === selected.option);
    if (!group || !option) {
      problems.push({ code: 'unknown_option', ...at, groupSlug: selected.group });
      continue;
    }
    if (!option.isAvailable) {
      problems.push({ code: 'option_unavailable', ...at, groupSlug: group.slug });
      continue;
    }
    modifiers.push({
      groupSlug: group.slug,
      optionSlug: option.slug,
      group: group.name,
      option: option.name,
      priceDeltaTetri: option.priceDeltaTetri,
    });
  }

  for (const group of item.modifierGroups) {
    const count = modifiers.filter((m) => m.groupSlug === group.slug).length;
    if (count < group.minSelect)
      problems.push({ code: 'too_few_options', ...at, groupSlug: group.slug });
    if (count > group.maxSelect)
      problems.push({ code: 'too_many_options', ...at, groupSlug: group.slug });
  }

  // Keep modifiers in menu order so identical choices always look (and hash) the same.
  const groupOrder = item.modifierGroups.map((g) => g.slug);
  modifiers.sort((a, b) => {
    const byGroup = groupOrder.indexOf(a.groupSlug) - groupOrder.indexOf(b.groupSlug);
    if (byGroup !== 0) return byGroup;
    const options = item.modifierGroups.find((g) => g.slug === a.groupSlug)!.options;
    return (
      options.findIndex((o) => o.slug === a.optionSlug) -
      options.findIndex((o) => o.slug === b.optionSlug)
    );
  });

  const unitPriceTetri = Math.max(
    0,
    item.priceTetri + modifiers.reduce((sum, m) => sum + m.priceDeltaTetri, 0),
  );
  const quantity = Math.min(Math.max(Math.trunc(input.quantity) || 1, 1), MAX_QUANTITY_PER_LINE);
  const notes = input.notes?.trim() || undefined;

  return {
    line: {
      itemSlug: item.slug,
      name: item.name,
      quantity,
      basePriceTetri: item.priceTetri,
      unitPriceTetri,
      lineTotalTetri: unitPriceTetri * quantity,
      modifiers,
      ...(notes ? { notes } : {}),
    },
    problems,
  };
}

export function deliveryFeeFor(
  orderType: OrderType,
  subtotalTetri: Tetri,
  settings: FeeSettings,
  zone: ZoneFees = null,
): Tetri {
  if (orderType !== 'delivery') return 0;
  const fee = zone?.feeTetri ?? settings.deliveryFeeTetri;
  if (fee <= 0) return 0;
  if (settings.freeDeliveryOverTetri > 0 && subtotalTetri >= settings.freeDeliveryOverTetri)
    return 0;
  return fee;
}

export function minimumFor(
  orderType: OrderType,
  settings: FeeSettings,
  zone: ZoneFees = null,
): Tetri {
  if (orderType !== 'delivery') return 0;
  return zone?.minOrderTetri ?? settings.minDeliveryOrderTetri;
}

export function priceOrder(args: {
  lines: CartLineInput[];
  menu: ReadonlyMap<string, MenuItem>;
  orderType: OrderType;
  fees: FeeSettings;
  zone?: ZoneFees;
}): PricedOrder {
  const problems: PricingProblem[] = [];
  const lines: PricedLine[] = [];

  if (args.lines.length === 0) problems.push({ code: 'empty_cart' });
  if (args.lines.length > MAX_LINES) problems.push({ code: 'too_many_lines' });

  args.lines.slice(0, MAX_LINES).forEach((input, index) => {
    const result = priceLine(input, args.menu.get(input.itemSlug), index);
    problems.push(...result.problems);
    if (result.line) lines.push(result.line);
  });

  const subtotalTetri = lines.reduce((sum, l) => sum + l.lineTotalTetri, 0);
  const zone = args.zone ?? null;
  const minimum = minimumFor(args.orderType, args.fees, zone);
  if (minimum > 0 && subtotalTetri < minimum) {
    problems.push({
      code: 'below_minimum',
      minimumTetri: minimum,
      shortByTetri: minimum - subtotalTetri,
    });
  }
  const deliveryFeeTetri = deliveryFeeFor(args.orderType, subtotalTetri, args.fees, zone);
  const discountTetri = 0;

  return {
    lines,
    subtotalTetri,
    deliveryFeeTetri,
    discountTetri,
    totalTetri: subtotalTetri + deliveryFeeTetri - discountTetri,
    problems,
  };
}

/** Same item + same options + same notes = same cart line (quantities merge). */
export function cartLineKey(line: Pick<CartLineInput, 'itemSlug' | 'options' | 'notes'>): string {
  const opts = line.options
    .map((o) => `${o.group}:${o.option}`)
    .sort()
    .join(',');
  return `${line.itemSlug}|${opts}|${line.notes?.trim() ?? ''}`;
}
