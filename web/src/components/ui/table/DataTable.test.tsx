import { renderWithProviders, screen, within } from '@/test/utils';
import { useMemo } from 'react';
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
}: {
  data?: Item[];
  onRowClick?: (item: Item) => void;
  onAction?: (item: Item) => void;
  emptyFallback?: string;
}) => {
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
  const table = useTunarrTable({ columns, data });
  return (
    <DataTable
      table={table}
      aria-label="Items"
      emptyFallback={emptyFallback}
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
    await user.type(screen.getByRole('textbox', { name: 'Min' }), '3');
    expect(names()).toEqual(['Alpha', 'Charlie']);
    await user.type(screen.getByRole('textbox', { name: 'Max' }), '6');
    expect(names()).toEqual(['Charlie']);

    expect(
      screen.getByRole('button', { name: 'Show/Hide filters (1 active)' }),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(names()).toHaveLength(3);
    expect(screen.getByRole('textbox', { name: 'Min' })).toHaveValue('');
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
    expect(
      screen.queryByRole('columnheader', { name: /^Count/ }),
    ).not.toBeInTheDocument();
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
