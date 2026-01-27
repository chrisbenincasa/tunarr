import { z } from 'zod/v4';
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

//
// Slot Configuration Schemas
//

export const InfiniteSlotConfigSchema = z.object({
  order: BaseSlotOrdering.shape.order.optional(),
  direction: BaseSlotOrdering.shape.direction.optional(),
  seasonFilter: z.array(z.number()).optional(),
});

export type InfiniteSlotConfig = z.infer<typeof InfiniteSlotConfigSchema>;

export const InfiniteSlotFillerConfigSchema = z.object({
  fillers: z.array(SlotFiller).optional(),
});

export type InfiniteSlotFillerConfig = z.infer<typeof InfiniteSlotFillerConfigSchema>;

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

export type InfiniteScheduleSlotState = z.infer<typeof InfiniteScheduleSlotStateSchema>;

//
// Slot Schema
//

const BaseInfiniteSlotSchema = z.object({
  uuid: z.uuid().optional(), // Optional for creation
  slotIndex: z.number().int().nonnegative(),
  // Time-anchoring (null = floating slot)
  anchorTime: z.number().int().nonnegative().nullable().optional(),
  anchorMode: AnchorModeSchema.nullable().optional(),
  anchorDays: z.array(z.number().int().min(0).max(6)).nullable().optional(),
  // For floating slots
  weight: z.number().int().positive().default(1),
  cooldownMs: z.number().int().nonnegative().default(0),
  // Padding rules
  padMs: z.number().int().nonnegative().nullable().optional(),
  padToMultiple: z.number().int().positive().nullable().optional(),
  // Filler presets
  fillerConfig: InfiniteSlotFillerConfigSchema.nullable().optional(),
});

export const MovieInfiniteSlotSchema = BaseInfiniteSlotSchema.extend({
  type: z.literal('movie'),
  slotConfig: InfiniteSlotConfigSchema.optional(),
});

export const ShowInfiniteSlotSchema = BaseInfiniteSlotSchema.extend({
  type: z.literal('show'),
  showId: z.uuid(),
  slotConfig: InfiniteSlotConfigSchema.optional(),
});

export const CustomShowInfiniteSlotSchema = BaseInfiniteSlotSchema.extend({
  type: z.literal('custom-show'),
  customShowId: z.uuid(),
  slotConfig: InfiniteSlotConfigSchema.optional(),
});

export const FillerInfiniteSlotSchema = BaseInfiniteSlotSchema.extend({
  type: z.literal('filler'),
  fillerListId: z.uuid(),
  order: SlotProgrammingFillerOrder.optional(),
});

export const RedirectInfiniteSlotSchema = BaseInfiniteSlotSchema.extend({
  type: z.literal('redirect'),
  redirectChannelId: z.uuid(),
});

export const FlexInfiniteSlotSchema = BaseInfiniteSlotSchema.extend({
  type: z.literal('flex'),
});

export const SmartCollectionInfiniteSlotSchema = BaseInfiniteSlotSchema.extend({
  type: z.literal('smart-collection'),
  smartCollectionId: z.uuid(),
  slotConfig: InfiniteSlotConfigSchema.optional(),
});

export const InfiniteScheduleSlotSchema = z.discriminatedUnion('type', [
  MovieInfiniteSlotSchema,
  ShowInfiniteSlotSchema,
  CustomShowInfiniteSlotSchema,
  FillerInfiniteSlotSchema,
  RedirectInfiniteSlotSchema,
  FlexInfiniteSlotSchema,
  SmartCollectionInfiniteSlotSchema,
]);

export type InfiniteScheduleSlot = z.infer<typeof InfiniteScheduleSlotSchema>;

//
// Schedule Schema
//

export const InfiniteScheduleSchema = z.object({
  uuid: z.uuid().optional(), // Optional for creation
  channelUuid: z.uuid(),
  // Schedule-level settings
  padMs: z.number().int().nonnegative().default(300000), // Default 5 min
  flexPreference: FlexPreferenceSchema.default('end'),
  timeZoneOffset: z.number().int().default(0), // Offset in minutes
  // Buffer management
  bufferDays: z.number().int().positive().default(7),
  bufferThresholdDays: z.number().int().positive().default(2),
  enabled: z.boolean().default(true),
  // Slots
  slots: z.array(InfiniteScheduleSlotSchema).default([]),
  createdAt: z.number().nullable().optional(),
  updatedAt: z.number().nullable().optional(),
});

export type InfiniteSchedule = z.infer<typeof InfiniteScheduleSchema>;

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

export const CreateInfiniteScheduleRequestSchema = InfiniteScheduleSchema.omit({
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

export const InfiniteScheduleResponseSchema = InfiniteScheduleSchema.extend({
  uuid: z.uuid(),
});

export type InfiniteScheduleResponse = z.infer<typeof InfiniteScheduleResponseSchema>;

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

export type RegenerateScheduleRequest = z.infer<typeof RegenerateScheduleRequestSchema>;

export const RegenerateScheduleResponseSchema = z.object({
  itemCount: z.number().int().nonnegative(),
  fromTimeMs: z.number().int().nonnegative(),
  toTimeMs: z.number().int().nonnegative(),
});

export type RegenerateScheduleResponse = z.infer<typeof RegenerateScheduleResponseSchema>;

export const ResetSeedsResponseSchema = z.object({
  slotsReset: z.number().int().nonnegative(),
});

export type ResetSeedsResponse = z.infer<typeof ResetSeedsResponseSchema>;

export const InfiniteSchedulePreviewRequestSchema = z.object({
  schedule: CreateInfiniteScheduleRequestSchema,
  days: z.number().int().positive().default(1),
  fromTimeMs: z.number().int().positive().optional(),
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
export const AddInfiniteSlotRequestSchema = InfiniteScheduleSlotSchema;

export type AddInfiniteSlotRequest = z.infer<typeof AddInfiniteSlotRequestSchema>;

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

export type UpdateInfiniteSlotRequest = z.infer<typeof UpdateInfiniteSlotRequestSchema>;

// Bulk slots update
export const UpdateInfiniteSlotsRequestSchema = z.object({
  slots: z.array(InfiniteScheduleSlotSchema),
});

export type UpdateInfiniteSlotsRequest = z.infer<typeof UpdateInfiniteSlotsRequestSchema>;
