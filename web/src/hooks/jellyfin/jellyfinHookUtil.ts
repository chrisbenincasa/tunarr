import { ApiClient } from '@/external/api.ts';
import { sequentialPromises } from '@/helpers/util.ts';
import { JellyfinItem, JellyfinItemKind } from '@tunarr/types/jellyfin';
import { MediaSourceId } from '@tunarr/types/schemas';
import { flattenDeep } from 'lodash-es';

export type EnrichedJellyfinItem = JellyfinItem & {
  // The internal Tunarr ID of the media source
  serverId: MediaSourceId;
  // This is the Plex server name that the info was retrieved from
  serverName: string;
  // If we found an existing reference to this item on the server, we add it here
  id?: string;
  showId?: string;
  seasonId?: string;
};

const TerminalTypes = new Set<JellyfinItemKind>(['Audio', 'Movie', 'Episode']);

export const enumerateJellyfinItem = (
  apiClient: ApiClient,
  serverId: MediaSourceId,
  serverName: string,
  initialItem: JellyfinItem,
): (() => Promise<EnrichedJellyfinItem[]>) => {
  return async function () {
    async function loopInner(
      item: JellyfinItem,
    ): Promise<EnrichedJellyfinItem[]> {
      if (TerminalTypes.has(item.Type)) {
        return [{ ...item, serverName, serverId }];
      } else {
        // const path = isPlexDirectory(item)
        //   ? `/library/sections/${item.key}/all`
        //   : item.key;

        // return fetchPlexPathFunc<
        //   PlexLibraryListing | PlexSeasonView | PlexEpisodeView
        // >(path)
        //   .then(async (result) => {
        //     return sequentialPromises(result.Metadata, loopInner);
        //   })
        //   .then((allResults) => flattenDeep(allResults));
        return apiClient
          .getJellyfinItems({
            params: {
              mediaSourceId: serverId,
              libraryId: item.Id,
            },
          })
          .then((result) => sequentialPromises(result.Items, loopInner))
          .then(flattenDeep);
      }
    }

    const res = await loopInner(initialItem);
    // const externalIds = res.map((m) =>
    //   createExternalId('plex', serverName, m.ratingKey),
    // );

    // This is best effort - if the user saves these IDs later, the upsert
    // logic should figure out what is new/existing
    try {
      // const existingIdsByExternalId =
      //   await apiClient.batchGetProgramsByExternalIds({ externalIds });
      // return map(res, (media) => {
      //   // const existing =
      //   //   existingIdsByExternalId[
      //   //     createExternalId('plex', serverName, media.ratingKey)
      //   //   ];
      //   return {
      //     ...media,
      //     // id: existing?.id,
      //     // showId: existing?.showId,
      //     // seasonId: existing?.seasonId,
      //   };
      // });
      return res;
    } catch (e) {
      console.error('Unable to retrieve IDs in batch', e);
    }

    return res;
  };
};
