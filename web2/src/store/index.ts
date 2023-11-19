import { Channel, PlexServerSettings, XmlTvSettings } from 'dizquetv-types';
import { PlexLibrarySection, PlexMedia } from 'dizquetv-types/plex';
import { Draft } from 'immer';
import { find } from 'lodash-es';
import { StateCreator, create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

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

type State = SettingsState & ChannelsState & ProgrammingListingsState;

const createSettingsSlice: StateCreator<SettingsState> = () => ({
  xmlTvSettings: undefined,
});

const createChannelsState: StateCreator<ChannelsState> = () => ({
  channels: undefined,
});

export interface ProgrammingListing {
  guid: string;
  type: keyof PlexMedia['type'];
  children: ProgrammingListing[]; // GUIDs from the known media store
}

export interface ProgrammingDirectory {
  dir: PlexLibrarySection;
  children: ProgrammingListing[]; // GUIDs from the known media store
}

interface ProgrammingListingsState {
  currentServer?: PlexServerSettings;
  listingsByServer: Record<string, ProgrammingDirectory[]>;
  knownMediaByServer: Record<string, Record<string, PlexMedia>>;
}

const createProgrammingListingsState: StateCreator<
  ProgrammingListingsState
> = () => ({ listingsByServer: {}, knownMediaByServer: {} });

export const setProgrammingListingServer = (
  server: PlexServerSettings | undefined,
) =>
  useStore.setState((state) => {
    state.currentServer = server;
  });

export const addKnownMediaForServer = (
  serverName: string,
  plexMedia: PlexMedia[],
) =>
  useStore.setState((state) => {
    if (!state.knownMediaByServer[serverName]) {
      state.knownMediaByServer[serverName] = {};
    }

    const byGuid = plexMedia.reduce(
      (prev, media) => ({ ...prev, [media.guid]: media }),
      {},
    );
    state.knownMediaByServer[serverName] = {
      ...state.knownMediaByServer[serverName],
      ...byGuid,
    };
    return state;
  });

export const setProgrammingDirectory = (
  serverName: string,
  dir: PlexLibrarySection[],
) =>
  useStore.setState((state) => {
    state.listingsByServer[serverName] = [
      ...dir.map((d) => ({ dir: d, children: [] })),
    ];
  });

export const setProgrammingDirectoryListings = (
  serverName: string,
  directoryKey: string,
  media: PlexMedia[],
) =>
  useStore.setState((state) => {
    if (state.listingsByServer[serverName]) {
      const directory = find(
        state.listingsByServer[serverName],
        (s) => s.dir.key === directoryKey,
      );
      if (directory) {
        console.log(media);
        directory.children = [
          // ...directory.children,
          ...(media.map((m) => ({
            guid: m.guid,
            type: m.type,
            children: [],
          })) as ProgrammingListing[]),
        ];
      }
    }
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
  })),
);

export const setChannels = (channels: Channel[]) =>
  useStore.setState({ channels });

export default useStore;
