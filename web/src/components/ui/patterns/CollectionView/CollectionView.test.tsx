import { renderWithProviders, screen } from '@/test/utils';
import { describe, expect, test } from 'vitest';
import { CollectionView } from './CollectionView.tsx';

const items = ['Alpha', 'Bravo'];

const renderCards = (equalRowHeights?: boolean) =>
  renderWithProviders(
    <CollectionView
      aria-label="Items"
      layout="cards"
      items={items}
      getItemKey={(item) => item}
      renderCard={(item) => <span>{item}</span>}
      table={null}
      equalRowHeights={equalRowHeights}
    />,
  );

describe('CollectionView cards', () => {
  test('gives every row the tallest card height by default', () => {
    renderCards();
    expect(screen.getByRole('list', { name: 'Items' })).toHaveStyle({
      gridAutoRows: '1fr',
    });
  });

  test('lets rows size to their cards when equal heights are off', () => {
    renderCards(false);
    expect(screen.getByRole('list', { name: 'Items' })).not.toHaveStyle({
      gridAutoRows: '1fr',
    });
  });
});
