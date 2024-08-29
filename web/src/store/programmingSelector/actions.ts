import { Maybe } from '@/types/util.ts';
import { forPlexMedia } from '@tunarr/shared/util';
import {
  JellyfinServerSettings,
  MediaSourceSettings,
  PlexServerSettings,
} from '@tunarr/types';
import { PlexFilter, PlexSort } from '@tunarr/types/api';
import { JellyfinItem } from '@tunarr/types/jellyfin';
import {
  PlexLibrarySection,
  PlexMedia,
  isPlexDirectory,
} from '@tunarr/types/plex';
import { MediaSourceId } from '@tunarr/types/schemas';
import { has, isArray, isUndefined, map, reject, some, uniq } from 'lodash-es';
import useStore from '..';
import {
  buildPlexFilterKey,
  buildPlexSortKey,
} from '../../helpers/plexSearchUtil.ts';
import { forSelectedMediaType, groupSelectedMedia } from '../../helpers/util';
import { MediaItems, SelectedLibrary, SelectedMedia } from './store';

export const setProgrammingListingServer = (
  server: Maybe<MediaSourceSettings>,
) =>
  useStore.setState((state) => {
    state.currentServer = server;
    state.currentLibrary = undefined;
  });

export const setProgrammingListLibrary = (library: SelectedLibrary) =>
  useStore.setState((state) => {
    state.currentLibrary = library;
  });

export const clearProgrammingListLibrary = () =>
  useStore.setState((state) => {
    state.currentLibrary = undefined;
  });

function uniqueId(item: PlexLibrarySection | PlexMedia): string {
  if (isPlexDirectory(item)) {
    return item.uuid;
  } else {
    return item.guid;
  }
}

export const addKnownMediaForServer = (
  serverId: MediaSourceId,
  media:
    | { type: 'plex'; items: PlexLibrarySection[] | PlexMedia[] }
    | { type: 'jellyfin'; items: JellyfinItem[] },
  parentId?: string,
) =>
  useStore.setState((state) => {
    if (media.items.length === 0) {
      return state;
    }

    // Add new media
    if (!state.knownMediaByServer[serverId]) {
      state.knownMediaByServer[serverId] = {};
    }

    const byGuid: Record<string, MediaItems> = {};
    switch (media.type) {
      case 'plex': {
        for (const item of media.items) {
          if (isUndefined(item)) {
            continue;
          }
          byGuid[uniqueId(item)] = { type: media.type, item };
        }
        break;
      }
      case 'jellyfin':
        for (const item of media.items) {
          byGuid[item.Id] = { type: media.type, item };
        }
        break;
    }

    // known media is an overwrite operation, not dealing with
    // lists here. we always want the most up-to-date view of
    // an item
    state.knownMediaByServer[serverId] = {
      ...state.knownMediaByServer[serverId],
      ...byGuid,
    };

    // Add relations
    let hierarchy = state.contentHierarchyByServer[serverId];
    if (!hierarchy) {
      state.contentHierarchyByServer[serverId] = {};
      hierarchy = state.contentHierarchyByServer[serverId];
    }

    let ids: string[];
    switch (media.type) {
      case 'plex':
        ids = map(media.items, uniqueId);
        break;
      case 'jellyfin':
        ids = map(media.items, 'Id');
        break;
    }

    ids.forEach((id) => {
      if (!has(state.contentHierarchyByServer[serverId], id)) {
        state.contentHierarchyByServer[serverId][id] = [];
      }
    });

    if (parentId) {
      if (!state.contentHierarchyByServer[serverId][parentId]) {
        state.contentHierarchyByServer[serverId][parentId] = [];
      }

      // Append only - take unique
      state.contentHierarchyByServer[serverId][parentId] = uniq([
        ...state.contentHierarchyByServer[serverId][parentId],
        ...ids,
      ]);
    }

    return state;
  });

export const addKnownMediaForPlexServer = (
  serverId: MediaSourceId,
  media: PlexLibrarySection[] | PlexMedia[],
  parentId?: string,
) => addKnownMediaForServer(serverId, { type: 'plex', items: media }, parentId);

