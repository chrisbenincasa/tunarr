import {
  MakePlexMediaContainerResponseSchema,
  PlexLibrariesResponseSchema,
  PlexLibraryCollectionSchema,
  PlexMediaContainerResponseSchema,
  PlexPlaylistSchema,
} from '@tunarr/types/plex';
import { makeEndpoint, parametersBuilder } from '@tunarr/zodios-core';
import { z } from 'zod/v4';

export const plexEndpoints = [
  makeEndpoint({
    method: 'get',
    path: '/api/plex/:mediaSourceId/libraries',
    alias: 'getPlexLibraries',
    parameters: parametersBuilder()
      .addPath('mediaSourceId', z.string())
      .build(),
    response: PlexLibrariesResponseSchema,
  }),
  makeEndpoint({
    method: 'get',
    path: '/api/plex/:mediaSourceId/playlists',
    alias: 'getPlexPlaylists',
    parameters: parametersBuilder()
      .addPath('mediaSourceId', z.string())
      .addQueries({
        offset: z.number().nonnegative().optional(),
        limit: z.number().nonnegative().optional(),
      })
      .build(),
    response: MakePlexMediaContainerResponseSchema(PlexPlaylistSchema),
  }),
  makeEndpoint({
    method: 'get',
    path: '/api/plex/:mediaSourceId/items/:plexItemId/children',
    alias: 'getPlexItemChildren',
    parameters: parametersBuilder()
      .addPath('mediaSourceId', z.string())
      .addPath('plexItemId', z.string())
      .addQuery('parentType', z.enum(['item', 'collection', 'playlist']))
      .build(),
    response: PlexMediaContainerResponseSchema,
  }),
  makeEndpoint({
    method: 'get',
    path: '/api/plex/:mediaSourceId/libraries/:libraryId/collections',
    alias: 'getPlexLibraryCollections',
    parameters: parametersBuilder()
      .addQueries({
        offset: z.number().nonnegative().optional(),
        limit: z.number().nonnegative().optional(),
      })
      .build(),
    response: MakePlexMediaContainerResponseSchema(PlexLibraryCollectionSchema),
  }),
  makeEndpoint({
    method: 'get',
    path: '/api/plex/:mediaSourceId/libraries/:libraryId/playlists',
    alias: 'getPlexLibraryPlaylists',
    parameters: parametersBuilder()
      .addQueries({
        offset: z.number().nonnegative().optional(),
        limit: z.number().nonnegative().optional(),
      })
      .build(),
    response: MakePlexMediaContainerResponseSchema(PlexPlaylistSchema),
  }),
] as const;
