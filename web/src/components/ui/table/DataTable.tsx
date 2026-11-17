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
  TableRow,
  type TableRowProps,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import type { Row, RowData, RowSelectionState } from '@tanstack/react-table';
import { clamp } from 'lodash-es';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { SortButton } from './SortButton.tsx';
import { TablePager } from './TablePager.tsx';
import { ColumnFilter } from './filters/ColumnFilter.tsx';
import { sxList } from './sx.ts';
import {
  ActionsColumnId,
  SelectColumnId,
  type TunarrColumn,
  type TunarrFeatures,
  type TunarrTable,
  columnLabel,
  lastPageIndex,
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

  // Turns on J/K to move between rows, X to select the current row, and Enter
  // to open it. The keys work while focus is on the page body or inside the
  // table, and never while typing in a field.
  keyboardNavigation?: {
    onOpen: (row: Row<TunarrFeatures, TData>) => void;
  };
};

const isTextEntry = (el: Element) =>
  (el instanceof HTMLInputElement &&
    el.type !== 'checkbox' &&
    el.type !== 'radio') ||
  el instanceof HTMLTextAreaElement ||
  el instanceof HTMLSelectElement ||
  (el instanceof HTMLElement && el.isContentEditable);

// Columns that hold their own controls. Their clicks never reach the row.
const isControlColumn = (id: string) =>
  id === ActionsColumnId || id === SelectColumnId;

// Moves a saved page index that falls outside the page range back into it.
// autoResetPageIndex skips the first render, so it never repairs one on load.
// Waits for data, because an empty table would reset every saved page to 0.
const PageIndexRepair = <TData extends RowData>({
  table,
  pageIndex,
  lastPage,
  ready,
}: {
  table: TunarrTable<TData>;
  pageIndex: number;
  lastPage: number;
  ready: boolean;
}) => {
  useEffect(() => {
    if (ready && (pageIndex < 0 || pageIndex > lastPage)) {
      table.setPageIndex(clamp(pageIndex, 0, lastPage));
    }
  }, [table, pageIndex, lastPage, ready]);
  return null;
};

// Drops selected rows that the search or a column filter hides, so a bulk
// action never reaches a row the user can no longer see.
const SelectionPrune = <TData extends RowData>({
  table,
  selection,
  globalFilter,
  columnFilters,
}: {
  table: TunarrTable<TData>;
  selection: RowSelectionState;
  globalFilter: string;
  columnFilters: unknown;
}) => {
  // Reads the selection from a ref, so selecting a row never re-runs the prune.
  const selectionRef = useRef(selection);
  selectionRef.current = selection;

  useEffect(() => {
    const selection = selectionRef.current;
    const selectedIds = Object.keys(selection).filter((id) => selection[id]);
    if (selectedIds.length === 0) {
      return;
    }
    const shown = new Set(
      table.getFilteredRowModel().rows.map((row) => row.id),
    );
    if (selectedIds.every((id) => shown.has(id))) {
      return;
    }
    table.setRowSelection(
      Object.fromEntries(
        selectedIds.filter((id) => shown.has(id)).map((id) => [id, true]),
      ),
    );
  }, [table, globalFilter, columnFilters]);
  return null;
};

