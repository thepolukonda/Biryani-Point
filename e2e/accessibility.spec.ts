import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Automated WCAG 2.2 A/AA checks. (Automation finds roughly a third of issues; see README for the manual checklist.)
for (const path of ['/en', '/en/menu', '/ka', '/ru/menu', '/en/checkout', '/en/privacy']) {
  test(`no serious accessibility problems on ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      // The OpenStreetMap iframe is third-party content.
      .exclude('iframe')
      .analyze();
    const serious = results.violations.filter(
      (v) => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(
      serious.map((v) => `${v.id}: ${v.help} (${v.nodes.length}) ${v.nodes[0]?.target.join(' ')}`),
    ).toEqual([]);
  });
}

test('keyboard: skip link and dish sheet', async ({ page }) => {
  await page.goto('/en/menu');
  await page.keyboard.press('Tab');
  await expect(page.getByRole('link', { name: 'Skip to menu' })).toBeFocused();
  await page.getByRole('heading', { name: 'Chicken Biryani' }).first().getByRole('button').focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('dialog', { name: 'Chicken Biryani' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog', { name: 'Chicken Biryani' })).toBeHidden();
});
