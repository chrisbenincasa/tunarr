import type { MediaSourceId } from '@tunarr/types/schemas';
import { produce } from 'immer';
import { reject } from 'lodash-es';
import { useApiQuery } from '../useApiQuery.ts';

export const usePlexLibraries = (
  serverId: MediaSourceId,
  enabled: boolean = true,
) =>
  useApiQuery({
    queryKey: ['plex', serverId, 'libraries'],
    enabled,
    queryFn: (apiClient) =>
      apiClient.getPlexLibraries({
        params: { mediaSourceId: serverId },
      }),
    select: (data) =>
      produce(data.MediaContainer, (draft) => {
        draft.Directory = reject(draft.Directory, { type: 'photo' });
      }),
  });

export const usePlexPlaylists = (
  serverId: MediaSourceId,
  enabled: boolean = true,
) =>
  useApiQuery({
    queryKey: ['plex', serverId, 'playlists'],
    enabled,
    queryFn: (apiClient) =>
      apiClient.getPlexPlaylists({ params: { mediaSourceId: serverId } }),
  });

export const usePlexItemChildren = (
  serverId: string,
  itemId: string,
  itemType: 'collection' | 'playlist' | 'item',
  enabled: boolean = true,
) =>
  useApiQuery({
    queryKey: ['plex', serverId, 'items', itemId, 'children', itemType],
    queryFn: (apiClient) =>
      apiClient.getPlexItemChildren({
        params: {
          mediaSourceId: serverId,
          plexItemId: itemId,
        },
        queries: {
          parentType: itemType,
        },
      }),
    enabled,
    select: (data) => data.MediaContainer,
  });
