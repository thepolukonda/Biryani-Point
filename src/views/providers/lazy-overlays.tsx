'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { useShop } from './shop-provider';

// The cart drawer and dish sheet are only needed after a tap, so their code is
// loaded when the browser is idle (or at the first tap) instead of up front.
const CartDrawer = dynamic(() => import('@/views/cart/cart-drawer').then((m) => m.CartDrawer), {
  ssr: false,
});
const ItemSheet = dynamic(() => import('@/views/menu/item-sheet').then((m) => m.ItemSheet), {
  ssr: false,
});

export function LazyOverlays() {
  const { drawerOpen, sheet } = useShop();
  const [idle, setIdle] = useState(false);

  useEffect(() => {
    const load = () => setIdle(true);
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(load, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(load, 2500);
    return () => window.clearTimeout(id);
  }, []);

  const needed = idle || drawerOpen || sheet !== null;
  if (!needed) return null;
  return (
    <>
      <CartDrawer />
      <ItemSheet />
    </>
  );
}
