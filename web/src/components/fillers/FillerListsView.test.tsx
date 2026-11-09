import useStore from '@/store/index.ts';
import { renderWithProviders, screen, within, withinRow } from '@/test/utils';
import type { FillerList } from '@tunarr/types';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { CollectionLayout } from '../ui/patterns/CollectionView/index.ts';
import { FillerListsView } from './FillerListsView.tsx';

vi.mock('@tanstack/react-router', () => import('@/test/routerMock.tsx'));

const filler = (
  id: string,
  name: string,
  contentCount: number,
): FillerList => ({
  id,
  name,
  contentCount,
});

const fillers = [
  filler('filler-bumpers', 'Bumpers', 4),
  filler('filler-ads', 'Retro Ads', 120),
];

const renderView = (layout: CollectionLayout, items = fillers) => {
  const onOpenFiller = vi.fn();
  const onAssignChannels = vi.fn();
  const onDeleteFiller = vi.fn();
  const result = renderWithProviders(
    <FillerListsView
      fillers={items}
      layout={layout}
      onOpenFiller={onOpenFiller}
      onAssignChannels={onAssignChannels}
      onDeleteFiller={onDeleteFiller}
    />,
  );
  return { ...result, onOpenFiller, onAssignChannels, onDeleteFiller };
};

const fillerNames = () =>
  within(screen.getAllByRole('rowgroup')[1])
    .getAllByRole('row')
    .map((row) => within(row).getAllByRole('cell')[0].textContent);

beforeEach(() => {
  useStore.setState(({ settings }) => {
    settings.ui.tableSettings = {};
  });
});

describe('FillerListsView table', () => {
  test('shows program counts', () => {
    renderView('table');
    expect(withinRow('Bumpers').getByText('4')).toBeInTheDocument();
    expect(withinRow('Retro Ads').getByText('120')).toBeInTheDocument();
  });

  test('opens a filler list when its row is clicked', async () => {
    const { user, onOpenFiller } = renderView('table');
    await user.click(screen.getByText('Bumpers'));
    expect(onOpenFiller).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'filler-bumpers' }),
    );
  });

  test('links each row to the editor', () => {
    renderView('table');
    expect(
      withinRow('Retro Ads').getByRole('link', { name: 'Edit' }),
    ).toHaveAttribute('href', '/library/fillers/filler-ads/edit');
  });

  test('assigns a row to channels without opening it', async () => {
    const { user, onOpenFiller, onAssignChannels } = renderView('table');
    await user.click(
      withinRow('Retro Ads').getByRole('button', {
        name: 'Assign to Channels',
      }),
    );
    expect(onAssignChannels).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'filler-ads' }),
    );
    expect(onOpenFiller).not.toHaveBeenCalled();
  });

  test('deletes a filler list only after confirmation', async () => {
    const { user, onOpenFiller, onDeleteFiller } = renderView('table');
    await user.click(
      withinRow('Retro Ads').getByRole('button', { name: 'Delete' }),
    );
    expect(onOpenFiller).not.toHaveBeenCalled();

    const dialog = screen.getByRole('dialog');
    expect(
      within(dialog).getByText(/Delete Filler List "Retro Ads"/),
    ).toBeVisible();
    expect(onDeleteFiller).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(onDeleteFiller).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'filler-ads' }),
    );
  });

  test('filters filler lists by program count', async () => {
    const { user } = renderView('table');
    expect(fillerNames()).toEqual(['Bumpers', 'Retro Ads']);
    await user.click(screen.getByRole('button', { name: 'Show/Hide filters' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Min # Programs' }),
      '10',
    );
    expect(fillerNames()).toEqual(['Retro Ads']);
  });
});

describe('FillerListsView cards', () => {
  test('shows one card per filler list with its count', () => {
    renderView('cards');
    const card = within(screen.getByRole('article', { name: 'Retro Ads' }));
    expect(
      card.getByText((_, el) => el?.textContent === '120 programs'),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });

  test('links the card to the editor', () => {
    renderView('cards');
    const card = within(screen.getByRole('article', { name: 'Bumpers' }));
    expect(card.getByRole('link', { name: 'Edit' })).toHaveAttribute(
      'href',
      '/library/fillers/filler-bumpers/edit',
    );
  });

  test('assigns a card to channels', async () => {
    const { user, onAssignChannels } = renderView('cards');
    await user.click(
      screen.getByRole('button', { name: 'Assign Bumpers to channels' }),
    );
    expect(onAssignChannels).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'filler-bumpers' }),
    );
  });

  test('deletes from a card after confirmation', async () => {
    const { user, onDeleteFiller } = renderView('cards');
    await user.click(screen.getByRole('button', { name: 'Delete Bumpers' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete',
      }),
    );
    expect(onDeleteFiller).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'filler-bumpers' }),
    );
  });

  test('counts filler lists in the header', () => {
    renderView('cards');
    expect(
      screen.getByText((_, el) => el?.textContent === '2 filler lists'),
    ).toBeInTheDocument();
  });

  test('offers to create the first filler list when there are none', () => {
    renderView('cards', []);
    expect(
      screen.getByRole('link', { name: 'Create a Filler List' }),
    ).toHaveAttribute('href', '/library/fillers/new');
  });
});
