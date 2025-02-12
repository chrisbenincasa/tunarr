import { type Maybe } from '@/types/util.ts';
import { forPlexMedia } from '@tunarr/shared/util';
import type { ProgramLike } from '@tunarr/types';
import {
  type EmbyServerSettings,
  type JellyfinServerSettings,
  type MediaSourceSettings,
  type PlexServerSettings,
} from '@tunarr/types';
import { type PlexFilter, type PlexSort } from '@tunarr/types/api';
import { type EmbyItem } from '@tunarr/types/emby';
import { type JellyfinItem } from '@tunarr/types/jellyfin';
import {
  type PlexLibrarySection,
  type PlexMedia,
  isPlexDirectory,
} from '@tunarr/types/plex';
import { type MediaSourceId } from '@tunarr/types/schemas';
import { has, isArray, isUndefined, map, reject, some, uniq } from 'lodash-es';
import { match } from 'ts-pattern';
import useStore from '..';
import { Emby, Imported, Jellyfin, Plex } from '../../helpers/constants.ts';
import {
  buildPlexFilterKey,
  buildPlexSortKey,
} from '../../helpers/plexSearchUtil.ts';
import { groupSelectedMedia } from '../../helpers/util';
import {
  type Emby as EmbyT,
  type Imported as ImportedT,
  type Jellyfin as JellyfinT,
  type Plex as PlexT,
  type TypedKey,
} from '../../types/MediaSource';
import {
  type EmbySelectedMedia,
  type JellyfinSelectedMedia,
  type MediaItems,
  type MediaSourceView,
  type SelectedMedia,
} from './store';

export const setProgrammingListingServer = (
  server: Maybe<MediaSourceSettings>,
) =>
  useStore.setState((state) => {
    state.currentMediaSource = server;
    state.currentMediaSourceView = undefined;
  });

export const setProgrammingListLibrary = (library: MediaSourceView) =>
  useStore.setState((state) => {
    state.currentMediaSourceView = library;
  });

export const setProgrammingGenre = (genre?: string) =>
  useStore.setState((state) => {
    state.currentMediaGenre = genre;
  });

export const setPlexProgrammingListLibrarySubview = (
  subview?: 'collections' | 'playlists',
) =>
  useStore.setState((state) => {
    if (
      state.currentMediaSourceView?.type === 'plex' &&
      state.currentMediaSourceView.view.type === 'library'
    ) {
      state.currentMediaSourceView.view.subview = subview;
    }
  });

export const clearPlexProgrammingListLibrarySubview = () =>
  setPlexProgrammingListLibrarySubview();

export const clearProgrammingListLibrary = () =>
  useStore.setState((state) => {
    state.currentMediaSourceView = undefined;
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
    | TypedKey<PlexLibrarySection[] | PlexMedia[], PlexT, 'items'>
    | TypedKey<JellyfinItem[], JellyfinT, 'items'>
    | TypedKey<EmbyItem[], EmbyT, 'items'>
    | TypedKey<ProgramLike[], ImportedT, 'items'>,
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
      case Plex: {
        for (const item of media.items) {
          if (isUndefined(item)) {
            continue;
          }
          byGuid[uniqueId(item)] = { type: media.type, item };
        }
        break;
      }
      case Jellyfin:
        for (const item of media.items) {
          byGuid[item.Id] = { type: media.type, item };
        }
        break;
      case Emby:
        for (const item of media.items) {
          byGuid[item.Id] = { type: media.type, item };
        }
        break;
      case Imported:
        for (const item of media.items) {
          // TODO: do we need to separate groupings here because they
          // are in a different ID page?
          byGuid[item.uuid] = { type: media.type, item };
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
      case Plex:
        ids = map(media.items, uniqueId);
        break;
      case Jellyfin:
        ids = map(media.items, 'Id');
        break;
      case Emby:
        ids = map(media.items, 'Id');
        break;
      case Imported:
        ids = map(media.items, (i) => i.uuid);
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
) => addKnownMediaForServer(serverId, { type: Plex, items: media }, parentId);

export const addKnownMediaForJellyfinServer = (
  serverId: MediaSourceId,
  media: JellyfinItem[],
  parentId?: string,
) =>
  addKnownMediaForServer(serverId, { type: Jellyfin, items: media }, parentId);

export const addKnownMediaForEmbyServer = (
  serverId: MediaSourceId,
  media: EmbyItem[],
  parentId?: string,
) => addKnownMediaForServer(serverId, { type: Emby, items: media }, parentId);

export const addKnownMediaFromLibrary = (
  serverId: MediaSourceId,
  media: ProgramLike[],
  parentId?: string,
) =>
  addKnownMediaForServer(serverId, { type: Imported, items: media }, parentId);

const plexChildCount = forPlexMedia({
  default: 1,
  season: (s) => s.leafCount,
  show: (s) => s.leafCount,
  collection: (s) => s.childCount,
});

export const addPlexSelectedMedia = (
  server: PlexServerSettings,
  media: (PlexLibrarySection | PlexMedia)[],
) =>
  useStore.setState((state) => {
    const newSelectedMedia: SelectedMedia[] = map(media, (m) => ({
      type: Plex,
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
        ? map(
            media,
            (m) =>
              ({
                type: Jellyfin,
                serverId: server.id,
                serverName: server.name,
                id: m.Id,
                childCount: m.ChildCount ?? 0,
              }) satisfies JellyfinSelectedMedia,
          )
        : [
            {
              type: Jellyfin,
              serverId: server.id,
              serverName: server.name,
              id: media.Id,
              childCount: media.ChildCount ?? 0,
            } satisfies JellyfinSelectedMedia,
          ]),
    ];
  });

export const addEmbySelectedMedia = (
  server: EmbyServerSettings,
  media: EmbyItem | EmbyItem[],
) =>
  useStore.setState((state) => {
    state.selectedMedia = [
      ...state.selectedMedia,
      ...(isArray(media)
        ? map(
            media,
            (m) =>
              ({
                type: Emby,
                serverId: server.id,
                serverName: server.name,
                id: m.Id,
                childCount: m.ChildCount ?? 0,
              }) satisfies EmbySelectedMedia,
          )
        : [
            {
              type: Emby,
              serverId: server.id,
              serverName: server.name,
              id: media.Id,
              childCount: media.ChildCount ?? 0,
            } satisfies EmbySelectedMedia,
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

    const it = (selectedMedia: SelectedMedia) => {
      return match(selectedMedia)
        .with({ type: 'custom-show' }, (cs) =>
          some(grouped['custom-show'], { customShowId: cs.customShowId }),
        )
        .otherwise((srcMedia) =>
          some(grouped[srcMedia.type], {
            serverId: srcMedia.serverId,
            id: srcMedia.id,
          }),
        );
    };

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
      (m) => m.type === Plex && m.serverId === serverId && idsSet.has(m.id),
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
