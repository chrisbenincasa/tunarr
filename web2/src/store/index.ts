import { Channel, XmlTvSettings } from '@tunarr/types';
import { StateCreator, create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import {
  ProgrammingListingsState,
  createProgrammingListingsState,
} from './programmingSelector/store';
import {
  ChannelEditorState,
  createChannelEditorState,
} from './channelEditor/store.ts';

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

export type State = SettingsState &
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
      // ['zustand/persist', unknown],
    ]
  >,
) => immer(devtools(f));

const useStore = create<State>()(
  middleware((...set) => ({
    ...createSettingsSlice(...set),
    ...createChannelsState(...set),
    ...createProgrammingListingsState(...set),
    ...createChannelEditorState(...set),
  })),
);

export const setChannels = (channels: Channel[]) =>
  useStore.setState({ channels });

export default useStore;
