import z from 'zod';
import { ResolutionSchema } from './miscSchemas.js';
import { TupleToUnion } from '../util.js';
import { ScheduleSchema } from './utilSchemas.js';

export const XmlTvSettingsSchema = z.object({
  programmingHours: z.number().default(12),
  refreshHours: z.number().default(4),
  outputPath: z.string().default(''),
  enableImageCache: z.boolean().default(false),
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

export const FfmpegSettingsSchema = z.object({
  configVersion: z.number().default(5),
  ffmpegExecutablePath: z.string().default('/usr/bin/ffmpeg'),
  numThreads: z.number().default(4),
  concatMuxDelay: z.number().default(0),
  enableLogging: z.boolean().default(false),
  // DEPRECATED
  enableTranscoding: z.boolean().default(true).describe('DEPRECATED'),
  audioVolumePercent: z.number().default(100),
  // DEPRECATED
  videoEncoder: z.string().default('libx264').describe('DEPRECATED'),
  hardwareAccelerationMode: z
    .union([
      z.literal('none'),
      z.literal('cuda'),
      z.literal('vaapi'),
      z.literal('qsv'),
      z.literal('videotoolbox'),
    ])
    .default(DefaultHardwareAccel),
  videoFormat: z
    .union([z.literal('h264'), z.literal('hevc'), z.literal('mpeg2')])
    .default(DefaultVideoFormat),
  audioEncoder: z.string().default('aac'),
  targetResolution: ResolutionSchema.default({ widthPx: 1920, heightPx: 1080 }),
  videoBitrate: z.number().default(2000),
  videoBufferSize: z.number().default(2000),
  audioBitrate: z.number().default(192),
  audioBufferSize: z.number().default(50),
  audioSampleRate: z.number().default(48),
  audioChannels: z.number().default(2),
  errorScreen: z.string().default('pic'),
  errorAudio: z.string().default('silent'),
  normalizeVideoCodec: z.boolean().default(true),
  normalizeAudioCodec: z.boolean().default(true),
  normalizeResolution: z.boolean().default(true),
  normalizeAudio: z.boolean().default(true),
  maxFPS: z.number().default(60),
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
  disableChannelOverlay: z.boolean().default(true),
  disableChannelPrelude: z.boolean().default(false),
});

export const PlexServerSettingsSchema = z.object({
  id: z.string(),
  name: z.string(),
  uri: z.string(),
  accessToken: z.string(),
  sendGuideUpdates: z.boolean(),
  sendChannelUpdates: z.boolean(),
  index: z.number(),
  clientIdentifier: z.string().optional(),
});

export const PlexStreamSettingsSchema = z.object({
  streamPath: z.union([z.literal('plex'), z.literal('direct')]).default('plex'),
  enableDebugLogging: z.boolean().default(false),
  directStreamBitrate: z.number().default(20000),
  transcodeBitrate: z.number().default(2000),
  mediaBufferSize: z.number().default(1000),
  transcodeMediaBufferSize: z.number().default(20000),
  maxPlayableResolution: ResolutionSchema.default({
    widthPx: 1920,
    heightPx: 1080,
  }),
  maxTranscodeResolution: ResolutionSchema.default({
    widthPx: 1920,
    heightPx: 1080,
  }),
  videoCodecs: z
    .array(z.string())
    .default(['h264', 'hevc', 'mpeg2video', 'av1']),
  audioCodecs: z.array(z.string()).default(['ac3']),
  maxAudioChannels: z.string().default('2.0'),
  audioBoost: z.number().default(100),
  enableSubtitles: z.boolean().default(false),
  subtitleSize: z.number().default(100),
  updatePlayStatus: z.boolean().default(false),
  streamProtocol: z.string().default('http'),
  forceDirectPlay: z.boolean().default(false),
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
