import type { TunarrAmendedJellyfinVirtualFolder } from '@tunarr/types/jellyfin';
import {
  type JellyfinCollectionType,
  type JellyfinItem,
  type JellyfinItemKind,
} from '@tunarr/types/jellyfin';
import type { NonEmptyArray } from 'ts-essentials';

export function jellyfinChildType(
  item: JellyfinItem,
): NonEmptyArray<JellyfinItemKind> | null {
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

export const JellyfinTerminalTypes = new Set<JellyfinItemKind>([
  'Audio',
  'Movie',
  'Episode',
  'Video',
  'Trailer',
  'MusicVideo',
]) as ReadonlySet<JellyfinItemKind>;

export const sortJellyfinLibraries = (
  item: TunarrAmendedJellyfinVirtualFolder,
) => {
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

export function isJellyfinParentItem(item: JellyfinItem) {
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
    case 'Folder':
      return true;
    default:
      return false;
  }
}

export function extractJellyfinItemId(item: JellyfinItem) {
  return item.Id;
}

export function jellyfinCollectionTypeToItemTypes(
  collectionType?: JellyfinCollectionType,
): JellyfinItemKind[] {
  switch (collectionType) {
    case 'movies':
      return ['Movie'];
    case 'tvshows':
      return ['Series'];
    case 'music':
      return ['MusicArtist'];
    case 'musicvideos':
      return ['MusicVideo'];
    default:
      return [];
  }
}
