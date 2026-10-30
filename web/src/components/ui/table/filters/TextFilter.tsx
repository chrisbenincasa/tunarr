import { useLingui } from '@lingui/react/macro';
import { TextField } from '@mui/material';
import type { RowData } from '@tanstack/react-table';
import { type TunarrColumn, columnLabel } from '../tunarrTable.ts';

type TextFilterProps<TData extends RowData> = {
  column: TunarrColumn<TData>;
};

export const TextFilter = <TData extends RowData>({
  column,
}: TextFilterProps<TData>) => {
  const { t } = useLingui();
  const label = columnLabel(column);
  const value = column.getFilterValue();

  return (
    <TextField
      size="small"
      variant="standard"
      fullWidth
      placeholder={t`Filter by ${label}`}
      value={typeof value === 'string' ? value : ''}
      onChange={(e) => column.setFilterValue(e.target.value)}
      slotProps={{ htmlInput: { 'aria-label': t`Filter by ${label}` } }}
    />
  );
};
