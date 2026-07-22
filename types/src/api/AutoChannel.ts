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
  groupingId: z
    .string()
    .uuid()
    .optional()
    .describe('Filter by a specific show grouping (e.g., for binge channels)'),
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
// Content picker hints — tells the frontend what specialized picker UI to render
//
export const ContentPickerHintSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('facet'),
    facetFields: z.array(z.string()),
    label: z.string(),
  }),
  z.object({ type: z.literal('year-range'), label: z.string() }),
  z.object({ type: z.literal('single-show'), label: z.string() }),
  z.object({ type: z.literal('weighted_mix'), label: z.string() }),
  z.object({ type: z.literal('classic_tv'), label: z.string() }),
]);

export type ContentPickerHint = z.infer<typeof ContentPickerHintSchema>;

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
  pickerHint: ContentPickerHintSchema.optional(),
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
  'binge',
  'genre',
  'people',
  'decade',
  'network',
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
  dynamicRequirements: z.boolean().optional(),
  minBlocks: z.number().optional(),
  maxBlocks: z.number().optional(),
  defaultBlocks: z.number().optional(),
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
// Dynamic preset params — client sends these for presets with dynamicRequirements
//
export const WeightedMixParamsSchema = z.object({
  type: z.literal('weighted_mix'),
  groups: z.array(
    z.object({
      role: z.string(),
      weight: z.number().min(1).max(10),
    }),
  ),
});

export type WeightedMixParams = z.infer<typeof WeightedMixParamsSchema>;

export const ClassicTvDayParamsSchema = z.object({
  type: z.literal('classic_tv_day'),
  blocks: z.array(
    z.object({
      role: z.string(),
      startTime: z.number(), // ms offset from midnight
    }),
  ),
});

export type ClassicTvDayParams = z.infer<typeof ClassicTvDayParamsSchema>;

export const DynamicPresetParamsSchema = z.discriminatedUnion('type', [
  WeightedMixParamsSchema,
  ClassicTvDayParamsSchema,
]);

export type DynamicPresetParams = z.infer<typeof DynamicPresetParamsSchema>;

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
  dynamicParams: DynamicPresetParamsSchema.optional().describe(
    'Structure params for dynamic presets (weighted mix, classic TV day)',
  ),
});

export type AutoChannelCreateRequest = z.infer<
  typeof AutoChannelCreateRequestSchema
>;
