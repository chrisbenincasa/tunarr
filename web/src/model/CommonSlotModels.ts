import type { FieldArrayWithId } from 'react-hook-form';
import type { RandomSlotForm } from './SlotModels.ts';

import {
  BaseSlotOrdering,
  SlotFiller,
  SlotProgrammingFillerOrder,
} from '@tunarr/types/api';
import { Show } from '@tunarr/types/schemas';
import z from 'zod';
import type { TimeSlotForm } from './TimeSlotModels.ts';

export const WithSlotFiller = z.object({
  filler: z.array(SlotFiller).optional(),
});

export const CommonMovieSlotViewModel = z.object({
  type: z.literal('movie'),
});

export const CommonCustomShowSlotViewModel = z.object({
  type: z.literal('custom-show'),
  customShowId: z.uuid(),
});

export type CommonCustomShowSlotViewModel = z.infer<
  typeof CommonCustomShowSlotViewModel
>;

export const CommonFillerSlotViewModel = z.object({
  type: z.literal('filler'),
  fillerListId: z.uuid(),
  order: SlotProgrammingFillerOrder,
  durationWeighting: z.enum(['linear', 'log']),
  decayFactor: z.number().gte(0).lt(1),
  recoveryFactor: z.number().gte(0).lt(1),
});

export type CommonFillerSlotViewModel = z.infer<
  typeof CommonFillerSlotViewModel
>;

export const CommonShowSlotViewModel = z.object({
  ...BaseSlotOrdering.shape,
  type: z.literal('show'),
  showId: z.string(),
  show: Show.nullable(),
});

export type CommonShowSlotViewModel = z.infer<typeof CommonShowSlotViewModel>;

export const CommonFlexSlotViewModel = z.object({
  type: z.literal('flex'),
});

export const CommonRedirectSlotViewModel = z.object({
  type: z.literal('redirect'),
  channelId: z.string(),
});

export const CommonSlotViewModel = z.discriminatedUnion('type', [
  CommonMovieSlotViewModel,
  CommonCustomShowSlotViewModel,
  CommonFillerSlotViewModel,
  CommonShowSlotViewModel,
  CommonFlexSlotViewModel,
  CommonRedirectSlotViewModel,
]);

export type CommonSlotViewModel = z.infer<typeof CommonSlotViewModel>;

export type ProgramTooLongWarning = {
  type: 'program_too_long';
  programs: { id: string; duration: number }[];
};

export type SlotWarning = ProgramTooLongWarning;

export type TimeSlotTableDataType = FieldArrayWithId<TimeSlotForm, 'slots'>;
export type RandomSlotTableDataType = FieldArrayWithId<RandomSlotForm, 'slots'>;

export type SlotTableWarnings = {
  warnings: SlotWarning[];
  programCount: number;
  durationMs?: number;
};

export type TimeSlotTableRowType = TimeSlotTableDataType &
  SlotTableWarnings & {
    originalIndex: number;
  };

export type RandomSlotTableRowType = RandomSlotTableDataType &
  SlotTableWarnings;
