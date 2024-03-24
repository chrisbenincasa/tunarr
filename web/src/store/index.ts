import { Channel, XmlTvSettings } from '@tunarr/types';
import { StateCreator, create } from 'zustand';
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
import {
  ThemeEditorState,
  createThemeEditorState,
} from './themeEditor/store.ts';

interface ChannelsState {
  channels?: Channel[];
}

interface SettingsState {
  xmltvSettings?: XmlTvSettings;
}

export type State = ThemeEditorState &
  SettingsState &
  ChannelsState &
  ProgrammingListingsState &
  EditorsState &
  PlexMetadataState;

const createSettingsSlice: StateCreator<SettingsState> = () => ({
  xmlTvSettings: undefined,
});

const createChannelsState: StateCreator<ChannelsState> = () => ({
  channels: undefined,
});

const useStore = create<State>()(
  immer(
    devtools(
      persist(
        (...set) => ({
          ...createSettingsSlice(...set),
          ...createChannelsState(...set),
          ...createProgrammingListingsState(...set),
          ...createChannelEditorState(...set),
          ...createThemeEditorState(...set),
          ...createPlexMetadataState(...set),
        }),
        {
          name: 'tunarr',
          partialize: (state: State) => ({
            theme: state.theme,
          }),
        },
      ),
    ),
  ),
);

export default useStore;
