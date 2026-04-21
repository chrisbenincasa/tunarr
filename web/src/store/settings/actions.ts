import { loadDayjsLocale } from '@/helpers/localeLoader.ts';
import { loadCatalog } from '@/i18n.ts';
import type { SupportedLocales, TimeFormat } from '@/store/settings/store.ts';
import type { PaginationState, SortingState } from '@tanstack/react-table';
import useStore from '..';

export const setBackendUri = (uri: string) =>
  useStore.setState(({ settings }) => {
    settings.backendUri = uri;
  });

export const setTableColumnModel = (
  tableName: string,
  model: Record<string, boolean>,
) =>
  useStore.setState(({ settings }) => {
    settings.ui.tableSettings[tableName] = {
      ...(settings.ui.tableSettings[tableName] ?? {}),
      columnModel: model,
    };
  });

export const setTablePaginationState = (
  tableName: string,
  pagination: PaginationState,
) =>
  useStore.setState(({ settings }) => {
    settings.ui.tableSettings[tableName] = {
      ...(settings.ui.tableSettings[tableName] ?? {}),
      pagination,
    };
  });

export const setTableSortState = (tableName: string, sorting: SortingState) =>
  useStore.setState(({ settings }) => {
    settings.ui.tableSettings[tableName] = {
      ...(settings.ui.tableSettings[tableName] ?? {}),
      sortState: sorting,
    };
  });

export const setChannelTableColumnModel = (model: Record<string, boolean>) => {
  useStore.setState(({ settings }) => {
    settings.ui.channelTableColumnModel = { ...model };
  });
};

export const setChannelPaginationState = (p: PaginationState) =>
  useStore.setState(({ settings }) => {
    settings.ui.channelTablePagination = p;
  });

export const setUiLocale = async (locale: SupportedLocales) => {
  await loadDayjsLocale(locale);
  await loadCatalog(locale);
  useStore.setState(({ settings }) => {
    settings.ui.i18n.locale = locale;
  });
};

export const setTimeFormat = async (format: TimeFormat) => {
  if (format === '24h') {
    await import('dayjs/locale/en-gb');
  }
  useStore.setState(({ settings }) => {
    settings.ui.i18n.timeFormat = format;
  });
};

export const setShowAdvancedSettings = (value: boolean) =>
  useStore.setState(({ settings }) => {
    settings.ui.showAdvancedSettings = value;
  });
