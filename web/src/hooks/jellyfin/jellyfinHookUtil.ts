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
        // Only reliable way to filter out programs that were deleted
        // from disk but not updated in JF
        if (item.RunTimeTicks && item.RunTimeTicks > 0) {
          return [{ ...item, serverName, serverId }];
        } else {
          return [];
        }
      } else {
        return (
          apiClient
            .getJellyfinItems({
              params: {
                mediaSourceId: serverId,
                libraryId: item.Id,
              },
              queries: {
                itemTypes: [...TerminalTypes],
              },
            })
            // TODO: Use p-queue here to parallelize a bit
            .then((result) => sequentialPromises(result.Items, loopInner))
            .then(flattenDeep)
        );
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
