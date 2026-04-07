import type {
  OnChangeFn,
  PaginationState,
  SortingState,
  VisibilityState,
} from '@tanstack/react-table';
import { isFunction } from 'lodash-es';
import type { MRT_RowData, MRT_TableOptions } from 'material-react-table';
import { useCallback, useState } from 'react';
import {
  setTableColumnModel,
  setTablePaginationState,
  setTableSortState,
} from '../store/settings/actions.ts';
import { useSettings } from '../store/settings/selectors.ts';

export const useTableSettings = (
  tableName: string,
  defaultPaginationState: PaginationState = { pageIndex: 0, pageSize: 10 },
  defaultVisibilityState: VisibilityState = {},
  defaultSortState: SortingState = [],
) => {
  const settings = useSettings();
  const tableSettings = settings.ui.tableSettings[tableName];
  const initialColumnModel =
    tableSettings?.columnModel ?? defaultVisibilityState;
  const colVisibilityState = useState<VisibilityState>(initialColumnModel);
  const paginationState = useState<PaginationState>(
    tableSettings?.pagination ?? defaultPaginationState,
  );
  const sortState = useState<SortingState>(
    tableSettings?.sortState ?? defaultSortState,
  );

  const visibilityUpdater: OnChangeFn<VisibilityState> = useCallback(
    (updater) => {
      if (isFunction(updater)) {
        colVisibilityState[1]((prev) => {
          const next = updater(prev);
          setTableColumnModel(tableName, next);
          return next;
        });
      } else {
        setTableColumnModel(tableName, updater);
        colVisibilityState[1](updater);
      }
    },
    [colVisibilityState, tableName],
  );

  const paginationUpdater: OnChangeFn<PaginationState> = useCallback(
    (updater) => {
      if (isFunction(updater)) {
        paginationState[1]((prev) => {
          const next = updater(prev);
          setTablePaginationState(tableName, next);
          return next;
        });
      } else {
        setTablePaginationState(tableName, updater);
        paginationState[1](updater);
      }
    },
    [paginationState, tableName],
  );

  const sortUpdater: OnChangeFn<SortingState> = useCallback(
    (updater) => {
      if (isFunction(updater)) {
        sortState[1]((prev) => {
          const next = updater(prev);
          setTableSortState(tableName, next);
          return next;
        });
      } else {
        setTableSortState(tableName, updater);
        sortState[1](updater);
      }
    },
    [sortState, tableName],
  );

  return {
    colVisibilityState: {
      current: colVisibilityState[0],
      setter: visibilityUpdater,
    },
    paginationState: {
      current: paginationState[0],
      setter: paginationUpdater,
    },
    sortState: {
      current: sortState[0],
      setter: sortUpdater,
    },
  };
};

export const useStoreBackedTableSettings = <Data extends MRT_RowData>(
  tableName: string,
  defaultPaginationState: PaginationState = { pageIndex: 0, pageSize: 10 },
  defaultVisibilityState: VisibilityState = {},
) => {
  const tableState = useTableSettings(
    tableName,
    defaultPaginationState,
    defaultVisibilityState,
  );

  return {
    state: {
      columnVisibility: tableState.colVisibilityState.current,
      pagination: tableState.paginationState.current,
    },
    initialState: {
      pagination: tableState.paginationState.current,
    },
    onColumnVisibilityChange: (updater) => {
      tableState.colVisibilityState.setter(updater);
    },
    onPaginationChange: (updater) => tableState.paginationState.setter(updater),
    onSortingChange: (updater) => tableState.sortState.setter(updater),
  } satisfies Partial<MRT_TableOptions<Data>>;
};
