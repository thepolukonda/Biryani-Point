'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import {
  ADMIN_ORDER_SELECT,
  OPEN_STATUSES,
  FINAL_STATUSES,
  type AdminOrder,
  type OrderStatus,
} from '@/lib/admin/orders';
import { notify, playChime, requestNotifications, unlockAudio } from '@/lib/admin/alerts';
import { printTicket, usePrintDevice } from '@/lib/admin/printing';
import { cn } from '@/lib/cn';
import { useNow } from '@/lib/hooks';
import { orderLabel } from '@/lib/orders/format';
import type { Menu } from '@/lib/domain/menu';
import type { Database } from '@/lib/supabase/database.types';
import { browserClient } from '@/lib/supabase/browser';
import { OrderEntry, type EntryTarget } from './counter/order-entry';
import { TablesPanel } from './counter/tables-panel';
import { OrderTile, readTab, saveTab, StateLegend, type BoardTab } from './counter/order-tile';
import { useAdminBrand } from './admin-brand';
import { OrderCard } from './order-card';

const noSubscribe = () => () => undefined;

export type DiningTable = Database['public']['Tables']['dining_tables']['Row'];

// Which status prints which ticket: the KOT when the kitchen accepts (and for each later
// round of a table's dishes), the bill when the food is ready to hand over (ready for
// pickup, or leaving with the driver). A table's bill is printed when the guests ask.
const KOT_STATUSES: OrderStatus[] = ['accepted', 'preparing'];
const BILL_STATUSES: OrderStatus[] = ['ready', 'out_for_delivery'];

