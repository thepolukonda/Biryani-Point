import Script from 'next/script';
import { publicEnv } from '@/lib/env';

/**
 * Optional, privacy-friendly analytics without cookies (so no cookie banner is needed).
 * Turned on by NEXT_PUBLIC_PLAUSIBLE_DOMAIN, or NEXT_PUBLIC_UMAMI_WEBSITE_ID (+ script URL).
 */
export function Analytics() {
  if (publicEnv.NEXT_PUBLIC_PLAUSIBLE_DOMAIN) {
    return (
      <Script
        defer
        strategy="afterInteractive"
        data-domain={publicEnv.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
        src="https://plausible.io/js/script.js"
      />
    );
  }
  if (publicEnv.NEXT_PUBLIC_UMAMI_WEBSITE_ID) {
    return (
      <Script
        defer
        strategy="afterInteractive"
        data-website-id={publicEnv.NEXT_PUBLIC_UMAMI_WEBSITE_ID}
        src={publicEnv.NEXT_PUBLIC_UMAMI_SCRIPT_URL ?? 'https://cloud.umami.is/script.js'}
      />
    );
  }
  return null;
}
