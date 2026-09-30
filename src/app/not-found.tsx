import Link from 'next/link';
import '@/app/globals.css';
import { fontVariables } from '@/app/fonts';
import { Roundel } from '@/components/brand/logo';
import { getRestaurant } from '@/lib/data/restaurant';

// 404 for paths outside the language routes (the proxy normally adds /en, /ka or /ru).
export default async function RootNotFound() {
  // A 404 must still render when the database is down.
  const monogram = await getRestaurant()
    .then((r) => r.profile.monogram)
    .catch(() => null);
  return (
    <html lang="en" className={fontVariables}>
      <body className="bg-cream grid min-h-dvh place-items-center px-4 text-center">
        <main className="grid justify-items-center gap-3">
          {monogram && <Roundel monogram={monogram} className="size-24" />}
          <p className="font-display text-gold-text text-7xl">404</p>
          <h1 className="text-3xl font-extrabold">This page isn’t on the menu</h1>
          <p className="text-muted">ეს გვერდი მენიუში არ არის · Этой страницы нет в меню</p>
          <div className="mt-3 flex flex-wrap justify-center gap-3" lang="en">
            <Link
              href="/en/menu"
              className="bg-gold text-on-gold inline-flex min-h-12 items-center rounded-md px-5 font-semibold"
            >
              Menu
            </Link>
            <Link
              href="/ka/menu"
              lang="ka"
              className="bg-soft inline-flex min-h-12 items-center rounded-md px-5 font-semibold"
            >
              მენიუ
            </Link>
            <Link
              href="/ru/menu"
              lang="ru"
              className="bg-soft inline-flex min-h-12 items-center rounded-md px-5 font-semibold"
            >
              Меню
            </Link>
          </div>
        </main>
      </body>
    </html>
  );
}
