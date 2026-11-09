import useStore from '@/store/index.ts';
import { renderWithProviders, screen, within, withinRow } from '@/test/utils';
import type { SmartCollection } from '@tunarr/types';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { CollectionLayout } from '../ui/patterns/CollectionView/index.ts';
import { SmartCollectionsView } from './SmartCollectionsView.tsx';

vi.mock('@tanstack/react-router', () => import('@/test/routerMock.tsx'));

const collections: SmartCollection[] = [
  {
    uuid: 'uuid-action',
    name: 'Action Movies',
    keywords: '',
    filterString: 'type:movie AND genre:action',
  },
  { uuid: 'uuid-cartoons', name: 'Cartoons', keywords: 'animated' },
];

const renderView = (layout: CollectionLayout, items = collections) => {
  const onOpenCollection = vi.fn();
  const onEditCollection = vi.fn();
  const onDeleteCollection = vi.fn();
  const result = renderWithProviders(
    <SmartCollectionsView
      collections={items}
      layout={layout}
      onOpenCollection={onOpenCollection}
      onEditCollection={onEditCollection}
      onDeleteCollection={onDeleteCollection}
    />,
  );
  return { ...result, onOpenCollection, onEditCollection, onDeleteCollection };
};

beforeEach(() => {
  useStore.setState(({ settings }) => {
    settings.ui.tableSettings = {};
  });
});

describe('SmartCollectionsView table', () => {
  test('shows each collection with its query', () => {
    renderView('table');
    expect(
      withinRow('Action Movies').getByText('type:movie AND genre:action'),
    ).toBeInTheDocument();
    expect(withinRow('Cartoons').getByText(/animated/)).toBeInTheDocument();
  });

  test('opens a collection when its row is clicked', async () => {
    const { user, onOpenCollection } = renderView('table');
    await user.click(screen.getByText('Cartoons'));
    expect(onOpenCollection).toHaveBeenCalledWith(
      expect.objectContaining({ uuid: 'uuid-cartoons' }),
    );
  });

  test('links each row to the collection', () => {
    renderView('table');
    expect(
      withinRow('Cartoons').getByRole('link', { name: 'View Collection' }),
    ).toHaveAttribute('href', '/library/smart_collections/uuid-cartoons');
  });

  test('edits a row without opening it', async () => {
    const { user, onOpenCollection, onEditCollection } = renderView('table');
    await user.click(
      withinRow('Action Movies').getByRole('button', { name: 'Edit' }),
    );
    expect(onEditCollection).toHaveBeenCalledWith(
      expect.objectContaining({ uuid: 'uuid-action' }),
    );
    expect(onOpenCollection).not.toHaveBeenCalled();
  });

  test('deletes a collection only after confirmation', async () => {
    const { user, onOpenCollection, onDeleteCollection } = renderView('table');
    await user.click(
      withinRow('Cartoons').getByRole('button', { name: 'Delete' }),
    );
    expect(onOpenCollection).not.toHaveBeenCalled();

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Delete "Cartoons"')).toBeInTheDocument();
    expect(onDeleteCollection).not.toHaveBeenCalled();

    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(onDeleteCollection).toHaveBeenCalledWith(
      expect.objectContaining({ uuid: 'uuid-cartoons' }),
    );
  });
});

describe('SmartCollectionsView cards', () => {
  test('shows one card per collection with its query', () => {
    renderView('cards');
    const card = within(screen.getByRole('article', { name: 'Cartoons' }));
    expect(card.getByText(/“animated”/)).toBeInTheDocument();
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });

  test('links the card to the collection', () => {
    renderView('cards');
    const card = within(screen.getByRole('article', { name: 'Action Movies' }));
    expect(card.getByRole('link', { name: 'View' })).toHaveAttribute(
      'href',
      '/library/smart_collections/uuid-action',
    );
  });

  test('edits from a card', async () => {
    const { user, onEditCollection } = renderView('cards');
    await user.click(screen.getByRole('button', { name: 'Edit Cartoons' }));
    expect(onEditCollection).toHaveBeenCalledWith(
      expect.objectContaining({ uuid: 'uuid-cartoons' }),
    );
  });

  test('deletes from a card after confirmation', async () => {
    const { user, onDeleteCollection } = renderView('cards');
    await user.click(screen.getByRole('button', { name: 'Delete Cartoons' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete',
      }),
    );
    expect(onDeleteCollection).toHaveBeenCalledWith(
      expect.objectContaining({ uuid: 'uuid-cartoons' }),
    );
  });

  test('counts collections in the header', () => {
    renderView('cards');
    expect(
      screen.getByText((_, el) => el?.textContent === '2 smart collections'),
    ).toBeInTheDocument();
  });

  test('points to search when there are none', () => {
    renderView('cards', []);
    expect(
      screen.getByRole('link', { name: 'Search the Library' }),
    ).toHaveAttribute('href', '/search');
  });
});
