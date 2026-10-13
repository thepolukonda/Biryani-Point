import { ImageResponse } from 'next/og';
import { profileText, type BusinessProfile } from '@/shared/domain/restaurant';
import type { Locale } from '@/shared/domain/i18n-text';

export const OG_SIZE = { width: 1200, height: 630 };

const GOLD = '#e9a72d';
const NIGHT = '#0a0a0a';

/** The round logo as an image-renderer element: black disc, gold ring, monogram. */
export function monogramDisc(monogram: string, disc: number, ring = disc * 0.035) {
  return (
    <div
      style={{
        width: disc,
        height: disc,
        borderRadius: 9999,
        background: NIGHT,
        border: `${Math.round(ring)}px solid ${GOLD}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: GOLD,
        fontSize: disc * (monogram.length > 2 ? 0.3 : 0.4),
        fontWeight: 800,
        fontFamily: 'sans-serif',
      }}
    >
      {monogram}
    </div>
  );
}

/** A square app icon or favicon with the monogram. */
export function iconImage(
  profile: BusinessProfile,
  size: number,
  { maskable = false }: { maskable?: boolean } = {},
) {
  // Maskable icons need their artwork inside the central 80% "safe zone".
  const disc = maskable ? size * 0.62 : size * 0.96;
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: maskable ? NIGHT : 'transparent',
      }}
    >
      {monogramDisc(profile.monogram, disc)}
    </div>,
    { width: size, height: size },
  );
}

/** e.g. "Biryani Point Batumi: Andhra & South Indian kitchen" */
export function brandCardAlt(profile: BusinessProfile, locale: Locale = 'en') {
  const text = profileText(profile, locale);
  return [text.siteName, text.tagline].filter(Boolean).join(': ');
}

/**
 * Brand card used as the Open Graph / Twitter image. English text only: the
 * built-in image renderer has no Georgian font, and a clean brand card reads in
 * every language.
 */
export function brandCard(profile: BusinessProfile) {
  const en = profileText(profile, 'en');
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 60,
        padding: '0 90px',
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1712 60%, #3a2708 100%)',
        color: '#f5f1e8',
        fontFamily: 'sans-serif',
      }}
    >
      {monogramDisc(profile.monogram, 260, 10)}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
        {en.city && (
          <div style={{ fontSize: 30, letterSpacing: 6, color: GOLD, fontWeight: 700 }}>
            {en.city.toUpperCase()}
          </div>
        )}
        <div style={{ fontSize: 82, fontWeight: 900, lineHeight: 1 }}>{profile.brandName}</div>
        {en.specialties && <div style={{ fontSize: 36, color: '#b5b0a6' }}>{en.specialties}</div>}
        <div
          style={{
            marginTop: 20,
            display: 'flex',
            alignSelf: 'flex-start',
            padding: '14px 28px',
            borderRadius: 14,
            background: GOLD,
            color: '#1a1208',
            fontSize: 32,
            fontWeight: 800,
          }}
        >
          Order online · Delivery & pickup
        </div>
      </div>
    </div>,
    OG_SIZE,
  );
}
