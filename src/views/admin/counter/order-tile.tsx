'use client';

import { useAdminBrand } from '../admin-brand';
import { orderKindLabel, statusLabel, type AdminOrder } from '@/shared/admin/orders';
import { cn } from '@/shared/cn';
import { formatAmount } from '@/shared/domain/money';
import { orderLabel } from '@/shared/orders/format';

export type BoardTab = 'dine_in' | 'takeaway' | 'online';
const TAB_KEY = 'bp-orders-tab';

export function readTab(): BoardTab | null {
  try {
    const v = localStorage.getItem(TAB_KEY);
    return v === 'dine_in' || v === 'takeaway' || v === 'online' ? v : null;
  } catch {
    return null;
  }
}

export function saveTab(tab: BoardTab) {
  try {
    localStorage.setItem(TAB_KEY, tab);
  } catch {
    // Private mode: the tab just isn't remembered.
  }
}

export type TileState = 'free' | 'new' | 'cooking' | 'ready';

/** One colour per state, the same on every tab. */
export const STATE_STYLE: Record<TileState, { tile: string; dot: string; label: string }> = {
  free: { tile: 'border-line bg-soft border-dashed', dot: 'bg-line-strong', label: 'Free' },
  new: {
    tile: 'border-danger bg-danger-soft ring-4 ring-danger/20',
    dot: 'bg-danger',
    label: 'New, needs accepting',
  },
  cooking: { tile: 'border-gold bg-gold-soft', dot: 'bg-gold', label: 'In the kitchen' },
  ready: { tile: 'border-ok bg-ok-soft', dot: 'bg-ok', label: 'Ready / served' },
};

export function tileState(order: AdminOrder): TileState {
  if (order.status === 'received') return 'new';
  if (order.status === 'ready' || order.status === 'out_for_delivery') return 'ready';
  return 'cooking';
}

export function minutesSince(iso: string, now: number): number | null {
  return now > 0 ? Math.max(0, Math.round((now - Date.parse(iso)) / 60_000)) : null;
}

export function StateLegend({ tab }: { tab: BoardTab }) {
  const states: TileState[] =
    tab === 'dine_in'
      ? ['free', 'cooking', 'ready']
      : tab === 'online'
        ? ['new', 'cooking', 'ready']
        : ['cooking', 'ready'];
  return (
    <ul className="text-muted flex flex-wrap gap-x-4 gap-y-1 text-sm" aria-label="Colours">
      {states.map((s) => (
        <li key={s} className="flex items-center gap-1.5">
          <span aria-hidden className={cn('size-3 rounded-full', STATE_STYLE[s].dot)} />
          {s === 'ready' && tab === 'dine_in'
            ? 'Served'
            : s === 'ready' && tab === 'online'
              ? 'Ready / on the way'
              : s === 'ready'
                ? 'Ready'
                : STATE_STYLE[s].label}
        </li>
      ))}
      <li className="flex items-center gap-1.5">
        <span aria-hidden className="bg-ok rounded px-1 text-[10px] font-bold text-white">
          PAID
        </span>
        already paid
      </li>
    </ul>
  );
}

/** A compact order: number or name, state colour, total and time. Tap to open it. */
export function OrderTile({
  order,
  now,
  onOpen,
}: {
  order: AdminOrder;
  now: number;
  onOpen: () => void;
}) {
  const { orderPrefix } = useAdminBrand();
  const state = tileState(order);
  const label = orderLabel(orderPrefix, order.order_number);
  const minutes = minutesSince(order.created_at, now);
  const who = order.customer_name || orderKindLabel(order);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={`${label}, ${who}: ${statusLabel(order)}. Open the order`}
      className={cn(
        'grid min-h-28 w-full content-between gap-1 rounded-xl border-2 p-3 text-left',
        STATE_STYLE[state].tile,
      )}
    >
      <span className="flex items-start justify-between gap-2">
        <b className="text-lg leading-tight">{label}</b>
        {order.payment_status === 'paid' && (
          <span className="bg-ok rounded px-1.5 py-0.5 text-[11px] font-bold text-white">PAID</span>
        )}
      </span>
      <span className="truncate font-semibold">{who}</span>
      <span className="flex items-baseline justify-between gap-2 text-sm">
        <b className="tabular">GEL {formatAmount(order.total_tetri)}</b>
        <span className="text-muted">
          {statusLabel(order)}
          {minutes !== null && ` · ${minutes}′`}
        </span>
      </span>
    </button>
  );
}
