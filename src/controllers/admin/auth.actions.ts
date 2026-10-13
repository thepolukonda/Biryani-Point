'use server';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { reportError } from '@/shared/monitoring';
import { clientIp } from '@/shared/request';
import * as signInHelper from '@/model-helpers/staff/sign-in';

const credentials = z.object({
  email: z.email(),
  password: z.string().min(1).max(200),
});

export type SignInState = { error?: string };

const SIGN_IN_ERRORS = {
  locked: 'Too many wrong attempts. Wait 15 minutes and try again.',
  wrong_password: 'Wrong email or password.',
  not_staff: 'This account is not set up as staff. Ask the owner to add you.',
} as const;

export async function signIn(_prev: SignInState, form: FormData): Promise<SignInState> {
  const parsed = credentials.safeParse({
    email: form.get('email'),
    password: form.get('password'),
  });
  if (!parsed.success) return { error: 'Enter your email and password.' };

  const { email, password } = parsed.data;
  const result = await signInHelper.signIn(email, password, clientIp(await headers()));
  if (!result.ok) return { error: SIGN_IN_ERRORS[result.reason] };
  redirect('/admin');
}

export async function signOut() {
  await signInHelper.signOut();
  redirect('/admin/login');
}

const passwordSchema = z.object({ password: z.string().min(10).max(200) });

export async function changeOwnPassword(
  _prev: { message?: string; error?: string },
  form: FormData,
) {
  const parsed = passwordSchema.safeParse({ password: form.get('password') });
  if (!parsed.success) return { error: 'Use at least 10 characters.' };
  try {
    await signInHelper.changeOwnPassword(parsed.data.password);
    return { message: 'Password changed.' };
  } catch (e) {
    reportError(e, { where: 'changeOwnPassword' });
    return { error: 'Could not change the password. Sign in again and retry.' };
  }
}
