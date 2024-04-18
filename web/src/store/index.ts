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
        },
      ),
    ),
  ),
);

export default useStore;
