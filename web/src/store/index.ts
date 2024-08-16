import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import {
  EditorsState,
  createChannelEditorState,
} from './channelEditor/store.ts';
import {
  PlexMetadataState,
  createPlexMetadataState,
} from './plexMetadata/store.ts';
import {
  ProgrammingListingsState,
  createProgrammingListingsState,
} from './programmingSelector/store.ts';
import { SettingsState, createSettingsSlice } from './settings/store.ts';
import {
  ThemeEditorState,
  createThemeEditorState,
} from './themeEditor/store.ts';
import { get, isNil, isObject, merge } from 'lodash-es';

export type State = ThemeEditorState &
  SettingsState &
  ProgrammingListingsState &
  EditorsState &
  PlexMetadataState;

type PersistedState = SettingsState & ThemeEditorState;

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
            <PersistedState>{
              theme: state.theme,
              settings: state.settings,
            },
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
