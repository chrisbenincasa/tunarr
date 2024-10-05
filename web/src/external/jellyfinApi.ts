import {
  JellyfinItemKind,
  JellyfinLibraryItemsResponse,
} from '@tunarr/types/jellyfin';
import { makeEndpoint, parametersBuilder } from '@zodios/core';
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
    path: '/api/jellyfin/:mediaSourceId/libraries/:libraryId/items',
    parameters: parametersBuilder()
      .addPaths({
        mediaSourceId: z.string(),
        libraryId: z.string(),
      })
      .addQueries({
        offset: z.coerce.number().nonnegative().optional(),
        limit: z.coerce.number().positive().optional(),
        itemTypes: JellyfinItemKind.array()
          .transform((arr) => arr?.join(','))
          .optional(),
        nameStartsWithOrGreater: z.string().min(1).optional(),
        nameStartsWith: z.string().min(1).optional(),
        nameLessThan: z.string().min(1).optional(),
      })
      .build(),
    response: JellyfinLibraryItemsResponse,
    alias: 'getJellyfinItems',
  }),
] as const;
