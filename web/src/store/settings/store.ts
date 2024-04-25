import { StateCreator } from 'zustand';

interface SettingsStateInternal {
  backendUri: string;
}

export interface SettingsState {
  settings: SettingsStateInternal;
}

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
  },
});
