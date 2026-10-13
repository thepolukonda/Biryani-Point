'use client';

import { useActionState } from 'react';
import { signIn, type SignInState } from '@/controllers/admin/auth.actions';

const input =
  'w-full rounded-md border-[1.5px] border-transparent bg-soft px-3.5 py-3 text-base focus:border-gold-text focus:bg-surface focus:outline-none';

export function LoginForm() {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, {});
  return (
    <form action={action} className="mt-6 grid gap-4">
      <label className="grid gap-1.5 text-sm font-semibold">
        Email
        <input name="email" type="email" autoComplete="username" required className={input} />
      </label>
      <label className="grid gap-1.5 text-sm font-semibold">
        Password
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={input}
        />
      </label>
      {state.error && (
        <p
          role="alert"
          className="bg-danger-soft text-danger rounded-md px-3 py-2.5 text-sm font-semibold"
        >
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="bg-ink min-h-12 rounded-md font-semibold text-white hover:bg-black disabled:opacity-60"
      >
        {pending ? 'Signing in…' : 'Sign in'}
      </button>
    </form>
  );
}
