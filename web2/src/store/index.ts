import { Channel, XmlTvSettings } from '@tunarr/types';
import { StateCreator, create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import {
  ProgrammingListingsState,
  createProgrammingListingsState,
} from './programmingSelector/store.ts';
import {
  ChannelEditorState,
  EditorsState,
  createChannelEditorState,
} from './channelEditor/store.ts';
import {
  ThemeEditorState,
  createThemeEditorState,
} from './themeEditor/store.ts';

// type WithSelectors<S> = S extends { getState: () => infer T }
//   ? S & { use: { [K in keyof T]: () => T[K] } }
//   : never

// const createSelectors = <S extends UseBoundStore<StoreApi<object>>>(
//   _store: S,
// ) => {
//   const store = _store as WithSelectors<typeof _store>
//   store.use = {}
//   for (const k of Object.keys(store.getState())) {
//     ;(store.use as any)[k] = () => store((s) => s[k as keyof typeof s])
//   }

//   return store
// }

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
  EditorsState;

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
