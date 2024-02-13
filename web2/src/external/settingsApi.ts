import {
  InsertPlexServerRequestSchema,
  UpdatePlexServerRequestSchema,
} from '@tunarr/types/api';
import { PlexServerSettingsSchema } from '@tunarr/types/schemas';
import { makeEndpoint, parametersBuilder } from '@zodios/core';
import { z } from 'zod';

export const getPlexServersEndpoint = makeEndpoint({
  method: 'get',
  path: '/api/plex-servers',
  response: z.array(PlexServerSettingsSchema),
  alias: 'getPlexServers',
});

export const createPlexServerEndpoint = makeEndpoint({
  method: 'post',
  path: '/api/plex-servers',
  parameters: parametersBuilder()
    .addBody(InsertPlexServerRequestSchema)
    .build(),
  alias: 'createPlexServer',
  status: 201,
  response: z.object({ id: z.string() }),
});

export const updatePlexServerEndpoint = makeEndpoint({
  method: 'put',
  path: '/api/plex-servers/:id',
  parameters: parametersBuilder()
    .addPath('id', z.string())
    .addBody(UpdatePlexServerRequestSchema)
    .build(),
  alias: 'updatePlexServer',
  response: z.void(),
});

export const deletePlexServerEndpoint = makeEndpoint({
  method: 'delete',
  path: '/api/plex-servers/:id',
  parameters: parametersBuilder()
    .addPath('id', z.string())
    .addBody(z.null())
    .build(),
  alias: 'deletePlexServer',
  response: z.void(),
});

export const getPlexBackendStatus = makeEndpoint({
  method: 'post',
  path: '/api/plex-servers/foreignstatus',
  parameters: parametersBuilder()
    .addBody(
      z.object({
        name: z.string(),
        accessToken: z.string(),
        uri: z.string(),
      }),
    )
    .build(),
  alias: 'getPlexBackendStatus',
  response: z.object({
    // TODO Change this, this is very stupid
    status: z.union([z.literal(1), z.literal(-1)]),
  }),
});
