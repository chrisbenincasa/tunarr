import { createExternalId } from '@tunarr/shared';
import { tag } from '@tunarr/types';
import type {
  PlexEpisodeView,
  PlexLibraryListing,
  PlexLibrarySection,
  PlexLibrarySections,
  PlexMedia,
  PlexSeasonView,
  PlexTerminalMedia,
} from '@tunarr/types/plex';
import { isPlexDirectory, isTerminalItem } from '@tunarr/types/plex';
import type { MediaSourceId } from '@tunarr/types/schemas';
import { flattenDeep, map } from 'lodash-es';
import type { ApiClient } from '../../external/api.ts';
import { fetchPlexPath } from '../../helpers/plexUtil.ts';
import { sequentialPromises } from '../../helpers/util.ts';

export const emptyMediaSourceId = tag<MediaSourceId>('');

export type PlexPathMappings = [
  ['/library/sections', PlexLibrarySections],
  [`/library/sections/${string}/all`, unknown],
];

export const plexQueryOptions = <T>(
  apiClient: ApiClient,
  serverId: MediaSourceId,
  path: string,
  enabled: boolean = true,
) => ({
  queryKey: ['plex', serverId, path],
  queryFn: fetchPlexPath<T>(apiClient, serverId, path),
  enabled: enabled && serverId.length > 0 && path.length > 0,
});

export type EnrichedPlexMedia = PlexTerminalMedia & {
  // The internal Tunarr ID of the media source
  serverId: MediaSourceId;
  // This is the Plex server name that the info was retrieved from
  serverName: string;
  // If we found an existing reference to this item on the server, we add it here
  id?: string;
  showId?: string;
  seasonId?: string;
};

export const enumeratePlexItem = (
  apiClient: ApiClient,
  serverId: MediaSourceId,
  serverName: string,
  initialItem: PlexMedia | PlexLibrarySection,
): (() => Promise<EnrichedPlexMedia[]>) => {
  const fetchPlexPathFunc = <T>(path: string) =>
    fetchPlexPath<T>(apiClient, serverId, path)();

  async function loopInner(
    item: PlexMedia | PlexLibrarySection,
  ): Promise<EnrichedPlexMedia[]> {
    if (isTerminalItem(item)) {
      if ((item.duration ?? 0) <= 0) {
        return [];
      }
      return [{ ...item, serverName, serverId }];
    } else {
      const path = isPlexDirectory(item)
        ? `/library/sections/${item.key}/all`
        : item.key;

      return fetchPlexPathFunc<
        PlexLibraryListing | PlexSeasonView | PlexEpisodeView
      >(path)
        .then(async (result) => {
          return sequentialPromises(result.Metadata, loopInner);
        })
        .then((allResults) => flattenDeep(allResults));
    }
  }

  return async function () {
    const res = await loopInner(initialItem);
    const externalIds = res.map((m) =>
      createExternalId('plex', serverName, m.ratingKey),
    );

    // This is best effort - if the user saves these IDs later, the upsert
    // logic should figure out what is new/existing
    try {
      const existingIdsByExternalId =
        await apiClient.batchGetProgramsByExternalIds({ externalIds });
      return map(res, (media) => {
        const existing =
          existingIdsByExternalId[
            createExternalId('plex', serverName, media.ratingKey)
          ];
        return {
          ...media,
          id: existing?.id,
          showId: existing?.showId,
          seasonId: existing?.seasonId,
        };
      });
    } catch (e) {
      console.error('Unable to retrieve IDs in batch', e);
    }

    return res;
  };
};
