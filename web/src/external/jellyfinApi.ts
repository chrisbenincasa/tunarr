import {
  JellyfinItemKind,
  JellyfinItemSortBy,
  JellyfinLibraryItemsResponse,
  JellyfinGenresResponse
} from '@tunarr/types/jellyfin';
import { makeEndpoint, parametersBuilder } from '@tunarr/zodios-core';
import { z } from 'zod/v4';

export const jellyfinEndpoints = [
  makeEndpoint({
    method: 'get',
    path: '/api/jellyfin/:mediaSourceId/user_libraries',
    parameters: parametersBuilder()
      .addPath('mediaSourceId', z.string())
      .build(),
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
        sortBy: JellyfinItemSortBy.array().nonempty().nullish(),
        recursive: z
          .union([
            z.boolean(),
            z.literal('true'),
            z.literal('false'),
            z.coerce.number(),
          ])
          .optional(),
      })
      .build(),
    response: JellyfinLibraryItemsResponse,
    alias: 'getJellyfinItems',
  }),
  makeEndpoint({
    method: 'get',
    path: '/api/jellyfin/:mediaSourceId/libraries/:libraryId/genres',
    parameters: parametersBuilder()
      .addPath('mediaSourceId', z.string())
      .addPath('libraryId', z.string())
      .build(),
    response: JellyfinGenresResponse,
    alias: 'getJellyfinGenres',
  }),
] as const;
