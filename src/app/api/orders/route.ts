/** POST /api/orders: see the controller. */
import { createOrder } from '@/controllers/api/orders';

export const dynamic = 'force-dynamic';

export const POST = createOrder;
