import { z } from 'zod/v4';
import { ChannelSchema } from '../schemas/channelSchema.js';
import { SmartCollection } from '../schemas/collectionsSchema.js';
import { CustomShowSchema } from '../schemas/customShowsSchema.js';
import { FillerListSchema } from '../schemas/fillerSchema.js';
import { Show } from '../schemas/programmingSchema.js';
import type { TupleToUnion } from '../util.js';
import {
  BaseSlotOrdering,
  SlotFiller,
  SlotProgrammingFillerOrder,
} from './CommonSlots.js';

/**
 * Infinite Schedule - A rule-based infinite scheduling system where channels
 * are defined by slots that generate content on-demand with persistent state.
 */

// Enums
export const FlexPreferenceSchema = z.enum(['distribute', 'end']);
export type FlexPreference = z.infer<typeof FlexPreferenceSchema>;

export const AnchorModeSchema = z.enum(['hard', 'soft', 'padded']);
export type AnchorMode = z.infer<typeof AnchorModeSchema>;

export const InfiniteSlotTypeSchema = z.enum([
  'movie',
  'show',
  'custom-show',
  'filler',
  'redirect',
  'flex',
  'smart-collection',
]);
export type InfiniteSlotType = z.infer<typeof InfiniteSlotTypeSchema>;

export const GeneratedItemTypeSchema = z.enum([
  'content',
  'offline',
  'redirect',
  'filler',
  'flex',
]);
export type GeneratedItemType = z.infer<typeof GeneratedItemTypeSchema>;

export const SlotPlaybackOrder = ['ordered', 'shuffle'] as const;
export type SlotPlaybackOrder = TupleToUnion<typeof SlotPlaybackOrder>;

export const FillModes = ['fill', 'count', 'duration'] as const;
export type FillMode = TupleToUnion<typeof FillModes>;

//
// Slot Configuration Schemas
//

export const InfiniteSlotConfigSchema = z.object({
  order: BaseSlotOrdering.shape.order.nullish(),
  direction: BaseSlotOrdering.shape.direction.nullish(),
  seasonFilter: z.array(z.number()).nullish(),
});

export type InfiniteSlotConfig = z.infer<typeof InfiniteSlotConfigSchema>;

export const InfiniteSlotFillerConfigSchema = z.object({
  fillers: z.array(SlotFiller).optional(),
});

export type InfiniteSlotFillerConfig = z.infer<
  typeof InfiniteSlotFillerConfigSchema
>;

//
// Slot State Schema
//

export const InfiniteScheduleSlotStateSchema = z.object({
  uuid: z.uuid(),
  slotUuid: z.uuid(),
  rngSeed: z.array(z.number()).nullable(),
  rngUseCount: z.number().int().nonnegative(),
  iteratorPosition: z.number().int().nonnegative(),
  shuffleOrder: z.array(z.uuid()).nullable(),
  lastScheduledAt: z.number().nullable(),
  createdAt: z.number().nullable(),
  updatedAt: z.number().nullable(),
});

export type InfiniteScheduleSlotState = z.infer<
  typeof InfiniteScheduleSlotStateSchema
>;

//
// Slot Schema
//

export const BaseInfiniteSlotSchema = z.object({
  uuid: z.uuid().optional(), // Optional for creation
  slotIndex: z.number().int().nonnegative(),
  // Time-anchoring (null = floating slot)
  anchorMode: AnchorModeSchema.nullable().optional(),
  anchorTime: z.number().int().nonnegative().nullable().optional(),
  anchorDays: z.array(z.number().int().min(0).max(6)).nullable().optional(),
  // For floating slots
  weight: z.number().int().positive().default(1),
  cooldownMs: z.number().int().nonnegative().default(0),
  // Padding rules
  padMs: z.number().int().nonnegative().nullable().optional(),
  padToMultiple: z.number().int().positive().nullable().optional(),
  // Filler presets
  fillerConfig: InfiniteSlotFillerConfigSchema.nullable().optional(),
  fillMode: z.enum(FillModes).default('fill'),
  fillValue: z.number().int().positive().default(1),
});

