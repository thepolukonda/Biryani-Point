/**
 * Controller for the customer pages: what the menu, cart, checkout, tracking and legal pages
 * (and the icons, manifest and share images) read. Read-only; orders are placed through
 * POST /api/orders (controllers/api/orders.ts).
 */
import 'server-only';
import type { Locale } from '@/shared/domain/i18n-text';
import { getPublicOrder } from '@/model-helpers/orders/public-order';
import { onlinePaymentsEnabled } from '@/model-helpers/payments/registry';
import { getBrand, getMenu, getRestaurant } from '@/model-helpers/restaurant';

/** Restaurant details, hours and fees (cached; refreshed when they change). */
export const loadRestaurant = getRestaurant;

/** The visible menu with today's availability. */
export const loadMenu = getMenu;

/** The business profile's texts in one language (name, address, SEO texts). */
export const loadBrand = (locale: Locale) => getBrand(locale);

/** The public view of an order for its tracking page, or null. */
export const loadTrackedOrder = getPublicOrder;

/** Whether checkout may offer card payment online. */
export const canPayOnline = onlinePaymentsEnabled;
