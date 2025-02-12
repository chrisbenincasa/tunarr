import { SystemSettingsSchema } from '@tunarr/types';
import {
  EmbyLoginRequest,
  InsertMediaSourceRequestSchema,
  JellyfinLoginRequest,
  ScanProgressSchema,
  SystemSettingsResponseSchema,
  UpdateMediaSourceRequestSchema,
  UpdateSystemSettingsRequestSchema,
} from '@tunarr/types/api';
import {
  FfmpegSettingsSchema,
  HdhrSettingsSchema,
  HealthCheckSchema,
  MediaSourceLibrarySchema,
  MediaSourceSettingsSchema,
  PlexStreamSettingsSchema,
  TranscodeConfigSchema,
  XmlTvSettingsSchema,
} from '@tunarr/types/schemas';
import { makeEndpoint, parametersBuilder } from '@tunarr/zodios-core';
import { z } from 'zod/v4';

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

const getMediaLibraries = makeEndpoint({
  method: 'get',
  path: '/api/media-sources/:mediaSourceId/libraries',
  parameters: parametersBuilder()
    .addPaths({
      mediaSourceId: z.string(),
    })
    .build(),
  alias: 'getMediaLibraries',
  response: z.array(MediaSourceLibrarySchema),
});

const getMediaLibrary = makeEndpoint({
  method: 'get',
  path: '/api/media-libraries/:libraryId',
  parameters: parametersBuilder()
    .addPaths({
      libraryId: z.string(),
    })
    .build(),
  alias: 'getMediaLibrary',
  response: MediaSourceLibrarySchema,
});

const getMediaLibraryStatus = makeEndpoint({
  method: 'get',
  path: '/api/media-libraries/:libraryId/status',
  parameters: parametersBuilder()
    .addPaths({
      libraryId: z.string(),
    })
    .build(),
  alias: 'getMediaLibraryStatus',
  response: ScanProgressSchema,
});

const updateMediaLibraryEndpoint = makeEndpoint({
  method: 'put',
  path: '/api/media-sources/:mediaSourceId/libraries/:libraryId',
  parameters: parametersBuilder()
    .addPaths({
      mediaSourceId: z.string(),
      libraryId: z.string(),
    })
    .addBody(
      z.object({
        enabled: z.boolean(),
      }),
    )
    .build(),
  alias: 'updateMediaLibrary',
  response: MediaSourceLibrarySchema,
});

const refreshAllMediaSourceLibraries = makeEndpoint({
  method: 'post',
  path: '/api/media-sources/:mediaSourceId/libraries/all/refresh',
  parameters: parametersBuilder()
    .addPaths({
      mediaSourceId: z.string(),
    })
    .build(),
  alias: 'refreshMediaLibraries',
  status: 202,
  response: z.void(),
});

const refreshMediaSourceLibrary = makeEndpoint({
  method: 'post',
  path: '/api/media-sources/:mediaSourceId/libraries/:libraryId/refresh',
  parameters: parametersBuilder()
    .addPaths({
      mediaSourceId: z.string(),
      libraryId: z.string(),
    })
    .addParameter('forceScan', 'Query', z.boolean().optional())
    .build(),
  alias: 'refreshMediaLibrary',
  status: 202,
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
  response: SystemSettingsResponseSchema,
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
  response: z.object({
    accessToken: z.string().optional(),
    userId: z.string().optional(),
  }),
});

const embyLogin = makeEndpoint({
  method: 'post',
  path: '/api/emby/login',
  parameters: parametersBuilder().addBody(EmbyLoginRequest).build(),
  alias: 'embyUserLogin',
  response: z.object({
    accessToken: z.string().optional(),
    userId: z.string().optional(),
  }),
});

const systemHealthChecks = makeEndpoint({
  method: 'get',
  path: '/api/system/health',
  alias: 'getSystemHealth',
  response: z.record(z.string(), HealthCheckSchema),
});

