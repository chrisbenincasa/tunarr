import { parseIntOrNull } from '@/util/index.js';
import { isNull, split } from 'lodash-es';
import { z } from 'zod/v4';

const BaseFfprobeMediaStreamSchema = z.object({
  index: z.number(),
  codec_long_name: z.string().optional(),
  profile: z.string().optional(),
  tags: z.record(z.string(), z.string()).optional(),
});

export const FfprobeVideoStreamSchema = BaseFfprobeMediaStreamSchema.extend({
  codec_type: z.literal('video'),
  codec_name: z.string(),
  width: z.number(),
  height: z.number(),
  coded_width: z.number(),
  coded_height: z.number(),
  has_b_frames: z.number().optional(),
  sample_aspect_ratio: z.string().optional(),
  display_aspect_ratio: z.string().optional(),
  pix_fmt: z.string().optional(),
  level: z.number().optional(),
  color_range: z.string().optional(),
  color_space: z.string().optional(),
  color_transfer: z.string().optional(),
  color_primaries: z.string().optional(),
  chroma_location: z.string().optional(),
  field_order: z.string().optional(), // enum??
  is_avc: z
    .string()
    .optional()
    .transform((s) => s === 'true'),
  r_frame_rate: z.string().transform(parsePossibleFractionToFloat).optional(),
  avg_frame_rate: z.string().transform(parsePossibleFractionToFloat).optional(),
  time_base: z.string().optional(),
  start_pts: z.number().optional(),
  duration_ts: z.number().optional(), // millis
  bit_rate: z.coerce.number().optional(),
  bits_per_raw_sample: z.coerce.number().optional(),
});

export type FfprobeVideoStream = z.infer<typeof FfprobeVideoStreamSchema>;

export const FfprobeAudioStreamSchema = BaseFfprobeMediaStreamSchema.extend({
  codec_type: z.literal('audio'),
  codec_name: z.string(),
  sample_fmt: z.string().optional(),
  sample_rate: z.string().or(z.coerce.number()).optional(),
  channels: z.number().optional(),
  channel_layout: z.string().optional(),
  bits_per_sample: z.number().optional(),
  initial_padding: z.number().optional(),
  time_base: z.string().optional(),
  bit_rate: z
    .string()
    .transform((s) => parsePossibleFractionToFloat(s))
    .optional(),
});

export type FfprobeAudioStream = z.infer<typeof FfprobeAudioStreamSchema>;

export const FfprobeSubtitleStreamSchema = BaseFfprobeMediaStreamSchema.extend({
  codec_type: z.literal('subtitle'),
  codec_name: z.string(),
  disposition: z
    .object({
      default: z.number().optional(),
      dub: z.number().optional(),
      original: z.number().optional(),
      comment: z.number().optional(),
      lyrics: z.number().optional(),
      karaoke: z.number().optional(),
      forced: z.number().optional(),
      hearing_impaired: z.number().optional(),
      visual_impaired: z.number().optional(),
      clean_effects: z.number().optional(),
      attached_pic: z.number().optional(),
      timed_thumbnails: z.number().optional(),
      non_diegetic: z.number().optional(),
      captions: z.number().optional(),
      descriptions: z.number().optional(),
      metadata: z.number().optional(),
      dependent: z.number().optional(),
      still_image: z.number().optional(),
      multilayer: z.number().optional(),
    })
    .optional(),
});

export const FfprobeAttachmentStreamSchema =
  BaseFfprobeMediaStreamSchema.extend({
    codec_type: z.literal('attachment'),
    codec_name: z.string().optional(),
  });

export const FfprobeBinDataStreamSchema = z.object({
  codec_type: z.literal('bin_data').or(z.literal('data')),
});

export type FfprobeSubtitleStream = z.infer<typeof FfprobeSubtitleStreamSchema>;

function parsePossibleFractionToFloat(s: string) {
  if (s.includes('/')) {
    const [num, den] = split(s, '/', 2);
    const numD = parseIntOrNull(num!);
    const denD = parseIntOrNull(den!);
    if (!isNull(numD) && !isNull(denD) && denD !== 0) {
      return numD / denD;
    }
  }

  return parseIntOrNull(s);
}

export const FfprobeMediaStreamSchema = z.discriminatedUnion('codec_type', [
  FfprobeVideoStreamSchema,
  FfprobeAudioStreamSchema,
  FfprobeSubtitleStreamSchema,
  FfprobeAttachmentStreamSchema,
  FfprobeBinDataStreamSchema,
]);

export const FfprobeMediaFormatSchema = z.object({
  filename: z.string().optional(),
  nb_streams: z.number(),
  format_name: z.string(),
  format_long_name: z.string().optional(),
  start_time: z.string().optional(),
  duration: z.coerce.number(), // Seconds
  size: z.coerce.number(),
  bit_rate: z.coerce.number(),
  probe_score: z.number().optional(),
});

export const FfprobeChapter = z.object({
  id: z.number(),
  time_base: z.string(),
  start: z.number(),
  start_time: z.string(),
  end: z.number(),
  end_time: z.string(),
  tags: z.record(z.string(), z.string()),
});

export const FfprobeMediaInfoSchema = z.object({
  streams: z.array(FfprobeMediaStreamSchema),
  format: FfprobeMediaFormatSchema,
  chapters: z.array(FfprobeChapter).optional(),
});
