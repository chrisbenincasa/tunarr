import { Channel, XmlTvSettings, Theme } from '@tunarr/types';
import { StateCreator, create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import {
  ProgrammingListingsState,
  createProgrammingListingsState,
} from './programmingSelector/store.ts';
import {
  ChannelEditorState,
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
  ChannelEditorState;

const createSettingsSlice: StateCreator<SettingsState> = () => ({
  xmlTvSettings: undefined,
});

const createChannelsState: StateCreator<ChannelsState> = () => ({
  channels: undefined,
});

const middleware = <T>(
  f: StateCreator<
    T,
    [
      ['zustand/immer', never],
      ['zustand/devtools', never],
      ['zustand/persist', unknown],
    ]
  >,
) =>
  immer(
    devtools(
      persist(f, {
        name: 'tunarr',
        partialize: (state) => ({
          theme: state.theme,
        }),
      }),
    ),
  );

const useStore = create<State>()(
  middleware((...set) => ({
    ...createSettingsSlice(...set),
    ...createChannelsState(...set),
    ...createProgrammingListingsState(...set),
    ...createChannelEditorState(...set),
    ...createThemeEditorState(...set),
  })),
);

export const setChannels = (channels: Channel[]) =>
  useStore.setState({ channels });

export default useStore;
