import { useQuery } from '@tanstack/react-query';
import type { PlexLibrarySections, PlexPlaylists } from '@tunarr/types/plex';
import {
  getApiPlexByMediaSourceIdLibrariesOptions,
  getApiPlexByMediaSourceIdPlaylistsOptions,
} from '../../generated/@tanstack/react-query.gen.ts';

export type PlexPathMappings = [
  ['/library/sections', PlexLibrarySections],
  [`/library/sections/${string}/all`, unknown],
  ['/playlists', PlexPlaylists],
];

export const usePlexLibraries = (serverId: string, enabled: boolean = true) =>
  useQuery({
    ...getApiPlexByMediaSourceIdLibrariesOptions({
      path: {
        mediaSourceId: serverId,
      },
    }),
    enabled,
  });

export const usePlexPlaylists = (serverId: string, enabled: boolean = true) =>
  useQuery({
    ...getApiPlexByMediaSourceIdPlaylistsOptions({
      path: {
        mediaSourceId: serverId,
      },
    }),
    enabled,
  });
