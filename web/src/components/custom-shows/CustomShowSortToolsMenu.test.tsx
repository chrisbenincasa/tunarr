// The store has to load before its action modules, which import it back
// through a cycle, the way the app's entry point loads it.
import useStore from '../../store/index.ts';
import { renderWithProviders, screen } from '@/test/utils';
import type { ContentProgram } from '@tunarr/types';
import { beforeEach, describe, expect, test } from 'vitest';
import { setCurrentCustomShowProgramming } from '../../store/customShowEditor/actions.ts';
import { makeContentProgram, makeMovie } from '../../test/programFixtures.ts';
import { CustomShowSortToolsMenu } from './CustomShowSortToolsMenu.tsx';

function movie(title: string, releaseDate?: number): ContentProgram {
  return makeContentProgram(
    makeMovie({ uuid: title, title, releaseDate }),
    0,
    title,
  );
}

// Menu items are wrapped in tooltips, which give each item the tooltip text as
// its accessible name, so they are found by their visible label instead.

function programTitles() {
  return useStore
    .getState()
    .customShowEditor.programList.map((p) => p.program?.title);
}

describe('CustomShowSortToolsMenu', () => {
  beforeEach(() => {
    setCurrentCustomShowProgramming([
      movie('Charlie', 300),
      movie('Alpha', 200),
      movie('Bravo', 100),
    ]);
  });

  test('sorts by title', async () => {
    const { user } = renderWithProviders(<CustomShowSortToolsMenu />);

    await user.click(screen.getByRole('button', { name: 'Tools' }));
    await user.click(screen.getByText('Alphabetically'));

    expect(programTitles()).toEqual(['Alpha', 'Bravo', 'Charlie']);
    expect(
      screen.getByRole('button', { name: 'A-Z (asc)' }),
    ).toBeInTheDocument();

    // The button flips the direction.
    await user.click(screen.getByRole('button', { name: 'A-Z (asc)' }));

    expect(programTitles()).toEqual(['Charlie', 'Bravo', 'Alpha']);
    expect(
      screen.getByRole('button', { name: 'A-Z (desc)' }),
    ).toBeInTheDocument();
  });

  test('picking release date from the menu again keeps the label in step with the order', async () => {
    const { user } = renderWithProviders(<CustomShowSortToolsMenu />);

    await user.click(screen.getByRole('button', { name: 'Tools' }));
    await user.click(screen.getByText('Release Date'));

    expect(programTitles()).toEqual(['Bravo', 'Alpha', 'Charlie']);
    expect(
      screen.getByRole('button', { name: 'Release Date (asc)' }),
    ).toBeInTheDocument();

    // Open the menu from the dropdown half of the button group and pick
    // release date again.
    const [, dropdown] = screen.getAllByRole('button');
    if (!dropdown) {
      throw new Error('Expected the sort button group to have a dropdown');
    }
    await user.click(dropdown);
    await user.click(screen.getByText('Release Date'));

    expect(programTitles()).toEqual(['Bravo', 'Alpha', 'Charlie']);
    expect(
      screen.getByRole('button', { name: 'Release Date (asc)' }),
    ).toBeInTheDocument();
  });
});
