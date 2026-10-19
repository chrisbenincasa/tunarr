import { useLingui } from '@lingui/react/macro';
import { TableSortLabel } from '@mui/material';
import type { RowData } from '@tanstack/react-table';
import { type TunarrColumn, columnLabel } from './tunarrTable.ts';

// Names the button after the current sort, or the first click's direction
// when unsorted. The table parity spec relies on these labels.
export const SortButton = <TData extends RowData>({
  column,
}: {
  column: TunarrColumn<TData>;
}) => {
  const { t } = useLingui();
  const label = columnLabel(column);
  const sorted = column.getIsSorted();
  const first = column.getFirstSortDir();

  let ariaLabel: string;
  if (sorted === 'asc') {
    ariaLabel = t`Sorted by ${label} ascending`;
  } else if (sorted === 'desc') {
    ariaLabel = t`Sorted by ${label} descending`;
  } else if (first === 'asc') {
    ariaLabel = t`Sort by ${label} ascending`;
  } else {
    ariaLabel = t`Sort by ${label} descending`;
  }

  return (
    <TableSortLabel
      active={sorted !== false}
      direction={sorted === false ? first : sorted}
      onClick={column.getToggleSortingHandler()}
      aria-label={ariaLabel}
    />
  );
};
