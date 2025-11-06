import z from 'zod/v4';
import { type TupleToUnion } from '../util.js';
import { ScheduleSchema } from './utilSchemas.js';

export const XmlTvSettingsSchema = z.object({
  programmingHours: z.number().default(12),
  refreshHours: z.number().default(4),
  outputPath: z.string().default(''),
  enableImageCache: z.boolean().default(false),
  // If true, episodes will use the poster for their show in
  // the XMLTV file
  useShowPoster: z.boolean().default(false).catch(false),
});

export const SupportedVideoFormats = ['h264', 'hevc', 'mpeg2'] as const;
export type SupportedVideoFormats = TupleToUnion<typeof SupportedVideoFormats>;
export const DefaultVideoFormat = 'h264';

export const SupportedHardwareAccels = [
  'none',
  'cuda',
  'vaapi',
  'qsv',
  'videotoolbox',
] as const;

export type SupportedHardwareAccels = TupleToUnion<
  typeof SupportedHardwareAccels
>;

export const DefaultHardwareAccel = 'none';

export const SupportedErrorScreens = [
  'static',
  'pic',
  'blank',
  'testsrc',
  'text',
  'kill',
] as const;

export const SupportedErrorAudioTypes = [
  'silent',
  'sine',
  'whitenoise',
] as const;

export const FfmpegLogLevels = [
  'panic',
  'fatal',
  'error',
  'warning',
  'info',
  'verbose',
  'debug',
  'trace',
] as const;

export type FfmpegLogLevel = TupleToUnion<typeof FfmpegLogLevels>;

export const FfmpegNumericLogLevels: Record<
  TupleToUnion<typeof FfmpegLogLevels>,
  number
> = {
  panic: 0,
  fatal: 8,
  error: 16,
  warning: 24,
  info: 32,
  verbose: 40,
  debug: 48,
  trace: 56,
};

export const LanguagePreferenceSchema = z.object({
  // ISO 639-1 (2-letter)
  iso6391: z.string().length(2),
  // ISO 639-2 (3-letter)
  iso6392: z.string().length(3),
  displayName: z.string(),
});

export const LanguagePreferencesSchema = z.object({
  preferences: z.array(LanguagePreferenceSchema).min(1),
});

export const FfmpegSettingsSchema = z.object({
  configVersion: z.number().default(5),
  ffmpegExecutablePath: z.string().default('/usr/bin/ffmpeg'),
  ffprobeExecutablePath: z.string().default('/usr/bin/ffprobe'),
  enableLogging: z.boolean().default(false),
  enableFileLogging: z.boolean().default(false),
  logLevel: z.enum(FfmpegLogLevels).optional().default('warning'),
  languagePreferences: LanguagePreferencesSchema.default({
    preferences: [{ iso6391: 'en', iso6392: 'eng', displayName: 'English' }],
  }),
  transcodeDirectory: z.string().default('').optional(),
  scalingAlgorithm: z
    .enum(['bicubic', 'fast_bilinear', 'lanczos', 'spline'])
    .default('bicubic'),
  deinterlaceFilter: z
    .enum(['none', 'bwdif=0', 'bwdif=1', 'w3fdif', 'yadif=0', 'yadif=1'])
    .default('none'),
  hlsDirectOutputFormat: z.enum(['mkv', 'mpegts', 'mp4']).default('mpegts'),
  enableSubtitleExtraction: z.boolean().optional().default(false),
});

export const MediaSourceType = z.enum(['plex', 'jellyfin', 'emby', 'local']);

export const MediaSourceContentType = z.enum([
  'movies',
  'shows',
  'music_videos',
  'other_videos',
  'tracks',
]);

const BaseMediaSourceLibrarySchema = z.object({
  id: z.uuid(),
  name: z.string(),
  mediaType: MediaSourceContentType,
  lastScannedAt: z.number().optional(),
  externalKey: z.string(),
  type: MediaSourceType,
  enabled: z.boolean(),
  isLocked: z.boolean(),
});

