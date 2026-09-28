import z from 'zod/v4';
import { StreamSelectionRuleSchema } from './streamSelectionSchema.js';
import {
  AudioStreamInfoSchema,
  SubtitleStreamInfoSchema,
} from './troubleshootSchemas.js';

export const StreamSelectionPreviewRequestSchema = z.object({
  // The rules being edited. They may be unsaved, so the whole list is sent
  // rather than a profile ID.
  rules: z.array(StreamSelectionRuleSchema).min(1),
  programId: z.uuid(),
  // Supplies the channel name and number to rule conditions. Without it,
  // those fields are empty.
  channelId: z.uuid().optional(),
});

export type StreamSelectionPreviewRequest = z.infer<
  typeof StreamSelectionPreviewRequestSchema
>;

export const StreamSelectionPreviewRuleSchema = z.object({
  label: z.string().optional(),
  condition: z.string(),
  matched: z.boolean(),
  // Set when the condition does not parse. Such a rule never matches.
  error: z.string().optional(),
});

export const StreamSelectionPreviewResultSchema = z.object({
  program: z.object({
    uuid: z.string(),
    title: z.string(),
    type: z.string(),
  }),
  channel: z
    .object({
      uuid: z.string(),
      name: z.string(),
      number: z.number(),
    })
    .optional(),
  audioStreams: AudioStreamInfoSchema.array(),
  subtitleStreams: SubtitleStreamInfoSchema.array(),
  rules: StreamSelectionPreviewRuleSchema.array(),
  // Index of the first matching rule. Null means no rule matched, so a real
  // stream would move on to the next profile in the cascade.
  matchedRuleIndex: z.number().nullable(),
  // Absent when no rule matched or the program has no audio streams.
  selectedAudioStream: AudioStreamInfoSchema.optional(),
  // Null when no rule matched or the matched rule found no subtitle.
  selectedSubtitleStream: SubtitleStreamInfoSchema.nullable(),
});

export type StreamSelectionPreviewResult = z.infer<
  typeof StreamSelectionPreviewResultSchema
>;
