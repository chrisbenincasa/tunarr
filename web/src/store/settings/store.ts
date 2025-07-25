import type { PaginationState } from '@tanstack/react-table';
import type { StateCreator } from 'zustand';

// Only these 2 are supported currently
export type SupportedLocales = 'en' | 'en-gb';

interface SettingsStateInternal {
  backendUri: string;
  ui: {
    channelTablePagination: PaginationState;
    channelTableColumnModel: Record<string, boolean>;
    i18n: {
      locale: SupportedLocales;
    };
  };
}

export interface SettingsState {
  settings: SettingsStateInternal;
}

export type PersistedSettingsState = {
  settings: {
    backendUri: string;
    ui: {
      channelTablePagination: {
        pageSize: number;
      };
      channelTableColumnModel: Record<string, boolean>;
      i18n: {
        locale: SupportedLocales;
      };
    };
  };
};

// By default, the dev environment runs its web server on port
// 5173. In 'prod' we assume that by default the user wants
// their web UI to hit their self-hosted instance of Tunarr,
// which will be on the same host/port.
export const DefaultBackendUri = import.meta.env.DEV
  ? 'http://localhost:8000'
  : '';

export const createSettingsSlice: StateCreator<SettingsState> = () => ({
  settings: {
    backendUri: DefaultBackendUri,
    ui: {
      channelTablePagination: {
        pageIndex: 0,
        pageSize: 10,
      },
      channelTableColumnModel: {
        onDemand: false,
      },
      i18n: {
        locale: 'en',
      },
    },
  },
});
