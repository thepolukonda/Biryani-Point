/**
 * npm run create-owner -- owner@example.com "Your Name"
 *
 * Creates the first owner account on the Supabase project in .env.local (or the
 * variables in your shell). Prints a random password once; sign in and change it
 * under Admin → Staff. Safe to re-run: an existing account is made owner instead.
 */
import { randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/lib/supabase/database.types';

try {
  process.loadEnvFile?.('.env.local');
} catch {
  // Variables may come from the shell instead.
}

async function main() {
  const [email, name = 'Owner'] = process.argv.slice(2);
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) {
    console.error('Usage: npm run create-owner -- owner@example.com "Your Name"');
    process.exit(1);
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY first.');
  const db = createClient<Database>(url, key, { auth: { persistSession: false } });

  const password = randomBytes(12).toString('base64url');
  let userId: string;
  const created = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (created.data.user) {
    userId = created.data.user.id;
    console.log(`Account created for ${email}.`);
    console.log(`Temporary password (shown once): ${password}`);
  } else {
    const list = await db.auth.admin.listUsers({ perPage: 1000 });
    const existing = list.data?.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (!existing) throw new Error(created.error?.message ?? 'Could not create the account.');
    userId = existing.id;
    console.log(`${email} already has an account; making it an owner (password unchanged).`);
  }

  const { error } = await db
    .from('staff')
    .upsert({ user_id: userId, role: 'owner', display_name: name });
  if (error) throw new Error(error.message);
  console.log('Done. Sign in at /admin/login and change the password under Staff.');
}

main().catch((e: unknown) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
