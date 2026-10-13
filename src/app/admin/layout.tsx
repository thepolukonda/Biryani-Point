import type { Metadata, Viewport } from 'next';
import type { ReactNode } from 'react';
import { fontVariables } from '@/app/fonts';
import { loadRestaurant } from '@/controllers/site/shop';

export async function generateMetadata(): Promise<Metadata> {
  const { brandName } = (await loadRestaurant()).profile;
  return {
    title: { default: `Kitchen · ${brandName}`, template: `%s · Kitchen · ${brandName}` },
    robots: { index: false, follow: false },
  };
}

export const viewport: Viewport = { themeColor: '#0a0a0a', width: 'device-width', initialScale: 1 };

// The admin panel is in English (staff UI). Customer pages have their own layout per language.
export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={fontVariables}>
      <body className="bg-soft min-h-dvh">{children}</body>
    </html>
  );
}
