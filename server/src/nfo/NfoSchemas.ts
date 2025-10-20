import z from 'zod/v4';

export const NfoThumb = z.object({
  '#text': z.string(),
  // '@_aspect': z.enum([
  //   'banner',
  //   'clearart',
  //   'clearlogo',
  //   'discart',
  //   'keyart',
  //   'landscape',
  //   'poster',
  // ]),
  '@_aspect': z.string(),
});

export const NfoUniqueId = z.object({
  '#text': z.coerce.string(),
  '@_type': z.string(), //z.enum(['imdb', 'tmdb', 'tvdb']),
  '@_default': z.stringbool().optional(),
});

const NfoAudioStream = z.object({
  codec: z.string(),
  language: z.string(),
  channels: z.number(),
});

const NfoVideoStream = z.object({
  codec: z.string(),
  aspect: z.number(),
  width: z.number(),
  height: z.number(),
  durationinseconds: z.number(),
  stereomode: z.string().optional(),
  hdrtype: z.enum(['', 'hdr10', 'dolbyvision', 'hlg']).nullish(),
});

const NfoSubtitleStream = z.object({
  language: z.string(),
});

export const NfoFileInfo = z.object({
  streamdetails: z.object({
    video: NfoVideoStream,
    audio: z.array(NfoAudioStream).or(NfoAudioStream).optional(),
    subtitle: z.array(NfoSubtitleStream).or(NfoSubtitleStream).optional(),
  }),
});

export const NfoActor = z.object({
  name: z.string(),
  role: z.string(),
  order: z.number().optional(),
  thumb: z.string().optional(),
});

export type NfoActor = z.infer<typeof NfoActor>;
