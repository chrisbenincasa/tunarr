import {
  TimeSlotScheduleResult,
  TimeSlotScheduleSchema,
} from '@tunarr/types/api';
import { inject, injectable } from 'inversify';
import { z } from 'zod/v4';
import { SlotSchedulerHelper } from './SlotSchedulerHelper.ts';
import { scheduleTimeSlots } from './TimeSlotService.ts';

export const ChannelTimeSlotScheduleRequest = z.object({
  type: z.literal('channel'),
  channelId: z.number().or(z.string()),
  schedule: TimeSlotScheduleSchema,
  seed: z.number().array().optional(),
  discardCount: z.number().optional(),
});

export type ChannelTimeSlotScheduleRequest = z.infer<
  typeof ChannelTimeSlotScheduleRequest
>;

export const ProgramsTimeSlotScheduleRequest = z.object({
  type: z.literal('programs'),
  programIds: z.uuid().array(),
  schedule: TimeSlotScheduleSchema,
  seed: z.number().array().optional(),
  discardCount: z.number().optional(),
});

export type ProgramsTimeSlotScheduleRequest = z.infer<
  typeof ProgramsTimeSlotScheduleRequest
>;

export const TimeSlotScheduleServiceRequest = z.discriminatedUnion('type', [
  ChannelTimeSlotScheduleRequest,
  ProgramsTimeSlotScheduleRequest,
]);

export type TimeSlotScheduleServiceRequest = z.infer<
  typeof TimeSlotScheduleServiceRequest
>;

@injectable()
export class TimeSlotSchedulerService {
  constructor(
    @inject(SlotSchedulerHelper)
    private slotSchedulerHelper: SlotSchedulerHelper,
  ) {}

  async schedule(
    request: TimeSlotScheduleServiceRequest,
  ): Promise<TimeSlotScheduleResult> {
    const slotPrograms =
      await this.slotSchedulerHelper.collectSlotProgramming(request);

    return scheduleTimeSlots(
      request.schedule,
      slotPrograms,
      request.seed,
      request.discardCount ?? 0,
    );
  }
}
