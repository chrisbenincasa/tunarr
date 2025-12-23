import {
  isTerminalItemType,
  type Library,
  type ProgramOrFolder,
  type TerminalProgram,
} from '@tunarr/types';
import { type EmbyItem, type EmbyItemKind } from '@tunarr/types/emby';
import type { JellyfinItemKind } from '@tunarr/types/jellyfin';
import { flattenDeep } from 'lodash-es';
import type { NonEmptyArray } from 'ts-essentials';
import { match } from 'ts-pattern';
import { getApiEmbyByMediaSourceIdLibrariesByLibraryIdItems } from '../generated/sdk.gen.ts';
import type { Nullable } from '../types/util.ts';
import { JellyfinTerminalTypes } from './jellyfinUtil.ts';

export function embyChildType(item: EmbyItem): EmbyItemKind[] | null {
  switch (item.Type) {
    case 'Audio':
    case 'Episode':
    case 'Movie':
      return null;
    case 'MusicAlbum':
      return ['Audio'];
    case 'MusicArtist':
      return ['MusicAlbum'];
    case 'MusicGenre':
      return ['MusicAlbum'];
    case 'Season':
      return ['Episode'];
    case 'Series':
      return ['Season'];
    case 'Playlist':
      return [...JellyfinTerminalTypes] as NonEmptyArray<JellyfinItemKind>;
    case 'Folder':
      return ['Folder', 'Video', 'MusicVideo'];
    default:
      return null;
  }
}

export const EmbyTerminalTypes = new Set<EmbyItemKind>([
  'Audio',
  'Movie',
  'Episode',
  'Video',
  'Trailer',
]);

const EmbyTerminalTypesArray = [...EmbyTerminalTypes];

export function extractEmbyId(item: EmbyItem) {
  return item.Id;
}

export function isParentEmbyItem(item: EmbyItem) {
  switch (item.Type) {
    // These are the currently supported item types
    case 'AggregateFolder':
    case 'Season':
    case 'Series':
    case 'CollectionFolder':
    case 'MusicAlbum':
    case 'MusicArtist':
    case 'MusicGenre':
    case 'Genre':
    case 'Playlist':
    case 'PlaylistsFolder':
      return true;
    default:
      return false;
  }
}

export const childEmbyItemKind = (item: EmbyItem): EmbyItemKind => {
  switch (item.Type) {
    case 'Season':
      return 'Episode';
    case 'Series':
      return 'Season';
    default:
      return 'Video';
  }
};

export const childEmbyItemType = (item: EmbyItem): string | null => {
  return match(item)
    .with({ Type: 'Season' }, () => 'episode')
    .with({ Type: 'Series' }, () => 'season')
    .with({ Type: 'CollectionFolder' }, () => 'item')
    .with({ Type: 'Playlist', MediaType: 'Audio' }, () => 'track')
    .with({ Type: 'Playlist' }, () => 'video')
    .with({ Type: 'MusicArtist' }, () => 'album')
    .with({ Type: 'MusicAlbum' }, () => 'tracn')
    .otherwise(() => null);
};

export type EnrichedEmbyItem = EmbyItem & {
  // The internal Tunarr ID of the media source
  serverId: string;
  // This is the Plex server name that the info was retrieved from
  serverName: string;
  libraryId: string;
  // If we found an existing reference to this item on the server, we add it here
  id?: string;
  showId?: string;
  seasonId?: string;
};

export const enumerateEmbyItem = (
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

        return getApiEmbyByMediaSourceIdLibrariesByLibraryIdItems({
          path: {
            mediaSourceId: serverId,
            libraryId,
          },
          query: {
            parentId: item.externalId,
            itemTypes: EmbyTerminalTypesArray,
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

export function embyCollectionTypeToItemTypes(
  collectionType?: string,
): EmbyItemKind[] {
  if (!collectionType) {
    return ['Movie', 'Series', 'MusicArtist'];
  }

  switch (collectionType) {
    case 'movies':
      return ['Movie'];
    case 'tvshows':
      return ['Series'];
    case 'music':
      return ['MusicArtist'];
    default:
      return ['Movie', 'Series', 'MusicArtist'];
  }
}
