/** POST /api/payments/<provider>/webhook: see the controller. */
import { receiveWebhook } from '@/controllers/api/payments';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  ctx: RouteContext<'/api/payments/[provider]/webhook'>,
) {
  return receiveWebhook(request, (await ctx.params).provider);
}
