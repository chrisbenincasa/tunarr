import { renderWithProviders, screen, within } from '@/test/utils';
import type { PaginationState } from '@tanstack/react-table';
import { useMemo, useState } from 'react';
import { describe, expect, test, vi } from 'vitest';
import { DataTable } from './DataTable.tsx';
import { actionsColumn } from './columns.tsx';
import { createAppColumnHelper, useTunarrTable } from './tunarrTable.ts';

type Item = { id: string; name: string; count: number };

const items: Item[] = [
  { id: 'b', name: 'Bravo', count: 2 },
  { id: 'a', name: 'Alpha', count: 10 },
  { id: 'c', name: 'Charlie', count: 5 },
];

const columnHelper = createAppColumnHelper<Item>();

const Harness = ({
  data = items,
  onRowClick,
  onAction,
  emptyFallback,
  loading,
  initialPagination = { pageIndex: 0, pageSize: 10 },
}: {
  data?: Item[];
  onRowClick?: (item: Item) => void;
  onAction?: (item: Item) => void;
  emptyFallback?: string;
  loading?: boolean;
  initialPagination?: PaginationState;
}) => {
  const [pagination, setPagination] = useState(initialPagination);
  const columns = useMemo(
    () => [
      ...columnHelper.columns([
        columnHelper.accessor('name', { header: 'Name' }),
        columnHelper.accessor('count', {
          header: 'Count',
          meta: { filterVariant: 'range', numeric: true },
        }),
      ]),
      actionsColumn<Item>({
        render: ({ original }) => (
          <button onClick={() => onAction?.(original)}>Act</button>
        ),
      }),
    ],
    [onAction],
  );
  const table = useTunarrTable({
    columns,
    data,
    state: { pagination },
    onPaginationChange: setPagination,
  });
  return (
    <DataTable
      table={table}
      aria-label="Items"
      emptyFallback={emptyFallback}
      loading={loading}
      getRowProps={(row) => ({
        onClick: onRowClick ? () => onRowClick(row.original) : undefined,
      })}
    />
  );
};

const names = () =>
  within(screen.getAllByRole('rowgroup')[1])
    .getAllByRole('row')
    .map((row) => within(row).getAllByRole('cell')[0].textContent);

