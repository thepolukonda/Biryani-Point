/** PNG app icons for the web app manifest: /icons/192, /icons/512, /icons/maskable. */
import { loadRestaurant } from '@/controllers/site/shop';
import { iconImage } from '@/shared/seo/og-image';

// Rebuilt at most hourly, so a new monogram shows up without a redeploy.
export const revalidate = 3600;

const VARIANTS = { '192': 192, '512': 512, maskable: 512 } as const;

export function generateStaticParams() {
  return Object.keys(VARIANTS).map((variant) => ({ variant }));
}

export async function GET(_request: Request, ctx: RouteContext<'/icons/[variant]'>) {
  const { variant } = await ctx.params;
  const size = VARIANTS[variant as keyof typeof VARIANTS];
  if (!size) return new Response('Not found', { status: 404 });
  const { profile } = await loadRestaurant();
  return iconImage(profile, size, { maskable: variant === 'maskable' });
}