export type BaseScheduleSlot = z.infer<typeof BaseInfiniteSlotSchema>;

export const MovieScheduleSlotSchema = BaseInfiniteSlotSchema.extend({
  type: z.literal('movie'),
  slotConfig: InfiniteSlotConfigSchema.optional(),
});

export const ShowScheduleSlotSchema = BaseInfiniteSlotSchema.extend({
  type: z.literal('show'),
  showId: z.uuid(),
  slotConfig: InfiniteSlotConfigSchema.optional(),
});

export const CustomShowScheduleSlotSchema = BaseInfiniteSlotSchema.extend({
  type: z.literal('custom-show'),
  customShowId: z.uuid(),
  slotConfig: InfiniteSlotConfigSchema.optional(),
});

export const FillerScheduleSlotSchema = BaseInfiniteSlotSchema.extend({
  type: z.literal('filler'),
  fillerListId: z.uuid(),
  order: SlotProgrammingFillerOrder.optional(),
});

export const RedirectScheduleSlotSchema = BaseInfiniteSlotSchema.extend({
  type: z.literal('redirect'),
  redirectChannelId: z.uuid(),
});

export const FlexScheduleSlotSchema = BaseInfiniteSlotSchema.extend({
  type: z.literal('flex'),
});

export const SmartCollectionScheduleSlotSchema = BaseInfiniteSlotSchema.extend({
  type: z.literal('smart-collection'),
  smartCollectionId: z.uuid(),
  slotConfig: InfiniteSlotConfigSchema.optional(),
});

export const ScheduleSlotSchema = z.discriminatedUnion('type', [
  MovieScheduleSlotSchema,
  ShowScheduleSlotSchema,
  CustomShowScheduleSlotSchema,
  FillerScheduleSlotSchema,
  RedirectScheduleSlotSchema,
  FlexScheduleSlotSchema,
  SmartCollectionScheduleSlotSchema,
]);

export type ScheduleSlot = z.infer<typeof ScheduleSlotSchema>;

export const MaterializedRedirectScheduleSlotSchema = z.object({
  ...RedirectScheduleSlotSchema.shape,
  channel: ChannelSchema.nullable(),
  isMissing: z.boolean().optional().default(false),
});

export type MaterializedRedirectScheduleSlot = z.infer<
  typeof MaterializedRedirectScheduleSlotSchema
>;

export const MaterializedShowScheduleSlotSchema = z.object({
  ...ShowScheduleSlotSchema.shape,
  show: Show.nullable(),
  missingShow: z
    .object({
      title: z.string().optional(),
    })
    .optional()
    .describe(
      'A show that existed in the DB at schedule time, but no longer exists.',
    ),
});

export type MaterializedShowScheduleSlot = z.infer<
  typeof MaterializedShowScheduleSlotSchema
>;

export const MaterializedCustomShowScheduleSlotSchema = z.object({
  ...CustomShowScheduleSlotSchema.shape,
  customShow: CustomShowSchema.omit({
    programs: true,
    totalDuration: true,
  }).nullable(),
  isMissing: z.boolean().optional().default(false),
});

export type MaterializedCustomShowScheduleSlot = z.infer<
  typeof MaterializedCustomShowScheduleSlotSchema
>;

export const MaterializedFillerShowScheduleSlotSchema =
  FillerScheduleSlotSchema.extend(BaseInfiniteSlotSchema.shape);

export const MaterializedFillerScheduleSlot = z.object({
  ...MaterializedFillerShowScheduleSlotSchema.shape,
  fillerList: FillerListSchema.omit({ programs: true }).nullable(),
  isMissing: z.boolean().optional().default(false),
});

