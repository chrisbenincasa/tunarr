// Generated from schema/channel_config.json by scripts/generate-etv-schemas.ts.
// Do not edit. Refinements belong in the hand-written files one level up.

import { z } from 'zod/v4';

export const AudioFormatSchema = z.enum(['aac', 'ac3']);
export type AudioFormat = z.infer<typeof AudioFormatSchema>;

export const AudioLoudnessConfigSchema = z.strictObject({
  integrated_target: z.number().nullable().optional(),
  range_target: z.number().nullable().optional(),
  true_peak: z.number().nullable().optional(),
});
export type AudioLoudnessConfig = z.infer<typeof AudioLoudnessConfigSchema>;

export const AudioNormalizationConfigSchema = z.strictObject({
  bitrate_kbps: z.number().int().min(0).nullable().optional(),
  buffer_kbps: z.number().int().min(0).nullable().optional(),
  channels: z.number().int().min(0).nullable().optional(),
  format: AudioFormatSchema.nullable().optional(),
  loudness: AudioLoudnessConfigSchema.nullable().optional(),
  normalize_loudness: z.boolean().optional(),
  sample_rate_hz: z.number().int().min(0).nullable().optional(),
});
export type AudioNormalizationConfig = z.infer<
  typeof AudioNormalizationConfigSchema
>;

export const BwdifCudaOptionsSchema = z.strictObject({
  mode: z.string().nullable().optional(),
});
export type BwdifCudaOptions = z.infer<typeof BwdifCudaOptionsSchema>;

export const BwdifOptionsSchema = z.strictObject({
  mode: z.string().nullable().optional(),
});
export type BwdifOptions = z.infer<typeof BwdifOptionsSchema>;

export const DeinterlaceQsvOptionsSchema = z.strictObject({
  mode: z.string().nullable().optional(),
});
export type DeinterlaceQsvOptions = z.infer<typeof DeinterlaceQsvOptionsSchema>;

export const DeinterlaceVaapiOptionsSchema = z.strictObject({
  mode: z.string().nullable().optional(),
});
export type DeinterlaceVaapiOptions = z.infer<
  typeof DeinterlaceVaapiOptionsSchema
>;

/** Controls the content that replaces scheduled content when there is nothing to play */
export const FallbackConfigSchema = z.strictObject({
  show_error: z.boolean().optional(),
});
export type FallbackConfig = z.infer<typeof FallbackConfigSchema>;

export const FfmpegConfigSchema = z.strictObject({
  disabled_filters: z.array(z.string()).optional(),
  ffmpeg_path: z.string().nullable().optional(),
  ffprobe_path: z.string().nullable().optional(),
  preferred_filters: z.array(z.string()).optional(),
  reports_folder: z.string().nullable().optional(),
});
export type FfmpegConfig = z.infer<typeof FfmpegConfigSchema>;

export const HardwareAccelSchema = z.enum([
  'amf',
  'cuda',
  'qsv',
  'rkmpp',
  'vaapi',
  'videotoolbox',
  'vulkan',
]);
export type HardwareAccel = z.infer<typeof HardwareAccelSchema>;

export const LibplaceboOptionsSchema = z.strictObject({
  tonemapping: z.string().nullable().optional(),
});
export type LibplaceboOptions = z.infer<typeof LibplaceboOptionsSchema>;

export const SubtitleModeSchema = z.enum(['burn', 'convert']);
export type SubtitleMode = z.infer<typeof SubtitleModeSchema>;

export const SubtitleNormalizationConfigSchema = z.strictObject({
  fonts_folder: z.string().nullable().optional(),
  force_style: z.string().nullable().optional(),
  mode: SubtitleModeSchema.optional(),
});
export type SubtitleNormalizationConfig = z.infer<
  typeof SubtitleNormalizationConfigSchema
>;

export const TonemapOptionsSchema = z.strictObject({
  tonemap: z.string().nullable().optional(),
});
export type TonemapOptions = z.infer<typeof TonemapOptionsSchema>;

