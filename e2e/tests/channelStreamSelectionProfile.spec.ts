import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { readFixtureIds } from './routes.ts';

// The channel's Streaming tab assigns a stream selection profile. Picking one
// must mark the form dirty, so Save enables, and survive a reload.

test.describe.configure({ mode: 'serial' });

const channelId = () => {
  const id = readFixtureIds().channelIds[1];
  if (id === undefined) {
    throw new Error('Fixture needs at least two channels');
  }
  return id;
};

const profileSelect = (page: Page) =>
  page.getByRole('combobox', { name: 'Stream Selection Profile' });

const saveButton = (page: Page) =>
  page.getByRole('button', { name: 'Save', exact: true });

const openStreamingTab = async (page: Page) => {
  await page.goto(`/web/channels/${channelId()}/edit?tab=ffmpeg`);
  await expect(profileSelect(page)).toBeVisible();
};

const chooseProfile = async (page: Page, name: string) => {
  await profileSelect(page).click();
  await page.getByRole('option', { name, exact: true }).click();
};

const save = async (page: Page) => {
  const saved = page.waitForResponse(
    (res) =>
      res.request().method() === 'PUT' &&
      res.url().includes(`/api/channels/${channelId()}`),
  );
  await saveButton(page).click();
  expect((await saved).ok()).toBe(true);
};

test('starts unassigned, using the default profile', async ({ page }) => {
  await openStreamingTab(page);

  await expect(profileSelect(page)).toHaveText('Default (Tunarr Default)');
  await expect(saveButton(page)).toBeDisabled();
});

test('choosing a profile enables Save', async ({ page }) => {
  await openStreamingTab(page);

  await chooseProfile(page, 'Tunarr Default');

  await expect(saveButton(page)).toBeEnabled();
});

test('the assigned profile persists after save and reload', async ({
  page,
}) => {
  await openStreamingTab(page);
  await chooseProfile(page, 'Tunarr Default');
  await save(page);

  await openStreamingTab(page);
  await expect(profileSelect(page)).toHaveText('Tunarr Default');

  await chooseProfile(page, 'Default (Tunarr Default)');
  await save(page);
});
