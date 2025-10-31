import {
  BaseRandomSlotSchema,
  BaseSlotOrdering,
  type RandomSlotSchedule,
} from '@tunarr/types/api';
import type { StrictOmit } from 'ts-essentials';
import z from 'zod';
import {
  CommonCustomShowSlotViewModel,
  CommonFillerSlotViewModel,
  CommonShowSlotViewModel,
  CommonSmartCollectionViewModel,
  WithSlotFiller,
} from './CommonSlotModels.ts';

const BaseSlot = z.object({
  ...BaseRandomSlotSchema.shape,
});

export const MovieSlotViewModel = z.object({
  ...BaseSlot.shape,
  ...BaseSlotOrdering.shape,
  ...WithSlotFiller.shape,
  type: z.literal('movie'),
});

export type MovieSlotViewModel = z.infer<typeof MovieSlotViewModel>;

export const ShowSlotViewModel = z.object({
  ...BaseSlot.shape,
  ...BaseSlotOrdering.shape,
  ...CommonShowSlotViewModel.shape,
  ...WithSlotFiller.shape,
});

export type ShowSlotViewModel = z.infer<typeof ShowSlotViewModel>;

export const FlexSlotViewModel = z.object({
  ...BaseSlot.shape,
  type: z.literal('flex'),
});

export type FlexSlotViewModel = z.infer<typeof FlexSlotViewModel>;

export const RedirectSlotViewModel = z.object({
  ...BaseSlot.shape,
  type: z.literal('redirect'),
  channelId: z.string(),
});

export type RedirectSlotViewModel = z.infer<typeof RedirectSlotViewModel>;

export const FillerSlotViewModel = z.object({
  ...BaseSlot.shape,
  ...CommonFillerSlotViewModel.shape,
});

export type FillerSlotViewModel = z.infer<typeof FillerSlotViewModel>;

export const CustomShowSlotViewModel = z.object({
  ...BaseSlot.shape,
  ...BaseSlotOrdering.shape,
  ...CommonCustomShowSlotViewModel.shape,
  ...WithSlotFiller.shape,
});

export const SmartCollectionTimeSlotViewModel = z.object({
  ...BaseSlot.shape,
  ...BaseSlotOrdering.shape,
  ...CommonSmartCollectionViewModel.shape,
  ...WithSlotFiller.shape,
});

export type SmartCollectionTimeSlotViewModel = z.infer<
  typeof SmartCollectionTimeSlotViewModel
>;

export const SlotViewModel = z.discriminatedUnion('type', [
  MovieSlotViewModel,
  ShowSlotViewModel,
  FlexSlotViewModel,
  RedirectSlotViewModel,
  FillerSlotViewModel,
  CustomShowSlotViewModel,
  SmartCollectionTimeSlotViewModel,
]);

export type SlotViewModel = z.infer<typeof SlotViewModel>;

export type RandomSlotForm = StrictOmit<
  RandomSlotSchedule,
  'timeZoneOffset' | 'type' | 'slots'
> & {
  slots: SlotViewModel[];
};

export const defaultRandomSlotSchedule: RandomSlotForm = {
  padStyle: 'slot',
  randomDistribution: 'uniform',
  flexPreference: 'distribute',
  maxDays: 365,
  padMs: 1,
  slots: [],
  // UI mechanism
  lockWeights: true,
};
