/**
 * Controllers for the admin pages: each checks who is signed in, then gathers what its
 * page shows. (Form submissions and buttons go to the *.actions.ts controllers.)
 */
import 'server-only';
import { notFound } from 'next/navigation';
import type { I18nText } from '@/shared/domain/i18n-text';
import * as menuAdmin from '@/model-helpers/menu-admin';
import * as kitchen from '@/model-helpers/orders/kitchen';
import { loadPrintSettings, loadTicket, sampleTicket } from '@/model-helpers/printing/ticket-data';
import { reportSummary } from '@/model-helpers/reports/report-data';
import { getMenu, getRestaurant } from '@/model-helpers/restaurant';
import * as settings from '@/model-helpers/settings';
import * as accounts from '@/model-helpers/staff/accounts';
import * as tables from '@/model-helpers/tables';
import { requireOwner, requireStaff } from './guard';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The kitchen board: open orders, auto-print settings, the menu (for counter orders), tables. */
export async function ordersBoardPage() {
  await requireStaff();
  const [orders, print, menu, allTables] = await Promise.all([
    kitchen.openOrders(),
    loadPrintSettings(),
    getMenu(),
    kitchen.allTables(),
  ]);
  return { orders, print, menu, tables: allTables };
}

export async function historyPage(rawQuery: unknown) {
  await requireStaff();
  const { profile, timezone } = await getRestaurant();
  const q = typeof rawQuery === 'string' ? rawQuery.trim().slice(0, 40) : '';
  const orders = await kitchen.searchHistory(q, profile.orderPrefix);
  return { q, orders, orderPrefix: profile.orderPrefix, timezone };
}

export async function menuEditorPage() {
  const user = await requireStaff();
  const data = await menuAdmin.editorData();
  return { ...data, isOwner: user.role === 'owner' };
}

export async function settingsPage() {
  await requireOwner();
  const data = await settings.editorData();
  return {
    ...data,
    dishes: data.dishes.map((d) => ({ slug: d.slug, name: d.name as I18nText })),
  };
}

export async function staffPage() {
  const me = await requireOwner();
  return { members: await accounts.listMembers(), me: me.id };
}

export async function tablesPage() {
  await requireOwner();
  return tables.listWithBusy();
}

export async function printersPage() {
  const user = await requireStaff();
  return { print: await loadPrintSettings(), isOwner: user.role === 'owner' };
}

export { RANGES as REPORT_RANGES } from '@/model-helpers/reports/report-data';

export async function reportsPage(rangeKey: unknown, by: unknown) {
  await requireOwner();
  return reportSummary(
    typeof rangeKey === 'string' ? rangeKey : undefined,
    by === 'week' ? 'week' : 'day',
  );
}

/** A ticket to print: a real order, or a made-up one for test prints ("sample"). */
export async function ticketPage(orderId: string, kind: string) {
  await requireStaff();
  if (kind !== 'kot' && kind !== 'bill') notFound();
  if (orderId !== 'sample' && !UUID.test(orderId)) notFound();
  const ctx = orderId === 'sample' ? await sampleTicket() : await loadTicket(orderId);
  if (!ctx) notFound();
  return { ctx, kind: kind as 'kot' | 'bill' };
}
