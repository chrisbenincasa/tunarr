import { JellyfinItem, JellyfinItemKind } from '@tunarr/types/jellyfin';

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
