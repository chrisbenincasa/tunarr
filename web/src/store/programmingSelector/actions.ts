import { PlexServerSettings } from '@tunarr/types';
import {
  PlexFilter,
  PlexLibrarySection,
  PlexMedia,
  PlexSort,
  isPlexDirectory,
  isTerminalItem,
} from '@tunarr/types/plex';
import { map, reject, some } from 'lodash-es';
import useStore from '..';
import {
  buildPlexFilterKey,
  buildPlexSortKey,
} from '../../helpers/plexSearchUtil.ts';
import { forSelectedMediaType, groupSelectedMedia } from '../../helpers/util';
import { SelectedLibrary, SelectedMedia } from './store';

export const setProgrammingListingServer = (
  server: PlexServerSettings | undefined,
) =>
  useStore.setState((state) => {
    state.currentServer = server;
  });

export const setProgrammingListLibrary = (library: SelectedLibrary) =>
  useStore.setState((state) => {
    state.currentLibrary = library;
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

export const addPlexSelectedMedia = (
  serverName: string,
  media: (PlexLibrarySection | PlexMedia)[],
) =>
  useStore.setState((state) => {
    const newSelectedMedia: SelectedMedia[] = map(media, (m) => ({
      type: 'plex',
      server: serverName,
      guid: isPlexDirectory(m) ? m.uuid : m.guid,
    }));
    state.selectedMedia = [...state.selectedMedia, ...newSelectedMedia];
  });

export const addPlexSelectedMediaById = (serverName: string, ids: string[]) =>
  useStore.setState((state) => {
    const newSelectedMedia: SelectedMedia[] = map(ids, (m) => ({
      type: 'plex',
      server: serverName,
      guid: m,
    }));
    state.selectedMedia = [...state.selectedMedia, ...newSelectedMedia];
  });

export const addSelectedMedia = (media: SelectedMedia | SelectedMedia[]) =>
  useStore.setState((state) => {
    state.selectedMedia = state.selectedMedia.concat(media);
  });

export const removeSelectedMedia = (media: SelectedMedia[]) =>
  useStore.setState((state) => {
    const grouped = groupSelectedMedia(media);
    const it = forSelectedMediaType({
      plex: (plex) =>
        some(grouped.plex, { server: plex.server, guid: plex.guid }),
      'custom-show': (cs) =>
        some(grouped['custom-show'], {
          customShowId: cs.customShowId,
          programId: cs.program.id,
        }),
      default: false,
    });

    state.selectedMedia = reject(state.selectedMedia, (sm) => it(sm)!);
  });

export const removePlexSelectedMedia = (serverName: string, guids: string[]) =>
  useStore.setState((state) => {
    const guidsSet = new Set([...guids]);
    state.selectedMedia = reject(
      state.selectedMedia,
      (m) =>
        m.type === 'plex' && m.server === serverName && guidsSet.has(m.guid),
    );
  });

export const removeCustomShowSelectedMedia = (
  csId: string,
  programIds: string[],
) =>
  useStore.setState((state) => {
    if (programIds.length === 0) {
      return;
    }

    const idsSet = new Set([...programIds]);
    state.selectedMedia = reject(
      state.selectedMedia,
      (m) =>
        m.type === 'custom-show' &&
        m.customShowId === csId &&
        idsSet.has(m.program.id!),
    );
  });

export const clearSelectedMedia = () =>
  useStore.setState((state) => {
    state.selectedMedia = [];
  });

export const setPlexFilter = (plexFilter: PlexFilter | undefined) =>
  useStore.setState((state) => {
    state.plexSearch = {
      ...state.plexSearch,
      filter: plexFilter,
      urlFilter: [
        ...buildPlexFilterKey(plexFilter),
        ...buildPlexSortKey(state.plexSearch.sort),
      ].join('&'),
    };
  });

export const setPlexSort = (plexSort: PlexSort | undefined) =>
  useStore.setState((state) => {
    console.log('plexSort', plexSort);
    state.plexSearch = {
      ...state.plexSearch,
      sort: plexSort,
      urlFilter: [
        ...buildPlexFilterKey(state.plexSearch.filter),
        ...buildPlexSortKey(plexSort),
      ].join('&'),
    };
  });
