import { useLingui } from '@lingui/react/macro';
import { MenuItem, TextField } from '@mui/material';
import type { RowData } from '@tanstack/react-table';
import { type TunarrColumn, columnLabel } from '../tunarrTable.ts';

type BooleanFilterProps<TData extends RowData> = {
  column: TunarrColumn<TData>;
};

type Choice = 'any' | 'yes' | 'no';

const toChoice = (value: unknown): Choice =>
  value === true ? 'yes' : value === false ? 'no' : 'any';

// Pair with filterFn: 'equals' on the column.
export const BooleanFilter = <TData extends RowData>({
  column,
}: BooleanFilterProps<TData>) => {
  const { t } = useLingui();
  const label = columnLabel(column);

  return (
    <TextField
      select
      size="small"
      variant="standard"
      fullWidth
      value={toChoice(column.getFilterValue())}
      onChange={(e) => {
        const choice = e.target.value;
        column.setFilterValue(
          choice === 'yes' ? true : choice === 'no' ? false : undefined,
        );
      }}
      slotProps={{
        select: { inputProps: { 'aria-label': t`Filter by ${label}` } },
      }}
    >
      <MenuItem value="any">{t`Any`}</MenuItem>
      <MenuItem value="yes">{t`Yes`}</MenuItem>
      <MenuItem value="no">{t`No`}</MenuItem>
    </TextField>
  );
};
