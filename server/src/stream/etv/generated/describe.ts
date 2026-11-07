// Generated from schema/describe.json by scripts/generate-etv-schemas.ts.
// Do not edit. Refinements belong in the hand-written files one level up.

import { z } from 'zod/v4';

export const DecodeSupportSchema = z.object({
  format: z.string(),
  pixel_formats: z.array(z.string()),
});
export type DecodeSupport = z.infer<typeof DecodeSupportSchema>;

export const EncodeSupportSchema = z.object({
  bit_depths: z.array(z.number().int().min(0).max(255)),
  format: z.string(),
});
export type EncodeSupport = z.infer<typeof EncodeSupportSchema>;

/** `available`: the channel uses this accel. `ffmpeg_missing`: the ffmpeg build lacks its hwaccel, */
export const AccelStatusSchema = z.enum([
  'available',
  'ffmpeg_missing',
  'probe_failed',
  'timeout',
  'skipped',
]);
export type AccelStatus = z.infer<typeof AccelStatusSchema>;

export const AccelRuntimeSchema = z.object({
  accel: z.string(),
  configured: z.boolean(),
  decode: z.array(DecodeSupportSchema),
  device: z.string().nullable().optional(),
  driver: z.string().nullable().optional(),
  encode: z.array(EncodeSupportSchema),
  error: z.string().nullable().optional(),
  status: AccelStatusSchema,
});
export type AccelRuntime = z.infer<typeof AccelRuntimeSchema>;

export const BinaryInfoSchema = z.object({
  commit: z.string().nullable().optional(),
  version: z.string(),
});
export type BinaryInfo = z.infer<typeof BinaryInfoSchema>;

export const SchemaInfoSchema = z.object({
  breaking: z.number().int().min(0),
  compatible: z.number().int().min(0),
  uri: z.string(),
});
export type SchemaInfo = z.infer<typeof SchemaInfoSchema>;

export const OutputFilesSchema = z.object({
  heartbeat: z.string(),
  playlist: z.string(),
  ready: z.string(),
  segment_template: z.string(),
  subtitle_playlist: z.string(),
});
export type OutputFiles = z.infer<typeof OutputFilesSchema>;

export const ContractSchema = z.object({
  channel_config_schema: SchemaInfoSchema,
  dynamic_callback_headers: z.array(z.string()),
  keyframe_seconds: z.number().int().min(0),
  output_files: OutputFilesSchema,
  playout_schema: SchemaInfoSchema,
  segment_seconds: z.number().int().min(0),
});
export type Contract = z.infer<typeof ContractSchema>;

export const FfmpegRuntimeSchema = z.object({
  hwaccels: z.array(z.string()),
  path: z.string(),
  version: z.string().nullable().optional(),
});
export type FfmpegRuntime = z.infer<typeof FfmpegRuntimeSchema>;

/** What this machine and ffmpeg build can do with a channel config. */
export const RuntimeCapabilitySchema = z.object({
  accels: z.array(AccelRuntimeSchema),
  ffmpeg: FfmpegRuntimeSchema,
});
export type RuntimeCapability = z.infer<typeof RuntimeCapabilitySchema>;

export const SchemaCapabilitySchema = z.object({
  accels: z.array(z.string()),
  audio_copy_formats: z.array(z.string()),
  audio_formats: z.array(z.string()),
  subtitle_modes: z.array(z.string()),
  video_formats: z.array(z.string()),
});
export type SchemaCapability = z.infer<typeof SchemaCapabilitySchema>;

export const DescribeSchema = z.object({
  binary: BinaryInfoSchema,
  contract: ContractSchema,
  describe_version: z.number().int().min(0),
  runtime_capability: RuntimeCapabilitySchema.nullable().optional(),
  schema_capability: SchemaCapabilitySchema,
});
export type Describe = z.infer<typeof DescribeSchema>;
