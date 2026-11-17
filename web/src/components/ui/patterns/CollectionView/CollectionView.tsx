import { useThemeTokens } from '@/hooks/useTunarrTheme.ts';
import { Box, useMediaQuery } from '@mui/material';
import type { PaginationState } from '@tanstack/react-table';
import { clamp } from 'lodash-es';
import type { ReactNode } from 'react';
import { TablePager } from '../../table/TablePager.tsx';
import { lastPageIndex } from '../../table/tunarrTable.ts';
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

  // Pages the cards. Pass the table's state so both layouts share a page size.
  pagination?: {
    state: PaginationState;
    onChange: (state: PaginationState) => void;
  };
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
  pagination,
}: CollectionViewProps<TItem>) => {
  const { theme, tokens, dense } = useThemeTokens();
  const phone = useMediaQuery(theme.breakpoints.down('sm'));
  const resolved = layout ?? collectionLayout(dense, phone);

  if (resolved === 'table') {
    return table;
  }

  if (items.length === 0) {
    return empty ?? null;
  }

  const pageSize = pagination?.state.pageSize ?? items.length;
  const pageIndex = clamp(
    pagination?.state.pageIndex ?? 0,
    0,
    lastPageIndex(items.length, pageSize),
  );
  const shown = items.slice(pageIndex * pageSize, (pageIndex + 1) * pageSize);

  const grid = (
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
        // Every row takes the height of the tallest card on the page.
        gridAutoRows: '1fr',
        gap: dense ? 1.5 : 2.5,
      }}
    >
      {shown.map((item) => (
        <Box component="li" key={getItemKey(item)} sx={{ display: 'flex' }}>
          {renderCard(item)}
        </Box>
      ))}
    </Box>
  );

  if (!pagination) {
    return grid;
  }

  return (
    <>
      {grid}
      <Box
        sx={{
          mt: dense ? 1.5 : 2.5,
          border: `1px solid ${tokens.border}`,
          borderRadius: `${theme.sizes.radiusCard}px`,
          backgroundColor: tokens.surface,
        }}
      >
        <TablePager
          count={items.length}
          pageIndex={pageIndex}
          pageSize={pageSize}
          onPageChange={(page) =>
            pagination.onChange({ pageIndex: page, pageSize })
          }
          onPageSizeChange={(size) =>
            pagination.onChange({ pageIndex: 0, pageSize: size })
          }
        />
      </Box>
    </>
  );
};
