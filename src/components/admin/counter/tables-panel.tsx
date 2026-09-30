'use client';

import Link from 'next/link';
import { statusLabel, type AdminOrder } from '@/lib/admin/orders';
import { cn } from '@/lib/cn';
import { formatAmount } from '@/lib/domain/money';
import type { DiningTable } from '../orders-board';
import { minutesSince, STATE_STYLE, tileState } from './order-tile';

/** The floor at a glance: free tables start a new order, busy ones open their tab. */
export function TablesPanel({
  tables,
  orders,
  now,
  onNewTableOrder,
  onOpenOrder,
}: {
  tables: DiningTable[];
  /** Open table orders. */
  orders: AdminOrder[];
  now: number;
  onNewTableOrder: (table: DiningTable) => void;
  onOpenOrder: (orderId: string) => void;
}) {
  const active = tables.filter((t) => t.is_active);
  const tabs = new Map(orders.filter((o) => o.table_id).map((o) => [o.table_id!, o]));
  // A tab whose table was paused or removed still has to be closed.
  const orphans = orders.filter((o) => !o.table_id || !active.some((t) => t.id === o.table_id));

  if (active.length === 0 && orphans.length === 0) {
    return (
      <p className="border-line-strong text-muted rounded-xl border-2 border-dashed p-8 text-center">
        No tables yet. The owner can add them on the{' '}
        <Link href="/admin/tables" className="text-gold-text font-semibold underline">
          Tables
        </Link>{' '}
        page.
      </p>
    );
  }

  const tile = (
    key: string,
    name: string,
    seats: number | null,
    tab: AdminOrder | undefined,
    onClick: () => void,
  ) => {
    const minutes = tab ? minutesSince(tab.created_at, now) : null;
    return (
      <li key={key}>
        <button
          type="button"
          onClick={onClick}
          aria-label={
            tab
              ? `${name}: in use, GEL ${formatAmount(tab.total_tetri)}. Open the order`
              : `${name}: free. Start an order`
          }
          className={cn(
            'grid min-h-28 w-full content-between rounded-xl border-2 p-3 text-left',
            STATE_STYLE[tab ? tileState(tab) : 'free'].tile,
            !tab && 'hover:border-line-strong',
          )}
        >
          <span className="flex items-baseline justify-between gap-1">
            <b className="text-2xl">{name}</b>
            {tab?.payment_status === 'paid' ? (
              <span className="bg-ok rounded px-1.5 py-0.5 text-[11px] font-bold text-white">
                PAID
              </span>
            ) : (
              seats !== null && <span className="text-muted text-xs">{seats} seats</span>
            )}
          </span>
          {tab ? (
            <span className="text-sm">
              <b className="tabular text-base">GEL {formatAmount(tab.total_tetri)}</b>
              <span className="text-muted block">
                {statusLabel(tab)}
                {minutes !== null && ` · ${minutes}′`}
              </span>
            </span>
          ) : (
            <span className="text-muted text-sm font-semibold">Free · tap to order</span>
          )}
        </button>
      </li>
    );
  };

  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2">
      {active.map((table) => {
        const tab = tabs.get(table.id);
        return tile(table.id, table.name, table.seats, tab, () =>
          tab ? onOpenOrder(tab.id) : onNewTableOrder(table),
        );
      })}
      {orphans.map((o) => tile(o.id, o.table_label ?? 'Table', null, o, () => onOpenOrder(o.id)))}
    </ul>
  );
}
