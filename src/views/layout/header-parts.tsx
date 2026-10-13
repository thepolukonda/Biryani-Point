'use client';

import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { useCartCount, useCartPricing, useShop } from '@/views/providers/shop-provider';
import { BagIcon, CloseIcon, MenuIcon } from '@/views/ui/icons';
import { Link, usePathname } from '@/config/i18n/navigation';
import { cn } from '@/shared/cn';
import type { Locale } from '@/shared/domain/i18n-text';
import { formatGel } from '@/shared/domain/money';
import { LanguageSwitcher } from './language-switcher';

export function CartButton() {
  const t = useTranslations('common');
  const count = useCartCount();
  const { openDrawer } = useShop();
  const [bump, setBump] = useState(false);
  const previous = useRef(count);

  useEffect(() => {
    if (count > previous.current) {
      setBump(true);
      const id = window.setTimeout(() => setBump(false), 400);
      previous.current = count;
      return () => window.clearTimeout(id);
    }
    previous.current = count;
  }, [count]);

  return (
    <button
      type="button"
      onClick={openDrawer}
      aria-label={t('cartButton', { count })}
      className={cn(
        'bg-ink inline-flex h-11 items-center gap-2 rounded-full pr-1.5 pl-3.5 text-sm font-semibold text-white [&_svg]:size-[18px]',
        bump && 'animate-bump',
      )}
    >
      <BagIcon />
      <span className="hidden sm:inline" aria-hidden>
        {t('order')}
      </span>
      <span
        aria-hidden
        className="tabular bg-gold text-on-gold grid h-8 min-w-8 place-items-center rounded-full px-2 text-[13px] font-extrabold"
      >
        {count}
      </span>
    </button>
  );
}

const NAV = [
  { href: '/', key: 'home' },
  { href: '/menu', key: 'menu' },
  { href: '/#visit', key: 'visit' },
] as const;

export function MainNav() {
  const t = useTranslations();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const link = (item: (typeof NAV)[number], mobile = false) => {
    const current = item.href === pathname;
    return (
      <Link
        key={item.key}
        href={item.href}
        aria-current={current ? 'page' : undefined}
        onClick={() => setOpen(false)}
        className={cn(
          'hover:bg-soft rounded-full font-semibold transition-colors',
          mobile
            ? 'flex min-h-12 items-center px-4 text-base'
            : 'inline-flex min-h-11 items-center px-3.5 text-sm',
          current ? 'text-ink' : 'text-muted hover:text-ink',
        )}
      >
        {t(`nav.${item.key}`)}
      </Link>
    );
  };

  return (
    <>
      <nav aria-label={t('common.mainNavigation')} className="hidden md:block">
        <ul className="flex gap-1">
          {NAV.map((item) => (
            <li key={item.key}>{link(item)}</li>
          ))}
        </ul>
      </nav>
      <div className="relative md:hidden">
        <button
          type="button"
          aria-expanded={open}
          aria-controls="mobile-nav"
          aria-label={t(open ? 'common.closeNavigation' : 'common.openNavigation')}
          onClick={() => setOpen((o) => !o)}
          className="bg-soft grid size-11 place-items-center rounded-full [&_svg]:size-5"
        >
          {open ? <CloseIcon /> : <MenuIcon />}
        </button>
        <div
          ref={panel}
          id="mobile-nav"
          hidden={!open}
          className="border-line bg-surface shadow-lift absolute top-13 right-0 z-50 w-56 rounded-xl border p-2"
        >
          <nav aria-label={t('common.mainNavigation')}>
            <ul>
              {NAV.map((item) => (
                <li key={item.key}>{link(item, true)}</li>
              ))}
            </ul>
          </nav>
          <LanguageSwitcher className="border-line mt-2 w-full border-t pt-2 sm:hidden [&_select]:w-full" />
        </div>
      </div>
    </>
  );
}

/** Sticky "Review order · 2 items · GEL 40.00" bar on phones and tablets. */
export function BottomCartBar() {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  const pricing = useCartPricing();
  const { openDrawer, drawerOpen } = useShop();
  const pathname = usePathname();
  const hidden =
    pricing.count === 0 ||
    drawerOpen ||
    ['/cart', '/checkout'].includes(pathname) ||
    pathname.startsWith('/order/');

  return (
    <div
      className={cn(
        'to-surface fixed inset-x-0 bottom-0 z-40 bg-gradient-to-b from-transparent to-30% px-4 pt-3 transition-transform duration-300 lg:hidden',
        'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
        hidden && 'pointer-events-none translate-y-[110%]',
      )}
      aria-hidden={hidden || undefined}
    >
      <button
        type="button"
        onClick={openDrawer}
        tabIndex={hidden ? -1 : undefined}
        className="bg-gold text-on-gold shadow-gold mx-auto flex h-14 w-full max-w-[640px] items-center justify-between gap-3 rounded-lg px-4 text-base font-bold"
      >
        <span className="tabular bg-on-gold/15 grid h-8 min-w-8 place-items-center rounded-md px-1.5 font-extrabold">
          {pricing.count}
        </span>
        <span className="flex-1 text-left">{t('cart.reviewBar')}</span>
        <span className="tabular">{formatGel(pricing.totalTetri, locale)}</span>
      </button>
    </div>
  );
}

/** Visible toast plus a polite live region for screen readers. */
export function Announcer() {
  const { toast, liveMessage } = useShop();
  return (
    <>
      <div aria-live="polite" aria-atomic="true" className="sr-only">
        {liveMessage}
      </div>
      {toast && (
        <div
          key={toast.id}
          aria-hidden
          className="animate-toast bg-ink shadow-lift pointer-events-none fixed top-[calc(4.75rem+env(safe-area-inset-top))] left-1/2 z-[70] max-w-[calc(100%-32px)] -translate-x-1/2 truncate rounded-md px-4 py-3 text-sm font-semibold text-white"
        >
          <span className="text-gold mr-2 font-extrabold">✓</span>
          {toast.message}
        </div>
      )}
    </>
  );
}
