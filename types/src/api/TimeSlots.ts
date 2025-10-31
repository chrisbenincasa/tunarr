import { z } from 'zod';
import { ChannelSchema } from '../schemas/channelSchema.js';
import { CustomShowSchema } from '../schemas/customShowsSchema.js';
import { FillerListSchema } from '../schemas/fillerSchema.js';
import { Show } from '../schemas/programmingSchema.js';
import {
  CustomShowProgrammingSlotSchema,
  FillerProgrammingSlotSchema,
  FlexProgrammingSlotSchema,
  MovieProgrammingSlotSchema,
  RedirectProgrammingSlotSchema,
  ShowProgrammingSlotSchema,
  SmartCollectionProgrammingSlot,
} from './CommonSlots.js';

//
// Time slots
//
const BaseTimeSlot = z.object({
  startTime: z.number(), // Offset from midnight in millis
});

export const MovieProgrammingTimeSlotSchema = z.object({
  ...BaseTimeSlot.shape,
  ...MovieProgrammingSlotSchema.shape,
});

export const ShowProgrammingTimeSlotSchema = z.object({
  ...BaseTimeSlot.shape,
  ...ShowProgrammingSlotSchema.shape,
});

export const MaterializedShowTimeSlot = z.object({
  ...ShowProgrammingTimeSlotSchema.shape,
  show: Show,
});

export const FlexProgrammingTimeSlotSchema = z.object({
  ...BaseTimeSlot.shape,
  ...FlexProgrammingSlotSchema.shape,
});

export const RedirectProgrammingTimeSlotSchema =
  RedirectProgrammingSlotSchema.extend(BaseTimeSlot.shape);

export const MaterializedRedirectTimeSlot = z.object({
  ...RedirectProgrammingTimeSlotSchema.shape,
  channel: ChannelSchema,
});
export type MaterializedRedirectTimeSlot = z.infer<
  typeof MaterializedRedirectTimeSlot
>;

export const CustomShowProgrammingTimeSlotSchema =
  CustomShowProgrammingSlotSchema.extend(BaseTimeSlot.shape);

export const MaterializedCustomShowTimeSlot = z.object({
  ...CustomShowProgrammingTimeSlotSchema.shape,
  customShow: CustomShowSchema.omit({ programs: true, totalDuration: true }),
});

export type MaterializedCustomShowTimeSlot = z.infer<
  typeof MaterializedCustomShowTimeSlot
>;

export const FillerShowProgrammingTimeSlotSchema =
  FillerProgrammingSlotSchema.extend(BaseTimeSlot.shape);

export const MaterializedFillerTimeSlot = z.object({
  ...FillerShowProgrammingTimeSlotSchema.shape,
  fillerList: FillerListSchema.omit({ programs: true }),
});

export type MaterializedFillerTimeSlot = z.infer<
  typeof MaterializedFillerTimeSlot
>;

export const SmartCollectionTimeSlot = z.object({
  ...BaseTimeSlot.shape,
  ...SmartCollectionProgrammingSlot.shape,
});

export type MovieProgrammingTimeSlot = z.infer<
  typeof MovieProgrammingTimeSlotSchema
>;

export type ShowProgrammingTimeSlot = z.infer<
  typeof ShowProgrammingTimeSlotSchema
>;

export type FlexProgrammingTimeSlot = z.infer<
  typeof FlexProgrammingTimeSlotSchema
>;

export type CustomShowProgrammingTimeSlot = z.infer<
  typeof CustomShowProgrammingTimeSlotSchema
>;

export type RedirectProgrammingTimeSlot = z.infer<
  typeof RedirectProgrammingTimeSlotSchema
>;

export type FillerProgrammingTimeSlot = z.infer<
  typeof FillerShowProgrammingTimeSlotSchema
>;

export const TimeSlotSchema = z.discriminatedUnion('type', [
  MovieProgrammingTimeSlotSchema,
  ShowProgrammingTimeSlotSchema,
  FlexProgrammingTimeSlotSchema,
  RedirectProgrammingTimeSlotSchema,
  FillerShowProgrammingTimeSlotSchema,
  CustomShowProgrammingTimeSlotSchema,
  SmartCollectionTimeSlot,
]);

export type TimeSlot = z.infer<typeof TimeSlotSchema>;

export const MaterializedTimeSlot = z.discriminatedUnion('type', [
  MovieProgrammingTimeSlotSchema,
  MaterializedShowTimeSlot,
  FlexProgrammingTimeSlotSchema,
  MaterializedRedirectTimeSlot,
  MaterializedCustomShowTimeSlot,
  MaterializedFillerTimeSlot,
  SmartCollectionTimeSlot,
]);

export type MaterializedTimeSlot = z.infer<typeof MaterializedTimeSlot>;

export const TimeSlotScheduleSchema = z.object({
  type: z.literal('time'),
  flexPreference: z.enum(['distribute', 'end']),
  latenessMs: z.number(), // max lateness in millis
  maxDays: z.number(), // days to pregenerate schedule for
  padMs: z.number(), // Pad time in millis
  period: z.enum(['day', 'week']),
  slots: z.array(TimeSlotSchema),
  timeZoneOffset: z.number(), // tz offset in...minutes, i think?
  startTomorrow: z.boolean().optional(),
});

export type TimeSlotSchedule = z.infer<typeof TimeSlotScheduleSchema>;
