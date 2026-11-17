import { beforeEach, describe, expect, test, vi } from 'vitest';
import type * as Sdk from '../../../generated/sdk.gen.ts';

const mocks = vi.hoisted(() => ({
  mediaSources: vi.fn(),
}));

vi.mock('../../../generated/sdk.gen.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof Sdk>()),
  getApiMediaSources: mocks.mediaSources,
}));

const { renderWithProviders, screen } = await import('../../../test/utils.tsx');
const { LibrarySelect } = await import('./LibrarySelect.tsx');

describe('LibrarySelect', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mediaSources.mockResolvedValue({
      data: [
        {
          id: 'plex-1',
          name: 'Home Plex',
          libraries: [
            { id: 'lib-anime', name: 'Anime' },
            { id: 'lib-movies', name: 'Movies' },
          ],
        },
        {
          id: 'jf-1',
          name: 'Jellyfin',
          libraries: [{ id: 'lib-shows', name: 'Shows' }],
        },
      ],
    });
  });

  test('lists libraries under their media source and reports the choice', async () => {
    const onChange = vi.fn();
    const { user } = renderWithProviders(
      <LibrarySelect value="" onChange={onChange} />,
    );

    await user.click(await screen.findByRole('combobox'));

    expect(await screen.findByText('Home Plex')).toBeInTheDocument();
    expect(
      screen.getAllByRole('option').map((option) => option.textContent),
    ).toEqual(['Home Plex', 'Anime', 'Movies', 'Jellyfin', 'Shows']);

    await user.click(screen.getByRole('option', { name: 'Shows' }));
    expect(onChange).toHaveBeenCalledWith('lib-shows');
  });

  test('shows the selected library by name', async () => {
    renderWithProviders(
      <LibrarySelect value="lib-movies" onChange={vi.fn()} />,
    );

    const select = await screen.findByRole('combobox');
    await vi.waitFor(() => expect(select).toHaveTextContent('Movies'));
  });

  test('keeps a library id that no media source lists', async () => {
    const { user } = renderWithProviders(
      <LibrarySelect value="lib-deleted" onChange={vi.fn()} />,
    );

    const select = await screen.findByRole('combobox');
    await vi.waitFor(() => expect(select).toHaveTextContent('Unknown library'));

    await user.click(select);
    expect(
      screen.getByRole('option', { name: 'Unknown library' }),
    ).toBeInTheDocument();
  });
});
