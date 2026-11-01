import { useLingui } from '@lingui/react/macro';
import { Box, Checkbox, ListItemText, MenuItem, TextField } from '@mui/material';
import type { RowData } from '@tanstack/react-table';
import { type TunarrColumn, columnLabel } from '../tunarrTable.ts';
import {
  fromSelectValue,
  toMultiSelectFilterValue,
} from './multiSelectFilterValue.ts';

type MultiSelectFilterProps<TData extends RowData> = {
  column: TunarrColumn<TData>;
};

// Keeps rows whose value is any of the checked options. Pairs with the
// arrHas filter function, which the column must name in its filterFn.
export const MultiSelectFilter = <TData extends RowData>({
  column,
}: MultiSelectFilterProps<TData>) => {
  const { t } = useLingui();
  const label = columnLabel(column);
  const options = column.columnDef.meta?.filterOptions ?? [];
  const selected = toMultiSelectFilterValue(column.getFilterValue());
  const placeholder = t`Filter by ${label}`;

  return (
    <TextField
      select
      size="small"
      variant="standard"
      fullWidth
      value={selected}
      onChange={(e) => column.setFilterValue(fromSelectValue(e.target.value))}
      slotProps={{
        htmlInput: { 'aria-label': placeholder },
        select: {
          multiple: true,
          displayEmpty: true,
          renderValue: (value) => {
            const values = toMultiSelectFilterValue(value);
            return values.length > 0 ? (
              values.join(', ')
            ) : (
              <Box component="span" sx={{ color: 'text.secondary' }}>
                {placeholder}
              </Box>
            );
          },
        },
      }}
    >
      {options.map((option) => (
        <MenuItem key={option} value={option} dense>
          <Checkbox
            size="small"
            checked={selected.includes(option)}
            tabIndex={-1}
            sx={{ p: 0.5, mr: 1 }}
          />
          <ListItemText primary={option} />
        </MenuItem>
      ))}
    </TextField>
  );
};
