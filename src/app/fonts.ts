import { Noto_Sans_Georgian, Noto_Serif_Georgian, Onest, Yeseva_One } from 'next/font/google';

// Body text. Self-hosted by next/font (no request to Google at runtime).
// Latin is preloaded; the Cyrillic file is only fetched when Russian text is on the page.
export const onest = Onest({
  subsets: ['latin'],
  variable: '--font-onest',
  display: 'swap',
});

export const onestCyrillic = Onest({
  subsets: ['cyrillic'],
  variable: '--font-onest-cyrillic',
  display: 'swap',
  preload: false,
});

// Georgian glyphs. Only downloaded when Georgian text is on the page (unicode-range),
// so English and Russian visitors never pay for it.
export const notoGeorgian = Noto_Sans_Georgian({
  subsets: ['georgian'],
  variable: '--font-georgian',
  display: 'swap',
  preload: false,
});

// Display face for big headings and the shop sign. "optional": used if it arrives within
// ~100 ms (or is cached), otherwise the fallback serif stays, so headlines never re-flow late.
export const yeseva = Yeseva_One({
  weight: '400',
  subsets: ['latin', 'cyrillic'],
  variable: '--font-yeseva',
  display: 'optional',
  preload: true,
});

export const notoSerifGeorgian = Noto_Serif_Georgian({
  weight: ['700'],
  subsets: ['georgian'],
  variable: '--font-georgian-serif',
  display: 'optional',
  preload: false,
});

export const fontVariables = [onest, onestCyrillic, notoGeorgian, yeseva, notoSerifGeorgian]
  .map((f) => f.variable)
  .join(' ');
