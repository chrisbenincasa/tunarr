import type { EmbyItem, EmbyItemKind } from '@tunarr/types/emby';
import type { StrictOmit } from 'ts-essentials';

export type SpecificEmbyType<Typ extends EmbyItemKind> = StrictOmit<
  EmbyItem,
  'Type'
> & { Type: Typ };

export type EmbyMovie = SpecificEmbyType<'Movie'>;

export type EmbySeries = SpecificEmbyType<'Series'>;
export type EmbySeason = SpecificEmbyType<'Season'>;
export type EmbyEpisode = SpecificEmbyType<'Episode'>;

export type EmbyMusicTrack = SpecificEmbyType<'Audio'>;
export type EmbyMusicAlbum = SpecificEmbyType<'MusicAlbum'>;
export type EmbyMusicArtist = SpecificEmbyType<'MusicArtist'>;

export type EmbyMusicVideo = SpecificEmbyType<'MusicVideo'>;
export type EmbyOtherVideo = SpecificEmbyType<'Video'>;

export function isEmbyType<Typ extends EmbyItemKind>(
  item: EmbyItem,
  k: Typ,
): item is SpecificEmbyType<Typ> {
  return item.Type === k;
}
