import { forPlexMedia } from '@tunarr/shared/util';
import { MediaSourceId } from '@tunarr/types/schemas';
import { ApiClient } from '../external/api.ts';

export const fetchPlexPath = <T>(
  apiClient: ApiClient,
  serverId: MediaSourceId,
  path: string,
) => {
  return async () => {
    return apiClient
      .getPlexPath({
        queries: {
          id: serverId,
          path,
        },
      })
      .then((r) => r as T);
  };
};

export const getPlexMediaChildType = forPlexMedia({
  season: 'episode',
  show: 'season',
  collection: (coll) => (coll.subtype === 'movie' ? 'movie' : 'show'),
  playlist: (pl) => (pl.playlistType === 'audio' ? 'track' : 'video'),
  artist: 'album',
  album: 'track',
});
