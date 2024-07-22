import { makeEndpoint, parametersBuilder } from '@zodios/core';
import { JellyfinLibraryResponse } from '@tunarr/types/jellyfin';
import { z } from 'zod';

export const jellyfinEndpoints = [
  makeEndpoint({
    method: 'get',
    path: '/api/jellyfin/:mediaSourceId/user_libraries',
    parameters: parametersBuilder()
      .addPath('mediaSourceId', z.string())
      .build(),
    response: JellyfinLibraryResponse,
    alias: 'getJellyfinUserLibraries',
  }),
] as const;
