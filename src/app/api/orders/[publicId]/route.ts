/** GET /api/orders/<publicId>: see the controller. */
import { showOrder } from '@/controllers/api/orders';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, ctx: RouteContext<'/api/orders/[publicId]'>) {
  return showOrder((await ctx.params).publicId);
}
