import z from 'zod/v4';

const NativePlaybackTimingSchema = z.object({
  itemStartedAtMs: z.number().int(),
  remainingMs: z.number().int(),
});

export const NativePlaybackContentItemSchema =
  NativePlaybackTimingSchema.extend({
    type: z.literal('content'),
    seekOffsetMs: z.number().int(),
    programId: z.string().uuid(),
    title: z.string(),
    episodeTitle: z.string().optional(),
    seasonNumber: z.number().int().optional(),
    episodeNumber: z.number().int().optional(),
    summary: z.string().optional(),
    thumb: z.string().optional(),
    streamUrl: z.string(),
  });

export const NativePlaybackFlexItemSchema = NativePlaybackTimingSchema.extend({
  type: z.literal('flex'),
});

export const NativePlaybackErrorItemSchema = z.object({
  type: z.literal('error'),
  message: z.string(),
  retryAfterMs: z.number().int(),
});

export const NativePlaybackItemSchema = z.discriminatedUnion('type', [
  NativePlaybackContentItemSchema,
  NativePlaybackFlexItemSchema,
  NativePlaybackErrorItemSchema,
]);

export const NativePlaybackResponseSchema = z.object({
  channelId: z.string().uuid(),
  channelNumber: z.number().int(),
  channelName: z.string(),
  serverTimeMs: z.number().int(),
  current: NativePlaybackItemSchema,
  next: NativePlaybackItemSchema.optional(),
});
