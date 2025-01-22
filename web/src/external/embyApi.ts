import {
  EmbyItemKind,
  EmbyItemSortBy,
  EmbyLibraryItemsResponse,
} from '@tunarr/types/emby';
import { makeEndpoint, parametersBuilder } from '@zodios/core';
import { z } from 'zod';

export const embyEndpoints = [
  makeEndpoint({
    method: 'get',
    path: '/api/emby/:mediaSourceId/user_libraries',
    parameters: parametersBuilder()
      .addPath('mediaSourceId', z.string())
      .build(),
    response: EmbyLibraryItemsResponse,
    alias: 'getEmbyUserLibraries',
  }),
  makeEndpoint({
    method: 'get',
    path: '/api/emby/:mediaSourceId/libraries/:libraryId/items',
    parameters: parametersBuilder()
      .addPaths({
        mediaSourceId: z.string(),
        libraryId: z.string(),
      })
      .addQueries({
        offset: z.coerce.number().nonnegative().optional(),
        limit: z.coerce.number().positive().optional(),
        itemTypes: EmbyItemKind.array()
          .transform((arr) => arr?.join(','))
          .optional(),
        nameStartsWithOrGreater: z.string().min(1).optional(),
        nameStartsWith: z.string().min(1).optional(),
        nameLessThan: z.string().min(1).optional(),
        sortBy: EmbyItemSortBy.array().nonempty().nullish(),
        recursive: z
          .union([
            z.boolean(),
            z.literal('true'),
            z.literal('false'),
            z.coerce.number(),
          ])
          .optional(),
        artistType: z.array(z.enum(['Artist', 'AlbumArtist'])).optional(),
      })
      .build(),
    response: EmbyLibraryItemsResponse,
    alias: 'getEmbyItems',
  }),
] as const;
