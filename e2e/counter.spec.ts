import { expect, test, type Page } from '@playwright/test';

// Local-only test accounts created by supabase/seed.sql (see scripts/generate-seed.ts).
const OWNER = { email: 'owner@biryanipoint.test', password: 'bp-local-owner-2026' };

// Print frames report what they would print instead of opening a dialog.
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

async function signIn(page: Page) {
  await page.goto('/admin/login');
  await page.getByLabel('Email').fill(OWNER.email);
  await page.getByLabel('Password').fill(OWNER.password);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Orders' })).toBeVisible();
}

async function pickDish(entry: ReturnType<Page['getByRole']>, name: string) {
  await entry
    .getByRole('button', { name: new RegExp(`^${name}`) })
    .first()
    .click();
  // Dishes with options open a picker; the defaults are fine.
  const picker = entry.page().getByRole('dialog', { name: `Options for ${name}` });
  if (await picker.isVisible().catch(() => false)) {
    const add = picker.getByRole('button', { name: 'Add', exact: true });
    if (await add.isDisabled()) await picker.locator('button[aria-pressed]').first().click();
    await add.click();
  }
}

test('tables: owner adds a table, staff run a tab with two rounds, then close it', async ({
  browser,
}) => {
  const ctx = await browser.newContext();
  await ctx.addInitScript(RECORD_PRINTS);
  const page = await ctx.newPage();
  await signIn(page);
  const tableName = `E2E ${Date.now() % 100000}`;

  // Tables module: add a table.
  await page.goto('/admin/tables');
  const add = page.locator('form', { has: page.getByRole('button', { name: 'Add table' }) });
  await add.getByLabel('Name *').fill(tableName);
  await add.getByLabel('Seats').fill('2');
  await add.getByRole('button', { name: 'Add table' }).click();
  await expect(page.getByText(`Table ${tableName} added.`)).toBeVisible();

  // This device prints.
  await page.goto('/admin/printers');
  const sw = page.getByRole('switch');
  if ((await sw.getAttribute('aria-checked')) !== 'true') await sw.click();

  // Orders page: the free table starts an order.
  await page.goto('/admin');
  await page.getByRole('tab', { name: /Dine in/ }).click();
  await page.getByRole('button', { name: `${tableName}: free. Start an order` }).click();
  const entry = page.getByRole('dialog', { name: `New order · ${tableName}` });
  await pickDish(entry, 'Chicken Noodles');
  await pickDish(entry, 'Chicken Noodles');
  await entry.getByRole('button', { name: /Send to kitchen/ }).click();
  await expect(entry).toBeHidden();

  // Round 1 KOT: the table, the dish, no prices.
  await expect.poll(async () => (await prints(page)).length, { timeout: 15_000 }).toBe(1);
  const kot1 = (await prints(page))[0]!;
  expect(kot1).toContain('/kot?copy=1&round=1');
  expect(kot1).toContain(`TABLE ${tableName}`.toUpperCase());
  expect(kot1).toContain('2×');
  expect(kot1).toContain('CHICKEN NOODLES');

  // The table is now in use; open its tab and add a second round.
  await page.getByRole('button', { name: new RegExp(`^${tableName}: in use`) }).click();
  const tab = page.getByRole('dialog', { name: /^Order / });
  await tab.getByRole('button', { name: '+ Add dishes' }).click();
  const more = page.getByRole('dialog', { name: `Add dishes · ${tableName}` });
  await pickDish(more, 'Chicken Biryani');
  await more.getByRole('button', { name: /Send to kitchen/ }).click();
  await expect(more).toBeHidden();

  // Round 2 KOT has only the new dish.
  await expect.poll(async () => (await prints(page)).length, { timeout: 15_000 }).toBe(2);
  const kot2 = (await prints(page))[1]!;
  expect(kot2).toContain('round=2');
  expect(kot2).toContain('ADD-ON · ROUND 2');
  expect(kot2).toContain('CHICKEN BIRYANI');
  expect(kot2).not.toContain('CHICKEN NOODLES');

  // Bill & pay (the tab stays open after adding dishes): the bill has both rounds, then
  // the table is free again.
  await expect(tab).toBeVisible();
  await tab.getByRole('button', { name: 'Bill & pay' }).click();
  await tab.getByRole('button', { name: 'Print the bill' }).click();
  await expect.poll(async () => (await prints(page)).length, { timeout: 15_000 }).toBe(3);
  const bill = (await prints(page))[2]!;
  expect(bill).toContain(`Table ${tableName}`);
  expect(bill).toContain('Chicken Noodles');
  expect(bill).toContain('Chicken Biryani');
  await tab.getByRole('button', { name: 'Paid card' }).click();
  await expect(
    page.getByRole('button', { name: `${tableName}: free. Start an order` }),
  ).toBeVisible();

  // Clean up: remove the table (allowed now the tab is closed).
  await page.goto('/admin/tables');
  page.once('dialog', (d) => void d.accept());
  const row = page.locator('li', { has: page.locator(`input[value="${tableName}"]`) });
  await row.getByRole('button', { name: 'Remove' }).click();
  await expect(page.getByText('Table removed.')).toBeVisible();
  await ctx.close();
});

test('takeaway at the counter: paid by cash, KOT prints straight away', async ({ browser }) => {
  const ctx = await browser.newContext();
  await ctx.addInitScript(RECORD_PRINTS);
  const page = await ctx.newPage();
  await signIn(page);
  await page.goto('/admin/printers');
  const sw = page.getByRole('switch');
  if ((await sw.getAttribute('aria-checked')) !== 'true') await sw.click();

  await page.goto('/admin');
  await page.getByRole('tab', { name: /Takeaway/ }).click();
  await page.getByRole('button', { name: '+ New takeaway' }).click();
  const entry = page.getByRole('dialog', { name: 'New takeaway' });
  await pickDish(entry, 'Chicken Noodles');
  await entry.getByLabel('Customer name (optional)').fill('Walk-in Test');
  await entry.getByRole('button', { name: 'Paid cash' }).click();
  await entry.getByRole('button', { name: /Send to kitchen/ }).click();
  await expect(entry).toBeHidden();

  await expect.poll(async () => (await prints(page)).length, { timeout: 15_000 }).toBe(1);
  expect((await prints(page))[0]).toContain('TAKEAWAY');

  // The takeaway shows as a tile; tap it to open the order.
  await page
    .getByRole('button', { name: /Walk-in Test: .*Open the order/ })
    .first()
    .click();
  const card = page.getByRole('dialog').getByRole('article');
  await expect(card).toContainText('Takeaway');
  await expect(card).toContainText('Paid by cash');
  await card.getByRole('button', { name: 'Ready for pickup' }).click();
  await card.getByRole('button', { name: 'Picked up' }).click();
  await ctx.close();
});
