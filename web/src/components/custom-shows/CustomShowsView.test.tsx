import useStore from '@/store/index.ts';
import { renderWithProviders, screen, within, withinRow } from '@/test/utils';
import type { CustomShow } from '@tunarr/types';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { CollectionLayout } from '../ui/patterns/CollectionView/index.ts';
import { CustomShowsView } from './CustomShowsView.tsx';

vi.mock('@tanstack/react-router', () => import('@/test/routerMock.tsx'));

const hour = 60 * 60 * 1000;

const show = (
  id: string,
  name: string,
  contentCount: number,
  syncMediaSourceId?: string,
): CustomShow => ({
  id,
  name,
  contentCount,
  schedulableContentCount: contentCount,
  totalDuration: contentCount * hour,
  syncMediaSourceId,
  isSyncing: false,
});

const shows = [
  show('show-small', 'Shorts', 3),
  show('show-big', 'Marathon', 40, 'plex-1'),
];

const renderView = (layout: CollectionLayout, items = shows) => {
  const onOpenShow = vi.fn();
  const onDeleteShow = vi.fn();
  const result = renderWithProviders(
    <CustomShowsView
      shows={items}
      layout={layout}
      onOpenShow={onOpenShow}
      onDeleteShow={onDeleteShow}
    />,
  );
  return { ...result, onOpenShow, onDeleteShow };
};

const showNames = () =>
  within(screen.getAllByRole('rowgroup')[1])
    .getAllByRole('row')
    .map((row) => within(row).getAllByRole('cell')[0].textContent);

beforeEach(() => {
  useStore.setState(({ settings }) => {
    settings.ui.tableSettings = {};
  });
});

describe('CustomShowsView table', () => {
  test('shows program counts and marks synced shows', () => {
    renderView('table');
    expect(withinRow('Shorts').getByText('3')).toBeInTheDocument();
    expect(withinRow('Marathon').getByText('40')).toBeInTheDocument();
    expect(
      withinRow('Marathon').getByLabelText('Synced with external playlist'),
    ).toBeInTheDocument();
    expect(
      withinRow('Shorts').queryByLabelText('Synced with external playlist'),
    ).not.toBeInTheDocument();
  });

  test("shows each show's total runtime", () => {
    renderView('table');
    expect(withinRow('Shorts').getByText('3h')).toBeInTheDocument();
    expect(withinRow('Marathon').getByText('1d 16h')).toBeInTheDocument();
  });

  test('opens a show when its row is clicked', async () => {
    const { user, onOpenShow } = renderView('table');
    await user.click(screen.getByText('Shorts'));
    expect(onOpenShow).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'show-small' }),
    );
  });

  test('links each row to the editor', () => {
    renderView('table');
    expect(
      withinRow('Marathon').getByRole('link', { name: 'Edit' }),
    ).toHaveAttribute('href', '/library/playlists/show-big/edit');
  });

  test('deletes a show only after confirmation, without opening it', async () => {
    const { user, onOpenShow, onDeleteShow } = renderView('table');
    await user.click(
      withinRow('Marathon').getByRole('button', { name: 'Delete' }),
    );
    expect(onOpenShow).not.toHaveBeenCalled();

    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText(/Delete Playlist "Marathon"/),
    ).toBeVisible();
    expect(onDeleteShow).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(onDeleteShow).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'show-big' }),
    );
  });

  test('filters rows by program count from the header', async () => {
    const { user } = renderView('table');
    expect(showNames()).toEqual(['Shorts', 'Marathon']);
    await user.type(
      screen.getByRole('textbox', { name: 'Min # Programs' }),
      '10',
    );
    expect(showNames()).toEqual(['Marathon']);

    await user.click(
      screen.getByRole('button', { name: /^Show\/Hide filters/ }),
    );
    expect(
      screen.getAllByRole('textbox', { name: 'Min # Programs' }),
    ).toHaveLength(1);
  });
});

describe('CustomShowsView cards', () => {
  test('shows one card per show with its count and runtime', () => {
    renderView('cards');
    const card = within(screen.getByRole('article', { name: 'Marathon' }));
    expect(
      card.getByText((_, el) => el?.textContent === '40 programs · 1d 16h'),
    ).toBeInTheDocument();
    expect(card.getByText('Synced')).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });

  test('marks a playlist that is syncing', () => {
    renderView('cards', [
      { ...show('show-live', 'Live Sync', 5, 'plex-1'), isSyncing: true },
    ]);
    const card = within(screen.getByRole('article', { name: 'Live Sync' }));
    expect(card.getByText('Syncing')).toBeInTheDocument();
  });

  test('filters cards by program count from the header', async () => {
    const { user } = renderView('cards');
    await user.type(
      screen.getByRole('textbox', { name: 'Max # Programs' }),
      '10',
    );
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('article', { name: 'Shorts' })).toBeInTheDocument();
  });

  test('offers to clear the filter when no cards match', async () => {
    const { user } = renderView('cards');
    await user.type(
      screen.getByRole('textbox', { name: 'Min # Programs' }),
      '100',
    );
    expect(screen.queryAllByRole('article')).toHaveLength(0);
    expect(
      screen.getByText('No playlists match this filter.'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Clear filter' }));
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });

  test('links the card to the editor', () => {
    renderView('cards');
    const card = within(screen.getByRole('article', { name: 'Shorts' }));
    expect(card.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      '/library/playlists/show-small/edit',
    );
  });

  test('deletes from a card after confirmation', async () => {
    const { user, onDeleteShow } = renderView('cards');
    await user.click(screen.getByRole('button', { name: 'Delete Shorts' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete',
      }),
    );
    expect(onDeleteShow).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'show-small' }),
    );
  });

  test('counts shows in the header', () => {
    renderView('cards');
    expect(
      screen.getByText((_, el) => el?.textContent === '2 playlists'),
    ).toBeInTheDocument();
  });

  test('offers to create the first show when there are none', () => {
    renderView('cards', []);
    expect(
      screen.getByRole('link', { name: 'Create a Playlist' }),
    ).toHaveAttribute('href', '/library/playlists/new');
  });
});
