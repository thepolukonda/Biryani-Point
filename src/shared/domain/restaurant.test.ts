import { describe, expect, it } from 'vitest';
import { orderLabel } from '@/shared/orders/format';
import { TEST_PROFILE } from './profile.fixture';
import { logoBrand, profileText } from './restaurant';

describe('business profile texts', () => {
  it('picks the language and falls back to English', () => {
    const ka = profileText(TEST_PROFILE, 'ka');
    expect(ka.siteName).toBe('Test Kitchen ბათუმი');
    expect(ka.tagline).toBe('Home-style cooking');
    expect(ka.street).toBe('სატესტო ქ. 1');
    // Empty Georgian highlights fall back to the English list.
    expect(ka.highlights).toEqual(['Fresh', 'Fast']);
  });

  it('builds the address line with the country name in the page language', () => {
    expect(profileText(TEST_PROFILE, 'en').address).toBe('1 Test St, Batumi 6010, Georgia');
    expect(profileText(TEST_PROFILE, 'ru').cityLine).toBe('Batumi 6010, Грузия');
  });

  it('splits the about text into paragraphs and fills SEO texts from the others', () => {
    const en = profileText(TEST_PROFILE, 'en');
    expect(en.aboutParagraphs).toEqual(['First paragraph.', 'Second paragraph.']);
    expect(en.seoTitle).toBe('Test Kitchen Batumi | Home-style cooking');
    expect(en.seoDescription).toBe('Cooked fresh.');
    expect(en.specialties).toBe('Home-style cooking');
  });

  it('keeps the logo in Latin letters and formats order numbers with the prefix', () => {
    expect(logoBrand(TEST_PROFILE)).toEqual({
      name: 'Test Kitchen',
      monogram: 'TK',
      city: 'Batumi',
    });
    expect(orderLabel(TEST_PROFILE.orderPrefix, 1042)).toBe('TK-1042');
  });
});
