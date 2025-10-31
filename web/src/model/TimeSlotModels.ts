import { BaseSlotOrdering, type TimeSlotSchedule } from '@tunarr/types/api';
import z from 'zod';
import {
  CommonCustomShowSlotViewModel,
  CommonFillerSlotViewModel,
  CommonShowSlotViewModel,
  CommonSmartCollectionViewModel,
  WithSlotFiller,
} from './CommonSlotModels.ts';

export const BaseTimeSlot = z.object({
  startTime: z.number(), // Offset from midnight in millis
});

export const MovieTimeSlotViewModel = z.object({
  ...BaseTimeSlot.shape,
  ...BaseSlotOrdering.shape,
  ...WithSlotFiller.shape,
  type: z.literal('movie'),
});

export type MovieTimeSlotViewModel = z.infer<typeof MovieTimeSlotViewModel>;

export const ShowTimeSlotViewModel = z.object({
  ...BaseTimeSlot.shape,
  ...BaseSlotOrdering.shape,
  ...CommonShowSlotViewModel.shape,
  ...WithSlotFiller.shape,
});

export type ShowTimeSlotViewModel = z.infer<typeof ShowTimeSlotViewModel>;

export const FlexTimeSlotViewModel = z.object({
  ...BaseTimeSlot.shape,
  type: z.literal('flex'),
});

export type FlexTimeSlotViewModel = z.infer<typeof FlexTimeSlotViewModel>;

export const RedirectTimeSlotViewModel = z.object({
  ...BaseTimeSlot.shape,
  type: z.literal('redirect'),
  channelId: z.string(),
});

export type RedirectTimeSlotViewModel = z.infer<
  typeof RedirectTimeSlotViewModel
>;

export const FillerTimeSlotViewModel = z.object({
  ...BaseTimeSlot.shape,
  ...CommonFillerSlotViewModel.shape,
});

export type FillerTimeSlotViewModel = z.infer<typeof FillerTimeSlotViewModel>;

export const CustomShowTimeSlotViewModel = z.object({
  ...BaseTimeSlot.shape,
  ...BaseSlotOrdering.shape,
  ...CommonCustomShowSlotViewModel.shape,
  ...WithSlotFiller.shape,
});

export const SmartCollectionTimeSlotViewModel = z.object({
  ...BaseTimeSlot.shape,
  ...BaseSlotOrdering.shape,
  ...CommonSmartCollectionViewModel.shape,
  ...WithSlotFiller.shape,
});

export const TimeSlotViewModel = z.discriminatedUnion('type', [
  MovieTimeSlotViewModel,
  ShowTimeSlotViewModel,
  FlexTimeSlotViewModel,
  RedirectTimeSlotViewModel,
  FillerTimeSlotViewModel,
  CustomShowTimeSlotViewModel,
  SmartCollectionTimeSlotViewModel,
]);

export type TimeSlotViewModel = z.infer<typeof TimeSlotViewModel>;

export type TimeSlotForm = {
  flexPreference: TimeSlotSchedule['flexPreference'];
  latenessMs: number;
  maxDays: number;
  padMs: number;
  period: 'day' | 'week';
  slots: TimeSlotViewModel[];
};