export const MediaSourceLibrarySchema = z.object({
  ...BaseMediaSourceLibrarySchema.shape,
  get mediaSource() {
    return z
      .discriminatedUnion('type', [
        PlexServerSettingsSchema.omit({ libraries: true }),
        JellyfinServerSettingsSchema.omit({ libraries: true }),
        EmbyServerSettingsSchema.omit({ libraries: true }),
        LocalMediaSourceSchema.omit({ libraries: true, paths: true }),
      ])
      .optional();
  },
});

export const MediaSourceId = z.string().brand<'mediaSourceId'>();

export const MediaSourcePathReplacement = z.object({
  serverPath: z.string(),
  localPath: z.string(),
});

const BaseMediaSourceSettingsSchema = z.object({
  id: z.string(),
  name: z.string(),
  uri: z.string(),
  accessToken: z.string(),
  userId: z.string().nullable(),
  username: z.string().nullable(),
  libraries: z.array(BaseMediaSourceLibrarySchema),
  pathReplacements: z.array(MediaSourcePathReplacement),
});

export const PlexServerSettingsSchema = BaseMediaSourceSettingsSchema.extend({
  type: z.literal(MediaSourceType.enum.plex),
  sendGuideUpdates: z.boolean(),
  index: z.number(),
  clientIdentifier: z.string().optional(),
});

export const JellyfinServerSettingsSchema =
  BaseMediaSourceSettingsSchema.extend({
    type: z.literal('jellyfin'),
  });

export const EmbyServerSettingsSchema = BaseMediaSourceSettingsSchema.extend({
  type: z.literal('emby'),
});

export const LocalMediaSourceSchema = z
  .object({
    ...BaseMediaSourceSettingsSchema.shape,
    type: z.literal('local'),
    mediaType: MediaSourceContentType,
    paths: z.array(z.string().min(1)).nonempty(),
  })
  .omit({ accessToken: true, userId: true, username: true, uri: true });

export const MediaSourceSettingsSchema = z.discriminatedUnion('type', [
  PlexServerSettingsSchema,
  JellyfinServerSettingsSchema,
  EmbyServerSettingsSchema,
  LocalMediaSourceSchema,
]);

export const PlexStreamSettingsSchema = z.object({
  streamPath: z.enum(['network', 'direct']).default('network'),
  updatePlayStatus: z.boolean().default(false),
  pathReplace: z.string().default(''),
  pathReplaceWith: z.string().default(''),
});

export const HdhrSettingsSchema = z.object({
  autoDiscoveryEnabled: z.boolean().default(true),
  tunerCount: z.number().default(2),
});

export const GlobalMediaSourceSettingsSchema = z.object({
  rescanIntervalHours: z.number().nonnegative().default(6),
});

export type GlobalMediaSourceSettings = z.infer<
  typeof GlobalMediaSourceSettingsSchema
>;

export const FileBackupOutputSchema = z.object({
  type: z.literal('file'),
  outputPath: z.string(),
  archiveFormat: z.union([z.literal('zip'), z.literal('tar')]).default('tar'),
  gzip: z.boolean().optional(), // Only valid if archive format is tar
  tempDir: z.string().optional(), // Defaults to OS-specific temp dir, can be relative path
  maxBackups: z.number().positive().default(3),
});

export type FileBackupOutput = z.infer<typeof FileBackupOutputSchema>;

export const BackupOutputSchema = z.discriminatedUnion('type', [
  FileBackupOutputSchema,
]);

export const BackupConfigurationSchema = z.object({
  enabled: z.boolean().default(true),
  schedule: ScheduleSchema.default({
    type: 'every',
    increment: 1,
    unit: 'day',
    offsetMs: 4 * 60 * 60 * 1000,
  }),
  outputs: z.array(BackupOutputSchema),
});

export type BackupConfiguration = z.infer<typeof BackupConfigurationSchema>;

export const BackupSettingsSchema = z.object({
  configurations: z.array(BackupConfigurationSchema),
});

export type BackupSettings = z.infer<typeof BackupSettingsSchema>;
