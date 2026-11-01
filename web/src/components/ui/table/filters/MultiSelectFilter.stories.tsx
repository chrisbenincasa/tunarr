import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ColumnFiltersState } from '@tanstack/react-table';
import { useMemo } from 'react';
import { DataTable } from '../DataTable.tsx';
import { createAppColumnHelper, useTunarrTable } from '../tunarrTable.ts';

type LogRow = { id: string; timestamp: string; level: string; message: string };

const levels = ['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'http'];

const logs: LogRow[] = [
  {
    id: '1',
    timestamp: '2026-11-01T14:02:11.204Z',
    level: 'info',
    message: 'Server listening on port 8000',
  },
  {
    id: '2',
    timestamp: '2026-11-01T14:02:12.880Z',
    level: 'warn',
    message: 'Media source "Basement Plex" is slow to respond',
  },
  {
    id: '3',
    timestamp: '2026-11-01T14:03:40.017Z',
    level: 'error',
    message: 'Library scan failed: connection reset',
  },
  {
    id: '4',
    timestamp: '2026-11-01T14:04:02.551Z',
    level: 'debug',
    message: 'Guide rebuilt for 3 channels',
  },
];

const columnHelper = createAppColumnHelper<LogRow>();

const MultiSelectFilterDemo = ({
  initialFilters = [],
}: {
  initialFilters?: ColumnFiltersState;
}) => {
  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('timestamp', {
          header: 'Timestamp',
          enableColumnFilter: false,
        }),
        columnHelper.accessor('level', {
          header: 'Level',
          filterFn: 'arrHas',
          meta: { filterVariant: 'multi-select', filterOptions: levels },
        }),
        columnHelper.accessor('message', {
          header: 'Message',
          enableColumnFilter: false,
        }),
      ]),
    [],
  );
  const table = useTunarrTable({
    columns,
    data: logs,
    initialState: { columnFilters: initialFilters },
  });
  return <DataTable table={table} aria-label="System logs" defaultShowFilters />;
};

const meta = {
  title: 'Patterns/DataTable/MultiSelectFilter',
  component: MultiSelectFilterDemo,
} satisfies Meta<typeof MultiSelectFilterDemo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Blank: Story = {};

export const OneOption: Story = {
  args: { initialFilters: [{ id: 'level', value: ['error'] }] },
};

export const SeveralOptions: Story = {
  args: { initialFilters: [{ id: 'level', value: ['error', 'warn'] }] },
};

export const NoMatches: Story = {
  args: { initialFilters: [{ id: 'level', value: ['fatal'] }] },
};

export const DenseDark: Story = {
  args: { initialFilters: [{ id: 'level', value: ['error', 'warn'] }] },
  globals: { density: 'dense', scheme: 'dark' },
};
