import {
  RandomSlotScheduleSchema,
  SlotScheduleResult,
} from '@tunarr/types/api';
import { inject, injectable } from 'inversify';
import { z } from 'zod/v4';
import { RandomSlotScheduler } from './RandomSlotsService.ts';
import { SlotSchedulerHelper } from './SlotSchedulerHelper.ts';

export const ChannelSlotScheduleRequest = z.object({
  type: z.literal('channel'),
  channelId: z.number().or(z.string()),
  schedule: RandomSlotScheduleSchema,
  seed: z.number().array().optional(),
  discardCount: z.number().optional(),
});

export type ChannelSlotScheduleRequest = z.infer<
  typeof ChannelSlotScheduleRequest
>;

export const ProgramsSlotScheduleRequest = z.object({
  type: z.literal('programs'),
  programIds: z.uuid().array(),
  schedule: RandomSlotScheduleSchema,
  seed: z.number().array().optional(),
  discardCount: z.number().optional(),
});

export type ProgramsSlotScheduleRequest = z.infer<
  typeof ProgramsSlotScheduleRequest
>;

export const SlotScheduleServiceRequest = z.discriminatedUnion('type', [
  ChannelSlotScheduleRequest,
  ProgramsSlotScheduleRequest,
]);

export type SlotScheduleServiceRequest = z.infer<
  typeof SlotScheduleServiceRequest
>;

@injectable()
export class SlotSchedulerService {
  constructor(
    @inject(SlotSchedulerHelper)
    private slotSchedulerHelper: SlotSchedulerHelper,
  ) {}

  async schedule(
    request: SlotScheduleServiceRequest,
  ): Promise<SlotScheduleResult> {
    const slotPrograms =
      await this.slotSchedulerHelper.collectSlotProgramming(request);

    return new RandomSlotScheduler(request.schedule).generateSchedule(
      slotPrograms,
      request.seed,
      request.discardCount,
    );
  }
}
