import { type Tag, type TupleToUnion } from '@tunarr/types';
import {
  ContentProgramTypeSchema,
  ResolutionSchema,
} from '@tunarr/types/schemas';
import type { ColumnType } from 'kysely';
import { z } from 'zod/v4';

export interface WithCreatedAt {
  createdAt: ColumnType<number, number, never>;
}

export interface WithUpdatedAt {
  updatedAt: ColumnType<number, number, number | undefined>;
}

export interface WithUuid {
  uuid: string;
}

export const ProgramExternalIdSourceTypes = [
  'plex',
  'plex-guid',
  'tmdb',
  'imdb',
  'tvdb',
  'jellyfin',
  'emby',
] as const;

export type ProgramExternalIdSourceType = TupleToUnion<
  typeof ProgramExternalIdSourceTypes
>;

export const RemoteSourceTypes = ['plex', 'jellyfin', 'emby'] as const;

export type RemoteSourceType = TupleToUnion<typeof RemoteSourceTypes>;

export const ChannelStreamModes = [
  'hls',
  'hls_slower',
  'mpegts',
  'hls_direct',
] as const;
export type ChannelStreamMode = TupleToUnion<typeof ChannelStreamModes>;

const ChannelIconSchema = z
  .object({
    path: z.string().catch(''),
    width: z.number().nonnegative().catch(0),
    duration: z.number().catch(0),
    position: z
      .enum(['top-left', 'top-right', 'bottom-left', 'bottom-right'])
      .catch('bottom-right'),
  })
  .catch({
    path: '',
    width: 0,
    duration: 0,
    position: 'bottom-right',
  });

export const DefaultChannelIcon = ChannelIconSchema.parse({});

export type ChannelIcon = z.infer<typeof ChannelIconSchema>;

export const ChannelTranscodingSettingsSchema = z.object({
  targetResolution: ResolutionSchema.optional().catch(undefined),
  videoBitrate: z.number().nonnegative().optional().catch(undefined),
  videoBufferSize: z.number().nonnegative().optional().catch(undefined),
});

export type ChannelTranscodingSettings = z.infer<
  typeof ChannelTranscodingSettingsSchema
>;

export const ChannelWatermarkSchema = z.object({
  url: z.string().optional().catch(undefined),
  enabled: z.boolean().catch(false),
  position: z
    .enum(['bottom-left', 'bottom-right', 'top-right', 'top-left'])
    .catch('bottom-right'),
  width: z.number().nonnegative().catch(2), // percentage
  verticalMargin: z.number().nonnegative().catch(0),
  horizontalMargin: z.number().nonnegative().catch(0),
  duration: z.number().nonnegative().catch(0),
  fixedSize: z.boolean().optional().catch(undefined),
  animated: z.boolean().optional().catch(undefined),
  opacity: z.number().min(0).max(100).int().optional().catch(100).default(100),
  fadeConfig: z
    .array(
      z.object({
        programType: ContentProgramTypeSchema.optional().catch(undefined),
        // Encodes on/off period of displaying the watermark in mins.
        // e.g. a 5m period fades in the watermark every 5th min and displays it
        // for 5 mins.
        periodMins: z.number().positive().min(1),
        leadingEdge: z.boolean().optional().catch(true),
      }),
    )
    .optional(),
});

export type ChannelWatermark = z.infer<typeof ChannelWatermarkSchema>;

export const ChannelOfflineSettingsSchema = z.object({
  picture: z.string().optional(),
  soundtrack: z.string().optional(),
  mode: z.enum(['pic', 'clip']).catch('clip'),
});

export type ChannelOfflineSettings = z.infer<
  typeof ChannelOfflineSettingsSchema
>;

export type MediaSourceId = Tag<string, 'mediaSourceId'>;
export type MediaSourceName = Tag<string, 'mediaSourceName'>;
export const MediaSourceTypes = ['plex', 'jellyfin', 'emby', 'local'] as const;
export const MediaLibraryTypes = [
  'movies',
  'shows',
  'music_videos',
  'other_videos',
  'tracks',
] as const;

export type MediaSourceType = TupleToUnion<typeof MediaSourceTypes>;
type MediaSourceMap = {
  [k in Capitalize<(typeof MediaSourceTypes)[number]>]: Uncapitalize<k>;
};

export const MediaSourceType: MediaSourceMap = {
  Plex: 'plex',
  Jellyfin: 'jellyfin',
  Emby: 'emby',
  Local: 'local',
} as const;

export const ProgramStates = ['ok', 'missing'] as const;

export type ProgramState = TupleToUnion<typeof ProgramStates>;

type TupleEnumMap<T extends ReadonlyArray<string>> = {
  [K in Capitalize<T[number]>]: Uncapitalize<K>;
};

export const ProgramState: TupleEnumMap<typeof ProgramStates> = {
  Ok: 'ok',
  Missing: 'missing',
};
