import { useThemeTokens } from '@/hooks/useTunarrTheme.ts';
import { Box, useMediaQuery } from '@mui/material';
import type { ReactNode } from 'react';
import { type CollectionLayout, collectionLayout } from './collectionLayout.ts';

export type CollectionViewProps<TItem> = {
  items: readonly TItem[];
  getItemKey: (item: TItem) => string;
  renderCard: (item: TItem) => ReactNode;

  // The Dense layout, usually a DataTable over the same items.
  table: ReactNode;

  // Shown in place of the cards when there are no items. The table shows its
  // own empty fallback.
  empty?: ReactNode;
  'aria-label': string;

  // Forces one layout. Stories use it; pages leave it unset.
  layout?: CollectionLayout;

  // Narrowest a card may get before the grid drops a column.
  minCardWidth?: number;
};

// A page's list of items. Comfortable density shows a card grid and Dense
// shows the table, so pages build both and this picks one.
export const CollectionView = <TItem,>({
  items,
  getItemKey,
  renderCard,
  table,
  empty,
  'aria-label': ariaLabel,
  layout,
  minCardWidth = 300,
}: CollectionViewProps<TItem>) => {
  const { theme, dense } = useThemeTokens();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const resolved = layout ?? collectionLayout(dense, phone);

  if (resolved === 'table') {
    return table;
  }

  if (items.length === 0) {
    return empty ?? null;
  }

  return (
    <Box
      component="ul"
      aria-label={ariaLabel}
      sx={{
        listStyle: 'none',
        m: 0,
        p: 0,
        display: 'grid',
        gridTemplateColumns: {
          xs: '1fr',
          sm: `repeat(auto-fill, minmax(${minCardWidth}px, 1fr))`,
        },
        gap: dense ? 1.5 : 2.5,
      }}
    >
      {items.map((item) => (
        <Box component="li" key={getItemKey(item)} sx={{ display: 'flex' }}>
          {renderCard(item)}
        </Box>
      ))}
    </Box>
  );
};
