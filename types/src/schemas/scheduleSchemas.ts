import { z } from 'zod';

export const ScheduleSlotTypes = [
  'movie',
  'show',
  'custom-show',
  'filler',
  'redirect',
  'flex',
  'smart-collection',
] as const;

export const SlotAnchorModes = ['hard', 'soft', 'padded'] as const;

export const SlotIterationOrders = [
  'next',
  'shuffle',
  'ordered_shuffle',
  'alphanumeric',
  'chronological',
] as const;

export const SlotIterationDirections = ['asc', 'desc'] as const;

export const SlotFillModes = ['fill', 'count', 'duration'] as const;

export const SlotConfig = z.object({
  order: z.enum(SlotIterationOrders).nullish(),
  direction: z.enum(SlotIterationOrders).nullish(),
  seasonFilter: z.number().nullish(),
});

export const ScheduleSlotSchema = z.object({
  uuid: z.uuid(),
  slotIndex: z.number(),
  slotType: z.enum(ScheduleSlotTypes),
});

// Response schema for schedule that matches DB structure
export const ScheduleSchema = z.object({
  uuid: z.uuid(),
  name: z.string(),
  padMs: z.number(),
  flexPreference: z.enum(['distribute', 'end']),
  timeZoneOffset: z.number(),
  bufferDays: z.number(),
  bufferThresholdDays: z.number(),
  enabled: z.boolean(),
  createdAt: z.number().nullable(),
  updatedAt: z.number().nullable(),
  slots: z.array(z.any()),
});

// Slot state response schema
export const SlotStateSchema = z.object({
  slotUuid: z.string(),
  slotIndex: z.number(),
  slotType: z.string(),
  state: z
    .object({
      uuid: z.string(),
      slotUuid: z.string(),
      rngSeed: z.any().nullable(),
      rngUseCount: z.number(),
      iteratorPosition: z.number(),
      shuffleOrder: z.array(z.string()).nullable(),
      lastScheduledAt: z.number().nullable(),
      createdAt: z.number().nullable(),
      updatedAt: z.number().nullable(),
    })
    .nullable(),
});
