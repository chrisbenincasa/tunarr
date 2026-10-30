import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ColumnFiltersState } from '@tanstack/react-table';
import { useMemo } from 'react';
import { DataTable } from '../DataTable.tsx';
import { createAppColumnHelper, useTunarrTable } from '../tunarrTable.ts';

type FillerRow = { id: string; name: string; contentCount: number };

const fillers: FillerRow[] = [
  { id: '1', name: 'Bumpers', contentCount: 2 },
  { id: '2', name: 'Idents', contentCount: 1 },
  { id: '3', name: 'Station IDs', contentCount: 48 },
  { id: '4', name: 'Holiday Promos', contentCount: 1250 },
];

const columnHelper = createAppColumnHelper<FillerRow>();

const RangeFilterDemo = ({
  initialFilters = [],
}: {
  initialFilters?: ColumnFiltersState;
}) => {
  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('name', {
          header: 'Name',
          enableColumnFilter: false,
        }),
        columnHelper.accessor('contentCount', {
          header: '# Programs',
          meta: { filterVariant: 'range', numeric: true },
        }),
      ]),
    [],
  );
  const table = useTunarrTable({
    columns,
    data: fillers,
    initialState: { columnFilters: initialFilters },
  });
  return (
    <DataTable table={table} aria-label="Filler lists" defaultShowFilters />
  );
};

const meta = {
  title: 'Patterns/DataTable/RangeFilter',
  component: RangeFilterDemo,
} satisfies Meta<typeof RangeFilterDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Blank: Story = {};

export const MinOnly: Story = {
  args: { initialFilters: [{ id: 'contentCount', value: [2, undefined] }] },
};

export const MinAndMax: Story = {
  args: { initialFilters: [{ id: 'contentCount', value: [2, 100] }] },
};

export const NoMatches: Story = {
  args: { initialFilters: [{ id: 'contentCount', value: [5000, undefined] }] },
};

export const DenseLight: Story = {
  args: { initialFilters: [{ id: 'contentCount', value: [2, 100] }] },
  globals: { density: 'dense', scheme: 'light' },
};
