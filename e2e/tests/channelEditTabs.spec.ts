import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { readFixtureIds } from './routes.ts';

// Visited channel edit tabs stay mounted and hidden when you switch away.

const channelId = (index: number) => {
  const id = readFixtureIds().channelIds[index];
  if (id === undefined) {
    throw new Error(`Fixture needs at least ${index + 1} channels`);
  }
  return id;
};

const tab = (page: Page, name: string) =>
  page.getByRole('tab', { name, exact: true });

test('switching tabs with unsaved changes does not ask to discard them', async ({
  page,
}) => {
  await page.goto(`/web/channels/${channelId(0)}/edit`);
  await page.getByLabel('Channel Name').fill('Renamed');

  await tab(page, 'EPG').click();

  await expect(page).toHaveURL(/[?&]tab=epg/);
  await expect(page.getByText('You have unsaved changes!')).toBeHidden();
});

test('Save on an invalid form shows the tab that holds the error', async ({
  page,
}) => {
  await page.goto(`/web/channels/${channelId(0)}/edit`);
  const name = page.getByLabel('Channel Name');
  await name.fill('');
  await expect(page.getByText('Channel name is required')).toBeVisible();

  await tab(page, 'EPG').click();
  await expect(name).toBeHidden();

  await page.getByRole('button', { name: 'Save', exact: true }).click();

  await expect(tab(page, 'Properties')).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await expect(name).toBeVisible();
  await expect(name).toBeFocused();
});

test.describe('subtitle table in a hidden tab', () => {
  const id = () => channelId(2);
  const englishRow = (page: Page) =>
    page.getByRole('row').filter({ hasText: 'English' });
  const headerWidths = (page: Page) =>
    page
      .getByRole('table')
      .filter({ has: englishRow(page) })
      .getByRole('columnheader')
      .evaluateAll((cells) =>
        cells.map((c) => Math.round(c.getBoundingClientRect().width)),
      );
  const openStreaming = async (page: Page) => {
    await page.goto(`/web/channels/${id()}/edit?tab=ffmpeg`);
    await expect(page.getByLabel('Enable Subtitles')).toBeVisible();
  };

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage();
    await openStreaming(page);
    await page.getByLabel('Enable Subtitles').check();
    await page.getByLabel('Add Language Preference').fill('English');
    await page.getByRole('option', { name: 'English', exact: true }).click();
    const saved = page.waitForResponse(
      (res) =>
        res.request().method() === 'PUT' &&
        res.url().includes(`/api/channels/${id()}`),
    );
    await page.getByRole('button', { name: 'Save', exact: true }).click();
    expect((await saved).ok()).toBe(true);
    await page.close();
  });

  test('re-measures after the window resizes while hidden', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1000, height: 900 });
    await openStreaming(page);
    await expect(englishRow(page)).toBeVisible();
    const fresh = await headerWidths(page);

    await page.setViewportSize({ width: 1400, height: 900 });
    await openStreaming(page);
    await expect(englishRow(page)).toBeVisible();

    await tab(page, 'Properties').click();
    await page.setViewportSize({ width: 1000, height: 900 });
    await tab(page, 'Streaming').click();
    await expect(englishRow(page)).toBeVisible();

    expect(fresh.every((w) => w > 0)).toBe(true);
    await expect.poll(() => headerWidths(page)).toEqual(fresh);
  });
});
