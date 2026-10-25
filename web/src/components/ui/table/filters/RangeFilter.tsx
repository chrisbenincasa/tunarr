import { useLingui } from '@lingui/react/macro';
import { Stack, TextField } from '@mui/material';
import type { RowData } from '@tanstack/react-table';
import { useState } from 'react';
import { type TunarrColumn, columnLabel } from '../tunarrTable.ts';
import {
  type RangeFilterValue,
  parseBound,
  toRangeFilterValue,
} from './rangeFilterValue.ts';

type RangeFilterProps<TData extends RowData> = {
  column: TunarrColumn<TData>;
};

type BoundFieldProps = {
  bound: RangeFilterValue[number];
  placeholder: string;
  ariaLabel: string;
  onChange: (text: string) => void;
};

// Keeps the typed text while it still parses to the bound, so partial input
// such as "1." or "-" survives. Any other bound, such as a cleared filter,
// replaces the text.
const BoundField = ({
  bound,
  placeholder,
  ariaLabel,
  onChange,
}: BoundFieldProps) => {
  const boundText = bound === undefined ? '' : String(bound);
  const [text, setText] = useState(boundText);
  const shown = parseBound(text) === bound ? text : boundText;

  return (
    <TextField
      size="small"
      variant="standard"
      placeholder={placeholder}
      value={shown}
      onChange={(e) => {
        setText(e.target.value);
        onChange(e.target.value);
      }}
      slotProps={{
        htmlInput: { 'aria-label': ariaLabel, inputMode: 'decimal' },
      }}
      sx={{ minWidth: 0, flex: 1 }}
    />
  );
};

// Inclusive min and max bounds. Either may be blank. Pairs with the
// inNumberRange filter function, which 'auto' picks for numeric columns.
export const RangeFilter = <TData extends RowData>({
  column,
}: RangeFilterProps<TData>) => {
  const { t } = useLingui();
  const label = columnLabel(column);
  const [min, max] = toRangeFilterValue(column.getFilterValue());

  const setBound = (index: 0 | 1, text: string) => {
    const next = toRangeFilterValue(column.getFilterValue());
    next[index] = parseBound(text);
    column.setFilterValue(
      next[0] === undefined && next[1] === undefined ? undefined : next,
    );
  };

  return (
    <Stack direction="row" sx={{ gap: 1 }}>
      <BoundField
        bound={min}
        placeholder={t`Min`}
        ariaLabel={t`Min ${label}`}
        onChange={(text) => setBound(0, text)}
      />
      <BoundField
        bound={max}
        placeholder={t`Max`}
        ariaLabel={t`Max ${label}`}
        onChange={(text) => setBound(1, text)}
      />
    </Stack>
  );
};
