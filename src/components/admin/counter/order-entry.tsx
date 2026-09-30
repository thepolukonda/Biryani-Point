'use client';

import { useMemo, useState, useTransition } from 'react';
import {
  addOrderRound,
  createCounterOrder,
  type CounterResult,
} from '@/app/admin/_actions/counter';
import { cn } from '@/lib/cn';
import { pickText } from '@/lib/domain/i18n-text';
import type { Menu, MenuItem } from '@/lib/domain/menu';
import { formatAmount } from '@/lib/domain/money';
import { cartLineKey, priceOrder, type SelectedOption } from '@/lib/domain/pricing';

/** What the dishes are for: a free table, a takeaway, or more dishes for an open order. */
export type EntryTarget =
  | { kind: 'table'; tableId: string; label: string }
  | { kind: 'takeaway' }
  | { kind: 'round'; orderId: string; label: string };

type Line = {
  key: string;
  itemSlug: string;
  quantity: number;
  options: SelectedOption[];
  notes?: string;
};

const NO_FEES = { deliveryFeeTetri: 0, freeDeliveryOverTetri: 0, minDeliveryOrderTetri: 0 };
const name = (item: MenuItem) => pickText(item.name, 'en');

function defaultSelection(item: MenuItem): SelectedOption[] {
  return item.modifierGroups.flatMap((g) =>
    g.options
      .filter((o) => o.isDefault && o.isAvailable)
      .slice(0, g.maxSelect)
      .map((o) => ({ group: g.slug, option: o.slug })),
  );
}

/**
 * Taking an order at the counter or a table: tap dishes (with their options), adjust
 * quantities, then send it to the kitchen. Prices shown here are a preview; the server
 * prices the order again from the live menu.
 */
