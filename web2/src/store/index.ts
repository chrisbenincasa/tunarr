import { Channel, XmlTvSettings } from 'dizquetv-types';
import { StateCreator, create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

interface ChannelsState {
  channels?: Channel[];
}

interface SettingsState {
  xmltvSettings?: XmlTvSettings;
}

type State = SettingsState & ChannelsState;

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
) => immer(devtools(persist(f, { name: 'dizque' })));

const useStore = create<State>()(
  middleware((...set) => ({
    ...createSettingsSlice(...set),
    ...createChannelsState(...set),
  })),
);

export const setChannels = (channels: Channel[]) =>
  useStore.setState({ channels });

export default useStore;