export const TonemapOpenclOptionsSchema = z.strictObject({
  tonemap: z.string().nullable().optional(),
});
export type TonemapOpenclOptions = z.infer<typeof TonemapOpenclOptionsSchema>;

export const W3fdifOptionsSchema = z.strictObject({
  mode: z.string().nullable().optional(),
});
export type W3fdifOptions = z.infer<typeof W3fdifOptionsSchema>;

export const YadifOptionsSchema = z.strictObject({
  mode: z.string().nullable().optional(),
});
export type YadifOptions = z.infer<typeof YadifOptionsSchema>;

export const YadifCudaOptionsSchema = z.strictObject({
  mode: z.string().nullable().optional(),
});
export type YadifCudaOptions = z.infer<typeof YadifCudaOptionsSchema>;

export const VideoFilterOptionsConfigSchema = z.strictObject({
  bwdif: BwdifOptionsSchema.nullable().optional(),
  bwdif_cuda: BwdifCudaOptionsSchema.nullable().optional(),
  deinterlace_qsv: DeinterlaceQsvOptionsSchema.nullable().optional(),
  deinterlace_vaapi: DeinterlaceVaapiOptionsSchema.nullable().optional(),
  libplacebo: LibplaceboOptionsSchema.nullable().optional(),
  tonemap: TonemapOptionsSchema.nullable().optional(),
  tonemap_opencl: TonemapOpenclOptionsSchema.nullable().optional(),
  w3fdif: W3fdifOptionsSchema.nullable().optional(),
  yadif: YadifOptionsSchema.nullable().optional(),
  yadif_cuda: YadifCudaOptionsSchema.nullable().optional(),
});
export type VideoFilterOptionsConfig = z.infer<
  typeof VideoFilterOptionsConfigSchema
>;

export const VideoFormatSchema = z.enum(['h264', 'hevc']);
export type VideoFormat = z.infer<typeof VideoFormatSchema>;

export const ScalingModeSchema = z.enum(['scale_and_pad', 'stretch', 'crop']);
export type ScalingMode = z.infer<typeof ScalingModeSchema>;

export const VaapiDriverSchema = z.enum(['ihd', 'i965', 'radeonsi']);
export type VaapiDriver = z.infer<typeof VaapiDriverSchema>;

export const VideoNormalizationConfigSchema = z.strictObject({
  accel: HardwareAccelSchema.nullable().optional(),
  amf_device: z.number().int().min(0).nullable().optional(),
  bit_depth: z.number().int().min(0).max(255).nullable().optional(),
  bitrate_kbps: z.number().int().min(0).nullable().optional(),
  buffer_kbps: z.number().int().min(0).nullable().optional(),
  deinterlace: z.boolean().optional(),
  filters: VideoFilterOptionsConfigSchema.optional(),
  format: VideoFormatSchema.nullable().optional(),
  height: z.number().int().min(0).nullable().optional(),
  scaling_mode: ScalingModeSchema.optional(),
  vaapi_device: z.string().nullable().optional(),
  vaapi_driver: VaapiDriverSchema.nullable().optional(),
  width: z.number().int().min(0).nullable().optional(),
});
export type VideoNormalizationConfig = z.infer<
  typeof VideoNormalizationConfigSchema
>;

export const NormalizationConfigSchema = z.strictObject({
  audio: AudioNormalizationConfigSchema,
  subtitle: SubtitleNormalizationConfigSchema.optional(),
  video: VideoNormalizationConfigSchema,
});
export type NormalizationConfig = z.infer<typeof NormalizationConfigSchema>;

export const PlayoutConfigSchema = z.strictObject({
  folder: z.string(),
  virtual_start: z.string().nullable().optional(),
});
export type PlayoutConfig = z.infer<typeof PlayoutConfigSchema>;

export const ChannelConfigSchema = z.strictObject({
  fallback: FallbackConfigSchema.optional(),
  ffmpeg: FfmpegConfigSchema,
  normalization: NormalizationConfigSchema,
  playout: PlayoutConfigSchema,
});
export type ChannelConfig = z.infer<typeof ChannelConfigSchema>;