const cellAlign = <TData extends RowData>(
  column: TunarrColumn<TData>,
  isFirst: boolean,
): TableCellProps['align'] => {
  if (column.id === SelectColumnId) {
    return 'left';
  }
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
  keyboardNavigation,
}: DataTableProps<TData>) => {
  const { t } = useLingui();
  const [showFilters, setShowFilters] = useState(defaultShowFilters);
  const [showSearch, setShowSearch] = useState(false);
  const [columnsMenuAnchor, setColumnsMenuAnchor] =
    useState<HTMLElement | null>(null);
  const [activeRowId, setActiveRowId] = useState<string>();

  // Keys can arrive faster than renders, so the handler reads the ref.
  const activeRowRef = useRef<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const rowElements = useRef(new Map<string, HTMLTableRowElement>());
  const onOpen = keyboardNavigation?.onOpen;

  useEffect(() => {
    if (!onOpen) {
      return;
    }
    const onKeyDown = (e: KeyboardEvent) => {
      const container = containerRef.current;
      const target = e.target;
      if (
        e.defaultPrevented ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey ||
        !container ||
        !(target instanceof Element) ||
        (target !== document.body && !container.contains(target)) ||
        isTextEntry(target)
      ) {
        return;
      }

      const rows = table.getRowModel().rows;
      const index = rows.findIndex((row) => row.id === activeRowRef.current);
      const active = index >= 0 ? rows[index] : undefined;
      const moveTo = (next: number) => {
        const row = rows[Math.max(0, Math.min(next, rows.length - 1))];
        if (row) {
          e.preventDefault();
          activeRowRef.current = row.id;
          setActiveRowId(row.id);
          rowElements.current.get(row.id)?.focus();
        }
      };

      switch (e.key) {
        case 'j':
        case 'J':
          moveTo(index + 1);
          break;
        case 'k':
        case 'K':
          moveTo(index < 0 ? 0 : index - 1);
          break;
        case 'x':
        case 'X':
          if (active?.getCanSelect()) {
            e.preventDefault();
            active.toggleSelected();
          }
          break;
        case 'Enter':
          // Enter on a button or link inside the row belongs to that control.
          if (
            active &&
            (target === document.body ||
              target === rowElements.current.get(active.id))
          ) {
            e.preventDefault();
            onOpen(active);
          }
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onOpen, table]);

  return (
    <table.Subscribe selector={(state) => state}>
      {(state) => {
        const leafColumns = table.getAllLeafColumns();
        const hideableColumns = leafColumns.filter((c) => c.getCanHide());
        const canFilter = leafColumns.some((c) => c.getCanFilter());
        const canSearch = table.options.enableGlobalFilter ?? true;
        const activeFilters = state.columnFilters.length;
        const visibleColumns = table.getVisibleLeafColumns();
        const firstColumnId = visibleColumns[0]?.id;

        const hasData = table.getCoreRowModel().rows.length > 0;
        const rows = table.getRowModel().rows;
        const rowCount = table.getFilteredRowModel().rows.length;
        const { pageIndex, pageSize } = state.pagination;
        const lastPage = lastPageIndex(rowCount, pageSize);

        return (
          <Box
            ref={containerRef}
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
              {activeFilters > 0 && (
                <Button
                  size="small"
                  startIcon={<FilterListOff />}
                  onClick={() => table.resetColumnFilters(true)}
                >
                  {t`Clear filters`}
                </Button>
              )}
              {canSearch && (
                <Tooltip title={t`Show/Hide search`}>
                  {/* A search can't be hidden while it filters rows, as in MRT.
                      The span lets the tooltip work on the disabled button. */}
                  <span>
                    <IconButton
                      aria-label={t`Show/Hide search`}
                      aria-pressed={showSearch}
                      disabled={showSearch && !!state.globalFilter}
                      onClick={() => setShowSearch((s) => !s)}
                    >
                      <Search />
                    </IconButton>
                  </span>
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
                                  <ColumnFilter column={column} />
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
                        {loading && !hasData ? (
                          <Box sx={{ py: 4 }} />
                        ) : hasData || emptyFallback === undefined ? (
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
                      const isActive =
                        keyboardNavigation !== undefined &&
                        row.id === activeRowId;
                      return (
                        <TableRow
                          key={row.id}
                          hover={clickable}
                          selected={row.getIsSelected()}
                          tabIndex={keyboardNavigation ? -1 : undefined}
                          ref={(el: HTMLTableRowElement | null) => {
                            if (el) {
                              rowElements.current.set(row.id, el);
                            } else {
                              rowElements.current.delete(row.id);
                            }
                          }}
                          {...rowProps}
                          sx={[
                            clickable && { cursor: 'pointer' },
                            { outline: 'none' },
                            isActive &&
                              ((theme) => ({
                                boxShadow: `inset 3px 0 0 ${theme.palette.primary.main}`,
                              })),
                            ...sxList(rowProps?.sx),
                          ]}
                        >
                          {row.getVisibleCells().map((cell) => {
                            const column = cell.column;
                            const meta = column.columnDef.meta;
                            const isActions = column.id === ActionsColumnId;
                            const isControl = isControlColumn(column.id);
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
                                  isControl
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

            <PageIndexRepair
              table={table}
              pageIndex={pageIndex}
              lastPage={lastPage}
              ready={hasData && !loading}
            />
            <SelectionPrune
              table={table}
              selection={state.rowSelection}
              globalFilter={
                typeof state.globalFilter === 'string' ? state.globalFilter : ''
              }
              columnFilters={state.columnFilters}
            />
            <TablePager
              count={rowCount}
              pageIndex={pageIndex}
              pageSize={pageSize}
              onPageChange={(page) => table.setPageIndex(page)}
              onPageSizeChange={(size) => table.setPageSize(size)}
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