export const addKnownMediaForJellyfinServer = (
  serverId: MediaSourceId,
  media: JellyfinItem[],
  parentId?: string,
) =>
  addKnownMediaForServer(
    serverId,
    { type: 'jellyfin', items: media },
    parentId,
  );

const plexChildCount = forPlexMedia({
  default: 1,
  season: (s) => s.leafCount,
  show: (s) => s.leafCount,
  collection: (s) => {
    const num = parseInt(s.childCount);
    return isNaN(num) ? 1 : num;
  },
});

export const addPlexSelectedMedia = (
  server: PlexServerSettings,
  media: (PlexLibrarySection | PlexMedia)[],
) =>
  useStore.setState((state) => {
    const newSelectedMedia: SelectedMedia[] = map(media, (m) => ({
      type: 'plex',
      serverId: server.id,
      serverName: server.name,
      id: isPlexDirectory(m) ? m.uuid : m.guid,
      childCount: isPlexDirectory(m) ? 1 : plexChildCount(m),
    }));
    state.selectedMedia = [...state.selectedMedia, ...newSelectedMedia];
  });

export const addJellyfinSelectedMedia = (
  server: JellyfinServerSettings,
  media: JellyfinItem | JellyfinItem[],
) =>
  useStore.setState((state) => {
    state.selectedMedia = [
      ...state.selectedMedia,
      ...(isArray(media)
        ? map(media, (m) => ({
            type: 'jellyfin' as const,
            serverId: server.id,
            serverName: server.name,
            id: m.Id,
            childCount: m.ChildCount ?? 0,
          }))
        : [
            {
              type: 'jellyfin' as const,
              serverId: server.id,
              serverName: server.name,
              id: media.Id,
              childCount: media.ChildCount ?? 0,
            },
          ]),
    ];
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
        some(grouped.plex, { serverId: plex.serverId, id: plex.id }),
      jellyfin: (jf) =>
        some(grouped.jellyfin, { serverId: jf.serverId, id: jf.id }),
      'custom-show': (cs) =>
        some(grouped['custom-show'], {
          customShowId: cs.customShowId,
        }),
      default: false,
    });

    state.selectedMedia = reject(state.selectedMedia, it);
  });

export const removePlexSelectedMedia = (
  serverId: MediaSourceId,
  ids: string[],
) =>
  useStore.setState((state) => {
    const idsSet = new Set([...ids]);
    state.selectedMedia = reject(
      state.selectedMedia,
      (m) => m.type === 'plex' && m.serverId === serverId && idsSet.has(m.id),
    );
  });

export const removeCustomShowSelectedMedia = (csId: string) =>
  useStore.setState((state) => {
    state.selectedMedia = reject(
      state.selectedMedia,
      (m) => m.type === 'custom-show' && m.customShowId === csId,
    );
  });

export const clearSelectedMedia = () =>
  useStore.setState((state) => {
    state.selectedMedia = [];
  });

export const setPlexFilter = (
  plexFilter: PlexFilter | undefined,
  plexFilterLimit?: number,
) =>
  useStore.setState((state) => {
    state.plexSearch = {
      ...state.plexSearch,
      filter: plexFilter,
      urlFilter: [
        ...buildPlexFilterKey(plexFilter),
        ...buildPlexSortKey(state.plexSearch.sort),
        ...(plexFilterLimit ? [`limit=${plexFilterLimit}`] : []),
      ].join('&'),
    };
  });

export const setPlexSort = (plexSort: PlexSort | undefined) =>
  useStore.setState((state) => {
    state.plexSearch = {
      ...state.plexSearch,
      sort: plexSort,
      urlFilter: [
        ...buildPlexFilterKey(state.plexSearch.filter),
        ...buildPlexSortKey(plexSort),
        ...(state.plexSearch.limit ? [`limit=${state.plexSearch.limit}`] : []),
      ].join('&'),
    };
  });