export function OrderEntry({
  menu,
  target,
  onClose,
  onDone,
}: {
  menu: Menu;
  target: EntryTarget;
  onClose: () => void;
  onDone: (result: Extract<CounterResult, { ok: true }>) => void;
}) {
  const [lines, setLines] = useState<Line[]>([]);
  const [category, setCategory] = useState<string>('all');
  const [query, setQuery] = useState('');
  const [picking, setPicking] = useState<{ item: MenuItem; options: SelectedOption[] } | null>(
    null,
  );
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [payment, setPayment] = useState<'later' | 'cash' | 'card'>(
    target.kind === 'takeaway' ? 'cash' : 'later',
  );
  const [error, setError] = useState('');
  const [pending, start] = useTransition();
  // One key per order being entered: a double tap can't create the order twice.
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const bySlug = useMemo(() => new Map(menu.items.map((i) => [i.slug, i])), [menu]);
  const priced = useMemo(
    () => priceOrder({ lines, menu: bySlug, orderType: 'pickup', fees: NO_FEES }),
    [lines, bySlug],
  );
  const shown = menu.items.filter(
    (i) =>
      (category === 'all' || i.categorySlug === category) &&
      (!query.trim() || name(i).toLowerCase().includes(query.trim().toLowerCase())),
  );

  const add = (item: MenuItem, options: SelectedOption[]) => {
    const key = cartLineKey({ itemSlug: item.slug, options });
    setLines((all) =>
      all.some((l) => l.key === key)
        ? all.map((l) => (l.key === key ? { ...l, quantity: Math.min(50, l.quantity + 1) } : l))
        : [...all, { key, itemSlug: item.slug, quantity: 1, options }],
    );
  };
  const tap = (item: MenuItem) => {
    if (!item.isAvailable) return;
    if (item.modifierGroups.length === 0) add(item, []);
    else setPicking({ item, options: defaultSelection(item) });
  };
  const setQty = (key: string, quantity: number) =>
    setLines((all) =>
      quantity <= 0
        ? all.filter((l) => l.key !== key)
        : all.map((l) => (l.key === key ? { ...l, quantity } : l)),
    );

  const submit = () =>
    start(async () => {
      setError('');
      const payload = lines.map(({ itemSlug, quantity, options, notes: n }) => ({
        itemSlug,
        quantity,
        options,
        ...(n ? { notes: n } : {}),
      }));
      const result =
        target.kind === 'round'
          ? await addOrderRound({ orderId: target.orderId, lines: payload })
          : await createCounterOrder({
              kind: target.kind === 'table' ? 'dine_in' : 'takeaway',
              tableId: target.kind === 'table' ? target.tableId : undefined,
              customerName: customerName.trim() || undefined,
              notes: notes.trim() || undefined,
              payment,
              lines: payload,
              idempotencyKey,
            });
      if (!result.ok) setError(result.error);
      else onDone(result);
    });

  const title =
    target.kind === 'table'
      ? `New order · ${target.label}`
      : target.kind === 'takeaway'
        ? 'New takeaway'
        : `Add dishes · ${target.label}`;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="bg-night/60 fixed inset-0 z-50 grid place-items-stretch p-0 md:p-4"
    >
      <div className="bg-surface grid min-h-0 grid-rows-[auto_1fr] overflow-hidden md:rounded-2xl lg:grid-cols-[1fr_380px] lg:grid-rows-1">
        {/* Dishes */}
        <div className="flex min-h-0 flex-col">
          <div className="border-line flex flex-wrap items-center gap-2 border-b p-3">
            <h2 className="mr-auto text-xl font-extrabold">{title}</h2>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search dishes"
              aria-label="Search dishes"
              className="border-line bg-soft min-h-11 w-48 rounded-full border px-4"
            />
            <button
              type="button"
              onClick={onClose}
              className="bg-soft min-h-11 rounded-full px-4 font-semibold"
            >
              Close
            </button>
          </div>
          <div className="flex scrollbar-none gap-1.5 overflow-x-auto p-3 pb-0">
            {[{ slug: 'all', name: { en: 'All' } }, ...menu.categories].map((c) => (
              <button
                key={c.slug}
                type="button"
                aria-pressed={category === c.slug}
                onClick={() => setCategory(c.slug)}
                className={cn(
                  'min-h-10 shrink-0 rounded-full px-4 text-sm font-semibold whitespace-nowrap',
                  category === c.slug ? 'bg-ink text-white' : 'bg-soft',
                )}
              >
                {pickText(c.name, 'en')}
              </button>
            ))}
          </div>
          <ul className="grid min-h-0 flex-1 auto-rows-min grid-cols-2 gap-2 overflow-y-auto p-3 sm:grid-cols-3 xl:grid-cols-4">
            {shown.map((item) => {
              const inOrder = lines
                .filter((l) => l.itemSlug === item.slug)
                .reduce((s, l) => s + l.quantity, 0);
              return (
                <li key={item.slug}>
                  <button
                    type="button"
                    disabled={!item.isAvailable}
                    onClick={() => tap(item)}
                    className={cn(
                      'relative grid min-h-20 w-full content-between rounded-xl border-2 p-3 text-left',
                      inOrder ? 'border-gold bg-gold-soft' : 'border-line bg-surface hover:bg-soft',
                      !item.isAvailable && 'opacity-45',
                    )}
                  >
                    <span className="leading-snug font-semibold">{name(item)}</span>
                    <span className="tabular text-muted text-sm">
                      {item.isAvailable ? `GEL ${formatAmount(item.priceTetri)}` : 'Sold out'}
                      {item.modifierGroups.length > 0 && item.isAvailable && ' · options'}
                    </span>
                    {inOrder > 0 && (
                      <span className="bg-ink tabular absolute top-2 right-2 grid size-7 place-items-center rounded-full text-sm font-bold text-white">
                        {inOrder}
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Order */}
        <div className="border-line bg-soft flex min-h-0 flex-col border-t lg:border-t-0 lg:border-l">
          <ul className="min-h-0 flex-1 overflow-y-auto p-3 max-lg:max-h-[30dvh]">
            {lines.length === 0 && (
              <li className="text-muted p-4 text-center">Tap dishes to add them.</li>
            )}
            {lines.map((line, index) => {
              const pl = priced.lines[index];
              const item = bySlug.get(line.itemSlug);
              return (
                <li key={line.key} className="bg-surface mb-2 rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <b className="leading-snug">{item ? name(item) : line.itemSlug}</b>
                      {pl && pl.modifiers.length > 0 && (
                        <p className="text-muted text-sm">
                          {pl.modifiers.map((m) => pickText(m.option, 'en')).join(', ')}
                        </p>
                      )}
                    </div>
                    <span className="tabular font-semibold">
                      {pl ? formatAmount(pl.lineTotalTetri) : ''}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setQty(line.key, line.quantity - 1)}
                      aria-label={`One less ${item ? name(item) : ''}`}
                      className="bg-soft size-10 rounded-full text-lg font-bold"
                    >
                      −
                    </button>
                    <span className="tabular w-6 text-center font-bold">{line.quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQty(line.key, Math.min(50, line.quantity + 1))}
                      aria-label={`One more ${item ? name(item) : ''}`}
                      className="bg-soft size-10 rounded-full text-lg font-bold"
                    >
                      +
                    </button>
                    <input
                      value={line.notes ?? ''}
                      onChange={(e) =>
                        setLines((all) =>
                          all.map((l) =>
                            l.key === line.key ? { ...l, notes: e.target.value.slice(0, 200) } : l,
                          ),
                        )
                      }
                      placeholder="Note"
                      aria-label={`Note for ${item ? name(item) : 'dish'}`}
                      className="border-line min-h-10 min-w-0 flex-1 rounded-md border px-2 text-sm"
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="border-line grid gap-3 border-t p-3">
            {target.kind !== 'round' && (
              <>
                {target.kind === 'takeaway' && (
                  <input
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    maxLength={80}
                    placeholder="Customer name (optional)"
                    aria-label="Customer name (optional)"
                    className="border-line bg-surface min-h-11 rounded-md border px-3"
                  />
                )}
                <input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={500}
                  placeholder="Note for the kitchen (optional)"
                  aria-label="Note for the kitchen (optional)"
                  className="border-line bg-surface min-h-11 rounded-md border px-3"
                />
                <fieldset className="grid grid-cols-3 gap-1.5">
                  <legend className="mb-1 text-sm font-bold">Payment</legend>
                  {(
                    [
                      ['later', target.kind === 'table' ? 'When leaving' : 'Pay later'],
                      ['cash', 'Paid cash'],
                      ['card', 'Paid card'],
                    ] as const
                  ).map(([value, label]) => (
                    <button
                      key={value}
                      type="button"
                      aria-pressed={payment === value}
                      onClick={() => setPayment(value)}
                      className={cn(
                        'min-h-11 rounded-md px-2 text-sm font-semibold',
                        payment === value ? 'bg-ink text-white' : 'bg-surface',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </fieldset>
              </>
            )}
            {error && (
              <p
                role="alert"
                className="bg-danger-soft text-danger rounded-md px-3 py-2 text-sm font-semibold"
              >
                {error}
              </p>
            )}
            <button
              type="button"
              disabled={pending || lines.length === 0}
              onClick={submit}
              className="bg-veg min-h-14 rounded-lg px-4 text-lg font-bold text-white disabled:opacity-50"
            >
              {pending ? 'Sending…' : `Send to kitchen · GEL ${formatAmount(priced.subtotalTetri)}`}
            </button>
          </div>
        </div>
      </div>

      {picking && (
        <OptionPicker
          item={picking.item}
          initial={picking.options}
          onCancel={() => setPicking(null)}
          onAdd={(options) => {
            add(picking.item, options);
            setPicking(null);
          }}
        />
      )}
    </div>
  );
}

function OptionPicker({
  item,
  initial,
  onCancel,
  onAdd,
}: {
  item: MenuItem;
  initial: SelectedOption[];
  onCancel: () => void;
  onAdd: (options: SelectedOption[]) => void;
}) {
  const [selected, setSelected] = useState(initial);
  const toggle = (group: MenuItem['modifierGroups'][number], option: string) =>
    setSelected((all) => {
      const inGroup = all.filter((s) => s.group === group.slug);
      const has = inGroup.some((s) => s.option === option);
      if (group.maxSelect === 1)
        return [...all.filter((s) => s.group !== group.slug), { group: group.slug, option }];
      if (has) return all.filter((s) => !(s.group === group.slug && s.option === option));
      if (inGroup.length >= group.maxSelect) return all;
      return [...all, { group: group.slug, option }];
    });
  const missing = item.modifierGroups.filter(
    (g) => selected.filter((s) => s.group === g.slug).length < g.minSelect,
  );

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Options for ${name(item)}`}
      className="bg-night/50 fixed inset-0 z-[60] grid place-items-center p-4"
    >
      <div className="bg-surface grid max-h-[90dvh] w-full max-w-md gap-4 overflow-y-auto rounded-2xl p-5">
        <h3 className="text-xl font-extrabold">{name(item)}</h3>
        {item.modifierGroups.map((group) => (
          <fieldset key={group.slug} className="grid gap-1.5">
            <legend className="mb-1 font-bold">
              {pickText(group.name, 'en')}
              <span className="text-muted text-sm font-normal">
                {' '}
                ·{' '}
                {group.minSelect > 0
                  ? group.maxSelect === 1
                    ? 'choose 1'
                    : `choose ${group.minSelect}–${group.maxSelect}`
                  : `optional, up to ${group.maxSelect}`}
              </span>
            </legend>
            <div className="grid grid-cols-2 gap-1.5">
              {group.options.map((o) => {
                const on = selected.some((s) => s.group === group.slug && s.option === o.slug);
                return (
                  <button
                    key={o.slug}
                    type="button"
                    disabled={!o.isAvailable}
                    aria-pressed={on}
                    onClick={() => toggle(group, o.slug)}
                    className={cn(
                      'min-h-12 rounded-md px-3 text-left text-sm font-semibold disabled:opacity-40',
                      on ? 'bg-ink text-white' : 'bg-soft',
                    )}
                  >
                    {pickText(o.name, 'en')}
                    {o.priceDeltaTetri !== 0 && (
                      <span className="tabular block text-xs font-normal opacity-80">
                        {o.priceDeltaTetri > 0 ? '+' : '−'}
                        {formatAmount(Math.abs(o.priceDeltaTetri))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="bg-soft min-h-12 rounded-lg font-semibold"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={missing.length > 0}
            onClick={() => onAdd(selected)}
            className="bg-ink min-h-12 rounded-lg font-bold text-white disabled:opacity-50"
          >
            Add
          </button>
        </div>
      </div>
    </div>
  );
}
