import { StateCreator } from 'zustand';

interface SettingsStateInternal {
  backendUri: string;
}

export interface SettingsState {
  settings: SettingsStateInternal;
}

export const DefaultBackendUri = 'http://localhost:8000';

export const createSettingsSlice: StateCreator<SettingsState> = () => ({
  settings: {
    backendUri: DefaultBackendUri,
  },
});
