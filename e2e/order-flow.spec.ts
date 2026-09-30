import { expect, test } from '@playwright/test';

// Local-only test account created by supabase/seed.sql (see scripts/generate-seed.ts).
const STAFF = { email: 'kitchen@biryanipoint.test', password: 'bp-local-kitchen-2026' };

test('browse → add a dish with an option → checkout → order appears on the kitchen board', async ({
  page,
  browser,
}) => {
  // 1. Browse the menu and open a dish.
  await page.goto('/en/menu');
  await expect(page.getByRole('heading', { level: 1, name: 'Biryani Point Batumi' })).toBeVisible();
  await page
    .getByRole('heading', { name: 'Kerala Mandi' })
    .getByRole('button', { name: 'Kerala Mandi' })
    .click();

  // 2. Choose a modifier (spice level) and add it.
  const sheet = page.getByRole('dialog', { name: 'Kerala Mandi' });
  await expect(sheet).toBeVisible();
  await sheet.getByLabel('Spicy').check();
  await sheet.getByRole('button', { name: /Add to order/ }).click();
  await expect(sheet).toBeHidden();
  await expect(page.getByRole('button', { name: 'Your order, 1 item' })).toBeVisible();

  // 3. Checkout: pickup, a scheduled time (always valid, open or closed), contact details.
  await page.goto('/en/checkout');
  await expect(page.getByRole('heading', { level: 1, name: 'Checkout' })).toBeVisible();
  await page.getByRole('radio', { name: 'Pickup' }).check({ force: true });
  await page.getByRole('radio', { name: 'Choose a time' }).check({ force: true });
  await expect(page.getByRole('combobox', { name: 'Choose a time' })).toBeVisible();
  await page.getByLabel('Name').fill('E2E Tester');
  await page.getByLabel('Phone number').fill('599 00 11 22');
  await page.getByRole('button', { name: /Place order/ }).click();

  // 4. Tracking page.
  await expect(page).toHaveURL(/\/en\/order\/[A-Za-z0-9_-]{20,}\?new=1/);
  const heading = page.getByRole('heading', { level: 1, name: /Order BP-\d+/ });
  await expect(heading).toBeVisible();
  const orderLabel = ((await heading.textContent()) ?? '').replace('Order ', '').trim();
  await expect(page.getByRole('heading', { name: 'Received' })).toBeVisible();
  await expect(page.getByText('Kerala Mandi')).toBeVisible();
  await expect(page.getByText('Spicy')).toBeVisible();

  // 5. Kitchen board (separate browser session, signed in as staff).
  const kitchen = await browser.newContext();
  const admin = await kitchen.newPage();
  await admin.goto('/admin');
  await expect(admin).toHaveURL(/\/admin\/login/);
  await admin.getByLabel('Email').fill(STAFF.email);
  await admin.getByLabel('Password').fill(STAFF.password);
  await admin.getByRole('button', { name: 'Sign in' }).click();
  await expect(admin.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
  // Online orders tab → tap the order's tile to open it.
  await admin.getByRole('tab', { name: /Online orders/ }).click();
  await admin.getByRole('button', { name: new RegExp(`^${orderLabel},`) }).click();
  const card = admin.getByRole('article', { name: orderLabel });
  await expect(card).toBeVisible();
  await expect(card.getByText('E2E Tester')).toBeVisible();
  await expect(card.getByText(/Kerala Mandi/)).toBeVisible();

  // 6. Accept it, and the customer's page updates live.
  await card.getByRole('button', { name: 'Accept, ready in 20 minutes' }).click();
  await expect(page.getByRole('heading', { name: 'Accepted' })).toBeVisible({ timeout: 15_000 });
  await kitchen.close();
});
