'use client';

import { useState, useTransition } from 'react';
import { settleOrder } from '@/controllers/admin/counter.actions';
import { setPaid, setPrepTime, updateOrderStatus } from '@/controllers/admin/orders.actions';
import { cn } from '@/shared/cn';
import {
  canAddItems,
  canChangePayment,
  nextSteps,
  orderKindLabel,
  REJECT_REASONS,
  statusLabel,
  type AdminOrder,
  type OrderStatus,
} from '@/shared/admin/orders';
import { pickText, type I18nText } from '@/shared/domain/i18n-text';
import { formatAmount } from '@/shared/domain/money';
import { formatGeorgianPhone } from '@/shared/domain/phone';
import { printTicket } from '@/controllers/client/print-device';
import { mapPinUrl } from '@/shared/links';
import { orderLabel } from '@/shared/orders/format';
import { useAdminBrand } from './admin-brand';

const PREP_CHOICES = [15, 20, 30, 45, 60];
const hhmm = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));
const dayHhmm = (iso: string, timeZone: string) =>
  new Intl.DateTimeFormat('en-GB', {
    timeZone,
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(new Date(iso));

function minutesAgo(iso: string, now: number) {
  const m = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ${m % 60} min ago`;
}

const LANG: Record<string, string> = { ka: 'Georgian', ru: 'Russian' };

export function OrderCard({
  order,
  now,
  onUpdated,
  onAddItems,
}: {
  order: AdminOrder;
  now: number;
  onUpdated: (o: Partial<AdminOrder> & { id: string }) => void;
  /** Opens the dish picker for another round (table tabs and counter takeaway). */
  onAddItems?: (order: AdminOrder) => void;
}) {
  const { timezone, orderPrefix } = useAdminBrand();
  const [pending, start] = useTransition();
  const [error, setError] = useState('');
  const [mode, setMode] = useState<'idle' | 'reject' | 'cancel' | 'time' | 'pay'>('idle');
  const counter = order.source === 'counter';
  const table = order.type === 'dine_in';
  // Picked up / delivered only once paid; the database refuses it otherwise.
  const unpaid = order.payment_status !== 'paid';
  const payFirst = counter ? 'Take payment first' : 'Mark paid first';
  const [reason, setReason] = useState(REJECT_REASONS[0]!);
  const [customReason, setCustomReason] = useState('');
  const [printing, setPrinting] = useState<'kot' | 'bill' | null>(null);
  const isNew = order.status === 'received';
  const final = ['completed', 'rejected', 'cancelled'].includes(order.status);
  const later =
    now > 0 && order.scheduled_for && new Date(order.scheduled_for).getTime() - now > 30 * 60_000;

  const run = (
    action: () => Promise<{ ok: boolean; error?: string }>,
    optimistic?: Partial<AdminOrder>,
  ) =>
    start(async () => {
      setError('');
      const result = await action();
      if (!result.ok) setError(result.error ?? 'Something went wrong.');
      else {
        setMode('idle');
        if (optimistic) onUpdated({ id: order.id, ...optimistic });
      }
    });

  const move = (
    status: Exclude<OrderStatus, 'received'>,
    extra: { prepMinutes?: number; reason?: string } = {},
  ) =>
    run(() => updateOrderStatus({ orderId: order.id, status, ...extra }), {
      status,
      ...(extra.prepMinutes ? { prep_minutes: extra.prepMinutes } : {}),
      ...(extra.reason ? { rejection_reason: extra.reason } : {}),
    });

  const big = 'min-h-14 rounded-lg px-4 text-base font-bold disabled:opacity-50';

  // Manual print / reprint. Works on any device (opens that device's print dialog).
  const print = async (kind: 'kot' | 'bill') => {
    setPrinting(kind);
    setError('');
    // The KOT button reprints the latest round (a table's newest dishes).
    const outcome = await printTicket(order.id, kind, { round: order.kot_round });
    setPrinting(null);
    if (typeof outcome === 'object') setError(outcome.error);
  };
  const printable = !isNew && order.status !== 'rejected' && order.status !== 'cancelled';

  const renderItem = (item: AdminOrder['order_items'][number]) => {
    const modifiers = (item.modifiers as { option: I18nText }[]).map((m) =>
      pickText(m.option, 'en'),
    );
    return (
      <li key={item.id} className="text-[17px] leading-snug">
        <b className="tabular">{item.quantity} ×</b> {pickText(item.item_name as I18nText, 'en')}
        {modifiers.length > 0 && <span className="text-muted"> · {modifiers.join(', ')}</span>}
        {item.notes && (
          <span className="bg-gold-soft text-gold-text mt-0.5 block rounded px-2 py-0.5 text-sm font-semibold">
            Note: {item.notes}
          </span>
        )}
      </li>
    );
  };

  return (
    <article
      aria-labelledby={`order-${order.id}`}
      className={cn(
        'bg-surface shadow-card rounded-xl border-2 p-4',
        isNew ? 'border-gold ring-gold/30 ring-4' : 'border-transparent',
        final && 'opacity-80',
      )}
    >
      <header className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 id={`order-${order.id}`} className="text-2xl font-black">
            {orderLabel(orderPrefix, order.order_number)}
          </h3>
          <p className="text-muted text-sm">
            {hhmm(order.created_at, timezone)}
            {now > 0 && ` · ${minutesAgo(order.created_at, now)}`}
          </p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          <span
            className={cn(
              'rounded-full px-3 py-1 text-sm font-bold',
              order.type === 'delivery'
                ? 'bg-ink text-white'
                : table
                  ? 'bg-ok-soft text-ok'
                  : 'bg-gold-soft text-gold-text',
            )}
          >
            {orderKindLabel(order)}
          </span>
          {!isNew && (
            <span className="bg-soft rounded-full px-3 py-1 text-sm font-semibold">
              {statusLabel(order)}
            </span>
          )}
        </div>
      </header>

      <p
        className={cn(
          'mt-2 rounded-md px-3 py-2 font-bold',
          later ? 'bg-gold-soft text-gold-text' : 'bg-soft',
        )}
      >
        {order.scheduled_for
          ? `For ${dayHhmm(order.scheduled_for, timezone)}`
          : counter
            ? table
              ? `At the table${order.kot_round > 1 ? ` · ${order.kot_round} rounds` : ''}`
              : 'Takeaway at the counter'
            : 'As soon as possible'}
        {order.estimated_ready_at && !final && order.status !== 'received' && (
          <span className="text-muted font-normal">
            {' '}
            · ready ~{hhmm(order.estimated_ready_at, timezone)}
          </span>
        )}
      </p>

      <ul className="mt-3 grid gap-1.5">
        {order.order_items
          .slice()
          .sort((a, b) => a.sort_order - b.sort_order)
          .flatMap((item, i, all) => {
            // Later rounds (dishes added to a table) get a small heading.
            const heading =
              item.kot_round > 1 && all[i - 1]?.kot_round !== item.kot_round ? (
                <li
                  key={`round-${item.kot_round}`}
                  className="text-muted border-line mt-1 border-t pt-1.5 text-xs font-bold tracking-wide uppercase"
                >
                  Round {item.kot_round}
                </li>
              ) : null;
            return heading ? [heading, renderItem(item)] : [renderItem(item)];
          })}
      </ul>
      {order.notes && (
        <p className="bg-gold-soft text-gold-text mt-2 rounded-md px-3 py-2 text-sm font-semibold">
          Note: {order.notes}
        </p>
      )}

      <div className="border-line mt-3 grid gap-1 border-t pt-3 text-[15px]">
        {(order.customer_name || order.customer_phone) && (
          <p>
            {order.customer_name && <b>{order.customer_name}</b>}
            {order.customer_name && order.customer_phone && ' · '}
            {order.customer_phone && (
              <a
                href={`tel:${order.customer_phone}`}
                className="tabular text-gold-text font-semibold underline"
              >
                {formatGeorgianPhone(order.customer_phone)}
              </a>
            )}
            {LANG[order.customer_locale] && (
              <span className="text-muted"> · speaks {LANG[order.customer_locale]}</span>
            )}
          </p>
        )}
        {order.type === 'delivery' && (
          <p>
            {order.address_text ?? 'Location pin only'}
            {order.address_lat !== null && order.address_lng !== null && (
              <>
                {' '}
                <a
                  href={mapPinUrl({ lat: order.address_lat, lng: order.address_lng })}
                  target="_blank"
                  rel="noreferrer"
                  className="text-gold-text font-semibold underline"
                >
                  Map
                </a>
                {order.distance_km !== null && (
                  <span className="text-muted"> · {order.distance_km} km</span>
                )}
              </>
            )}
          </p>
        )}
        <p className="flex flex-wrap items-center justify-between gap-2">
          <span>
            <b className="tabular text-lg">GEL {formatAmount(order.total_tetri)}</b>{' '}
            <span className="text-muted">
              ·{' '}
              {counter
                ? order.payment_status === 'paid'
                  ? `Paid by ${order.payment_method === 'card' ? 'card' : 'cash'}`
                  : 'Not paid yet'
                : order.payment_method === 'cash'
                  ? 'Cash on delivery'
                  : order.payment_method === 'pay_at_pickup'
                    ? 'Pay at pickup'
                    : 'Online'}
              {order.delivery_fee_tetri > 0 &&
                ` · incl. GEL ${formatAmount(order.delivery_fee_tetri)} delivery`}
            </span>
          </span>
          {!counter && canChangePayment(order) && (
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                run(() => setPaid(order.id, order.payment_status !== 'paid'), {
                  payment_status: order.payment_status === 'paid' ? 'unpaid' : 'paid',
                })
              }
              className={cn(
                'min-h-10 rounded-full px-3 text-sm font-bold',
                order.payment_status === 'paid' ? 'bg-ok-soft text-ok' : 'bg-soft text-ink-soft',
              )}
            >
              {order.payment_status === 'paid' ? 'Paid' : 'Mark paid'}
            </button>
          )}
        </p>
        {order.rejection_reason && (
          <p className="text-danger font-semibold">Reason: {order.rejection_reason}</p>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="bg-danger-soft text-danger mt-3 rounded-md px-3 py-2 text-sm font-semibold"
        >
          {error}
        </p>
      )}

      {/* Actions */}
      {isNew && mode === 'idle' && (
        <div className="mt-4 grid gap-2">
          <p className="text-muted text-sm font-semibold">Accept with prep time:</p>
          <div className="grid grid-cols-5 gap-1.5">
            {PREP_CHOICES.map((m) => (
              <button
                key={m}
                type="button"
                disabled={pending}
                onClick={() => move('accepted', { prepMinutes: m })}
                className={cn(big, 'bg-veg px-1 text-white hover:brightness-110')}
                aria-label={`Accept, ready in ${m} minutes`}
              >
                {m}′
              </button>
            ))}
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => setMode('reject')}
            className={cn(big, 'bg-danger-soft text-danger')}
          >
            Reject…
          </button>
        </div>
      )}

      {(mode === 'reject' || mode === 'cancel') && (
        <div className="bg-danger-soft mt-4 grid gap-2 rounded-lg p-3">
          <label className="grid gap-1 text-sm font-semibold">
            Reason (the customer sees this)
            <select
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="bg-surface min-h-12 rounded-md px-3 text-base"
            >
              {REJECT_REASONS.map((r) => (
                <option key={r}>{r}</option>
              ))}
              <option value="">Other…</option>
            </select>
          </label>
          {reason === '' && (
            <input
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              maxLength={300}
              placeholder="Type the reason"
              aria-label="Reason"
              className="bg-surface min-h-12 rounded-md px-3 text-base"
            />
          )}
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setMode('idle')} className={cn(big, 'bg-surface')}>
              Back
            </button>
            <button
              type="button"
              disabled={pending || (reason === '' && !customReason.trim())}
              onClick={() =>
                move(mode === 'reject' ? 'rejected' : 'cancelled', {
                  reason: reason || customReason.trim(),
                })
              }
              className={cn(big, 'bg-danger text-white')}
            >
              {mode === 'reject' ? 'Reject order' : 'Cancel order'}
            </button>
          </div>
        </div>
      )}

      {!isNew && !final && mode === 'idle' && (
        <div className="mt-4 grid gap-2">
          <div className="grid auto-cols-fr grid-flow-col gap-2">
            {nextSteps(order).map((step, i, all) => (
              <button
                key={step.status}
                type="button"
                disabled={pending || (step.status === 'completed' && unpaid)}
                title={step.status === 'completed' && unpaid ? payFirst : undefined}
                onClick={() => move(step.status)}
                className={cn(
                  big,
                  i === all.length - 1
                    ? 'bg-ink text-white hover:bg-black'
                    : 'bg-soft hover:bg-soft-2',
                )}
              >
                {step.label}
              </button>
            ))}
          </div>
          {unpaid && nextSteps(order).some((s) => s.status === 'completed') && (
            <p className="text-muted text-sm">
              {payFirst}, then{' '}
              {nextSteps(order)
                .find((s) => s.status === 'completed')!
                .label.toLowerCase()}
              .
            </p>
          )}
          {counter && (
            <div className="grid auto-cols-fr grid-flow-col gap-2">
              {onAddItems && canAddItems(order) && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => onAddItems(order)}
                  className={cn(big, 'bg-gold-soft text-gold-text')}
                >
                  + Add dishes
                </button>
              )}
              {(table || order.payment_status !== 'paid') && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setMode('pay')}
                  className={cn(big, 'bg-veg text-white')}
                >
                  {table ? 'Bill & pay' : 'Take payment'}
                </button>
              )}
            </div>
          )}
          <div className="flex flex-wrap gap-2 text-sm">
            <button
              type="button"
              onClick={() => setMode('time')}
              className="bg-soft min-h-10 rounded-full px-3 font-semibold"
            >
              Change ready time
            </button>
            <button
              type="button"
              onClick={() => setMode('cancel')}
              className="text-danger min-h-10 rounded-full px-3 font-semibold"
            >
              Cancel…
            </button>
          </div>
        </div>
      )}

      {mode === 'pay' && (
        <div className="bg-ok-soft mt-4 grid gap-2 rounded-lg p-3">
          <p className="flex items-baseline justify-between font-bold">
            {table ? 'Close the table' : 'Take payment'}
            <span className="tabular text-2xl">GEL {formatAmount(order.total_tetri)}</span>
          </p>
          <button
            type="button"
            disabled={printing !== null}
            onClick={() => void print('bill')}
            className={cn(big, 'bg-surface')}
          >
            {printing === 'bill' ? 'Printing…' : 'Print the bill'}
          </button>
          <div className="grid grid-cols-2 gap-2">
            {(['cash', 'card'] as const).map((method) => (
              <button
                key={method}
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() => settleOrder({ orderId: order.id, method }), {
                    payment_method: method,
                    payment_status: 'paid',
                    ...(table ? { status: 'completed' as const } : {}),
                  })
                }
                className={cn(big, 'bg-ink text-white')}
              >
                Paid {method === 'cash' ? 'cash' : 'card'}
              </button>
            ))}
          </div>
          <button type="button" onClick={() => setMode('idle')} className="min-h-10 font-semibold">
            Back
          </button>
        </div>
      )}

      {printable && mode === 'idle' && (
        <div className="border-line mt-3 flex flex-wrap gap-2 border-t pt-3 text-sm">
          {(['kot', 'bill'] as const).map((kind) => (
            <button
              key={kind}
              type="button"
              disabled={printing !== null}
              onClick={() => void print(kind)}
              className="bg-soft hover:bg-soft-2 min-h-10 rounded-full px-3 font-semibold disabled:opacity-50"
            >
              {printing === kind ? 'Printing…' : kind === 'kot' ? 'Print KOT' : 'Print bill'}
            </button>
          ))}
        </div>
      )}

      {mode === 'time' && (
        <div className="mt-4 grid gap-2">
          <p className="text-muted text-sm font-semibold">Ready in (from now):</p>
          <div className="grid grid-cols-5 gap-1.5">
            {[10, ...PREP_CHOICES.slice(0, 4)].map((m) => (
              <button
                key={m}
                type="button"
                disabled={pending}
                onClick={() =>
                  run(() => setPrepTime(order.id, m), {
                    prep_minutes: m,
                    estimated_ready_at: new Date(Date.now() + m * 60_000).toISOString(),
                  })
                }
                className={cn(big, 'bg-soft px-1')}
              >
                {m}′
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setMode('idle')}
            className="text-muted min-h-10 text-sm font-semibold"
          >
            Back
          </button>
        </div>
      )}
    </article>
  );
}
