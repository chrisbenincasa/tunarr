import { useState } from 'react';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type * as Sdk from '../../../generated/sdk.gen.ts';

const mocks = vi.hoisted(() => ({
  facets: vi.fn(),
}));

vi.mock('../../../generated/sdk.gen.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof Sdk>()),
  postApiProgramsFacetsByFacetName: mocks.facets,
}));

const { renderWithProviders, screen } = await import('../../../test/utils.tsx');
const { GenreAutocomplete } = await import('./GenreAutocomplete.tsx');

function Harness({ onChange }: { onChange: (value: string) => void }) {
  const [value, setValue] = useState('');
  return (
    <GenreAutocomplete
      value={value}
      onChange={(next) => {
        setValue(next);
        onChange(next);
      }}
    />
  );
}

describe('GenreAutocomplete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.facets.mockResolvedValue({
      data: { facetValues: { Fantasy: 2, Anime: 5 } },
    });
  });

  test('suggests genres from the search index in alphabetical order', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(<Harness onChange={onChange} />);

    await user.click(screen.getByRole('combobox', { name: 'Genre' }));
    const options = await screen.findAllByRole('option');

    expect(options.map((option) => option.textContent)).toEqual([
      'Anime',
      'Fantasy',
    ]);

    await user.click(screen.getByRole('option', { name: 'Fantasy' }));
    expect(onChange).toHaveBeenLastCalledWith('Fantasy');
  });

  test('accepts a genre that no program has yet', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(<Harness onChange={onChange} />);

    await user.type(screen.getByRole('combobox', { name: 'Genre' }), 'Noir');

    expect(onChange).toHaveBeenLastCalledWith('Noir');
    expect(screen.getByRole('combobox', { name: 'Genre' })).toHaveValue('Noir');
  });
});
