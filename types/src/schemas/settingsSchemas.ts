import z from 'zod';
import { ResolutionSchema } from './miscSchemas.js';

export const XmlTvSettingsSchema = z.object({
  programmingHours: z.number(),
  refreshHours: z.number(),
  outputPath: z.string(),
  enableImageCache: z.boolean(),
});

export const FfmpegSettingsSchema = z.object({
  configVersion: z.number().default(5),
  ffmpegExecutablePath: z.string().default('/usr/bin/ffmpeg'),
  numThreads: z.number().default(4),
  concatMuxDelay: z.number().default(0),
  enableLogging: z.boolean().default(false),
  enableTranscoding: z.boolean().default(true),
  audioVolumePercent: z.number().default(100),
  videoEncoder: z.string().default('mpeg2video'),
  audioEncoder: z.string().default('ac3'),
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
});
