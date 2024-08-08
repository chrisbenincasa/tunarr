import { SystemSettingsSchema } from '@tunarr/types';
import {
  InsertMediaSourceRequestSchema,
  JellyfinLoginRequest,
  UpdateMediaSourceRequestSchema,
  UpdateSystemSettingsRequestSchema,
} from '@tunarr/types/api';
import {
  FfmpegSettingsSchema,
  HdhrSettingsSchema,
  MediaSourceSettingsSchema,
  PlexStreamSettingsSchema,
  XmlTvSettingsSchema,
} from '@tunarr/types/schemas';
import { makeEndpoint, parametersBuilder } from '@zodios/core';
import { z } from 'zod';

const getMediaSourcesEndpoint = makeEndpoint({
  method: 'get',
  path: '/api/media-sources',
  response: z.array(MediaSourceSettingsSchema),
  alias: 'getMediaSources',
});

const createMediaSourceEndpoint = makeEndpoint({
  method: 'post',
  path: '/api/media-sources',
  parameters: parametersBuilder()
    .addBody(InsertMediaSourceRequestSchema)
    .build(),
  alias: 'createMediaSource',
  status: 201,
  response: z.object({ id: z.string() }),
});

const updateMediaSourceEndpoint = makeEndpoint({
  method: 'put',
  path: '/api/media-sources/:id',
  parameters: parametersBuilder()
    .addPath('id', z.string())
    .addBody(UpdateMediaSourceRequestSchema)
    .build(),
  alias: 'updateMediaSource',
  response: z.void(),
});

const deleteMediaSourceEndpoint = makeEndpoint({
  method: 'delete',
  path: '/api/media-sources/:id',
  parameters: parametersBuilder()
    .addPath('id', z.string())
    .addBody(z.null())
    .build(),
  alias: 'deleteMediaSource',
  response: z.void(),
});

const getXmlTvSettings = makeEndpoint({
  method: 'get',
  path: '/api/xmltv-settings',
  response: XmlTvSettingsSchema,
  alias: 'getXmlTvSettings',
});

const updateXmlTvSettings = makeEndpoint({
  method: 'put',
  path: '/api/xmltv-settings',
  response: XmlTvSettingsSchema,
  parameters: parametersBuilder().addBody(XmlTvSettingsSchema).build(),
  alias: 'updateXmlTvSettings',
});

const getFffmpegSettings = makeEndpoint({
  method: 'get',
  path: '/api/ffmpeg-settings',
  response: FfmpegSettingsSchema,
  alias: 'getFfmpegSettings',
});

const updateFfmpegSettings = makeEndpoint({
  method: 'put',
  path: '/api/ffmpeg-settings',
  response: FfmpegSettingsSchema,
  parameters: parametersBuilder().addBody(FfmpegSettingsSchema).build(),
  alias: 'updateFfmpegSettings',
});

const getHdhrSettings = makeEndpoint({
  method: 'get',
  path: '/api/hdhr-settings',
  response: HdhrSettingsSchema,
  alias: 'getHdhrSettings',
});

const updateHdhrSettings = makeEndpoint({
  method: 'put',
  path: '/api/hdhr-settings',
  response: HdhrSettingsSchema,
  parameters: parametersBuilder().addBody(HdhrSettingsSchema).build(),
  alias: 'updateHdhrSettings',
});

const getPlexStreamSettings = makeEndpoint({
  method: 'get',
  path: '/api/plex-settings',
  response: PlexStreamSettingsSchema,
  alias: 'getPlexStreamSettings',
});

const updatePlexStreamSettings = makeEndpoint({
  method: 'put',
  path: '/api/plex-settings',
  response: PlexStreamSettingsSchema,
  parameters: parametersBuilder().addBody(PlexStreamSettingsSchema).build(),
  alias: 'updatePlexStreamSettings',
});

const getSystemSettings = makeEndpoint({
  method: 'get',
  path: '/api/system/settings',
  response: SystemSettingsSchema,
  alias: 'getSystemSettings',
});

const updateSystemSettings = makeEndpoint({
  method: 'put',
  path: '/api/system/settings',
  parameters: parametersBuilder()
    .addBody(UpdateSystemSettingsRequestSchema)
    .build(),
  alias: 'updateSystemSettings',
  response: SystemSettingsSchema,
});

const jellyfinLogin = makeEndpoint({
  method: 'post',
  path: '/api/jellyfin/login',
  parameters: parametersBuilder().addBody(JellyfinLoginRequest).build(),
  alias: 'jellyfinUserLogin',
  response: z.object({ accessToken: z.string().optional() }),
});

export const endpoints = [
  getMediaSourcesEndpoint,
  createMediaSourceEndpoint,
  updateMediaSourceEndpoint,
  deleteMediaSourceEndpoint,
  getXmlTvSettings,
  updateXmlTvSettings,
  getFffmpegSettings,
  updateFfmpegSettings,
  getHdhrSettings,
  updateHdhrSettings,
  getPlexStreamSettings,
  updatePlexStreamSettings,
  getSystemSettings,
  updateSystemSettings,
  jellyfinLogin,
] as const;
