import {
  PlexEpisodeView,
  PlexLibraryListing,
  PlexLibrarySection,
  PlexLibrarySections,
  PlexMedia,
  PlexSeasonView,
  PlexTerminalMedia,
  isPlexDirectory,
  isTerminalItem,
} from '@tunarr/types/plex';
import { flattenDeep, map } from 'lodash-es';
import { ApiClient } from '../../external/api.ts';
import { sequentialPromises } from '../../helpers/util.ts';
import { createExternalId } from '@tunarr/shared';
import { fetchPlexPath } from '../../helpers/plexUtil.ts';

export type PlexPathMappings = [
  ['/library/sections', PlexLibrarySections],
  [`/library/sections/${string}/all`, unknown],
];

export const plexQueryOptions = <T>(
  apiClient: ApiClient,
  serverName: string,
  path: string,
  enabled: boolean = true,
) => ({
  queryKey: ['plex', serverName, path],
  queryFn: fetchPlexPath<T>(apiClient, serverName, path),
  enabled: enabled && serverName.length > 0 && path.length > 0,
});

export type EnrichedPlexMedia = PlexTerminalMedia & {
  // This is the Plex server name that the info was retrieved from
  serverName: string;
  // If we found an existing reference to this item on the server, we add it here
  id?: string;
  showId?: string;
  seasonId?: string;
};

export const enumeratePlexItem = (
  apiClient: ApiClient,
  serverName: string,
  initialItem: PlexMedia | PlexLibrarySection,
): (() => Promise<EnrichedPlexMedia[]>) => {
  const fetchPlexPathFunc = <T>(path: string) =>
    fetchPlexPath<T>(apiClient, serverName, path)();

  async function loopInner(
    item: PlexMedia | PlexLibrarySection,
  ): Promise<EnrichedPlexMedia[]> {
    if (isTerminalItem(item)) {
      return [{ ...item, serverName }];
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
