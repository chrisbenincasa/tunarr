import type z from 'zod/v4';
import type {
  NativePlaybackContentItemSchema,
  NativePlaybackErrorItemSchema,
  NativePlaybackFlexItemSchema,
  NativePlaybackItemSchema,
  NativePlaybackResponseSchema,
} from './schemas/nativePlaybackSchemas.js';

export type NativePlaybackContentItem = z.infer<
  typeof NativePlaybackContentItemSchema
>;
export type NativePlaybackFlexItem = z.infer<
  typeof NativePlaybackFlexItemSchema
>;
export type NativePlaybackErrorItem = z.infer<
  typeof NativePlaybackErrorItemSchema
>;
export type NativePlaybackItem = z.infer<typeof NativePlaybackItemSchema>;
export type NativePlaybackResponse = z.infer<
  typeof NativePlaybackResponseSchema
>;
