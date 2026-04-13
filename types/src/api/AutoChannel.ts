import { z } from 'zod/v4';
import { ContentProgramTypeSchema } from '../schemas/utilSchemas.js';
import { RandomSlotScheduleSchema } from './RandomSlots.js';
import { TimeSlotScheduleSchema } from './TimeSlots.js';

//
// Content query specification
//
export const ContentQuerySchema = z.object({
  filterString: z
    .string()
    .optional()
    .describe(
      'Existing search DSL filter (e.g., \'genre = "Action" AND year > 1980\')',
    ),
  keywords: z.string().optional().describe('Free-text search via Meilisearch'),
  libraryIds: z
    .string()
    .array()
    .optional()
    .describe('Restrict to specific libraries'),
  mediaSourceIds: z
    .string()
    .array()
    .optional()
    .describe('Restrict to specific media sources'),
  programTypes: ContentProgramTypeSchema.array()
    .optional()
    .describe('Restrict to specific program types'),
});

export type ContentQuery = z.infer<typeof ContentQuerySchema>;

//
// Content preview response
//
export const ContentPreviewResponseSchema = z.object({
  totalPrograms: z.number(),
  byType: z.record(ContentProgramTypeSchema, z.number()),
  topShows: z.array(
    z.object({
      name: z.string(),
      episodeCount: z.number(),
    }),
  ),
  totalDurationMs: z.number(),
  sampleIds: z.string().array().describe('First ~20 program IDs for display'),
});

export type ContentPreviewResponse = z.infer<
  typeof ContentPreviewResponseSchema
>;

//
// Content requirement (a role within a preset)
//
export const ContentRequirementSchema = z.object({
  role: z
    .string()
    .describe('Unique ID within preset (e.g., "primetime_movies")'),
  label: z.string().describe('Human-readable name'),
  description: z.string().optional(),
  defaultQuery: ContentQuerySchema.describe(
    'Pre-filled query, user can override',
  ),
  required: z.boolean(),
  minPrograms: z.number().min(0),
});

export type ContentRequirement = z.infer<typeof ContentRequirementSchema>;

//
// Schedule skeleton
//
export const ScheduleSkeletonSchema = z.discriminatedUnion('type', [
  TimeSlotScheduleSchema,
  RandomSlotScheduleSchema,
]);

export type ScheduleSkeleton = z.infer<typeof ScheduleSkeletonSchema>;

//
// Channel preset
//
export const ChannelPresetCategorySchema = z.enum([
  'simple',
  'classic-tv',
  'movie',
  'music',
  'custom',
]);

export type ChannelPresetCategory = z.infer<typeof ChannelPresetCategorySchema>;

export const ChannelPresetSchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  category: ChannelPresetCategorySchema,
  contentRequirements: ContentRequirementSchema.array(),
  scheduleType: z.enum(['time', 'random']),
  scheduleConfig: ScheduleSkeletonSchema,
});

export type ChannelPreset = z.infer<typeof ChannelPresetSchema>;

//
// Content assignment for a role
//
export const ContentAssignmentSchema = z.object({
  query: ContentQuerySchema.optional().describe(
    'Query-based: system finds matching content',
  ),
  programIds: z
    .string()
    .array()
    .optional()
    .describe('Explicit: user picked specific programs'),
});

export type ContentAssignment = z.infer<typeof ContentAssignmentSchema>;

//
// Auto-channel create request
//
export const AutoChannelCreateRequestSchema = z.object({
  presetId: z.string().describe('Built-in preset ID'),
  contentAssignments: z
    .record(z.string(), ContentAssignmentSchema)
    .describe('Map of role ID to content assignment'),
  channelName: z
    .string()
    .optional()
    .describe('Override the auto-generated name'),
  channelNumber: z
    .number()
    .optional()
    .describe('Override the auto-assigned channel number'),
  seed: z.number().optional().describe('For reproducible generation'),
});

export type AutoChannelCreateRequest = z.infer<
  typeof AutoChannelCreateRequestSchema
>;
