import z from 'zod';
import { type Tag, type TupleToUnion } from '../util.js';
import { ResolutionSchema } from './miscSchemas.js';
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
  numThreads: z.number().default(4),
  concatMuxDelay: z.number().default(0),
  enableLogging: z.boolean().default(false),
  enableFileLogging: z.boolean().default(false),
  logLevel: z.enum(FfmpegLogLevels).optional().default('warning'),
  languagePreferences: LanguagePreferencesSchema.default({
    preferences: [{ iso6391: 'en', iso6392: 'eng', displayName: 'English' }],
  }),
  transcodeDirectory: z.string().default('').optional(),
  // DEPRECATED
  enableTranscoding: z.boolean().default(true).describe('DEPRECATED'),
  audioVolumePercent: z.number().default(100),
  // DEPRECATED
  videoEncoder: z.string().default('libx264').describe('DEPRECATED'),
  hardwareAccelerationMode: z
    .enum(SupportedHardwareAccels)
    .default(DefaultHardwareAccel),
  videoFormat: z
    .union([z.literal('h264'), z.literal('hevc'), z.literal('mpeg2')])
    .default(DefaultVideoFormat),
  audioEncoder: z.string().default('aac'),
  targetResolution: ResolutionSchema.default({ widthPx: 1920, heightPx: 1080 }),
  videoBitrate: z.number().default(10000),
  videoBufferSize: z.number().default(1000),
  audioBitrate: z.number().default(192),
  audioBufferSize: z.number().default(50),
  audioSampleRate: z.number().default(48),
  audioChannels: z.number().default(2),
  errorScreen: z.enum(SupportedErrorScreens).default('pic'),
  errorAudio: z.enum(SupportedErrorAudioTypes).default('silent'),
  normalizeVideoCodec: z.boolean().default(true),
  normalizeAudioCodec: z.boolean().default(true),
  normalizeResolution: z.boolean().default(true),
  normalizeAudio: z.boolean().default(true),
  maxFPS: z.coerce.number().min(1).max(240).default(60),
  scalingAlgorithm: z
    .union([
      z.literal('bicubic'),
      z.literal('fast_bilinear'),
      z.literal('lanczos'),
      z.literal('spline'),
    ])
    .default('bicubic'),
  deinterlaceFilter: z
    .union([
      z.literal('none'),
      z.literal('bwdif=0'),
      z.literal('bwdif=1'),
      z.literal('w3fdif'),
      z.literal('yadif=0'),
      z.literal('yadif=1'),
    ])
    .default('none'),
  disableChannelOverlay: z.boolean().default(false),
  disableChannelPrelude: z.boolean().default(false),
  vaapiDevice: z.string().optional(),
  vaapiDriver: z.string().optional(),
  useNewFfmpegPipeline: z.boolean().default(true),
  hlsDirectOutputFormat: z.enum(['mkv', 'mpegts', 'mp4']).default('mpegts'),
});

const mediaSourceId = z.custom<MediaSourceId>((val) => {
  return typeof val === 'string';
});

export type MediaSourceId = Tag<string, 'mediaSourceId'>;

const BaseMediaSourceSettingsSchema = z.object({
  id: mediaSourceId,
  name: z.string(),
  uri: z.string(),
  accessToken: z.string(),
  userId: z.string().nullable(),
  username: z.string().nullable(),
});

export const PlexServerSettingsSchema = BaseMediaSourceSettingsSchema.extend({
  type: z.literal('plex'),
  sendGuideUpdates: z.boolean(),
  sendChannelUpdates: z.boolean(),
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

export const MediaSourceSettingsSchema = z.discriminatedUnion('type', [
  PlexServerSettingsSchema,
  JellyfinServerSettingsSchema,
  EmbyServerSettingsSchema,
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
