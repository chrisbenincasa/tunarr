import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

// A By Language audio rule holds its languages as a priority list. The order
// the user sets, by dragging or with the arrow buttons, must survive a save
// and reload.

const languageRows = (page: Page) =>
  page.getByRole('list', { name: 'Languages' }).getByRole('listitem');

const addLanguage = async (page: Page, name: string) => {
  await page.getByRole('combobox', { name: 'Add language' }).fill(name);
  await page.getByRole('option', { name: new RegExp(`^${name}`) }).click();
};

test('keeps the audio language order after save and reload', async ({
  page,
}) => {
  await page.goto('/web/profiles/stream-selection/new');
  await page
    .getByRole('textbox', { name: 'Profile Name' })
    .fill('Language order');
  await page.getByRole('combobox', { name: 'Audio Strategy' }).click();
  await page.getByRole('option', { name: 'By Language' }).click();

  for (const name of ['Spanish', 'English', 'Japanese']) {
    await addLanguage(page, name);
  }
  await expect(languageRows(page)).toHaveText([
    /Spanish/,
    /English/,
    /Japanese/,
  ]);

  // The drag handle is the row's first decorative element. A row moves once
  // the pointer crosses its middle, so drop near the top of the first row.
  await languageRows(page)
    .nth(2)
    .locator('[aria-hidden]')
    .first()
    .dragTo(languageRows(page).first(), { targetPosition: { x: 40, y: 4 } });
  await expect(languageRows(page)).toHaveText([
    /Japanese/,
    /Spanish/,
    /English/,
  ]);

  await page.getByRole('button', { name: 'Move English up' }).click();
  await expect(languageRows(page)).toHaveText([
    /Japanese/,
    /English/,
    /Spanish/,
  ]);

  await page.getByRole('button', { name: 'Create Profile' }).click();
  await page.waitForURL(/\/profiles\/stream-selection\/[0-9a-f-]{36}$/);
  await page.reload();
  await page.getByRole('button', { name: /Rule 1/ }).click();

  await expect(languageRows(page)).toHaveText([
    /Japanese/,
    /English/,
    /Spanish/,
  ]);
});
