'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { signOut } from '@/app/admin/_actions/auth';
import { Roundel } from '@/components/brand/logo';
import { cn } from '@/lib/cn';

const LINKS = [
  { href: '/admin', label: 'Orders', owner: false },
  { href: '/admin/history', label: 'History', owner: false },
  { href: '/admin/menu', label: 'Menu', owner: false },
  { href: '/admin/tables', label: 'Tables', owner: true },
  { href: '/admin/printers', label: 'Printers', owner: false },
  { href: '/admin/reports', label: 'Reports', owner: true },
  { href: '/admin/settings', label: 'Settings', owner: true },
  { href: '/admin/staff', label: 'Staff', owner: true },
];

/** The admin menu: a slim top bar; the side menu stays closed until Menu is tapped. */
export function AdminNav({
  role,
  name,
  monogram,
}: {
  role: 'owner' | 'staff';
  name: string;
  monogram: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const links = LINKS.filter((l) => !l.owner || role === 'owner');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const brand = (
    <Link
      href="/admin"
      onClick={() => setOpen(false)}
      className="flex items-center gap-2.5 rounded-md"
    >
      <Roundel monogram={monogram} className="size-9" />
      <span className="font-extrabold">Kitchen</span>
    </Link>
  );

  const menu = (
    <>
      <nav aria-label="Admin" className="flex-1 overflow-y-auto">
        <ul className="grid gap-1">
          {links.map((l) => {
            const active =
              l.href === '/admin' ? pathname === '/admin' : pathname.startsWith(l.href);
            return (
              <li key={l.href}>
                <Link
                  href={l.href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'flex min-h-12 items-center rounded-xl px-3 text-[15px] font-semibold',
                    active
                      ? 'bg-gold text-on-gold'
                      : 'text-on-night-muted hover:text-on-night hover:bg-white/10',
                  )}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="grid gap-2 border-t border-white/10 pt-4 text-sm">
        <span className="text-on-night-muted">
          {name} · {role}
        </span>
        <a
          href="/en"
          target="_blank"
          rel="noreferrer"
          className="text-on-night-muted hover:text-gold underline"
        >
          View site
        </a>
        <form action={signOut}>
          <button
            type="submit"
            className="min-h-11 w-full rounded-xl bg-white/10 px-4 font-semibold hover:bg-white/20"
          >
            Sign out
          </button>
        </form>
      </div>
    </>
  );

  const current = links.find((l) =>
    l.href === '/admin' ? pathname === '/admin' : pathname.startsWith(l.href),
  );

  return (
    <>
      <header className="on-dark bg-night text-on-night sticky top-0 z-40 flex min-h-14 items-center gap-3 px-3">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="admin-menu"
          aria-label="Open the menu"
          onClick={() => setOpen(true)}
          className="grid size-11 place-items-center rounded-xl hover:bg-white/10"
        >
          <svg aria-hidden viewBox="0 0 24 24" className="size-6" fill="none">
            <path
              d="M4 6h16M4 12h16M4 18h16"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </button>
        {current && <span className="font-bold">{current.label}</span>}
      </header>
      {open && (
        <div className="fixed inset-0 z-50" id="admin-menu">
          <button
            type="button"
            aria-label="Close the menu"
            className="bg-night/50 absolute inset-0"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Admin menu"
            className="on-dark bg-night text-on-night absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col gap-6 p-4"
          >
            <div className="flex items-center justify-between gap-2">
              {brand}
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="min-h-11 rounded-xl bg-white/10 px-4 font-semibold hover:bg-white/20"
              >
                Close
              </button>
            </div>
            {menu}
          </div>
        </div>
      )}
    </>
  );
}
