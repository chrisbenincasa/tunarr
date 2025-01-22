import { get, isNil, isObject, merge } from 'lodash-es';
import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import {
  type EditorsState,
  createChannelEditorState,
} from './channelEditor/store.ts';
import {
  type PlexMetadataState,
  createPlexMetadataState,
} from './plexMetadata/store.ts';
import {
  type ProgrammingListingsState,
  createProgrammingListingsState,
} from './programmingSelector/store.ts';
import {
  type PersistedSettingsState,
  type SettingsState,
  createSettingsSlice,
} from './settings/store.ts';
import {
  type ThemeEditorState,
  createThemeEditorState,
} from './themeEditor/store.ts';

export type State = ThemeEditorState &
  SettingsState &
  ProgrammingListingsState &
  EditorsState &
  PlexMetadataState;

type PersistedState = PersistedSettingsState & ThemeEditorState;

const useStore = create<State>()(
  immer(
    devtools(
      persist(
        (...set) => ({
          ...createSettingsSlice(...set),
          ...createProgrammingListingsState(...set),
          ...createChannelEditorState(...set),
          ...createThemeEditorState(...set),
          ...createPlexMetadataState(...set),
        }),
        {
          name: 'tunarr',
          partialize: (state: State) =>
            ({
              theme: state.theme,
              settings: {
                backendUri: state.settings.backendUri,
                ui: {
                  channelTablePagination: {
                    pageSize: state.settings.ui.channelTablePagination.pageSize,
                  },
                  channelTableColumnModel:
                    state.settings.ui.channelTableColumnModel,
                  i18n: state.settings.ui.i18n,
                },
              },
            }) satisfies PersistedState,
          merge(persistedState, currentState) {
            if (isNil(persistedState)) {
              return currentState;
            }

            if (!isObject(persistedState)) {
              return currentState;
            }

            const persistedTheme = get(persistedState, 'theme') as unknown;
            const persistedSettings = get(
              persistedState,
              'settings',
            ) as unknown;

            return {
              ...currentState,
              theme: merge(
                {},
                currentState.theme ?? {},
                isObject(persistedTheme) ? persistedTheme : {},
              ),
              settings: merge(
                {},
                currentState.settings ?? {},
                isObject(persistedSettings) ? persistedSettings : {},
              ),
            };
          },
        },
      ),
    ),
  ),
);

export default useStore;
