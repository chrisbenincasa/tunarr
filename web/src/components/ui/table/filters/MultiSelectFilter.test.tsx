import { renderWithProviders, screen, within } from '@/test/utils';
import { useMemo } from 'react';
import { describe, expect, test } from 'vitest';
import { DataTable } from '../DataTable.tsx';
import { createAppColumnHelper, useTunarrTable } from '../tunarrTable.ts';

type Line = { id: string; message: string; level: string };

const lines: Line[] = [
  { id: '1', message: 'Server started', level: 'info' },
  { id: '2', message: 'Disk almost full', level: 'warn' },
  { id: '3', message: 'Scan failed', level: 'error' },
  { id: '4', message: 'Request handled', level: 'info' },
];

const columnHelper = createAppColumnHelper<Line>();

const Harness = () => {
  const columns = useMemo(
    () =>
      columnHelper.columns([
        columnHelper.accessor('message', { header: 'Message' }),
        columnHelper.accessor('level', {
          header: 'Level',
          filterFn: 'arrHas',
          meta: {
            filterVariant: 'multi-select',
            filterOptions: ['error', 'warn', 'info'],
          },
        }),
      ]),
    [],
  );
  const table = useTunarrTable({ columns, data: lines });
  return <DataTable table={table} aria-label="Logs" />;
};

// The open menu hides the rest of the page from the accessibility tree.
const messages = () =>
  within(screen.getAllByRole('rowgroup', { hidden: true })[1])
    .getAllByRole('row', { hidden: true })
    .map(
      (row) => within(row).getAllByRole('cell', { hidden: true })[0].textContent,
    );

describe('MultiSelectFilter', () => {
  test('keeps rows matching any checked option', async () => {
    const { user } = renderWithProviders(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Show/Hide filters' }));
    await user.click(screen.getByRole('combobox', { name: 'Filter by Level' }));

    await user.click(screen.getByRole('option', { name: 'error' }));
    expect(messages()).toEqual(['Scan failed']);

    await user.click(screen.getByRole('option', { name: 'warn' }));
    expect(messages()).toEqual(['Disk almost full', 'Scan failed']);
    expect(
      screen.getByRole('button', {
        name: 'Show/Hide filters (1 active)',
        hidden: true,
      }),
    ).toBeInTheDocument();
  });

  test('unchecking every option clears the filter', async () => {
    const { user } = renderWithProviders(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Show/Hide filters' }));
    await user.click(screen.getByRole('combobox', { name: 'Filter by Level' }));
    await user.click(screen.getByRole('option', { name: 'info' }));
    expect(messages()).toEqual(['Server started', 'Request handled']);

    await user.click(screen.getByRole('option', { name: 'info' }));
    expect(messages()).toHaveLength(lines.length);
    expect(
      screen.queryByRole('button', { name: 'Clear filters', hidden: true }),
    ).not.toBeInTheDocument();
  });
});
