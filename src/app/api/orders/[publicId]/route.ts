/** GET /api/orders/<publicId>: the public view of one order (tracking page fallback polling). */
import { NextResponse } from 'next/server';
import { getPublicOrder } from '@/lib/data/public-order';

export const dynamic = 'force-dynamic';

export async function GET(_request: Request, ctx: RouteContext<'/api/orders/[publicId]'>) {
  const { publicId } = await ctx.params;
  const order = await getPublicOrder(publicId);
  if (!order) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(order, { headers: { 'cache-control': 'no-store' } });
}