export type MaterializedFillerScheduleSlot = z.infer<
  typeof MaterializedFillerScheduleSlot
>;

export const MaterializedSmartCollectioScheduleSlotSchema = z.object({
  ...SmartCollectionScheduleSlotSchema.shape,
  smartCollection: SmartCollection.nullable(),
  isMissing: z.boolean().optional().default(false),
});

export type MaterializedSmartCollectioScheduleSlot = z.infer<
  typeof MaterializedSmartCollectioScheduleSlotSchema
>;

export const MaterializedScheduleSlotSchema = z.discriminatedUnion('type', [
  FlexScheduleSlotSchema,
  MaterializedRedirectScheduleSlotSchema,
  MaterializedCustomShowScheduleSlotSchema,
  MaterializedFillerShowScheduleSlotSchema,
  MaterializedShowScheduleSlotSchema,
  MaterializedSmartCollectioScheduleSlotSchema,
]);

export type MaterializedScheduleSlot = z.infer<
  typeof MaterializedScheduleSlotSchema
>;

//
// Schedule Schema
//

export const ScheduleSchema = z.object({
  uuid: z.uuid(), // Optional for creation
  name: z.string(),
  // Schedule-level settings
  padMs: z.number().int().nonnegative().default(1),
  flexPreference: FlexPreferenceSchema.default('end'),
  timeZoneOffset: z.number().int().default(0),
  // Buffer management
  bufferDays: z.number().int().positive().default(7),
  bufferThresholdDays: z.number().int().positive().default(2),
  enabled: z.boolean().default(true),
  slotPlaybackOrder: z.enum(SlotPlaybackOrder),
  // Slots
  slots: z.array(ScheduleSlotSchema).default([]),
  createdAt: z.number().nullable().optional(),
  updatedAt: z.number().nullable().optional(),
});

export type Schedule = z.infer<typeof ScheduleSchema>;

export const MaterializedScheduleSchema = ScheduleSchema.omit({
  slots: true,
}).extend({
  slots: MaterializedScheduleSlotSchema.array(),
});

export type MaterializedSchedule2 = z.infer<typeof MaterializedScheduleSchema>;

//
// Generated Schedule Item Schema
//

export const GeneratedScheduleItemSchema = z.object({
  uuid: z.uuid(),
  scheduleUuid: z.uuid(),
  programUuid: z.uuid().nullable(),
  slotUuid: z.uuid().nullable(),
  itemType: GeneratedItemTypeSchema,
  startTimeMs: z.number().int().nonnegative(),
  durationMs: z.number().int().positive(),
  redirectChannelUuid: z.uuid().nullable().optional(),
  fillerListId: z.uuid().nullable().optional(),
  fillerType: z.string().nullable().optional(),
  sequenceIndex: z.number().int().nonnegative(),
  createdAt: z.number().nullable().optional(),
});

export type GeneratedScheduleItem = z.infer<typeof GeneratedScheduleItemSchema>;

//
// API Request/Response Schemas
//

export const CreateInfiniteScheduleRequestSchema = ScheduleSchema.omit({
  uuid: true,
  createdAt: true,
  updatedAt: true,
});

export type CreateInfiniteScheduleRequest = z.infer<
  typeof CreateInfiniteScheduleRequestSchema
>;

export const UpdateInfiniteScheduleRequestSchema =
  CreateInfiniteScheduleRequestSchema.partial();

export type UpdateInfiniteScheduleRequest = z.infer<
  typeof UpdateInfiniteScheduleRequestSchema
>;

export const InfiniteScheduleResponseSchema = ScheduleSchema.extend({
  uuid: z.uuid(),
});

export type InfiniteScheduleResponse = z.infer<
  typeof InfiniteScheduleResponseSchema
>;

export const InfiniteScheduleWithStateResponseSchema =
  InfiniteScheduleResponseSchema.extend({
    slotStates: z.array(InfiniteScheduleSlotStateSchema),
  });

