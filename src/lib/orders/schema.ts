/**
 * The checkout request, validated with the same schema in the browser (for
 * field errors) and on the server (which trusts nothing else). Prices and totals
 * are deliberately absent: the server works them out.
 */
import { z } from 'zod';
import { LOCALES } from '@/lib/domain/i18n-text';
import { normaliseCustomerPhone } from '@/lib/domain/phone';
import { MAX_LINES, MAX_QUANTITY_PER_LINE } from '@/lib/domain/pricing';

const slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
  .max(80);

export const cartLineSchema = z.object({
  itemSlug: slug,
  quantity: z.number().int().min(1).max(MAX_QUANTITY_PER_LINE),
  options: z.array(z.object({ group: slug, option: slug })).max(20),
  notes: z.string().trim().max(200).optional(),
});

export const PAYMENT_METHODS = ['cash', 'pay_at_pickup', 'online'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const orderRequestSchema = z
  .object({
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,100}$/),
    locale: z.enum(LOCALES),
    type: z.enum(['delivery', 'pickup']),
    name: z.string().trim().min(1, 'required').max(80, 'too_long'),
    phone: z
      .string()
      .trim()
      .min(1, 'required')
      .refine((v) => normaliseCustomerPhone(v) !== null, 'invalid_phone'),
    addressText: z.string().trim().max(300, 'too_long').optional(),
    location: z
      .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
      .optional(),
    when: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('asap') }),
      z.object({ kind: z.literal('scheduled'), at: z.iso.datetime({ offset: true }) }),
    ]),
    paymentMethod: z.enum(PAYMENT_METHODS),
    notes: z.string().trim().max(500, 'too_long').optional(),
    lines: z.array(cartLineSchema).min(1, 'empty_cart').max(MAX_LINES),
    /** Honeypot: a hidden field people never see. Bots fill it in. */
    website: z.string().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.type === 'delivery' && !value.addressText && !value.location) {
      ctx.addIssue({ code: 'custom', path: ['addressText'], message: 'address_required' });
    }
  });

export type OrderRequest = z.infer<typeof orderRequestSchema>;

/** Field name -> first error code, for showing messages next to inputs. */
export function fieldErrors(error: z.ZodError): Partial<Record<string, string>> {
  const out: Partial<Record<string, string>> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? 'form');
    out[key] ??= issue.message && /^[a-z_]+$/.test(issue.message) ? issue.message : 'invalid';
  }
  return out;
}
