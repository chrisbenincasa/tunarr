import { forPlexMedia } from '@tunarr/shared/util';
import type { PlexMedia } from '@tunarr/types/plex';

export const getPlexMediaChildType = forPlexMedia({
  season: 'episode',
  show: 'season',
  collection: (coll) => (coll.subtype === 'movie' ? 'movie' : 'show'),
  playlist: (pl) => (pl.playlistType === 'audio' ? 'track' : 'video'),
  artist: 'album',
  album: 'track',
});

export function extractPlexRatingKey(item: PlexMedia) {
  return item.ratingKey;
}

export function getPlexPageDataSize(data: {
  totalSize?: number;
  size: number;
}) {
  return {
    total: data.totalSize,
    size: data.size,
  };
}
