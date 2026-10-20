import type {
  ColumnVisibilityState,
  PaginationState,
  SortingState,
} from '@tanstack/react-table';
import { useTableSettings } from '../../../hooks/useTableSettings.ts';

type Defaults = {
  pagination?: PaginationState;
  columnVisibility?: ColumnVisibilityState;
  sorting?: SortingState;
};

// Persists sorting, column visibility and pagination under `tableName` in the
// settings store. Spread the result into useTunarrTable. Filters are not
// persisted.
export const useStoreBackedTableSettings = (
  tableName: string,
  defaults: Defaults = {},
) => {
  const settings = useTableSettings(
    tableName,
    defaults.pagination,
    defaults.columnVisibility,
    defaults.sorting,
  );

  return {
    state: {
      columnVisibility: settings.colVisibilityState.current,
      pagination: settings.paginationState.current,
      sorting: settings.sortState.current,
    },
    onColumnVisibilityChange: settings.colVisibilityState.setter,
    onPaginationChange: settings.paginationState.setter,
    onSortingChange: settings.sortState.setter,
  };
};
