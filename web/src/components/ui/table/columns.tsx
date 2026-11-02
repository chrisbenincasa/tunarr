import { Box } from '@mui/material';
import type { DisplayColumnDef, Row, RowData } from '@tanstack/react-table';
import type { ReactNode } from 'react';
import { ActionsHeader } from './ActionsHeader.tsx';
import { SelectPageCheckbox, SelectRowCheckbox } from './SelectCheckboxes.tsx';
import {
  ActionsColumnId,
  SelectColumnId,
  type TunarrFeatures,
} from './tunarrTable.ts';

type ActionsColumnOptions<TData extends RowData> = {
  render: (row: Row<TunarrFeatures, TData>) => ReactNode;
};

// Row action buttons. Place the column first or last in the column list;
// DataTable aligns it to that edge. Clicks inside it never reach the row's
// own click handler.
export const actionsColumn = <TData extends RowData>({
  render,
}: ActionsColumnOptions<TData>): DisplayColumnDef<
  TunarrFeatures,
  TData,
  unknown
> => ({
  id: ActionsColumnId,
  header: () => <ActionsHeader />,
  cell: ({ row }) => (
    <Box sx={{ display: 'inline-flex', gap: 0.5 }}>{render(row)}</Box>
  ),
  enableSorting: false,
  enableHiding: false,
  enableColumnFilter: false,
  enableGlobalFilter: false,
  meta: { width: '1%' },
});

type SelectColumnOptions<TData extends RowData> = {
  // Names the row in its checkbox label, as in "Select Classic Sitcoms".
  getLabel: (row: TData) => string;
};

// Row checkboxes, with a header checkbox for the current page. Place it first.
// Clicks inside it never reach the row's own click handler.
export const selectColumn = <TData extends RowData>({
  getLabel,
}: SelectColumnOptions<TData>): DisplayColumnDef<
  TunarrFeatures,
  TData,
  unknown
> => ({
  id: SelectColumnId,
  header: ({ table }) => <SelectPageCheckbox table={table} />,
  cell: ({ row }) => (
    <SelectRowCheckbox row={row} label={getLabel(row.original)} />
  ),
  enableSorting: false,
  enableHiding: false,
  enableColumnFilter: false,
  enableGlobalFilter: false,
  meta: { width: '1%' },
});
