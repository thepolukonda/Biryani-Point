'use client';

/**
 * Browser-side controller for the kitchen board: live updates and re-reading orders and
 * tables. Changes to orders go through the server actions in controllers/admin.
 */
export {
  fetchOpenOrders,
  fetchOrder,
  fetchTables,
  watchKitchen,
  type KitchenEvents,
} from '@/model-helpers/browser/live';
