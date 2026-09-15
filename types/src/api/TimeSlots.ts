import { z } from 'zod';
import { ChannelSchema } from '../schemas/channelSchema.js';
import { SmartCollection } from '../schemas/collectionsSchema.js';
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
  padMs: z.number().optional(),
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

export const FlexProgrammingTimeSlotSchema = z.object({
  ...BaseTimeSlot.shape,
  ...FlexProgrammingSlotSchema.shape,
});

export const RedirectProgrammingTimeSlotSchema =
  RedirectProgrammingSlotSchema.extend(BaseTimeSlot.shape);

export const MaterializedRedirectTimeSlot = z.object({
  ...RedirectProgrammingTimeSlotSchema.shape,
  channel: ChannelSchema.nullable(),
  isMissing: z.boolean().optional().default(false),
});

export type MaterializedRedirectTimeSlot = z.infer<
  typeof MaterializedRedirectTimeSlot
>;

export const CustomShowProgrammingTimeSlotSchema =
  CustomShowProgrammingSlotSchema.extend(BaseTimeSlot.shape);

export const MaterializedCustomShowTimeSlot = z.object({
  ...CustomShowProgrammingTimeSlotSchema.shape,
  customShow: CustomShowSchema.omit({
    programs: true,
    totalDuration: true,
  }).nullable(),
  isMissing: z.boolean().optional().default(false),
});

export type MaterializedCustomShowTimeSlot = z.infer<
  typeof MaterializedCustomShowTimeSlot
>;

export const FillerShowProgrammingTimeSlotSchema = z.object({
  ...BaseTimeSlot.shape,
  ...FillerProgrammingSlotSchema.shape,
});

export const MaterializedFillerTimeSlot = z.object({
  ...FillerShowProgrammingTimeSlotSchema.shape,
  fillerList: FillerListSchema.omit({ programs: true }).nullable(),
  isMissing: z.boolean().optional().default(false),
});

export type MaterializedFillerTimeSlot = z.infer<
  typeof MaterializedFillerTimeSlot
>;

export const SmartCollectionTimeSlot = z.object({
  ...BaseTimeSlot.shape,
  ...SmartCollectionProgrammingSlot.shape,
});

export const MaterializedSmartCollectionTimeSlot = z.object({
  ...SmartCollectionTimeSlot.shape,
  smartCollection: SmartCollection.nullable(),
  isMissing: z.boolean().optional().default(false),
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
  MaterializedSmartCollectionTimeSlot,
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

const OneDayMs = 24 * 60 * 60 * 1000;
const OneWeekMs = 7 * OneDayMs;

/**
 * Request-body variant of {@link TimeSlotScheduleSchema}.
 *
 * The permissive schema above also parses lineups already on disk and is used
 * to serialize channel responses, so it cannot be tightened: a channel holding
 * a value written by an older build would stop loading entirely. Validate
 * incoming schedules with this instead.
 *
 * Every bound here corresponds to a state the scheduler mishandles rather than
 * rejects: a fractional `startTime` spins it in a loop that no timeout can
 * interrupt, `padMs` of zero yields a lineup of NaN durations, a non-positive
 * `maxDays` returns an empty schedule, and a `startTime` at or beyond the
 * period matches no cursor position, so the schedule either throws or collapses
 * into one flex block.
 */
export const StrictTimeSlotScheduleSchema = TimeSlotScheduleSchema.extend({
  latenessMs: z.number().int().nonnegative(),
  maxDays: z.number().int().positive(),
  padMs: z.number().int().positive(),
  slots: z.array(TimeSlotSchema).min(1),
}).superRefine((schedule, ctx) => {
  const periodMs = schedule.period === 'week' ? OneWeekMs : OneDayMs;

  schedule.slots.forEach((slot, index) => {
    if (!Number.isInteger(slot.startTime)) {
      ctx.addIssue({
        code: 'custom',
        path: ['slots', index, 'startTime'],
        message: `startTime must be a whole number of milliseconds, got ${slot.startTime}`,
      });
      return;
    }

    if (slot.startTime < 0 || slot.startTime >= periodMs) {
      ctx.addIssue({
        code: 'custom',
        path: ['slots', index, 'startTime'],
        message: `startTime must be an offset within the ${schedule.period} period (0 to ${periodMs - 1} ms), got ${slot.startTime}`,
      });
    }
  });
});

export type StrictTimeSlotSchedule = z.infer<
  typeof StrictTimeSlotScheduleSchema
>;
