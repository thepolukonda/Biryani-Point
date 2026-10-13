import type { Database } from '@/models/db/database.types';

type Tables = Database['public']['Tables'];
export type AdminOrder = Tables['orders']['Row'] & { order_items: Tables['order_items']['Row'][] };
export type OrderStatus = Database['public']['Enums']['order_status'];

export const ADMIN_ORDER_SELECT = '*, order_items(*)';
export const FINAL_STATUSES: OrderStatus[] = ['completed', 'rejected', 'cancelled'];

/** The board shows open orders only; finished ones are on the History page. */
export const OPEN_STATUSES: OrderStatus[] = [
  'received',
  'accepted',
  'preparing',
  'ready',
  'out_for_delivery',
];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  received: 'New',
  accepted: 'Accepted',
  preparing: 'Preparing',
  ready: 'Ready for pickup',
  out_for_delivery: 'Out for delivery',
  completed: 'Completed',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
};

type OrderKind = Pick<AdminOrder, 'type' | 'source' | 'table_label'>;

/** "Delivery", "Pickup" (ordered online), "Takeaway" (at the counter) or "Table 4". */
export function orderKindLabel(order: OrderKind): string {
  if (order.type === 'dine_in') return order.table_label ?? 'Table';
  if (order.type === 'delivery') return 'Delivery';
  return order.source === 'counter' ? 'Takeaway' : 'Pickup';
}

/** Status in words; a served table says "Served", not "Ready for pickup". */
export function statusLabel(order: Pick<AdminOrder, 'status' | 'type'>): string {
  if (order.type === 'dine_in' && order.status === 'ready') return 'Served';
  if (order.type === 'dine_in' && order.status === 'completed') return 'Paid & closed';
  return STATUS_LABEL[order.status];
}

/** Open counter orders can take another round of dishes. */
export function canAddItems(order: Pick<AdminOrder, 'source' | 'status'>): boolean {
  return order.source === 'counter' && ['accepted', 'preparing', 'ready'].includes(order.status);
}

/** The next step buttons offered for an order, in the kitchen's order of work. */
export function nextSteps(
  order: Pick<AdminOrder, 'status' | 'type'>,
): { status: Exclude<OrderStatus, 'received'>; label: string }[] {
  // Table tabs are closed by taking payment ("Bill & pay"), not by a status button.
  if (order.type === 'dine_in') {
    return order.status === 'accepted'
      ? [
          { status: 'preparing', label: 'Start preparing' },
          { status: 'ready', label: 'Served' },
        ]
      : order.status === 'preparing'
        ? [{ status: 'ready', label: 'Served' }]
        : [];
  }
  const delivery = order.type === 'delivery';
  switch (order.status) {
    case 'accepted':
      return [
        { status: 'preparing', label: 'Start preparing' },
        delivery
          ? { status: 'out_for_delivery', label: 'Out for delivery' }
          : { status: 'ready', label: 'Ready for pickup' },
      ];
    case 'preparing':
      return [
        delivery
          ? { status: 'out_for_delivery', label: 'Out for delivery' }
          : { status: 'ready', label: 'Ready for pickup' },
      ];
    case 'ready':
      return [{ status: 'completed', label: 'Picked up' }];
    case 'out_for_delivery':
      return [{ status: 'completed', label: 'Delivered' }];
    default:
      return [];
  }
}

/** Payment can only be changed while an order is in progress (the database enforces it). */
export function canChangePayment(order: Pick<AdminOrder, 'status'>): boolean {
  return ['accepted', 'preparing', 'ready', 'out_for_delivery'].includes(order.status);
}

export const REJECT_REASONS = [
  'We are too busy right now',
  'Outside our delivery area',
  'A dish is sold out',
  'We are closing soon',
  'Could not reach you by phone',
];