export function OrdersBoard({
  initial,
  autoPrint,
  menu,
  tables: initialTables,
}: {
  initial: AdminOrder[];
  autoPrint: { kot: boolean; bill: boolean };
  menu: Menu;
  tables: DiningTable[];
}) {
  const { brandName, orderPrefix } = useAdminBrand();
  const [orders, setOrders] = useState(initial);
  const [tables, setTables] = useState(initialTables);
  const [entry, setEntry] = useState<EntryTarget | null>(null);
  const [openOrderId, setOpenOrderId] = useState<string | null>(null);
  const ordersRef = useRef(orders);
  useEffect(() => {
    ordersRef.current = orders;
  }, [orders]);
  const printDevice = usePrintDevice();
  const [printError, setPrintError] = useState('');
  const autoPrintRef = useRef(autoPrint);
  // Tickets this tab already tried to auto-print, so repeated updates don't re-claim them.
  const handledPrints = useRef(new Set<string>());
  useEffect(() => {
    autoPrintRef.current = autoPrint;
  }, [autoPrint]);
  // Shared clock (0 until hydrated, so server and browser HTML match), ticks every 20 s.
  const now = useNow();
  const [connected, setConnected] = useState(false);
  const [alertsOn, setAlertsOn] = useState(false);
  // Which tab is shown; remembered on this device (read after hydration).
  const storedTab = useSyncExternalStore(noSubscribe, readTab, () => null);
  const [chosenTab, setTab] = useState<BoardTab | null>(null);
  const tab = chosenTab ?? storedTab ?? 'dine_in';
  const chooseTab = (next: BoardTab) => {
    setTab(next);
    saveTab(next);
  };
  const alertsRef = useRef(false);

  const upsert = useCallback((order: Partial<AdminOrder> & { id: string }) => {
    setOrders((list) => {
      const index = list.findIndex((o) => o.id === order.id);
      if (index === -1) return 'order_items' in order ? [order as AdminOrder, ...list] : list;
      const next = [...list];
      next[index] = {
        ...next[index]!,
        ...order,
        order_items: order.order_items ?? next[index]!.order_items,
      };
      return next;
    });
  }, []);

  const maybeAutoPrint = useCallback(
    (order: Partial<Pick<AdminOrder, 'status' | 'type' | 'kot_round'>> & { id: string }) => {
      if (!order.status) return;
      const round = order.kot_round ?? 1;
      const kind =
        autoPrintRef.current.kot && KOT_STATUSES.includes(order.status)
          ? 'kot'
          : autoPrintRef.current.bill &&
              BILL_STATUSES.includes(order.status) &&
              order.type !== 'dine_in'
            ? 'bill'
            : null;
      if (!kind) return;
      const key = kind === 'kot' ? `${order.id}:kot:${round}` : `${order.id}:bill`;
      if (handledPrints.current.has(key)) return;
      handledPrints.current.add(key);
      void printTicket(order.id, kind, { auto: true, round }).then((outcome) => {
        if (typeof outcome === 'object') {
          handledPrints.current.delete(key);
          setPrintError(
            `Could not print the ${kind === 'kot' ? 'KOT' : 'bill'}. Use the Print buttons on the order.`,
          );
        }
      });
    },
    [],
  );

  // The card updates the board straight away; the same update also arrives live below.
  const onCardUpdated = useCallback(
    (order: Partial<AdminOrder> & { id: string }) => {
      upsert(order);
      maybeAutoPrint(order);
    },
    [upsert, maybeAutoPrint],
  );

  const loadOrder = useCallback(
    async (id: string) => {
      const { data } = await browserClient()
        .from('orders')
        .select(ADMIN_ORDER_SELECT)
        .eq('id', id)
        .single();
      if (data) upsert(data as AdminOrder);
      return data as AdminOrder | null;
    },
    [upsert],
  );

  // Live: new and changed orders. Realtime applies RLS, so the connection must carry the
  // signed-in staff member's token, otherwise the database filters every event out.
  useEffect(() => {
    const db = browserClient();
    let channel: ReturnType<typeof db.channel> | null = null;
    let cancelled = false;
    void (async () => {
      const { data } = await db.auth.getSession();
      if (data.session) await db.realtime.setAuth(data.session.access_token);
      if (cancelled) return;
      channel = db
        .channel('kitchen-orders')
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'orders' },
          async (payload) => {
            const order = await loadOrder((payload.new as { id: string }).id);
            // Counter orders start accepted: print their KOT, no "new order" alarm.
            if (order?.source === 'counter') {
              maybeAutoPrint(order);
              return;
            }
            if (order && alertsRef.current) {
              playChime();
              notify(
                `New order ${orderLabel(orderPrefix, order.order_number)}`,
                `${order.type === 'delivery' ? 'Delivery' : 'Pickup'} · ${order.customer_name}`,
              );
            }
          },
        )
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'orders' },
          (payload) => {
            const next = payload.new as AdminOrder;
            const known = ordersRef.current.find((o) => o.id === next.id);
            // New dishes were added (a new KOT round): reload the order with its items.
            if (known && next.kot_round > known.kot_round) {
              void loadOrder(next.id).then((o) => o && maybeAutoPrint(o));
              return;
            }
            upsert(next);
            maybeAutoPrint(next);
          },
        )
        .on('postgres_changes', { event: '*', schema: 'public', table: 'dining_tables' }, () => {
          void db
            .from('dining_tables')
            .select('*')
            .order('sort_order')
            .order('name')
            .then(({ data }) => data && setTables(data));
        })
        .subscribe((status) => setConnected(status === 'SUBSCRIBED'));
    })();
    // Keep the realtime token fresh when the session refreshes.
    const { data: listener } = db.auth.onAuthStateChange((_event, session) => {
      if (session) void db.realtime.setAuth(session.access_token);
    });
    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
      if (channel) void db.removeChannel(channel);
    };
  }, [loadOrder, upsert, maybeAutoPrint, orderPrefix]);

  // Keeps chiming (each clock tick) while an order is still waiting to be accepted.
  const waiting = orders.filter((o) => o.status === 'received');
  useEffect(() => {
    if (alertsRef.current && waiting.length > 0) playChime();
  }, [now, waiting.length]);

  // Tab title shows how many new orders are waiting.
  useEffect(() => {
    document.title = waiting.length
      ? `(${waiting.length}) New order · Kitchen`
      : `Orders · Kitchen · ${brandName}`;
  }, [waiting.length, brandName]);

  // Re-sync after the tablet sleeps or the connection drops.
  useEffect(() => {
    const resync = async () => {
      if (document.visibilityState !== 'visible') return;
      const { data } = await browserClient()
        .from('orders')
        .select(ADMIN_ORDER_SELECT)
        .in('status', OPEN_STATUSES)
        .order('created_at', { ascending: false })
        .limit(200);
      if (data) setOrders(data as AdminOrder[]);
    };
    document.addEventListener('visibilitychange', resync);
    window.addEventListener('online', resync);
    return () => {
      document.removeEventListener('visibilitychange', resync);
      window.removeEventListener('online', resync);
    };
  }, []);

  const enableAlerts = async () => {
    const sound = await unlockAudio();
    await requestNotifications();
    alertsRef.current = sound;
    setAlertsOn(sound);
    if (sound) playChime();
  };

  // A finished order leaves the board, so its window closes too.
  const openOrder = openOrderId
    ? orders.find((o) => o.id === openOrderId && !FINAL_STATUSES.includes(o.status))
    : undefined;
  const addItems = useCallback(
    (order: AdminOrder) =>
      setEntry({
        kind: 'round',
        orderId: order.id,
        label: order.table_label ?? orderLabel(orderPrefix, order.order_number),
      }),
    [orderPrefix],
  );

  // Only open orders are shown; finished ones are in History.
  const open = useMemo(() => orders.filter((o) => !FINAL_STATUSES.includes(o.status)), [orders]);
  const byTime = (a: AdminOrder, b: AdminOrder) =>
    (a.scheduled_for ?? a.created_at).localeCompare(b.scheduled_for ?? b.created_at);
  const tableTabs = open.filter((o) => o.type === 'dine_in');
  const takeaways = open.filter((o) => o.source === 'counter' && o.type !== 'dine_in').sort(byTime);
  const online = open.filter((o) => o.source === 'website').sort(byTime);
  const newOnline = online.filter((o) => o.status === 'received').length;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold">Orders</h1>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex min-h-10 items-center gap-2 rounded-full px-3 text-sm font-semibold',
              connected ? 'bg-ok-soft text-ok' : 'bg-danger-soft text-danger',
            )}
          >
            <span
              aria-hidden
              className={cn('size-2 rounded-full', connected ? 'bg-veg' : 'bg-chili')}
            />
            {connected ? 'Live' : 'Reconnecting…'}
          </span>
          <Link
            href="/admin/printers"
            className={cn(
              'inline-flex min-h-10 items-center rounded-full px-3 text-sm font-semibold',
              printDevice ? 'bg-ok-soft text-ok' : 'bg-soft text-ink-soft',
            )}
          >
            {printDevice ? 'Printing here' : 'Not printing here'}
          </Link>
          <button
            type="button"
            onClick={enableAlerts}
            className={cn(
              'min-h-12 rounded-full px-5 font-bold',
              alertsOn ? 'bg-ok-soft text-ok' : 'bg-gold text-on-gold',
            )}
          >
            {alertsOn ? 'Sound & alerts on' : 'Turn on sound & alerts'}
          </button>
        </div>
      </div>
      {!alertsOn && (
        <p className="bg-gold-soft text-gold-text rounded-lg px-4 py-3">
          Tap <b>Turn on sound & alerts</b> once each time you open this page, so the tablet can
          ring for new orders. Keep this page open during service.
        </p>
      )}

      {printError && (
        <p
          role="alert"
          className="bg-danger-soft text-danger flex flex-wrap items-center justify-between gap-2 rounded-lg px-4 py-3 font-semibold"
        >
          {printError}
          <button type="button" onClick={() => setPrintError('')} className="min-h-10 underline">
            Dismiss
          </button>
        </p>
      )}

      <div role="tablist" aria-label="Order type" className="grid grid-cols-3 gap-2">
        {(
          [
            ['dine_in', 'Dine in', tableTabs.length],
            ['takeaway', 'Takeaway', takeaways.length],
            ['online', 'Online orders', online.length],
          ] as const
        ).map(([key, label, count]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => chooseTab(key)}
            className={cn(
              'relative flex min-h-14 flex-col items-center justify-center gap-x-2 rounded-xl px-2 py-1.5 text-sm font-bold sm:flex-row sm:text-base',
              tab === key ? 'bg-ink text-white' : 'bg-surface shadow-card hover:bg-soft',
            )}
          >
            <span className="whitespace-nowrap">{label}</span>
            <span
              className={cn(
                'tabular grid min-w-7 place-items-center rounded-full px-1.5 text-sm',
                tab === key ? 'bg-white/20' : 'bg-soft',
              )}
            >
              {count}
            </span>
            {key === 'online' && newOnline > 0 && (
              <span className="bg-danger absolute -top-2 -right-1 animate-pulse rounded-full px-2 py-0.5 text-xs text-white">
                {newOnline} new
              </span>
            )}
          </button>
        ))}
      </div>

      <StateLegend tab={tab} />

      <div
        role="tabpanel"
        aria-label={
          tab === 'dine_in' ? 'Dine in' : tab === 'takeaway' ? 'Takeaway' : 'Online orders'
        }
      >
        {tab === 'dine_in' && (
          <TablesPanel
            tables={tables}
            orders={tableTabs}
            now={now}
            onNewTableOrder={(table) =>
              setEntry({ kind: 'table', tableId: table.id, label: table.name })
            }
            onOpenOrder={setOpenOrderId}
          />
        )}
        {tab === 'takeaway' && (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(170px,1fr))] gap-2">
            <li>
              <button
                type="button"
                onClick={() => setEntry({ kind: 'takeaway' })}
                className="border-gold text-gold-text hover:bg-gold-soft grid min-h-28 w-full place-items-center rounded-xl border-2 border-dashed p-3 text-lg font-bold"
              >
                + New takeaway
              </button>
            </li>
            {takeaways.map((o) => (
              <li key={o.id}>
                <OrderTile order={o} now={now} onOpen={() => setOpenOrderId(o.id)} />
              </li>
            ))}
          </ul>
        )}
        {tab === 'online' &&
          (online.length === 0 ? (
            <p className="border-line-strong text-muted rounded-xl border-2 border-dashed p-8 text-center">
              No online orders right now. New ones appear here with a sound.
            </p>
          ) : (
            <ul className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-2">
              {online.map((o) => (
                <li key={o.id}>
                  <OrderTile order={o} now={now} onOpen={() => setOpenOrderId(o.id)} />
                </li>
              ))}
            </ul>
          ))}
      </div>

      {openOrder && !entry && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Order ${orderLabel(orderPrefix, openOrder.order_number)}`}
          className="bg-night/60 fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4"
          onClick={(e) => e.target === e.currentTarget && setOpenOrderId(null)}
        >
          <div className="grid w-full max-w-lg gap-2">
            <button
              type="button"
              onClick={() => setOpenOrderId(null)}
              className="bg-surface justify-self-end rounded-full px-4 py-2 font-semibold"
            >
              Close
            </button>
            <OrderCard
              order={openOrder}
              now={now}
              onUpdated={onCardUpdated}
              onAddItems={addItems}
            />
          </div>
        </div>
      )}

      {entry && (
        <OrderEntry
          menu={menu}
          target={entry}
          onClose={() => setEntry(null)}
          onDone={(result) => {
            setEntry(null);
            // Show the new order (and print its KOT) without waiting for the live update.
            void loadOrder(result.orderId).then((o) => o && maybeAutoPrint(o));
          }}
        />
      )}
    </div>
  );
}
