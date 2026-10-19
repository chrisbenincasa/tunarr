import { Add, Delete, Edit, PlayArrow } from '@mui/icons-material';
import { Button, IconButton, Tooltip, Typography } from '@mui/material';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useMemo } from 'react';
import { StatusPill } from '../StatusPill.tsx';
import { DataTable, type DataTableProps } from './DataTable.tsx';
import { actionsColumn } from './columns.tsx';
import { createAppColumnHelper, useTunarrTable } from './tunarrTable.ts';
import { useStoreBackedTableSettings } from './useStoreBackedTableSettings.ts';

type DemoChannel = {
  id: string;
  number: number;
  name: string;
  programs: number;
  watching: number;
  transcode: string;
};

const channels: DemoChannel[] = [
  ['Saturday Morning Cartoons', 1, 412, 2, 'Default'],
  ['Classic Sitcoms', 2, 1286, 0, 'NVENC 1080p'],
  ['80s Movie Night', 3, 64, 0, 'Default'],
  ['Sci-Fi Marathon', 4, 548, 1, 'NVENC 1080p'],
  ['Nature Docs', 5, 92, 0, 'Default'],
  ['Music Videos', 7, 2310, 0, 'Default'],
  ['Kids Block', 12, 330, 0, 'Default'],
].map(([name, number, programs, watching, transcode]) => ({
  id: `channel-${number}`,
  name: String(name),
  number: Number(number),
  programs: Number(programs),
  watching: Number(watching),
  transcode: String(transcode),
}));

const longText: DemoChannel[] = [
  {
    id: 'long',
    number: 1024,
    name: 'The Extremely Long Saturday Morning Cartoon Marathon Channel',
    programs: 12_480,
    watching: 3,
    transcode: 'Intel QuickSync HEVC 2160p with tone mapping',
  },
  ...channels,
];

const manyRows: DemoChannel[] = Array.from({ length: 64 }, (_, i) => ({
  id: `bulk-${i}`,
  number: i + 100,
  name: `Channel ${i + 100}`,
  programs: (i * 37) % 500,
  watching: i % 9 === 0 ? 1 : 0,
  transcode: i % 3 === 0 ? 'NVENC 1080p' : 'Default',
}));

const columnHelper = createAppColumnHelper<DemoChannel>();

const useDemoColumns = (withActions: 'none' | 'first' | 'last') =>
  useMemo(() => {
    const data = columnHelper.columns([
      columnHelper.accessor('number', {
        header: '#',
        meta: { label: 'Number', numeric: true, width: 72 },
      }),
      columnHelper.accessor('name', { header: 'Name' }),
      columnHelper.accessor('watching', {
        header: 'Status',
        enableColumnFilter: false,
        cell: ({ getValue }) => {
          const watching = getValue();
          return watching > 0 ? (
            <StatusPill status="live" label={`${watching} watching`} />
          ) : (
            <StatusPill status="idle" label="Idle" />
          );
        },
      }),
      columnHelper.accessor('programs', {
        header: 'Programs',
        meta: { numeric: true, filterVariant: 'range' },
      }),
      columnHelper.accessor('transcode', { header: 'Transcode' }),
    ]);

    if (withActions === 'none') {
      return data;
    }

    const actions = actionsColumn<DemoChannel>({
      render: ({ original }) => (
        <>
          <Tooltip title="Watch">
            <IconButton aria-label={`Watch ${original.name}`} size="small">
              <PlayArrow fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Edit">
            <IconButton aria-label={`Edit ${original.name}`} size="small">
              <Edit fontSize="small" />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete">
            <IconButton aria-label={`Delete ${original.name}`} size="small">
              <Delete fontSize="small" />
            </IconButton>
          </Tooltip>
        </>
      ),
    });
    return withActions === 'first' ? [actions, ...data] : [...data, actions];
  }, [withActions]);

type DemoProps = Omit<DataTableProps<DemoChannel>, 'table'> & {
  data: DemoChannel[];
  actions?: 'none' | 'first' | 'last';
  pageSize?: number;
};

const DemoTable = ({
  data,
  actions = 'last',
  pageSize = 10,
  ...props
}: DemoProps) => {
  const columns = useDemoColumns(actions);
  const table = useTunarrTable({
    columns,
    data,
    initialState: { pagination: { pageIndex: 0, pageSize } },
  });
  return <DataTable table={table} aria-label="Channels" {...props} />;
};

const PersistedDemo = () => {
  const columns = useDemoColumns('last');
  const settings = useStoreBackedTableSettings('StorybookDemo');
  const table = useTunarrTable({ columns, data: channels, ...settings });
  return <DataTable table={table} aria-label="Channels" />;
};

const meta = {
  title: 'Patterns/DataTable',
  component: DemoTable,
  args: { data: channels },
} satisfies Meta<typeof DemoTable>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const DenseDark: Story = {
  globals: { density: 'dense', scheme: 'dark' },
};

export const ComfortableLight: Story = {
  globals: { density: 'comfortable', scheme: 'light' },
};

export const DenseLight: Story = {
  globals: { density: 'dense', scheme: 'light' },
};

export const ClickableRows: Story = {
  args: {
    getRowProps: () => ({ onClick: () => {} }),
  },
};

export const ActionsFirst: Story = { args: { actions: 'first' } };

export const NoActions: Story = { args: { actions: 'none' } };

export const WithToolbarActions: Story = {
  args: {
    toolbarActions: (
      <Button variant="contained" startIcon={<Add />}>
        New channel
      </Button>
    ),
  },
};

export const FiltersOpen: Story = { args: { defaultShowFilters: true } };

export const Loading: Story = { args: { data: [], loading: true } };

export const Empty: Story = {
  args: {
    data: [],
    emptyFallback: (
      <Typography sx={{ py: 4, textAlign: 'center', fontStyle: 'italic' }}>
        You have no channels yet.
      </Typography>
    ),
  },
};

export const EmptyDefaultMessage: Story = { args: { data: [] } };

export const LongText: Story = { args: { data: longText } };

export const Paginated: Story = { args: { data: manyRows, pageSize: 25 } };

// Sort, hide a column or change the page size, then reload the story. The
// settings persist in local storage under the StorybookDemo table name.
export const PersistedSettings: Story = {
  render: () => <PersistedDemo />,
};
