import { expect, test } from '@playwright/test';
import { seed, writeFixtureIds } from '../fixture/seed.ts';

test.describe.configure({ mode: 'serial' });

test('fresh install opens the welcome checklist', async ({ page }) => {
  await page.goto('/web/');
  await expect(page).toHaveURL(/\/web\/welcome$/);
  await expect(page.getByText('Welcome to Tunarr!')).toBeVisible();
});

test('seed fixture database', async () => {
  writeFixtureIds(await seed());
});
