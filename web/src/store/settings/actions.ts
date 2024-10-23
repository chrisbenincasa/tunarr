import { PaginationState } from '@tanstack/react-table';
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
