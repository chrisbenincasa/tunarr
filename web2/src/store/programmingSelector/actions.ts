import { PlexServerSettings } from '@tunarr/types';
import {
  PlexLibrarySection,
  PlexMedia,
  isPlexDirectory,
  isTerminalItem,
} from '@tunarr/types/plex';
import { map, reject } from 'lodash-es';
import useStore from '..';
import { SelectedMedia } from './store';

export const setProgrammingListingServer = (
  server: PlexServerSettings | undefined,
) =>
  useStore.setState((state) => {
    state.currentServer = server;
  });

export const setProgrammingListLibrary = (key: string) =>
  useStore.setState((state) => {
    state.currentLibrary = key;
  });

function uniqueId(item: PlexLibrarySection | PlexMedia): string {
  if (isPlexDirectory(item)) {
    return item.uuid;
  } else {
    return item.guid;
  }
}

export const addKnownMediaForServer = (
  serverName: string,
  plexMedia: PlexLibrarySection[] | PlexMedia[],
  parentId?: string,
) =>
  useStore.setState((state) => {
    if (plexMedia.length === 0) {
      return state;
    }

    // Add new media
    if (!state.knownMediaByServer[serverName]) {
      state.knownMediaByServer[serverName] = {};
    }

    const byGuid = plexMedia.reduce(
      (prev, media) => ({ ...prev, [uniqueId(media)]: media }),
      {},
    );

    state.knownMediaByServer[serverName] = {
      ...state.knownMediaByServer[serverName],
      ...byGuid,
    };

    // Add relations
    let hierarchy = state.contentHierarchyByServer[serverName];
    if (!hierarchy) {
      state.contentHierarchyByServer[serverName] = {};
      hierarchy = state.contentHierarchyByServer[serverName];
    }

    const childrenByGuid = plexMedia
      .filter((m) => !isTerminalItem(m))
      .reduce((prev, media) => ({ ...prev, [uniqueId(media)]: [] }), {});
    state.contentHierarchyByServer[serverName] = {
      ...state.contentHierarchyByServer[serverName],
      ...childrenByGuid,
    };

    if (parentId) {
      if (!state.contentHierarchyByServer[serverName][parentId]) {
        state.contentHierarchyByServer[serverName][parentId] = [];
      }

      state.contentHierarchyByServer[serverName][parentId] = [
        ...state.contentHierarchyByServer[serverName][parentId],
        ...plexMedia.map(uniqueId),
      ];
    }

    return state;
  });

export const addSelectedMedia = (
  serverName: string,
  media: (PlexLibrarySection | PlexMedia)[],
) =>
  useStore.setState((state) => {
    const newSelectedMedia = map(
      media,
      (m) =>
        ({
          server: serverName,
          guid: isPlexDirectory(m) ? m.uuid : m.guid,
        }) as SelectedMedia,
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

export const clearSelectedMedia = () =>
  useStore.setState((state) => {
    state.selectedMedia = [];
  });
