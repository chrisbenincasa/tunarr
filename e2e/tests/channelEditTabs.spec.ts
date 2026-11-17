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
