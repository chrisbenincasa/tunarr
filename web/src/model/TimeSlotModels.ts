import { OverflowConfig, type TimeSlotSchedule } from '@tunarr/types/api';
import z from 'zod';
import {
  CommonCustomShowSlotViewModel,
  CommonFillerSlotViewModel,
  CommonFlexSlotViewModel,
  CommonMovieSlotViewModel,
  CommonRedirectSlotViewModel,
  CommonShowSlotViewModel,
  CommonSmartCollectionViewModel,
} from './CommonSlotModels.ts';

const BaseTimeSlot = z.object({
  startTime: z.number(), // Offset from midnight in millis
  padMs: z.number().optional(),
  overflow: OverflowConfig.optional(),
  latenessMs: z.number().optional(),
});

const MovieTimeSlotViewModel = z.object({
  ...CommonMovieSlotViewModel.shape,
  ...BaseTimeSlot.shape,
  type: z.literal('movie'),
});

export type MovieTimeSlotViewModel = z.infer<typeof MovieTimeSlotViewModel>;

export const ShowTimeSlotViewModel = z.object({
  ...CommonShowSlotViewModel.shape,
  ...BaseTimeSlot.shape,
});

export type ShowTimeSlotViewModel = z.infer<typeof ShowTimeSlotViewModel>;

const FlexTimeSlotViewModel = z.object({
  ...BaseTimeSlot.shape,
  ...CommonFlexSlotViewModel.shape,
});

export type FlexTimeSlotViewModel = z.infer<typeof FlexTimeSlotViewModel>;

const RedirectTimeSlotViewModel = z.object({
  ...CommonRedirectSlotViewModel.shape,
  ...BaseTimeSlot.shape,
});

export type RedirectTimeSlotViewModel = z.infer<
  typeof RedirectTimeSlotViewModel
>;

const FillerTimeSlotViewModel = z.object({
  ...BaseTimeSlot.shape,
  ...CommonFillerSlotViewModel.shape,
});

export type FillerTimeSlotViewModel = z.infer<typeof FillerTimeSlotViewModel>;

const CustomShowTimeSlotViewModel = z.object({
  ...CommonCustomShowSlotViewModel.shape,
  ...BaseTimeSlot.shape,
});

const SmartCollectionTimeSlotViewModel = z.object({
  ...CommonSmartCollectionViewModel.shape,
  ...BaseTimeSlot.shape,
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
  overflow: OverflowConfig;
  padMs: number;
  period: 'day' | 'week';
  slots: TimeSlotViewModel[];
  type: 'time';
};