export type InfiniteScheduleWithStateResponse = z.infer<
  typeof InfiniteScheduleWithStateResponseSchema
>;

export const RegenerateScheduleRequestSchema = z.object({
  // Optional: Force regenerate even if buffer is sufficient
  force: z.boolean().default(false),
  // Optional: Number of days to generate
  days: z.number().int().positive().optional(),
  // Optional: Starting timestamp (defaults to now)
  fromTimeMs: z.number().int().positive().optional(),
});

export type RegenerateScheduleRequest = z.infer<
  typeof RegenerateScheduleRequestSchema
>;

export const RegenerateScheduleResponseSchema = z.object({
  itemCount: z.number().int().nonnegative(),
  fromTimeMs: z.number().int().nonnegative(),
  toTimeMs: z.number().int().nonnegative(),
});

export type RegenerateScheduleResponse = z.infer<
  typeof RegenerateScheduleResponseSchema
>;

export const ResetSeedsResponseSchema = z.object({
  slotsReset: z.number().int().nonnegative(),
});

export type ResetSeedsResponse = z.infer<typeof ResetSeedsResponseSchema>;

export const InfiniteSchedulePreviewRequestSchema = z.object({
  // Schedule settings (optional, allows partial override)
  padMs: z.number().int().nonnegative().default(300000),
  flexPreference: FlexPreferenceSchema.default('end'),
  timeZoneOffset: z.number().int().default(0),
  slots: z.array(ScheduleSlotSchema).default([]),
  // Time range for preview
  fromTimeMs: z.number().int().nonnegative(),
  toTimeMs: z.number().int().nonnegative(),
});

export type InfiniteSchedulePreviewRequest = z.infer<
  typeof InfiniteSchedulePreviewRequestSchema
>;

export const InfiniteSchedulePreviewResponseSchema = z.object({
  items: z.array(GeneratedScheduleItemSchema),
  totalDurationMs: z.number().int().nonnegative(),
});

export type InfiniteSchedulePreviewResponse = z.infer<
  typeof InfiniteSchedulePreviewResponseSchema
>;

// Add/Update slot request
export const AddInfiniteSlotRequestSchema = ScheduleSlotSchema;

export type AddInfiniteSlotRequest = z.infer<
  typeof AddInfiniteSlotRequestSchema
>;

// For updates, we need the type and uuid, rest is optional
export const UpdateInfiniteSlotRequestSchema = z.object({
  uuid: z.uuid(),
  type: InfiniteSlotTypeSchema,
  slotIndex: z.number().int().nonnegative().optional(),
  showId: z.uuid().optional(),
  customShowId: z.uuid().optional(),
  fillerListId: z.uuid().optional(),
  redirectChannelId: z.uuid().optional(),
  smartCollectionId: z.uuid().optional(),
  slotConfig: InfiniteSlotConfigSchema.optional(),
  anchorTime: z.number().int().nonnegative().nullable().optional(),
  anchorMode: AnchorModeSchema.nullable().optional(),
  anchorDays: z.array(z.number().int().min(0).max(6)).nullable().optional(),
  weight: z.number().int().positive().optional(),
  cooldownMs: z.number().int().nonnegative().optional(),
  padMs: z.number().int().nonnegative().nullable().optional(),
  padToMultiple: z.number().int().positive().nullable().optional(),
  fillerConfig: InfiniteSlotFillerConfigSchema.nullable().optional(),
  order: SlotProgrammingFillerOrder.optional(), // For filler slots
});

export type UpdateInfiniteSlotRequest = z.infer<
  typeof UpdateInfiniteSlotRequestSchema
>;

// Bulk slots update
export const UpdateInfiniteSlotsRequestSchema = z.object({
  slots: z.array(ScheduleSlotSchema),
});

export type UpdateInfiniteSlotsRequest = z.infer<
  typeof UpdateInfiniteSlotsRequestSchema
>;
