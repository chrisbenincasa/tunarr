import z from 'zod/v4';
import { SubtitleFilterSchema } from './subtitleSchema.js';

// Audio Actions - discriminated union on `type`
export const AudioActionByLanguageSchema = z.object({
  type: z.literal('by_language'),
  languages: z.array(z.string()).min(1),
  preferChannels: z.enum(['most', 'least']).optional(),
});

export const AudioActionByTitleSchema = z.object({
  type: z.literal('by_title'),
  titleContains: z.string().min(1),
});

export const AudioActionDefaultSchema = z.object({
  type: z.literal('default'),
});

export const AudioActionSchema = z.discriminatedUnion('type', [
  AudioActionByLanguageSchema,
  AudioActionByTitleSchema,
  AudioActionDefaultSchema,
]);

export type AudioAction = z.infer<typeof AudioActionSchema>;

// Subtitle Actions - discriminated union on `type`
export const SubtitleActionDisableSchema = z.object({
  type: z.literal('disable'),
});

export const SubtitleActionByLanguageSchema = z.object({
  type: z.literal('by_language'),
  languages: z.array(z.string()).min(1),
  filterType: SubtitleFilterSchema.default('any'),
  allowImageBased: z.boolean().default(true),
  allowExternal: z.boolean().default(true),
});

export const SubtitleActionDefaultSchema = z.object({
  type: z.literal('default'),
});

export const SubtitleActionSchema = z.discriminatedUnion('type', [
  SubtitleActionDisableSchema,
  SubtitleActionByLanguageSchema,
  SubtitleActionDefaultSchema,
]);

export type SubtitleAction = z.infer<typeof SubtitleActionSchema>;

// Stream Selection Rule
export const StreamSelectionRuleSchema = z.object({
  label: z.string().optional(),
  condition: z.string().min(1),
  audioAction: AudioActionSchema,
  subtitleAction: SubtitleActionSchema,
});

export type StreamSelectionRule = z.infer<typeof StreamSelectionRuleSchema>;

// Stream Selection Profile
export const StreamSelectionProfileSchema = z.object({
  uuid: z.string(),
  name: z.string().min(1),
  rules: z.array(StreamSelectionRuleSchema).min(1),
});

export type StreamSelectionProfile = z.infer<
  typeof StreamSelectionProfileSchema
>;

// Create/Update request schemas (no uuid required)
export const CreateStreamSelectionProfileSchema = z.object({
  name: z.string().min(1),
  rules: z.array(StreamSelectionRuleSchema).min(1),
});

export type CreateStreamSelectionProfileRequest = z.infer<
  typeof CreateStreamSelectionProfileSchema
>;

export const UpdateStreamSelectionProfileSchema =
  CreateStreamSelectionProfileSchema;

export type UpdateStreamSelectionProfileRequest = z.infer<
  typeof UpdateStreamSelectionProfileSchema
>;
