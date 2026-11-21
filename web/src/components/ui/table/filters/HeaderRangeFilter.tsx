import { Box, Stack, Typography } from '@mui/material';
import type { RowData } from '@tanstack/react-table';
import { type TunarrColumn, columnLabel } from '../tunarrTable.ts';
import { RangeFilter } from './RangeFilter.tsx';

// A column's range filter, drawn in a page header so it serves the card layout
// too. Set filterInHeader on the column so the table's filter row skips it.
export const HeaderRangeFilter = <TData extends RowData>({
  column,
}: {
  column: TunarrColumn<TData>;
}) => (
  <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
    <Typography variant="body2" sx={{ color: 'text.secondary' }}>
      {columnLabel(column)}
    </Typography>
    <Box sx={{ width: 140 }}>
      <RangeFilter column={column} />
    </Box>
  </Stack>
);