const runSystemFixer = makeEndpoint({
  method: 'post',
  path: '/api/system/fixers/:fixerId/run',
  alias: 'runSystemFixer',
  parameters: parametersBuilder()
    .addParameter('fixerId', 'Path', z.string())
    .build(),
  response: z.any(),
});

const systemState = makeEndpoint({
  method: 'get',
  path: '/api/system/state',
  alias: 'getSystemState',
  response: z.object({
    isDocker: z.boolean(),
    isInContainer: z.boolean(),
  }),
});

const systemMigrationState = makeEndpoint({
  method: 'get',
  path: '/api/system/migration-state',
  alias: 'getSystemMigrationState',
  response: z.object({
    isFreshSettings: z.boolean().optional().default(true),
  }),
});

const transcodeConfigs = makeEndpoint({
  method: 'get',
  alias: 'getTranscodeConfigs',
  path: '/api/transcode_configs',
  response: z.array(TranscodeConfigSchema),
});

const getTranscodeConfig = makeEndpoint({
  method: 'get',
  alias: 'getTranscodeConfig',
  path: '/api/transcode_configs/:id',
  parameters: parametersBuilder()
    .addParameter('id', 'Path', z.string().uuid())
    .build(),
  response: TranscodeConfigSchema,
});

const createTranscodeConfig = makeEndpoint({
  method: 'post',
  alias: 'createTranscodeConfig',
  path: '/api/transcode_configs',
  parameters: parametersBuilder().addBody(TranscodeConfigSchema).build(),
  response: TranscodeConfigSchema,
});

const updateTranscodeConfig = makeEndpoint({
  method: 'put',
  alias: 'updateTranscodeConfig',
  path: '/api/transcode_configs/:id',
  parameters: parametersBuilder()
    .addPath('id', z.string().uuid())
    .addBody(TranscodeConfigSchema)
    .build(),
  response: TranscodeConfigSchema,
});

const deleteTranscodeConfig = makeEndpoint({
  method: 'delete',
  alias: 'deleteTranscodeConfig',
  path: '/api/transcode_configs/:id',
  parameters: parametersBuilder().addPath('id', z.string().uuid()).build(),
  response: z.void(),
});

const duplicateTranscodeConfig = makeEndpoint({
  method: 'post',
  alias: 'duplicateTranscodeConfig',
  path: '/api/transcode_configs/:id/copy',
  parameters: parametersBuilder().addPath('id', z.string().uuid()).build(),
  response: TranscodeConfigSchema,
  errors: [
    {
      status: 404,
      schema: z.void(),
    },
    {
      status: 500,
      schema: z.void(),
    },
  ],
});

const vainfoDebugEndpoint = makeEndpoint({
  method: 'get',
  alias: 'getVaapiDebugInfo',
  path: '/api/system/debug/vaapi',
  response: z.string(),
});

const nvidiaDebugEndpoint = makeEndpoint({
  method: 'get',
  alias: 'getNvidiaDebugInfo',
  path: '/api/system/debug/nvidia',
  response: z.string(),
});

const envDebugEndpoint = makeEndpoint({
  method: 'get',
  alias: 'getServerEnvInfo',
  path: '/api/system/debug/env',
  response: z.record(z.string(), z.string()),
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
  systemState,
  jellyfinLogin,
  systemHealthChecks,
  runSystemFixer,
  systemMigrationState,
  transcodeConfigs,
  getTranscodeConfig,
  createTranscodeConfig,
  updateTranscodeConfig,
  deleteTranscodeConfig,
  embyLogin,
  duplicateTranscodeConfig,
  vainfoDebugEndpoint,
  nvidiaDebugEndpoint,
  envDebugEndpoint,
  getMediaLibraries,
  updateMediaLibraryEndpoint,
  refreshAllMediaSourceLibraries,
  refreshMediaSourceLibrary,
  getMediaLibrary,
  getMediaLibraryStatus,
] as const;
