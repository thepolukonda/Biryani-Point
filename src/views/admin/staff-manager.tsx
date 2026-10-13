'use client';

import { useActionState, useState, useTransition } from 'react';
import { changeOwnPassword } from '@/controllers/admin/auth.actions';
import {
  addStaff,
  removeStaff,
  resetPassword,
  setRole,
  type FormState,
} from '@/controllers/admin/staff.actions';
import { Card, FormMessage, inputClass, Labeled, SubmitButton } from './ui';

export type StaffMember = {
  userId: string;
  name: string;
  email: string;
  role: 'owner' | 'staff';
  lastSignIn: string | null;
};

export function StaffManager({ members, me }: { members: StaffMember[]; me: string }) {
  const [addState, add, adding] = useActionState<FormState, FormData>(addStaff, {});
  const [pwState, changePw, changing] = useActionState<
    { message?: string; error?: string },
    FormData
  >(changeOwnPassword, {});
  const [pending, start] = useTransition();
  const [rowState, setRowState] = useState<Record<string, FormState>>({});

  const run = (userId: string, fn: () => Promise<FormState>) =>
    start(async () => {
      const result = await fn();
      setRowState((s) => ({ ...s, [userId]: result }));
    });

  return (
    <div className="grid gap-5">
      <h1 className="text-2xl font-extrabold">Staff</h1>
      <Card
        title="People who can sign in"
        description="Staff see orders, history and the menu (and can mark dishes sold out). Owners see everything."
      >
        <ul className="grid gap-3">
          {members.map((m) => (
            <li key={m.userId} className="bg-soft grid gap-2 rounded-lg p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  <b>{m.name}</b>{' '}
                  {m.userId === me && <span className="text-muted text-sm">(you)</span>}
                  <span className="text-muted block text-sm">
                    {m.email}
                    {m.lastSignIn &&
                      ` · last signed in ${new Date(m.lastSignIn).toLocaleDateString('en-GB')}`}
                  </span>
                </span>
                <div className="flex flex-wrap gap-2">
                  <label className="sr-only" htmlFor={`role-${m.userId}`}>
                    Role for {m.name}
                  </label>
                  <select
                    id={`role-${m.userId}`}
                    value={m.role}
                    disabled={pending}
                    onChange={(e) =>
                      run(m.userId, () => setRole(m.userId, e.target.value as 'owner' | 'staff'))
                    }
                    className={`${inputClass} w-auto`}
                  >
                    <option value="staff">Staff</option>
                    <option value="owner">Owner</option>
                  </select>
                  {m.userId !== me && (
                    <>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() => {
                          const pw = window.prompt(
                            `New password for ${m.name} (at least 10 characters):`,
                          );
                          if (pw) run(m.userId, () => resetPassword(m.userId, pw));
                        }}
                        className="bg-surface min-h-11 rounded-md px-3 text-sm font-semibold"
                      >
                        Reset password
                      </button>
                      <button
                        type="button"
                        disabled={pending}
                        onClick={() =>
                          window.confirm(
                            `Remove ${m.name}? They will no longer be able to sign in.`,
                          ) && run(m.userId, () => removeStaff(m.userId))
                        }
                        className="text-danger min-h-11 rounded-md px-3 text-sm font-semibold"
                      >
                        Remove
                      </button>
                    </>
                  )}
                </div>
              </div>
              {rowState[m.userId] && <FormMessage state={rowState[m.userId]!} />}
            </li>
          ))}
        </ul>
      </Card>

      <Card
        title="Add someone"
        description="Creates their login straight away. Share the password in person, and ask them to keep it private."
      >
        <form action={add} className="grid gap-3 sm:grid-cols-2">
          <Labeled label="Name">
            <input name="name" required className={inputClass} />
          </Labeled>
          <Labeled label="Email">
            <input name="email" type="email" required autoComplete="off" className={inputClass} />
          </Labeled>
          <Labeled label="Role">
            <select name="role" defaultValue="staff" className={inputClass}>
              <option value="staff">Staff (orders and menu)</option>
              <option value="owner">Owner (everything)</option>
            </select>
          </Labeled>
          <Labeled label="Password" hint="At least 10 characters">
            <input
              name="password"
              type="text"
              required
              minLength={10}
              autoComplete="new-password"
              className={inputClass}
            />
          </Labeled>
          <div className="grid gap-2 sm:col-span-2">
            <FormMessage state={addState} />
            <SubmitButton pending={adding}>Add</SubmitButton>
          </div>
        </form>
      </Card>

      <Card title="Change my password">
        <form action={changePw} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <Labeled label="New password" hint="At least 10 characters">
            <input
              name="password"
              type="password"
              required
              minLength={10}
              autoComplete="new-password"
              className={inputClass}
            />
          </Labeled>
          <SubmitButton pending={changing}>Change password</SubmitButton>
          <div className="sm:col-span-2">
            <FormMessage state={pwState} />
          </div>
        </form>
      </Card>
    </div>
  );
}
