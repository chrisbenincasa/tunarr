import { useLingui } from '@lingui/react/macro';
import { Checkbox } from '@mui/material';
import type { Row, RowData, Table } from '@tanstack/react-table';
import type { TunarrFeatures } from './tunarrTable.ts';

export const SelectPageCheckbox = <TData extends RowData>({
  table,
}: {
  table: Table<TunarrFeatures, TData>;
}) => {
  const { t } = useLingui();
  const all = table.getIsAllPageRowsSelected();
  return (
    <Checkbox
      size="small"
      checked={all}
      indeterminate={!all && table.getIsSomePageRowsSelected()}
      onChange={table.getToggleAllPageRowsSelectedHandler()}
      slotProps={{ input: { 'aria-label': t`Select all on this page` } }}
      sx={{ p: 0.5 }}
    />
  );
};

export const SelectRowCheckbox = <TData extends RowData>({
  row,
  label,
}: {
  row: Row<TunarrFeatures, TData>;
  label: string;
}) => {
  const { t } = useLingui();
  return (
    <Checkbox
      size="small"
      checked={row.getIsSelected()}
      disabled={!row.getCanSelect()}
      onChange={row.getToggleSelectedHandler()}
      slotProps={{ input: { 'aria-label': t`Select ${label}` } }}
      sx={{ p: 0.5 }}
    />
  );
};