describe('DataTable', () => {
  test('sorts by a column and labels the sort button', async () => {
    const { user } = renderWithProviders(<Harness />);
    expect(names()).toEqual(['Bravo', 'Alpha', 'Charlie']);

    await user.click(
      screen.getByRole('button', { name: 'Sort by Name ascending' }),
    );
    expect(names()).toEqual(['Alpha', 'Bravo', 'Charlie']);

    await user.click(
      screen.getByRole('button', { name: 'Sorted by Name ascending' }),
    );
    expect(names()).toEqual(['Charlie', 'Bravo', 'Alpha']);
    expect(
      screen.getByRole('button', { name: 'Sorted by Name descending' }),
    ).toBeInTheDocument();
  });

  test('numeric columns sort descending first', () => {
    renderWithProviders(<Harness />);
    expect(
      screen.getByRole('button', { name: 'Sort by Count descending' }),
    ).toBeInTheDocument();
  });

  test('range filter keeps rows inside the bounds and counts as active', async () => {
    const { user } = renderWithProviders(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Show/Hide filters' }));
    await user.type(screen.getByRole('textbox', { name: 'Min Count' }), '3');
    expect(names()).toEqual(['Alpha', 'Charlie']);
    await user.type(screen.getByRole('textbox', { name: 'Max Count' }), '6');
    expect(names()).toEqual(['Charlie']);

    expect(
      screen.getByRole('button', { name: 'Show/Hide filters (1 active)' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(names()).toHaveLength(3);
    expect(screen.getByRole('textbox', { name: 'Min Count' })).toHaveValue('');
    expect(screen.getByRole('textbox', { name: 'Max Count' })).toHaveValue('');
  });

  test('range filter keeps partial decimal input', async () => {
    const { user } = renderWithProviders(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Show/Hide filters' }));
    const min = screen.getByRole('textbox', { name: 'Min Count' });
    await user.type(min, '4.');
    expect(min).toHaveValue('4.');
    await user.type(min, '5');
    expect(min).toHaveValue('4.5');
    expect(names()).toEqual(['Alpha', 'Charlie']);
  });

  test('global search filters rows across columns', async () => {
    const { user } = renderWithProviders(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Show/Hide search' }));
    await user.type(screen.getByRole('textbox', { name: 'Search' }), 'arl');
    expect(names()).toEqual(['Charlie']);

    await user.clear(screen.getByRole('textbox', { name: 'Search' }));
    await user.type(screen.getByRole('textbox', { name: 'Search' }), '10');
    expect(names()).toEqual(['Alpha']);

    // Search is not a column filter, so it adds no count or clear button.
    expect(
      screen.getByRole('button', { name: 'Show/Hide filters' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Clear filters' }),
    ).not.toBeInTheDocument();
  });

  test('moves an out-of-range page index onto the last page', async () => {
    const many = Array.from({ length: 12 }, (_, i) => ({
      id: String(i),
      name: `Item ${String(i + 1).padStart(2, '0')}`,
      count: i,
    }));
    renderWithProviders(
      <Harness data={many} initialPagination={{ pageIndex: 5, pageSize: 5 }} />,
    );
    expect(await screen.findByText('11–12 of 12')).toBeInTheDocument();
    expect(names()).toEqual(['Item 11', 'Item 12']);
  });

  test('shows no empty message while loading', () => {
    renderWithProviders(<Harness data={[]} loading />);
    expect(screen.queryByText('No records to display')).not.toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  test('text filter matches part of a value', async () => {
    const { user } = renderWithProviders(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Show/Hide filters' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Filter by Name' }),
      'arl',
    );
    expect(names()).toEqual(['Charlie']);
  });

  test('hides a column from the visibility menu', async () => {
    const { user } = renderWithProviders(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Show/Hide columns' }));
    const menu = screen.getByRole('menu');
    expect(
      within(menu).queryByRole('checkbox', { name: /Actions/ }),
    ).not.toBeInTheDocument();
    await user.click(
      within(menu).getByRole('checkbox', { name: 'Toggle visibility Count' }),
    );
    await user.keyboard('{Escape}');
    expect(
      screen.queryByRole('button', { name: 'Sort by Count descending' }),
    ).not.toBeInTheDocument();
    expect(names()).toEqual(['Bravo', 'Alpha', 'Charlie']);
  });

  test('row action clicks do not trigger the row click', async () => {
    const onRowClick = vi.fn();
    const onAction = vi.fn();
    const { user } = renderWithProviders(
      <Harness onRowClick={onRowClick} onAction={onAction} />,
    );
    const [firstAction] = screen.getAllByRole('button', { name: 'Act' });
    await user.click(firstAction);
    expect(onAction).toHaveBeenCalledWith(items[0]);
    expect(onRowClick).not.toHaveBeenCalled();

    await user.click(screen.getByRole('cell', { name: 'Bravo' }));
    expect(onRowClick).toHaveBeenCalledWith(items[0]);
  });

  test('shows the empty fallback only when there is no data', async () => {
    const { user, unmount } = renderWithProviders(
      <Harness data={[]} emptyFallback="Nothing here yet" />,
    );
    expect(screen.getByText('Nothing here yet')).toBeInTheDocument();
    unmount();

    renderWithProviders(<Harness emptyFallback="Nothing here yet" />);
    await user.click(screen.getByRole('button', { name: 'Show/Hide filters' }));
    await user.type(
      screen.getByRole('textbox', { name: 'Filter by Name' }),
      'zzz',
    );
    expect(screen.queryByText('Nothing here yet')).not.toBeInTheDocument();
    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  test('never offers an unbounded page size', async () => {
    const { user } = renderWithProviders(<Harness />);
    await user.click(screen.getByRole('combobox', { name: /Rows per page/ }));
    const options = screen
      .getAllByRole('option')
      .map((o) => Number(o.textContent));
    expect(options.every(Number.isFinite)).toBe(true);
  });
});
