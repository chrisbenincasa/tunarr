import { PlexLibrarySection, PlexMedia } from 'dizquetv-types/plex';
import useStore from '..';
import { find, map, reject } from 'lodash-es';
import { PlexServerSettings } from 'dizquetv-types';
import { ProgrammingListing, SelectedMedia } from './store';

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
    const listings = state.listingsByServer[serverName];
    if (!listings) {
      state.listingsByServer[serverName] = [];
    }
    dir.forEach((d) => {
      const existing = find(listings, (l) => l.dir.key === d.key);
      if (!existing) {
        state.listingsByServer[serverName].push({ dir: d, children: [] });
      } else {
        // Figure out what to do here
      }
    });
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

export const addSelectedMedia = (serverName: string, media: PlexMedia[]) =>
  useStore.setState((state) => {
    const newSelectedMedia = map(
      media,
      (m) => ({ server: serverName, guid: m.guid }) as SelectedMedia,
    );
    state.selectedMedia = [...state.selectedMedia, ...newSelectedMedia];
  });

export const removeSelectedMedia = (serverName: string, guids: string[]) =>
  useStore.setState((state) => {
    const guidsSet = new Set([...guids]);
    state.selectedMedia = reject(
      state.selectedMedia,
      (m) => m.server === serverName && guidsSet.has(m.guid),
    );
  });
