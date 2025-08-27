import z from 'zod/v4';
import type { TupleToUnion } from '../util.js';
import { ResolutionSchema } from './miscSchemas.js';
import {
  SupportedErrorAudioTypes,
  SupportedErrorScreens,
  SupportedHardwareAccels,
} from './settingsSchemas.js';

// These are purposefully duplicated from the DB code so that the
// exposed API can differ from the DB. This allows us to make
// incremental changes on the backend without exposing them immediately
// on the frontend.

export const SupportedVaapiDrivers = [
  'system',
  'ihd',
  'i965',
  'radeonsi',
  'nouveau',
] as const;

export const SupportedTranscodeVideoOutputFormats = [
  'h264',
  'hevc',
  'mpeg2video',
] as const;

export const SupportedTranscodeAudioOutputFormats = [
  'aac',
  'ac3',
  'copy',
  'mp3',
] as const;

export type SupportedTranscodeAudioOutputFormats = TupleToUnion<
  typeof SupportedTranscodeAudioOutputFormats
>;

export const TranscodeConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  threadCount: z.number(),
  hardwareAccelerationMode: z.enum(SupportedHardwareAccels),
  vaapiDriver: z.enum(SupportedVaapiDrivers),
  vaapiDevice: z.string().nullable(),
  resolution: ResolutionSchema,
  videoFormat: z.enum(SupportedTranscodeVideoOutputFormats),
  videoProfile: z.string().nullable(),
  videoPreset: z.string().nullable(),
  videoBitDepth: z.union([z.literal(8), z.literal(10)]).nullable(),
  videoBitRate: z.number(),
  videoBufferSize: z.number(),
  audioChannels: z.number(),
  audioFormat: z.enum(SupportedTranscodeAudioOutputFormats),
  audioBitRate: z.number(),
  audioBufferSize: z.number(),
  audioSampleRate: z.number(),
  audioVolumePercent: z.number().default(100),
  normalizeFrameRate: z.boolean(),
  deinterlaceVideo: z.boolean(),
  disableChannelOverlay: z.boolean(),
  errorScreen: z.enum(SupportedErrorScreens),
  errorScreenAudio: z.enum(SupportedErrorAudioTypes),
  isDefault: z.boolean(),
  disableHardwareDecoder: z.boolean().default(false),
  disableHardwareEncoding: z.boolean().default(false),
  disableHardwareFilters: z.boolean().default(false),
});
