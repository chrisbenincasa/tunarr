import { type EmbyItem, type EmbyItemKind } from '@tunarr/types/emby';
import type { JellyfinItemKind } from '@tunarr/types/jellyfin';
import { flattenDeep } from 'lodash-es';
import type { NonEmptyArray } from 'ts-essentials';
import { match } from 'ts-pattern';
import { getApiEmbyByMediaSourceIdLibrariesByLibraryIdItems } from '../generated/sdk.gen.ts';
import { JellyfinTerminalTypes } from './jellyfinUtil.ts';
import { sequentialPromises } from './util.ts';

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

export const sortEmbyLibraries = (item: EmbyItem) => {
  if (item.CollectionType) {
    switch (item.CollectionType) {
      case 'tvshows':
        return 0;
      case 'movies':
      case 'music':
        return 1;
      case 'unknown':
      case 'musicvideos':
      case 'trailers':
      case 'homevideos':
      case 'boxsets':
      case 'books':
      case 'photos':
      case 'livetv':
      case 'playlists':
      case 'folders':
        return 2;
    }
  }

  return Number.MAX_SAFE_INTEGER;
};

export type EnrichedEmbyItem = EmbyItem & {
  // The internal Tunarr ID of the media source
  serverId: string;
  // This is the Plex server name that the info was retrieved from
  serverName: string;
  // If we found an existing reference to this item on the server, we add it here
  id?: string;
  showId?: string;
  seasonId?: string;
};

export const enumerateEmbyItem = (
  serverId: string,
  serverName: string,
  initialItem: EmbyItem,
): (() => Promise<EnrichedEmbyItem[]>) => {
  const seen = new Map<string, EmbyItem[]>();

  return async function () {
    async function loopInner(item: EmbyItem): Promise<EnrichedEmbyItem[]> {
      if (item.Type && EmbyTerminalTypes.has(item.Type)) {
        // Only reliable way to filter out programs that were deleted
        // from disk but not updated in JF
        if (item.RunTimeTicks && item.RunTimeTicks > 0) {
          return [{ ...item, serverName, serverId }];
        } else {
          return [];
        }
      } else {
        if (seen.has(item.Id)) {
          return sequentialPromises(seen.get(item.Id) ?? [], loopInner).then(
            flattenDeep,
          );
        }

        return getApiEmbyByMediaSourceIdLibrariesByLibraryIdItems({
          path: {
            mediaSourceId: serverId,
            libraryId: item.Id,
          },
          query: {
            itemTypes: EmbyTerminalTypesArray,
            recursive: true,
          },
          throwOnError: true,
        }) // TODO: Use p-queue here to parallelize a bit
          .then((result) => sequentialPromises(result.data.Items, loopInner))
          .then(flattenDeep);
      }
    }

    return await loopInner(initialItem);
  };
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
