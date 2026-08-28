import type { LanguagePreference } from '@tunarr/types';
import { describe, expect, test } from 'vitest';
import { renderWithProviders, screen, within } from '@/test/utils';
import { LanguagePreferencesList } from './LanguagePreferencesList';

// ISO 639-2 gives German two codes: "ger" (bibliographic) and "deu"
// (terminological). Preferences saved before the picker standardized on /T are
// stored as "ger", so the already-selected check must recognize them.
// Regression test for https://github.com/chrisbenincasa/tunarr/issues/1960
describe('LanguagePreferencesList', () => {
  async function openOptions(preferences: LanguagePreference[]) {
    const { user } = renderWithProviders(
      <LanguagePreferencesList preferences={preferences} onChange={() => {}} />,
    );
    await user.click(screen.getByRole('combobox'));
    return screen.getByRole('listbox');
  }

  test('does not offer a language that is already selected', async () => {
    const listbox = await openOptions([
      { iso6391: 'de', iso6392: 'deu', displayName: 'German' },
    ]);

    expect(
      within(listbox).queryByRole('option', { name: 'German' }),
    ).not.toBeInTheDocument();
  });

  test('does not offer a language already selected under its legacy code', async () => {
    const listbox = await openOptions([
      { iso6391: 'de', iso6392: 'ger', displayName: 'German' },
    ]);

    expect(
      within(listbox).queryByRole('option', { name: 'German' }),
    ).not.toBeInTheDocument();
  });

  test('still offers languages that are not selected', async () => {
    const listbox = await openOptions([
      { iso6391: 'de', iso6392: 'ger', displayName: 'German' },
    ]);

    expect(
      within(listbox).getByRole('option', { name: 'French' }),
    ).toBeInTheDocument();
  });
});
