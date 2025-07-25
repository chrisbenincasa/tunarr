import type { SupportedLocales } from '@/store/settings/store.ts';
import type { PaginationState } from '@tanstack/react-table';
import dayjs from 'dayjs';
import useStore from '..';

export const setBackendUri = (uri: string) =>
  useStore.setState(({ settings }) => {
    settings.backendUri = uri;
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

export const setUiLocale = (locale: SupportedLocales) =>
  useStore.setState(({ settings }) => {
    dayjs.locale(locale); // Changes the default dayjs locale globally
    settings.ui.i18n.locale = locale;
  });
