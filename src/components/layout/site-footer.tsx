import { useLocale, useTranslations } from 'next-intl';
import { Logo } from '@/components/brand/logo';
import { MailIcon, PhoneIcon, PinIcon, WhatsAppIcon } from '@/components/ui/icons';
import { Link } from '@/i18n/navigation';
import { formatGeorgianPhone } from '@/lib/domain/phone';
import type { Locale } from '@/lib/domain/i18n-text';
import { logoBrand, profileText, type RestaurantInfo } from '@/lib/domain/restaurant';
import { directionsUrl, whatsappUrl } from '@/lib/links';

export function SiteFooter({ restaurant }: { restaurant: RestaurantInfo }) {
  const t = useTranslations();
  const brand = profileText(restaurant.profile, useLocale() as Locale);
  const { social, email } = restaurant.profile;
  const socialLinks = [
    ['Instagram', social.instagram],
    ['Facebook', social.facebook],
    ['TikTok', social.tiktok],
  ].filter((l): l is [string, string] => Boolean(l[1]));
  const year = new Date().getFullYear();
  const linkClass = 'inline-flex min-h-11 items-center gap-2 hover:text-gold [&_svg]:size-4';

  return (
    <footer className="on-dark bg-night text-on-night-muted pt-12 pb-[calc(2.5rem+env(safe-area-inset-bottom))] max-lg:pb-32">
      <div className="mx-auto grid w-[min(1240px,100%-32px)] gap-10 md:grid-cols-[1.3fr_1fr_1fr]">
        <div>
          <Logo brand={logoBrand(restaurant.profile)} tone="dark" />
          {brand.tagline && <p className="mt-4 text-sm leading-relaxed">{brand.tagline}</p>}
          <address className="mt-3 text-sm leading-relaxed not-italic">
            {brand.street && (
              <>
                {brand.street}
                <br />
              </>
            )}
            {brand.cityLine}
          </address>
          {socialLinks.length > 0 && (
            <nav aria-label={t('nav.follow')} className="mt-3">
              <ul className="flex flex-wrap gap-x-4 text-sm">
                {socialLinks.map(([label, href]) => (
                  <li key={label}>
                    <a href={href} className={linkClass} target="_blank" rel="noopener noreferrer">
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>

        <div>
          <h2 className="text-on-night mb-3 text-sm font-bold tracking-wide uppercase">
            {t('footer.contact')}
          </h2>
          <ul className="grid text-sm">
            <li>
              <a href={`tel:${restaurant.phone}`} className={linkClass}>
                <PhoneIcon />
                {formatGeorgianPhone(restaurant.phone)}
              </a>
            </li>
            <li>
              <a
                href={whatsappUrl(restaurant.whatsapp)}
                className={linkClass}
                target="_blank"
                rel="noopener noreferrer"
              >
                <WhatsAppIcon />
                WhatsApp
              </a>
            </li>
            {email && (
              <li>
                <a href={`mailto:${email}`} className={linkClass}>
                  <MailIcon />
                  {email}
                </a>
              </li>
            )}
            <li>
              <a
                href={directionsUrl(restaurant.location)}
                className={linkClass}
                target="_blank"
                rel="noopener noreferrer"
              >
                <PinIcon />
                {t('visit.directions')}
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h2 className="text-on-night mb-3 text-sm font-bold tracking-wide uppercase">
            {t('footer.order')}
          </h2>
          <ul className="grid text-sm">
            <li>
              <Link href="/menu" className={linkClass}>
                {t('nav.menu')}
              </Link>
            </li>
            <li>
              <Link href="/privacy" className={linkClass}>
                {t('legal.privacy')}
              </Link>
            </li>
            <li>
              <Link href="/terms" className={linkClass}>
                {t('legal.terms')}
              </Link>
            </li>
            <li>
              <Link href="/refunds" className={linkClass}>
                {t('legal.refunds')}
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <p className="text-on-night-muted mx-auto mt-10 w-[min(1240px,100%-32px)] border-t border-white/10 pt-5 text-xs">
        {t('footer.rights', { year, name: brand.siteName })}
      </p>
    </footer>
  );
}
