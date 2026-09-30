import 'server-only';
import { z } from 'zod';

const optional = z
  .string()
  .trim()
  .transform((v) => (v === '' ? undefined : v))
  .optional();

const optionalUrl = optional.pipe(z.url().optional());

const serverSchema = z.object({
  SUPABASE_SECRET_KEY: z.string().min(20),
  IP_HASH_SALT: z.string().min(16),
  CRON_SECRET: z.string().min(16),
  SHEET_MENU_CSV_URL: optionalUrl,
  SHEET_CATEGORIES_CSV_URL: optionalUrl,
  SHEET_OPTIONS_CSV_URL: optionalUrl,
  SHEET_HOURS_CSV_URL: optionalUrl,
  SHEET_SETTINGS_CSV_URL: optionalUrl,
  TELEGRAM_BOT_TOKEN: optional,
  TELEGRAM_CHAT_ID: optional,
  RESEND_API_KEY: optional,
  ORDER_EMAIL_FROM: optional,
  ORDER_EMAIL_TO: optional,
  PAYMENT_PROVIDER: optional,
});

export type ServerEnv = z.infer<typeof serverSchema>;

let cached: ServerEnv | undefined;

/** Server-only settings. Validated on first use so a missing secret fails loudly, with its name. */
export function serverEnv(): ServerEnv {
  if (!cached) {
    const result = serverSchema.safeParse(process.env);
    if (!result.success) {
      const names = result.error.issues.map((i) => i.path.join('.')).join(', ');
      throw new Error(
        `Missing or invalid server environment variables: ${names}. See .env.example.`,
      );
    }
    cached = result.data;
  }
  return cached;
}
