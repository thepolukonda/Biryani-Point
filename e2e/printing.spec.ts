import { expect, test, type Page } from '@playwright/test';

// Local-only test account created by supabase/seed.sql (see scripts/generate-seed.ts).
const STAFF = { email: 'kitchen@biryanipoint.test', password: 'bp-local-kitchen-2026' };

// Instead of opening a real print dialog, each print frame reports what it would print.
const RECORD_PRINTS = () => {
  window.print = () => {
    const top = window.top as Window & { __prints?: string[] };
    (top.__prints ??= []).push(
      `${location.pathname}${location.search}\n${document.body.innerText}`,
    );
    window.dispatchEvent(new Event('afterprint'));
  };
};

const prints = (page: Page) =>
  page.evaluate(() => (window as Window & { __prints?: string[] }).__prints ?? []);

async function placePickupOrder(page: Page): Promise<string> {
  await page.goto('/en/menu');
  await page
    .getByRole('heading', { name: 'Kerala Mandi' })
    .getByRole('button', { name: 'Kerala Mandi' })
    .click();
  const sheet = page.getByRole('dialog', { name: 'Kerala Mandi' });
  await sheet.getByLabel('Spicy').check();
  await sheet.getByRole('button', { name: /Add to order/ }).click();
  await expect(sheet).toBeHidden();
  await page.goto('/en/checkout');
  await page.getByRole('radio', { name: 'Pickup' }).check({ force: true });
  await page.getByRole('radio', { name: 'Choose a time' }).check({ force: true });
  await page.getByLabel('Name').fill('Print Tester');
  await page.getByLabel('Phone number').fill('599 00 11 33');
  await page.getByRole('button', { name: /Place order/ }).click();
  const heading = page.getByRole('heading', { level: 1, name: /Order BP-\d+/ });
  await expect(heading).toBeVisible();
  return ((await heading.textContent()) ?? '').replace('Order ', '').trim();
}

test('KOT prints on accept, bill on ready, reprints are marked', async ({ page, browser }) => {
  const orderLabel = await placePickupOrder(page);
  const orderNumber = orderLabel.replace('BP-', '');

  const kitchen = await browser.newContext();
  await kitchen.addInitScript(RECORD_PRINTS);
  const admin = await kitchen.newPage();
  await admin.goto('/admin/login');
  await admin.getByLabel('Email').fill(STAFF.email);
  await admin.getByLabel('Password').fill(STAFF.password);
  await admin.getByRole('button', { name: 'Sign in' }).click();
  await expect(admin.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();

  // Make this the printing device.
  await admin.goto('/admin/printers');
  await admin.getByRole('switch').click();
  await expect(admin.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  await admin.goto('/admin');
  await expect(admin.getByRole('link', { name: /Printing here/ })).toBeVisible();

  // Online orders tab → tap the order's tile to open it.
  await admin.getByRole('tab', { name: /Online orders/ }).click();
  await admin.getByRole('button', { name: new RegExp(`^${orderLabel},`) }).click();
  const card = admin.getByRole('article', { name: orderLabel });
  await card.getByRole('button', { name: 'Accept, ready in 20 minutes' }).click();

  // KOT: first print, big order number, dish and option, no prices.
  await expect.poll(async () => (await prints(admin)).length, { timeout: 15_000 }).toBe(1);
  const [kot] = await prints(admin);
  expect(kot).toContain('/kot?copy=1');
  expect(kot).toContain(`#${orderNumber}`);
  expect(kot).toContain('KERALA MANDI');
  expect(kot).toContain('SPICY');
  expect(kot).not.toContain('REPRINT');
  expect(kot).not.toMatch(/GEL|₾/);

  // Bill when the order is ready for pickup.
  await card.getByRole('button', { name: 'Ready for pickup' }).click();
  await expect.poll(async () => (await prints(admin)).length, { timeout: 15_000 }).toBe(2);
  const bill = (await prints(admin))[1]!;
  expect(bill).toContain('/bill?copy=1');
  expect(bill).toContain(orderLabel);
  expect(bill).toContain('Print Tester');
  expect(bill).toContain('TOTAL');

  // A manual reprint is marked as one.
  await card.getByRole('button', { name: 'Print KOT' }).click();
  await expect.poll(async () => (await prints(admin)).length, { timeout: 15_000 }).toBe(3);
  const reprint = (await prints(admin))[2]!;
  expect(reprint).toContain('/kot?copy=2');
  expect(reprint).toContain('REPRINT');

  // Picked up needs payment first; after that the payment is locked.
  const pickedUp = card.getByRole('button', { name: 'Picked up' });
  await expect(pickedUp).toBeDisabled();
  await card.getByRole('button', { name: 'Mark paid' }).click();
  await expect(pickedUp).toBeEnabled();

  // Another status change doesn't print the KOT again.
  await pickedUp.click();
  await expect(admin.getByRole('dialog')).toBeHidden();
  await expect(card.getByRole('button', { name: /^(Paid|Mark paid)$/ })).toHaveCount(0);
  await admin.waitForTimeout(1500);
  expect(await prints(admin)).toHaveLength(3);
  await kitchen.close();
});
