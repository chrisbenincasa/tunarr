import { useLingui } from '@lingui/react/macro';
import { Stack, TextField } from '@mui/material';
import type { RowData } from '@tanstack/react-table';
import type { TunarrColumn } from '../tunarrTable.ts';
import {
  type RangeFilterValue,
  parseBound,
  toRangeFilterValue,
} from './rangeFilterValue.ts';

type RangeFilterProps<TData extends RowData> = {
  column: TunarrColumn<TData>;
};

// Inclusive min and max bounds. Either may be blank. Pairs with the
// inNumberRange filter function, which 'auto' picks for numeric columns.
export const RangeFilter = <TData extends RowData>({
  column,
}: RangeFilterProps<TData>) => {
  const { t } = useLingui();
  const [min, max] = toRangeFilterValue(column.getFilterValue());

  const setBound = (index: 0 | 1, text: string) => {
    const next = toRangeFilterValue(column.getFilterValue());
    next[index] = parseBound(text);
    column.setFilterValue(
      next[0] === undefined && next[1] === undefined ? undefined : next,
    );
  };

  const field = (
    index: 0 | 1,
    label: string,
    bound: RangeFilterValue[number],
  ) => (
    <TextField
      size="small"
      variant="standard"
      placeholder={label}
      defaultValue={bound ?? ''}
      onChange={(e) => setBound(index, e.target.value)}
      slotProps={{ htmlInput: { 'aria-label': label, inputMode: 'decimal' } }}
      sx={{ minWidth: 0, flex: 1 }}
    />
  );

  return (
    <Stack direction="row" sx={{ gap: 1 }}>
      {field(0, t`Min`, min)}
      {field(1, t`Max`, max)}
    </Stack>
  );
};
