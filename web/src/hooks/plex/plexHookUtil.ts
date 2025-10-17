import {
  isTerminalItemType,
  type Library,
  type MediaSourceSettings,
  type ProgramOrFolder,
  type TerminalProgram,
} from '@tunarr/types';
import type {
  PlexLibrarySections,
  PlexTerminalMedia,
} from '@tunarr/types/plex';
import { match, P } from 'ts-pattern';
import { getApiPlexByMediaSourceIdItemsByItemIdChildren } from '../../generated/sdk.gen.ts';

export type PlexPathMappings = [
  ['/library/sections', PlexLibrarySections],
  [`/library/sections/${string}/all`, unknown],
];

export type EnrichedPlexMedia = PlexTerminalMedia & {
  // The internal Tunarr ID of the media source
  serverId: string;
  // This is the Plex server name that the info was retrieved from
  serverName: string;
  // The internal Tunarr ID of the media library
  libraryId: string;
  // If we found an existing reference to this item on the server, we add it here
  id?: string;
  showId?: string;
  seasonId?: string;
};

export const enumeratePlexItem = async (
  mediaSource: MediaSourceSettings,
  item: ProgramOrFolder | Library,
  parent?: ProgramOrFolder | Library,
  acc: TerminalProgram[] = [],
): Promise<TerminalProgram[]> => {
  if (isTerminalItemType(item)) {
    if ((item.duration ?? 0) <= 0) {
      return acc;
    }

    if (item.type === 'episode' && parent?.type === 'season') {
      item.season = parent;
    } else if (item.type === 'track' && parent?.type === 'album') {
      item.album = parent;
    }

    acc.push(item);
    return acc;
  } else {
    if (item.type === 'season' && parent?.type === 'show') {
      item.show = parent;
    } else if (item.type === 'album' && parent?.type === 'artist') {
      item.artist = parent;
    }

    return getApiPlexByMediaSourceIdItemsByItemIdChildren({
      path: {
        mediaSourceId: mediaSource.id,
        itemId: item.externalId,
      },
      query: {
        parentType: match(item.type)
          .returnType<'item' | 'collection' | 'playlist'>()
          .with('collection', () => 'collection')
          .with('playlist', () => 'playlist')
          .with(P._, () => 'item')
          .exhaustive(),
      },
      throwOnError: true,
    }).then(async (result) => {
      for (const nextItem of result.data) {
        acc = await enumeratePlexItem(mediaSource, nextItem, item, acc);
      }
      return acc;
    });
  }
};
