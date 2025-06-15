import { get, isNil, isObject, isUndefined, merge } from 'lodash-es';
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
import type { ProgrammingState } from './programming/store.ts';
import { createProgrammingState } from './programming/store.ts';
import {
  type ProgrammingListingsState,
  createProgrammingListingsState,
} from './programmingSelector/store.ts';
import {
  type PersistedSettingsState,
  type SettingsState,
  createSettingsSlice,
} from './settings/store.ts';
import type { ThemeEditorStateInner } from './themeEditor/store.ts';
import {
  type ThemeEditorState,
  createThemeEditorState,
} from './themeEditor/store.ts';

export type State = ThemeEditorState &
  SettingsState &
  ProgrammingListingsState &
  EditorsState &
  PlexMetadataState &
  ProgrammingState;

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
          ...createProgrammingState(...set),
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

            // Migrate to new setting.
            if (
              isObject(persistedTheme) &&
              isUndefined(
                (persistedTheme as ThemeEditorStateInner).themePreference,
              )
            ) {
              const castedTheme = persistedTheme as ThemeEditorStateInner;
              castedTheme.themePreference = castedTheme.darkMode
                ? 'dark'
                : 'light';
            }

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
