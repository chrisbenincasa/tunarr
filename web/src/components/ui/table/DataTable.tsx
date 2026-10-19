import { useLingui } from '@lingui/react/macro';
import {
  FilterList,
  FilterListOff,
  Search,
  ViewColumn,
} from '@mui/icons-material';
import {
  Badge,
  Box,
  Button,
  Checkbox,
  IconButton,
  LinearProgress,
  ListItemText,
  Menu,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  type TableCellProps,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  type TableRowProps,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type { Row, RowData } from '@tanstack/react-table';
import { type ReactNode, useState } from 'react';
import { SortButton } from './SortButton.tsx';
import { ColumnFilter } from './filters/ColumnFilter.tsx';
import { sxList } from './sx.ts';
import {
  ActionsColumnId,
  type TunarrColumn,
  type TunarrFeatures,
  type TunarrTable,
  columnLabel,
  pageSizeOptions,
} from './tunarrTable.ts';

export type DataTableProps<TData extends RowData> = {
  table: TunarrTable<TData>;

  // Rendered at the start of the toolbar, before the table controls.
  toolbarActions?: ReactNode;

  // Shown when the table has no data at all. Filtered-out rows show a
  // generic message instead.
  emptyFallback?: ReactNode;
  getRowProps?: (row: Row<TunarrFeatures, TData>) => TableRowProps;
  loading?: boolean;
  defaultShowFilters?: boolean;
  'aria-label'?: string;
};

const cellAlign = <TData extends RowData>(
  column: TunarrColumn<TData>,
  isFirst: boolean,
): TableCellProps['align'] => {
  if (column.id === ActionsColumnId) {
    return isFirst ? 'left' : 'right';
  }
  return column.columnDef.meta?.numeric ? 'right' : undefined;
};

export const DataTable = <TData extends RowData>({
  table,
  toolbarActions,
  emptyFallback,
  getRowProps,
  loading = false,
  defaultShowFilters = false,
  'aria-label': ariaLabel,
}: DataTableProps<TData>) => {
  const { t } = useLingui();
  const [showFilters, setShowFilters] = useState(defaultShowFilters);
  const [showSearch, setShowSearch] = useState(false);
  const [columnsMenuAnchor, setColumnsMenuAnchor] =
    useState<HTMLElement | null>(null);

  // Remounts the filter inputs so a reset clears text they hold locally.
  const [filterKey, setFilterKey] = useState(0);

  return (
    <table.Subscribe selector={(state) => state}>
      {(state) => {
        const leafColumns = table.getAllLeafColumns();
        const hideableColumns = leafColumns.filter((c) => c.getCanHide());
        const canFilter = leafColumns.some((c) => c.getCanFilter());
        const canSearch = table.options.enableGlobalFilter ?? true;
        const activeFilters = state.columnFilters.length;
        const hasAnyFilter = activeFilters > 0 || !!state.globalFilter;
        const visibleColumns = table.getVisibleLeafColumns();
        const firstColumnId = visibleColumns[0]?.id;

        const hasData = table.getCoreRowModel().rows.length > 0;
        const rows = table.getRowModel().rows;
        const rowCount = table.getFilteredRowModel().rows.length;
        const { pageIndex, pageSize } = state.pagination;
        const lastPage = Math.max(0, Math.ceil(rowCount / pageSize) - 1);
        const rowsPerPageOptions = pageSizeOptions.includes(pageSize)
          ? pageSizeOptions
          : [...pageSizeOptions, pageSize].sort((a, b) => a - b);

        const clearFilters = () => {
          table.resetColumnFilters(true);
          table.resetGlobalFilter(true);
          setFilterKey((k) => k + 1);
        };

        return (
          <Box
            sx={(theme) => ({
              border: `1px solid ${theme.palette.tokens.border}`,
              borderRadius: `${theme.sizes.radiusCard}px`,
              backgroundColor: theme.palette.tokens.surface,
              overflow: 'hidden',
            })}
          >
            <Stack
              direction="row"
              sx={{
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: 1,
                px: 2,
                py: 1,
              }}
            >
              {toolbarActions}
              <Box sx={{ flex: 1 }} />
              {showSearch && (
                <TextField
                  size="small"
                  autoFocus
                  placeholder={t`Search`}
                  value={
                    typeof state.globalFilter === 'string'
                      ? state.globalFilter
                      : ''
                  }
                  onChange={(e) => table.setGlobalFilter(e.target.value)}
                  slotProps={{ htmlInput: { 'aria-label': t`Search` } }}
                />
              )}
              {hasAnyFilter && (
                <Button
                  size="small"
                  startIcon={<FilterListOff />}
                  onClick={clearFilters}
                >
                  {t`Clear filters`}
                </Button>
              )}
              {canSearch && (
                <Tooltip title={t`Show/Hide search`}>
                  <IconButton
                    aria-label={t`Show/Hide search`}
                    aria-pressed={showSearch}
                    onClick={() => setShowSearch((s) => !s)}
                  >
                    <Search />
                  </IconButton>
                </Tooltip>
              )}
              {canFilter && (
                <Tooltip title={t`Show/Hide filters`}>
                  <IconButton
                    aria-label={
                      activeFilters > 0
                        ? t`Show/Hide filters (${activeFilters} active)`
                        : t`Show/Hide filters`
                    }
                    aria-pressed={showFilters}
                    onClick={() => setShowFilters((s) => !s)}
                  >
                    <Badge badgeContent={activeFilters} color="primary">
                      <FilterList />
                    </Badge>
                  </IconButton>
                </Tooltip>
              )}
              {hideableColumns.length > 0 && (
                <>
                  <Tooltip title={t`Show/Hide columns`}>
                    <IconButton
                      aria-label={t`Show/Hide columns`}
                      aria-haspopup="menu"
                      onClick={(e) => setColumnsMenuAnchor(e.currentTarget)}
                    >
                      <ViewColumn />
                    </IconButton>
                  </Tooltip>
                  <Menu
                    anchorEl={columnsMenuAnchor}
                    open={columnsMenuAnchor !== null}
                    onClose={() => setColumnsMenuAnchor(null)}
                  >
                    {hideableColumns.map((column) => {
                      const label = columnLabel(column);
                      return (
                        <MenuItem
                          key={column.id}
                          onClick={(e) => {
                            // The checkbox handles its own clicks.
                            if (!(e.target instanceof HTMLInputElement)) {
                              column.toggleVisibility();
                            }
                          }}
                        >
                          <Checkbox
                            size="small"
                            checked={column.getIsVisible()}
                            onChange={() => column.toggleVisibility()}
                            slotProps={{
                              input: {
                                'aria-label': t`Toggle visibility ${label}`,
                              },
                            }}
                            sx={{ p: 0.5, mr: 1 }}
                          />
                          <ListItemText primary={label} />
                        </MenuItem>
                      );
                    })}
                  </Menu>
                </>
              )}
            </Stack>

            {loading && <LinearProgress />}

            <TableContainer>
              <Table
                aria-label={ariaLabel}
                aria-busy={loading}
                sx={(theme) => ({
                  '& .MuiTableCell-root': {
                    borderBottom: `1px solid ${theme.palette.tokens.border}`,
                    fontSize: theme.sizes.fontSize,
                    px: 1.25,
                  },
                  '& .MuiTableCell-root:first-of-type': { pl: 2 },
                  '& .MuiTableCell-root:last-of-type': { pr: 2 },
                  '& .MuiTableCell-head': {
                    fontWeight: 500,
                    letterSpacing: 'normal',
                    textTransform: 'none',
                    color: theme.palette.tokens.textMuted,
                    borderBottomColor: theme.palette.tokens.borderStrong,
                    py: 1.5,
                    verticalAlign: 'top',
                  },
                  '& .MuiTableBody-root .MuiTableRow-root:last-of-type .MuiTableCell-root':
                    { borderBottom: 0 },
                })}
              >
                <TableHead>
                  {table.getHeaderGroups().map((group) => (
                    <TableRow key={group.id} sx={{ height: 'auto' }}>
                      {group.headers.map((header) => {
                        const column = header.column;
                        const sorted = column.getIsSorted();
                        const meta = column.columnDef.meta;
                        return (
                          <TableCell
                            key={header.id}
                            sortDirection={sorted}
                            align={cellAlign(
                              column,
                              column.id === firstColumnId,
                            )}
                            sx={{ width: meta?.width }}
                          >
                            {header.isPlaceholder ? null : (
                              <Stack sx={{ gap: 0.5 }}>
                                <Box
                                  sx={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: meta?.numeric
                                      ? 'flex-end'
                                      : 'flex-start',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  <Box
                                    component="span"
                                    onClick={column.getToggleSortingHandler()}
                                    sx={{
                                      cursor: column.getCanSort()
                                        ? 'pointer'
                                        : undefined,
                                    }}
                                  >
                                    <table.FlexRender header={header} />
                                  </Box>
                                  {column.getCanSort() && (
                                    <SortButton column={column} />
                                  )}
                                </Box>
                                {showFilters && column.getCanFilter() && (
                                  <ColumnFilter
                                    key={filterKey}
                                    column={column}
                                  />
                                )}
                              </Stack>
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                  ))}
                </TableHead>
                <TableBody>
                  {rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={visibleColumns.length}>
                        {hasData || emptyFallback === undefined ? (
                          <Typography
                            sx={{
                              py: 4,
                              textAlign: 'center',
                              fontStyle: 'italic',
                              color: 'text.secondary',
                            }}
                          >
                            {hasData
                              ? t`No results found`
                              : t`No records to display`}
                          </Typography>
                        ) : (
                          emptyFallback
                        )}
                      </TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => {
                      const rowProps = getRowProps?.(row);
                      const clickable = rowProps?.onClick !== undefined;
                      return (
                        <TableRow
                          key={row.id}
                          hover={clickable}
                          {...rowProps}
                          sx={[
                            clickable && { cursor: 'pointer' },
                            ...sxList(rowProps?.sx),
                          ]}
                        >
                          {row.getVisibleCells().map((cell) => {
                            const column = cell.column;
                            const meta = column.columnDef.meta;
                            const isActions = column.id === ActionsColumnId;
                            return (
                              <TableCell
                                key={cell.id}
                                align={cellAlign(
                                  column,
                                  column.id === firstColumnId,
                                )}
                                {...meta?.cellProps}
                                sx={[
                                  (theme) => ({
                                    width: meta?.width,
                                    ...(meta?.numeric && {
                                      ...theme.typography.mono,
                                    }),
                                  }),
                                  isActions &&
                                    ((theme) => ({
                                      py: 0,
                                      whiteSpace: 'nowrap',
                                      '& .MuiIconButton-root': {
                                        p: 0.75,
                                        color: 'text.secondary',
                                      },
                                      '& .MuiSvgIcon-root': {
                                        fontSize: theme.sizes.fontSize + 6,
                                      },
                                    })),
                                  ...sxList(meta?.cellProps?.sx),
                                ]}
                                onClick={
                                  isActions
                                    ? (e) => e.stopPropagation()
                                    : meta?.cellProps?.onClick
                                }
                              >
                                <table.FlexRender cell={cell} />
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </TableContainer>

            <TablePagination
              component="div"
              count={rowCount}
              page={Math.min(pageIndex, lastPage)}
              rowsPerPage={pageSize}
              rowsPerPageOptions={rowsPerPageOptions}
              onPageChange={(_, page) => table.setPageIndex(page)}
              onRowsPerPageChange={(e) =>
                table.setPageSize(Number(e.target.value))
              }
              labelRowsPerPage={t`Rows per page`}
              labelDisplayedRows={({ from, to, count }) =>
                t`${from}–${to} of ${count}`
              }
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
              sx={(theme) => ({
                borderTop: `1px solid ${theme.palette.tokens.border}`,
              })}
            />
          </Box>
        );
      }}
    </table.Subscribe>
  );
};
