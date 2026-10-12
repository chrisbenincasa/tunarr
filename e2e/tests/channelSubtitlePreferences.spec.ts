import type { Locator, Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { readFixtureIds } from './routes.ts';

// Edits to the subtitle preference table must mark the channel form dirty,
// so Save enables (#2109).

test.describe.configure({ mode: 'serial' });

const channelId = () => {
  const id = readFixtureIds().channelIds[1];
  if (id === undefined) {
    throw new Error('Fixture needs at least two channels');
  }
  return id;
};

const openStreamingTab = async (page: Page) => {
  await page.goto(`/web/channels/${channelId()}/edit?tab=ffmpeg`);
  await expect(page.getByLabel('Enable Subtitles')).toBeVisible();
};

const saveButton = (page: Page) =>
  page.getByRole('button', { name: 'Save', exact: true });

const englishRow = (page: Page) =>
  page.getByRole('row').filter({ hasText: 'English' });

const checkboxes = (row: Locator) => row.getByRole('checkbox');

const save = async (page: Page) => {
  const saved = page.waitForResponse(
    (res) =>
      res.request().method() === 'PUT' &&
      res.url().includes(`/api/channels/${channelId()}`),
  );
  await saveButton(page).click();
  expect((await saved).ok()).toBe(true);
};

const setFilter = async (page: Page, from: string, to: string) => {
  await englishRow(page)
    .getByRole('cell', { name: from, exact: true })
    .dblclick();
  await page.getByRole('combobox').filter({ hasText: from }).click();
  await page.getByRole('option', { name: to, exact: true }).click();
};

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage();
  await openStreamingTab(page);
  await page.getByLabel('Enable Subtitles').check();
  await page.getByLabel('Add Language Preference').fill('English');
  await page.getByRole('option', { name: 'English', exact: true }).click();
  await expect(englishRow(page)).toBeVisible();
  await save(page);
  await page.close();
});

test.beforeEach(async ({ page }) => {
  await openStreamingTab(page);
  await expect(englishRow(page)).toBeVisible();
  await expect(saveButton(page)).toBeDisabled();
});

test('toggling Allow External enables Save', async ({ page }) => {
  await checkboxes(englishRow(page)).nth(0).click();
  await expect(saveButton(page)).toBeEnabled();
});

test('toggling Allow Image Based enables Save', async ({ page }) => {
  await checkboxes(englishRow(page)).nth(1).click();
  await expect(saveButton(page)).toBeEnabled();
});

test('changing the Filter enables Save', async ({ page }) => {
  await setFilter(page, 'Any', 'Forced');
  await expect(saveButton(page)).toBeEnabled();
});

test('edited preferences persist after save and reload', async ({ page }) => {
  const row = englishRow(page);
  await expect(checkboxes(row).nth(0)).toBeChecked();
  await expect(checkboxes(row).nth(1)).toBeChecked();

  await checkboxes(row).nth(0).click();
  await checkboxes(row).nth(1).click();
  await setFilter(page, 'Any', 'Default');
  await page.getByText('Audio & Subtitles').click();
  await save(page);

  await openStreamingTab(page);
  const reloaded = englishRow(page);
  await expect(checkboxes(reloaded).nth(0)).not.toBeChecked();
  await expect(checkboxes(reloaded).nth(1)).not.toBeChecked();
  await expect(
    reloaded.getByRole('cell', { name: 'Default', exact: true }),
  ).toBeVisible();
});
