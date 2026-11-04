import { useLingui } from '@lingui/react/macro';
import { type SxProps, TablePagination, type Theme } from '@mui/material';
import { clamp } from 'lodash-es';
import { lastPageIndex, pageSizeOptions } from './tunarrTable.ts';

export type TablePagerProps = {
  count: number;
  pageIndex: number;
  pageSize: number;
  onPageChange: (pageIndex: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  sx?: SxProps<Theme>;
};

// Page controls for a table or a card grid. The page is clamped because MUI
// logs an error for an out-of-range page.
export const TablePager = ({
  count,
  pageIndex,
  pageSize,
  onPageChange,
  onPageSizeChange,
  sx,
}: TablePagerProps) => {
  const { t } = useLingui();
  const rowsPerPageOptions = pageSizeOptions.includes(pageSize)
    ? pageSizeOptions
    : [...pageSizeOptions, pageSize].sort((a, b) => a - b);

  return (
    <TablePagination
      component="div"
      count={count}
      page={clamp(pageIndex, 0, lastPageIndex(count, pageSize))}
      rowsPerPage={pageSize}
      rowsPerPageOptions={rowsPerPageOptions}
      onPageChange={(_, page) => onPageChange(page)}
      onRowsPerPageChange={(e) => onPageSizeChange(Number(e.target.value))}
      labelRowsPerPage={t`Rows per page`}
      labelDisplayedRows={({ from, to, count }) => t`${from}–${to} of ${count}`}
      getItemAriaLabel={(type) => {
        switch (type) {
          case 'first':
            return t`Go to first page`;
          case 'last':
            return t`Go to last page`;
          case 'next':
            return t`Go to next page`;
          case 'previous':
            return t`Go to previous page`;
        }
      }}
      sx={sx}
    />
  );
};
