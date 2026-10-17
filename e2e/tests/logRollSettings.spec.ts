import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { SERVER_URL } from '../fixture/env.ts';

// Each log roll option must save and survive a reload on its own.
// Unticking the schedule used to fail validation silently, so Save did nothing.

test.describe.configure({ mode: 'serial' });

const FIFTY_MB = 50 * 1024 * 1024;

const schedule = (page: Page) => page.getByLabel('Roll on Schedule');
const size = (page: Page) => page.getByLabel('Roll based on size');
const sizeField = (page: Page) => page.getByLabel('Max file size (bytes)');

const open = async (page: Page) => {
  await page.goto('/web/settings/general');
  await expect(page.getByLabel('Enable Log File Rolling')).toBeChecked();
};

const save = async (page: Page) => {
  const saved = page.waitForResponse(
    (res) =>
      res.request().method() === 'PUT' &&
      res.url().endsWith('/api/system/settings'),
  );
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  expect((await saved).ok()).toBe(true);
};

const savedLogRollConfig = async (page: Page) => {
  const res = await page.request.get(`${SERVER_URL}/api/system/settings`);
  const body = (await res.json()) as {
    logging: {
      logRollConfig: {
        maxFileSizeBytes?: number;
        schedule?: { increment: number };
      };
    };
  };
  return body.logging.logRollConfig;
};

test('unticking the schedule saves and keeps the size limit', async ({
  page,
}) => {
  await open(page);
  await schedule(page).uncheck();
  await save(page);

  await page.reload();
  await expect(schedule(page)).not.toBeChecked();
  await expect(size(page)).toBeChecked();
  await expect(sizeField(page)).toHaveValue(String(FIFTY_MB));

  const config = await savedLogRollConfig(page);
  expect(config.schedule).toBeUndefined();
  expect(config.maxFileSizeBytes).toBe(FIFTY_MB);
});

test('unticking size saves while the schedule stays on', async ({ page }) => {
  await open(page);
  await schedule(page).check();
  await size(page).uncheck();
  await save(page);

  await page.reload();
  await expect(schedule(page)).toBeChecked();
  await expect(size(page)).not.toBeChecked();

  const config = await savedLogRollConfig(page);
  expect(config.schedule?.increment).toBe(1);
  expect(config.maxFileSizeBytes).toBeUndefined();
});

test('ticking size fills in 50 MB', async ({ page }) => {
  await open(page);
  await size(page).check();
  await expect(sizeField(page)).toHaveValue(String(FIFTY_MB));
});
