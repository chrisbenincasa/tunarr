import {
  type JellyfinItem,
  type JellyfinItemKind,
} from '@tunarr/types/jellyfin';

export function jellyfinChildType(
  item: JellyfinItem,
): JellyfinItemKind[] | null {
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
      return [...JellyfinTerminalTypes];
    case 'Folder':
      return ['Folder', 'Video'];
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
]);
export const sortJellyfinLibraries = (item: JellyfinItem) => {
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
