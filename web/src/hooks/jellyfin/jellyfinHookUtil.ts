import { JellyfinTerminalTypes } from '@/helpers/jellyfinUtil';
import {
  isTerminalItemType,
  type Library,
  type ProgramOrFolder,
  type TerminalProgram,
} from '@tunarr/types';
import { type JellyfinItem } from '@tunarr/types/jellyfin';
import { flattenDeep } from 'lodash-es';
import { getJellyfinLibraryItems } from '../../generated/sdk.gen.ts';
import type { Nullable } from '../../types/util.ts';

export type EnrichedJellyfinItem = JellyfinItem & {
  // The internal Tunarr ID of the media source
  serverId: string;
  // This is the server name that the info was retrieved from
  serverName: string;
  // The internal Tunarr ID of the media library,
  libraryId: string;
  // If we found an existing reference to this item on the server, we add it here
  id?: string;
  showId?: string;
  seasonId?: string;
};

export const enumerateJellyfinItem = (
  serverId: string,
  libraryId: string,
  initialItem: ProgramOrFolder | Library,
): Promise<TerminalProgram[]> => {
  const seen = new Map<string, (ProgramOrFolder | Library)[]>();

  return (async function () {
    async function loopInner(
      item: ProgramOrFolder | Library,
      parent: Nullable<ProgramOrFolder | Library>,
      acc: TerminalProgram[],
    ): Promise<TerminalProgram[]> {
      if (isTerminalItemType(item)) {
        // Only reliable way to filter out programs that were deleted
        // from disk but not updated in JF
        if (item.duration <= 0) {
          return acc;
        }

        if (parent?.type === 'season' && item.type === 'episode') {
          item.season = parent;
        } else if (parent?.type === 'album' && item.type === 'track') {
          item.album = parent;
        }

        acc.push(item);
        return acc;
      } else {
        if (seen.has(item.uuid)) {
          for (const program of seen.get(item.uuid) ?? []) {
            acc = await loopInner(program, item, acc);
          }
          return acc;
        }

        if (parent?.type === 'show' && item.type === 'season') {
          item.show = parent;
        } else if (parent?.type === 'artist' && item.type === 'album') {
          item.artist = parent;
        }

        return getJellyfinLibraryItems({
          path: {
            mediaSourceId: serverId,
            libraryId,
          },
          query: {
            parentId: item.externalId,
            itemTypes: [...JellyfinTerminalTypes],
            recursive: true,
          },
          throwOnError: true,
        }) // TODO: Use p-queue here to parallelize a bit
          .then(async (result) => {
            for (const program of result.data.result) {
              acc = await loopInner(program, item, acc);
            }
            return acc;
          })
          .then(flattenDeep);
      }
    }

    return await loopInner(initialItem, null, []);
  })();
};
