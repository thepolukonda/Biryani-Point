import { expect, test, type Page } from '@playwright/test';

// Local-only test account created by supabase/seed.sql (see scripts/generate-seed.ts).
const OWNER = { email: 'owner@biryanipoint.test', password: 'bp-local-owner-2026' };

async function saveProfile(admin: Page, fields: Record<string, string>) {
  await admin.goto('/admin/settings');
  const form = admin.locator('form', {
    has: admin.getByRole('button', { name: 'Save business profile' }),
  });
  for (const [name, value] of Object.entries(fields))
    await form.locator(`[name="${name}"]`).fill(value);
  await form.getByRole('button', { name: 'Save business profile' }).click();
  await expect(form.getByText('Saved.')).toBeVisible();
}

test('the business profile drives the name, address and order numbers', async ({
  page,
  browser,
}) => {
  const ctx = await browser.newContext();
  const admin = await ctx.newPage();
  await admin.goto('/admin/login');
  await admin.getByLabel('Email').fill(OWNER.email);
  await admin.getByLabel('Password').fill(OWNER.password);
  await admin.getByRole('button', { name: 'Sign in' }).click();
  await expect(admin.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();

  await admin.goto('/admin/settings');
  const original = await admin.evaluate(() =>
    Object.fromEntries(
      ['brand_name', 'site_name_en', 'street_en', 'order_prefix'].map((n) => [
        n,
        (document.querySelector(`[name="${n}"]`) as HTMLInputElement).value,
      ]),
    ),
  );

  try {
    await saveProfile(admin, {
      brand_name: 'Test Kitchen',
      site_name_en: 'Test Kitchen Batumi',
      street_en: '1 Test Street',
      order_prefix: 'TK',
    });

    await page.goto('/en');
    await expect(page.getByRole('link', { name: 'Test Kitchen Batumi' }).first()).toBeVisible();
    await expect(page.locator('footer')).toContainText('1 Test Street');
    await expect(page.locator('footer')).toContainText('© ');
    await expect(page.locator('footer')).toContainText('Test Kitchen Batumi');

    await page.goto('/en/menu');
    // Page titles end with the full name (the home page title is its own SEO text).
    await expect(page).toHaveTitle(/\| Test Kitchen Batumi$/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Test Kitchen Batumi' }),
    ).toBeVisible();

    // The kitchen board shows order numbers with the new prefix.
    await admin.goto('/admin/history');
    await expect(admin.getByText(/^TK-\d+$/).first()).toBeVisible();
  } finally {
    await saveProfile(admin, original);
    await ctx.close();
  }
});
