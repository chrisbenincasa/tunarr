import type { Nullable } from '@/types/util.ts';
import { type Maybe } from '@/types/util.ts';
import type { Library, MediaSourceType, ProgramOrFolder } from '@tunarr/types';
import { type MediaSourceSettings } from '@tunarr/types';
import { type PlexFilter, type PlexSort } from '@tunarr/types/api';
import type { SearchRequest } from '@tunarr/types/schemas';

import { groupBy, has, reject, some, uniq } from 'lodash-es';
import { match } from 'ts-pattern';
import useStore from '..';
import { Emby, Jellyfin, Local, Plex } from '../../helpers/constants.ts';
import {
  buildPlexFilterKey,
  buildPlexSortKey,
} from '../../helpers/plexSearchUtil.ts';
import { groupSelectedMedia } from '../../helpers/util';

import {
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

export const addKnownMediaForServer = (
  serverId: string,
  items: (ProgramOrFolder | Library)[],
  parentId?: string,
) =>
  useStore.setState((state) => {
    if (items.length === 0) {
      return state;
    }

    // Add new media
    if (!state.knownMediaByServer[serverId]) {
      state.knownMediaByServer[serverId] = {};
    }

    const byGuid: Record<string, MediaItems> = {};
    for (const item of items) {
      byGuid[item.uuid] = item;
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

    const ids = items.map((item) => item.uuid);

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

export const addSelectedMedia = (media: SelectedMedia | SelectedMedia[]) =>
  useStore.setState((state) => {
    state.selectedMedia = state.selectedMedia.concat(media);
  });

type MediaSourceSelectedMedia = {
  sourceType: MediaSourceType;
  mediaSourceId: string;
  id: string;
};

export const removeMediaSourceSelectedMedia = (
  media: MediaSourceSelectedMedia[],
) =>
  useStore.setState((state) => {
    const grouped = groupBy(media, (m) => m.sourceType);

    state.selectedMedia = reject(
      state.selectedMedia,
      (media: SelectedMedia) => {
        switch (media.type) {
          case Plex:
          case Jellyfin:
          case Emby:
            return some(grouped[media.type], {
              id: media.id,
              mediaSourceId: media.mediaSource.id,
            });
          case Local:
          case 'custom-show':
            return false;
        }
      },
    );
  });

export const removeSelectedMedia = (media: SelectedMedia[]) =>
  useStore.setState((state) => {
    const grouped = groupSelectedMedia(media);

    const it = (selectedMedia: SelectedMedia) => {
      return match(selectedMedia)
        .with({ type: 'custom-show' }, (cs) =>
          some(grouped['custom-show'], { customShowId: cs.customShowId }),
        )
        .otherwise(
          (srcMedia) =>
            grouped[srcMedia.type]?.some(
              (target) =>
                target.mediaSource.id === srcMedia.mediaSource.id &&
                target.id === srcMedia.id,
            ) ?? false,
        );
    };

    state.selectedMedia = reject(state.selectedMedia, it);
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

export const setSearchRequest = (request: Nullable<SearchRequest>) =>
  useStore.setState((state) => {
    state.currentSearchRequest = request;
  });
