/** A made-up business profile for unit tests. */
import type { BusinessProfile } from './restaurant';

export const TEST_PROFILE: BusinessProfile = {
  brandName: 'Test Kitchen',
  siteName: { en: 'Test Kitchen Batumi', ka: 'Test Kitchen ბათუმი' },
  monogram: 'TK',
  orderPrefix: 'TK',
  tagline: { en: 'Home-style cooking' },
  specialties: null,
  cuisines: ['Indian'],
  street: { en: '1 Test St', ka: 'სატესტო ქ. 1' },
  city: { en: 'Batumi', ka: 'ბათუმი' },
  postalCode: '6010',
  countryCode: 'GE',
  email: null,
  social: { instagram: null, facebook: null, tiktok: null },
  headline: { en: 'Good food.' },
  intro: { en: 'Cooked fresh.' },
  aboutTitle: null,
  aboutText: { en: 'First paragraph.\n\nSecond paragraph.' },
  highlights: { en: ['Fresh', 'Fast'], ka: [] },
  features: [{ title: { en: 'Fresh' }, text: null }],
  seoTitle: null,
  seoDescription: null,
  menuDescription: null,
};
