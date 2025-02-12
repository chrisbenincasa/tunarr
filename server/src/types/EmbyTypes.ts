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

export function isEmbyType<Typ extends EmbyItemKind>(
  item: EmbyItem,
  k: Typ,
): item is SpecificEmbyType<Typ> {
  return item.Type === k;
}
