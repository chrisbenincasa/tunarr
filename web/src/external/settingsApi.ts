import { SystemSettingsSchema } from '@tunarr/types';
import {
  InsertPlexServerRequestSchema,
  UpdatePlexServerRequestSchema,
  UpdateSystemSettingsRequestSchema,
} from '@tunarr/types/api';
import {
  FfmpegSettingsSchema,
  HdhrSettingsSchema,
  PlexServerSettingsSchema,
  PlexStreamSettingsSchema,
  XmlTvSettingsSchema,
} from '@tunarr/types/schemas';
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

export const getXmlTvSettings = makeEndpoint({
  method: 'get',
  path: '/api/xmltv-settings',
  response: XmlTvSettingsSchema,
  alias: 'getXmlTvSettings',
});

export const updateXmlTvSettings = makeEndpoint({
  method: 'put',
  path: '/api/xmltv-settings',
  response: XmlTvSettingsSchema,
  parameters: parametersBuilder().addBody(XmlTvSettingsSchema).build(),
  alias: 'updateXmlTvSettings',
});

export const getFffmpegSettings = makeEndpoint({
  method: 'get',
  path: '/api/ffmpeg-settings',
  response: FfmpegSettingsSchema,
  alias: 'getFfmpegSettings',
});

export const updateFfmpegSettings = makeEndpoint({
  method: 'put',
  path: '/api/ffmpeg-settings',
  response: FfmpegSettingsSchema,
  parameters: parametersBuilder().addBody(FfmpegSettingsSchema).build(),
  alias: 'updateFfmpegSettings',
});

export const getHdhrSettings = makeEndpoint({
  method: 'get',
  path: '/api/hdhr-settings',
  response: HdhrSettingsSchema,
  alias: 'getHdhrSettings',
});

export const updateHdhrSettings = makeEndpoint({
  method: 'put',
  path: '/api/hdhr-settings',
  response: HdhrSettingsSchema,
  parameters: parametersBuilder().addBody(HdhrSettingsSchema).build(),
  alias: 'updateHdhrSettings',
});

export const getPlexStreamSettings = makeEndpoint({
  method: 'get',
  path: '/api/plex-settings',
  response: PlexStreamSettingsSchema,
  alias: 'getPlexStreamSettings',
});

export const updatePlexStreamSettings = makeEndpoint({
  method: 'put',
  path: '/api/plex-settings',
  response: PlexStreamSettingsSchema,
  parameters: parametersBuilder().addBody(PlexStreamSettingsSchema).build(),
  alias: 'updatePlexStreamSettings',
});

export const getSystemSettings = makeEndpoint({
  method: 'get',
  path: '/api/system/settings',
  response: SystemSettingsSchema,
  alias: 'getSystemSettings',
});

export const updateSystemSettings = makeEndpoint({
  method: 'put',
  path: '/api/system/settings',
  parameters: parametersBuilder()
    .addBody(UpdateSystemSettingsRequestSchema)
    .build(),
  alias: 'updateSystemSettings',
  response: SystemSettingsSchema,
});
