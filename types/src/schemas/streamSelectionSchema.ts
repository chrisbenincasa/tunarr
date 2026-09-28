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
  preferTextBased: z.boolean().default(false),
});

export const SubtitleActionDefaultSchema = z.object({
  type: z.literal('default'),
  preferTextBased: z.boolean().default(false),
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
  // Locked profiles ship with Tunarr and cannot be edited or deleted.
  locked: z.boolean().default(false),
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

// The locked, built-in profile seeded by the database migrations. It is the
// last step of every resolution chain, so there is always a profile to use.
export const BuiltInStreamSelectionProfileId =
  '00000000-0000-4000-8000-000000000001';

export const StreamSelectionSettingsSchema = z.object({
  // The profile used when neither the program, its source (custom show or
  // filler list), nor the channel has one assigned.
  defaultProfileId: z.uuid().default(BuiltInStreamSelectionProfileId),
});

export type StreamSelectionSettings = z.infer<
  typeof StreamSelectionSettingsSchema
>;

export const defaultStreamSelectionSettings: StreamSelectionSettings = {
  defaultProfileId: BuiltInStreamSelectionProfileId,
};

// Where in the resolution chain a profile came from. Order matters: the
// resolver walks these from most to least specific.
export const StreamSelectionLevelSchema = z.enum([
  'program',
  'custom_show',
  'filler',
  'channel',
  'default',
  'built_in',
]);

export type StreamSelectionLevel = z.infer<typeof StreamSelectionLevelSchema>;

const NamedEntitySchema = z.object({
  uuid: z.string(),
  name: z.string(),
});

export const StreamSelectionProfileUsageSchema = z.object({
  channels: z.array(NamedEntitySchema.extend({ number: z.number() })),
  fillerLists: z.array(NamedEntitySchema),
  customShows: z.array(NamedEntitySchema),
  // Program-level assignment has no UI yet, so only a count is reported.
  programCount: z.number(),
});

export type StreamSelectionProfileUsage = z.infer<
  typeof StreamSelectionProfileUsageSchema
>;

export const StreamSelectionProfileWithUsageSchema =
  StreamSelectionProfileSchema.extend({
    usage: StreamSelectionProfileUsageSchema,
    // Whether this is the profile the default pointer targets.
    isDefault: z.boolean(),
  });

export type StreamSelectionProfileWithUsage = z.infer<
  typeof StreamSelectionProfileWithUsageSchema
>;
