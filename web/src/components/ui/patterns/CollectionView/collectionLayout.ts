export type CollectionLayout = 'cards' | 'table';

// Comfortable density shows cards and Dense shows a table. Phones always get
// cards, because a wide table cannot fit there.
export const collectionLayout = (
  dense: boolean,
  phone: boolean,
): CollectionLayout => (dense && !phone ? 'table' : 'cards');
