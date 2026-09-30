'use client';

import { useLocale, useTranslations } from 'next-intl';
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { cartStore, defaultOptions, type CartState } from '@/lib/cart/store';
import { pickText, type Locale } from '@/lib/domain/i18n-text';
import type { Menu, MenuItem } from '@/lib/domain/menu';
import { priceOrder, type PricedOrder } from '@/lib/domain/pricing';
import type { RestaurantInfo } from '@/lib/domain/restaurant';

type SheetState = { itemSlug: string; editKey?: string } | null;

type ShopContextValue = {
  menu: Menu;
  itemsBySlug: ReadonlyMap<string, MenuItem>;
  restaurant: RestaurantInfo;
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  sheet: SheetState;
  openItem: (itemSlug: string, editKey?: string) => void;
  closeItem: () => void;
  /** Screen-reader announcement + visible toast. */
  announce: (message: string, options?: { toast?: boolean }) => void;
  toast: { id: number; message: string } | null;
  liveMessage: string;
};

const ShopContext = createContext<ShopContextValue | null>(null);

export function ShopProvider({
  menu,
  restaurant,
  children,
}: {
  menu: Menu;
  restaurant: RestaurantInfo;
  children: ReactNode;
}) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null);
  const [liveMessage, setLiveMessage] = useState('');
  const toastTimer = useRef<number | undefined>(undefined);

  const itemsBySlug = useMemo(() => new Map(menu.items.map((i) => [i.slug, i])), [menu]);

  const announce = useCallback((message: string, options?: { toast?: boolean }) => {
    // Clearing first makes screen readers repeat identical messages.
    setLiveMessage('');
    window.setTimeout(() => setLiveMessage(message), 30);
    if (options?.toast !== false) {
      setToast({ id: Date.now(), message });
      window.clearTimeout(toastTimer.current);
      toastTimer.current = window.setTimeout(() => setToast(null), 2600);
    }
  }, []);

  const value = useMemo<ShopContextValue>(
    () => ({
      menu,
      itemsBySlug,
      restaurant,
      drawerOpen,
      openDrawer: () => setDrawerOpen(true),
      closeDrawer: () => setDrawerOpen(false),
      sheet,
      openItem: (itemSlug, editKey) => setSheet({ itemSlug, ...(editKey ? { editKey } : {}) }),
      closeItem: () => setSheet(null),
      announce,
      toast,
      liveMessage,
    }),
    [menu, itemsBySlug, restaurant, drawerOpen, sheet, announce, toast, liveMessage],
  );

  return <ShopContext.Provider value={value}>{children}</ShopContext.Provider>;
}

export function useShop(): ShopContextValue {
  const value = useContext(ShopContext);
  if (!value) throw new Error('useShop must be used inside <ShopProvider>');
  return value;
}

export function useCart(): CartState {
  return useSyncExternalStore(
    cartStore.subscribe,
    cartStore.getSnapshot,
    cartStore.getServerSnapshot,
  );
}

export function useCartCount(): number {
  return useCart().lines.reduce((sum, l) => sum + l.quantity, 0);
}

/** Running totals for the cart, from the current menu. (The server recalculates at checkout.) */
export function useCartPricing(): PricedOrder & { count: number } {
  const cart = useCart();
  const { itemsBySlug, restaurant } = useShop();
  return useMemo(() => {
    const priced = priceOrder({
      lines: cart.lines,
      menu: itemsBySlug,
      orderType: cart.orderType,
      fees: restaurant.fees,
    });
    // An empty cart isn't an error while browsing.
    const problems = priced.problems.filter((p) => p.code !== 'empty_cart');
    return { ...priced, problems, count: cart.lines.reduce((s, l) => s + l.quantity, 0) };
  }, [cart, itemsBySlug, restaurant.fees]);
}

/** "+" on a dish: add with default options, or open the dish sheet if a choice is needed. */
export function useQuickAdd() {
  const { itemsBySlug, openItem, announce } = useShop();
  const t = useTranslations('menu');
  const locale = useLocale() as Locale;

  return useCallback(
    (itemSlug: string) => {
      const item = itemsBySlug.get(itemSlug);
      if (!item || !item.isAvailable) return;
      const options = defaultOptions(item);
      if (!options) {
        openItem(itemSlug);
        return;
      }
      cartStore.add({ itemSlug, quantity: 1, options });
      const name = pickText(item.name, locale);
      const chosen = options
        .map((o) => {
          const group = item.modifierGroups.find((g) => g.slug === o.group);
          const option = group?.options.find((x) => x.slug === o.option);
          return option ? pickText(option.name, locale) : null;
        })
        .filter(Boolean)
        .join(', ');
      announce(chosen ? t('addedWith', { n: name, options: chosen }) : t('added', { n: name }));
    },
    [itemsBySlug, openItem, announce, t, locale],
  );
}

/** The logo letters, for dish photo placeholders. */
export function useMonogram(): string {
  return useShop().restaurant.profile.monogram;
}
