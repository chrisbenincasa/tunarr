import { makeEndpoint, parametersBuilder } from '@zodios/core';
import { JellyfinLibraryItemsResponse } from '@tunarr/types/jellyfin';
import { z } from 'zod';

export const jellyfinEndpoints = [
  makeEndpoint({
    method: 'get',
    path: '/api/jellyfin/:mediaSourceId/user_libraries',
    parameters: parametersBuilder()
      .addPath('mediaSourceId', z.string())
      .build(),
    // response: JellyfinLibraryResponse,
    response: JellyfinLibraryItemsResponse,
    alias: 'getJellyfinUserLibraries',
  }),
  makeEndpoint({
    method: 'get',
    path: '/api/jellyfin/:mediaSourceId/libraries/:libraryId/movies',
    parameters: parametersBuilder()
      .addPaths({
        mediaSourceId: z.string(),
        libraryId: z.string(),
      })
      .addQueries({
        offset: z.coerce.number().nonnegative().optional(),
        limit: z.coerce.number().positive().optional(),
      })
      .build(),
    response: JellyfinLibraryItemsResponse,
    alias: 'getJellyfinLibraryMovies',
  }),
] as const;
