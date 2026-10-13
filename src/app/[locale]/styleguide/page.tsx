// Internal design-system reference (not linked from the site; 404 in production).
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Logo, Roundel } from '@/views/brand/logo';
import { SpiceMeter, VegMark } from '@/views/menu/dietary';
import { Price } from '@/views/menu/price';
import { OpenStatus } from '@/views/restaurant/open-status';
import { Button } from '@/views/ui/button';
import { Field, Input, Textarea } from '@/views/ui/field';
import { loadRestaurant } from '@/controllers/site/shop';
import type { Schedule } from '@/shared/domain/hours';
import { logoBrand } from '@/shared/domain/restaurant';

export const metadata: Metadata = {
  title: 'Design system',
  robots: { index: false, follow: false },
};

const SWATCHES: [name: string, className: string, note: string][] = [
  ['ink', 'bg-ink', 'Text, dark buttons'],
  ['muted', 'bg-muted', 'Secondary text (5.0:1+)'],
  ['faint', 'bg-faint', 'Decoration only, never text'],
  ['cream', 'bg-cream', 'Page background'],
  ['surface', 'bg-surface', 'Cards'],
  ['soft', 'bg-soft', 'Inputs, chips'],
  ['gold', 'bg-gold', 'Brand fill; ink text on it (8.9:1)'],
  ['gold-text', 'bg-gold-text', 'Gold text on light (5.4:1)'],
  ['gold-soft', 'bg-gold-soft', 'Highlights, tags'],
  ['night', 'bg-night', 'Footer, dark sections'],
  ['chili', 'bg-chili', 'Spice, closed'],
  ['veg', 'bg-veg', 'Veg marker'],
  ['nonveg', 'bg-nonveg', 'Non-veg marker'],
  ['whatsapp', 'bg-whatsapp', 'WhatsApp button (white text 5.3:1)'],
];

// A day with no opening hours, to show the "closed" state (in the restaurant's time zone).
const closedSchedule = (timezone: string): Schedule => ({
  timezone,
  hours: [],
  closures: [],
  lastOrderMinutesBeforeClose: 15,
});

export default async function Styleguide({ params }: PageProps<'/[locale]/styleguide'>) {
  // Design reference for developers only; not part of the live site.
  if (process.env.NODE_ENV === 'production') notFound();
  const { locale } = await params;
  setRequestLocale(locale);
  const [t, restaurant] = await Promise.all([getTranslations(), loadRestaurant()]);

  return (
    <main className="mx-auto grid w-[min(1100px,100%-32px)] gap-12 py-10">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <Logo brand={logoBrand(restaurant.profile)} />
        <div className="bg-night rounded-2xl p-4">
          <Logo brand={logoBrand(restaurant.profile)} tone="dark" />
        </div>
        <Roundel
          monogram={restaurant.profile.monogram}
          className="size-24"
          label={restaurant.profile.brandName}
        />
      </header>

      <section>
        <h2 className="mb-4 text-xl font-extrabold">Colours</h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
          {SWATCHES.map(([name, cls, note]) => (
            <li key={name} className="border-line bg-surface overflow-hidden rounded-xl border">
              <div className={`h-16 ${cls}`} />
              <div className="p-3 text-sm">
                <b className="block">{name}</b>
                <span className="text-muted">{note}</span>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-3">
        <h2 className="text-xl font-extrabold">Type: long strings in all three languages</h2>
        <p className="font-display text-4xl" lang="en">
          Biryani worth the wait.
        </p>
        <p className="font-display text-4xl" lang="ka">
          ბირიანი, რომელიც ლოდინად ღირს.
        </p>
        <p className="font-display text-4xl" lang="ru">
          Бирьяни, который стоит ожидания.
        </p>
        <p className="text-lg font-bold" lang="ka">
          ანდჰრული და სამხრეთ ინდური სამზარეულოს რესტორანი · შეკვეთის დაწყება · მიტანის მინიმალური
          შეკვეთაა 30 GEL
        </p>
        <p className="text-lg font-bold" lang="ru">
          Ресторан андхрской и южноиндийской кухни · Минимальный заказ для доставки — 30 GEL
        </p>
        <div className="border-line-strong flex max-w-[360px] flex-wrap gap-2 rounded-lg border border-dashed p-3">
          <Button lang="ka">შეკვეთაში დამატება · 20,00 ₾</Button>
          <Button lang="ru" variant="dark">
            Добавить в заказ · 20,00 GEL
          </Button>
          <p className="text-muted text-xs">360px wide box: buttons wrap instead of overflowing.</p>
        </div>
      </section>

      <section className="grid gap-4">
        <h2 className="text-xl font-extrabold">Buttons</h2>
        <div className="flex flex-wrap gap-3">
          <Button>{t('common.orderOnline')}</Button>
          <Button variant="dark">{t('cart.checkout')}</Button>
          <Button variant="soft">{t('common.viewMenu')}</Button>
          <Button variant="outline">{t('visit.directions')}</Button>
          <Button variant="whatsapp">WhatsApp</Button>
          <Button variant="ghost">{t('common.close')}</Button>
          <Button variant="danger">Reject</Button>
          <Button disabled>{t('common.soldOut')}</Button>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm">Small</Button>
          <Button>Medium</Button>
          <Button size="lg">Large</Button>
          <Button size="icon" variant="soft" aria-label={t('common.add')}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              aria-hidden
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
          </Button>
        </div>
      </section>

      <section className="grid gap-4">
        <h2 className="text-xl font-extrabold">Menu atoms</h2>
        <div className="flex flex-wrap items-center gap-5">
          <span className="inline-flex items-center gap-2">
            <VegMark veg label={t('common.vegLabel')} /> {t('common.veg')}
          </span>
          <span className="inline-flex items-center gap-2">
            <VegMark veg={false} label={t('common.nonVegLabel')} /> {t('common.nonVeg')}
          </span>
          <SpiceMeter level={1} label={t('checkout.mild')} />
          <SpiceMeter level={2} label={t('checkout.medium')} />
          <SpiceMeter level={3} label={t('checkout.spicy')} />
          <Price tetri={2250} />
          <span className="bg-gold-soft text-gold-text rounded-sm px-2 py-0.5 text-xs font-bold">
            {t('common.popular')}
          </span>
          <span className="bg-ink rounded-full px-2.5 py-1 text-xs font-bold text-white">
            {t('common.soldOut')}
          </span>
        </div>
        <div className="flex flex-wrap gap-3">
          <OpenStatus
            schedule={restaurant.schedule}
            initial={{ kind: 'open', until: '23:00', acceptingOrders: true }}
          />
          <OpenStatus
            schedule={closedSchedule(restaurant.timezone)}
            initial={{ kind: 'closed', opensWhen: 'tomorrow', weekday: 'tue', time: '12:00' }}
          />
        </div>
      </section>

      <section className="grid max-w-md gap-4">
        <h2 className="text-xl font-extrabold">Form fields</h2>
        <Field label={t('checkout.name')}>{(p) => <Input {...p} autoComplete="name" />}</Field>
        <Field
          label={t('checkout.phone')}
          hint="+995 5XX XX XX XX"
          error={t('checkout.missing', { f: t('checkout.missingPhone') })}
        >
          {(p) => <Input {...p} type="tel" inputMode="tel" defaultValue="12345" />}
        </Field>
        <Field label={t('checkout.notes')} optionalLabel={t('common.optional')}>
          {(p) => <Textarea {...p} placeholder={t('checkout.notesPlaceholder')} />}
        </Field>
      </section>
    </main>
  );
}
