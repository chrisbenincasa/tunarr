import { Box, Typography } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useMemo } from 'react';
import { EmptyState } from '../../EmptyState.tsx';
import { MonoText } from '../../MonoText.tsx';
import { DataTable } from '../../table/DataTable.tsx';
import {
  createAppColumnHelper,
  useTunarrTable,
} from '../../table/tunarrTable.ts';
import { CollectionView } from './CollectionView.tsx';
import type { CollectionLayout } from './collectionLayout.ts';

type Item = { id: string; name: string; count: number };

const items: Item[] = [
  { id: 'a', name: 'Sci-Fi Shorts', count: 42 },
  { id: 'b', name: 'Holiday Specials', count: 118 },
  { id: 'c', name: 'Station Idents', count: 9 },
  {
    id: 'd',
    name: 'An Extremely Long Playlist Name That Has To Wrap Somewhere',
    count: 12_480,
  },
];

const columnHelper = createAppColumnHelper<Item>();

const Demo = ({
  data,
  layout,
}: {
  data: Item[];
  layout?: CollectionLayout;
}) => {
  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('name', { header: 'Name' }),
        columnHelper.accessor('count', {
          header: 'Items',
          meta: { numeric: true },
        }),
      ]),
    [],
  );
  const table = useTunarrTable({ columns, data });
  const empty = <EmptyState title="Nothing here yet" />;

  return (
    <CollectionView
      aria-label="Playlists"
      layout={layout}
      items={data}
      getItemKey={(item) => item.id}
      empty={empty}
      renderCard={(item) => (
        <Box
          sx={(theme) => ({
            flex: 1,
            p: 2,
            border: `1px solid ${theme.palette.tokens.border}`,
            borderRadius: `${theme.sizes.radiusCard}px`,
            backgroundColor: theme.palette.tokens.surface,
          })}
        >
          <Typography sx={{ fontWeight: 600, overflowWrap: 'anywhere' }}>
            {item.name}
          </Typography>
          <Typography color="text.secondary">
            <MonoText>{item.count}</MonoText> items
          </Typography>
        </Box>
      )}
      table={
        <DataTable table={table} aria-label="Playlists" emptyFallback={empty} />
      }
    />
  );
};

// Comfortable shows cards and Dense shows the table. Switch density in the
// toolbar, or use the stories that force one layout.
const meta = {
  title: 'Patterns/CollectionView',
  component: Demo,
  args: { data: items },
} satisfies Meta<typeof Demo>;

export default meta;

type Story = StoryObj<typeof meta>;

export const FollowsDensity: Story = {};

export const Cards: Story = { args: { layout: 'cards' } };

export const Table: Story = { args: { layout: 'table' } };

export const Empty: Story = { args: { data: [] } };
