import { expect, test } from '@playwright/test';
import { seed, writeFixtureIds } from '../fixture/seed.ts';

// The config runs tests fully parallel. Default mode keeps file order without
// skipping the seed when the fresh-install check fails.
test.describe.configure({ mode: 'default' });

test('fresh install opens the welcome checklist', async ({ page }) => {
  await page.goto('/web/');
  await expect(page).toHaveURL(/\/web\/welcome$/);
  await expect(page.getByText('Welcome to Tunarr!')).toBeVisible();
});

test('seed fixture database', async () => {
  writeFixtureIds(await seed());
});
