import type { TableCellProps } from '@mui/material';
import {
  type Column,
  type ReactTable,
  type RowData,
  columnFilteringFeature,
  columnVisibilityFeature,
  createFilteredRowModel,
  createPaginatedRowModel,
  createSortedRowModel,
  createTableHook,
  filterFn_arrHas,
  filterFn_arrIncludes,
  filterFn_equals,
  filterFn_inNumberRange,
  filterFn_includesString,
  filterFn_weakEquals,
  globalFilteringFeature,
  metaHelper,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  sortFn_alphanumeric,
  sortFn_basic,
  sortFn_datetime,
  sortFn_text,
  tableFeatures,
} from '@tanstack/react-table';

export type FilterVariant = 'text' | 'range' | 'multi-select' | 'boolean';

export type TunarrColumnMeta = {
  // Plain-text column name for menus and accessible labels. Defaults to the
  // header when it is a string, then to the column id.
  label?: string;

  // Defaults to 'text'. 'range' needs numeric values. 'multi-select' needs
  // filterOptions and filterFn: 'arrHas' on the column. 'boolean' needs
  // filterFn: 'equals'.
  filterVariant?: FilterVariant;
  filterOptions?: readonly string[];

  // Right-aligns the column and sets its values in the mono face.
  numeric?: boolean;
  width?: number | string;
  cellProps?: TableCellProps;
};

// A column may name a filter or sort function only if it is registered here.
// filterFn: 'auto' and sortFn: 'auto' resolve through these lists too.
export const tunarrFeatures = tableFeatures({
  columnFilteringFeature,
  globalFilteringFeature,
  rowSortingFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  columnVisibilityFeature,
  filteredRowModel: createFilteredRowModel(),
  sortedRowModel: createSortedRowModel(),
  paginatedRowModel: createPaginatedRowModel(),
  filterFns: {
    includesString: filterFn_includesString,
    inNumberRange: filterFn_inNumberRange,
    equals: filterFn_equals,
    weakEquals: filterFn_weakEquals,
    arrIncludes: filterFn_arrIncludes,
    arrHas: filterFn_arrHas,
  },
  sortFns: {
    alphanumeric: sortFn_alphanumeric,
    text: sortFn_text,
    datetime: sortFn_datetime,
    basic: sortFn_basic,
  },
  columnMeta: metaHelper<TunarrColumnMeta>(),
});

export type TunarrFeatures = typeof tunarrFeatures;

export type TunarrTable<TData extends RowData> = ReactTable<
  TunarrFeatures,
  TData
>;

export type TunarrColumn<TData extends RowData> = Column<
  TunarrFeatures,
  TData,
  unknown
>;

export const { useAppTable: useTunarrTable, createAppColumnHelper } =
  createTableHook({ features: tunarrFeatures });

export const ActionsColumnId = 'actions';
export const SelectColumnId = 'select';

export const columnLabel = <TData extends RowData>(
  column: TunarrColumn<TData>,
) => {
  const header = column.columnDef.header;
  return (
    column.columnDef.meta?.label ??
    (typeof header === 'string' ? header : column.id)
  );
};

// Page sizes MRT offered. Saved settings may hold any of them. Never add
// Infinity, which JSON stores as null and the settings schema rejects.
export const pageSizeOptions = [5, 10, 15, 20, 25, 30, 50, 100];

export const lastPageIndex = (count: number, pageSize: number) =>
  Math.max(0, Math.ceil(count / pageSize) - 1);
