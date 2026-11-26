import { TimeSlotScheduleSchema } from '@tunarr/types/api';
import dayjs from 'dayjs';
import { inject, injectable } from 'inversify';
import { z } from 'zod/v4';
import { SlotSchedulerHelper } from './SlotSchedulerHelper.ts';
import { SlotIteratorStateSchema } from './slotIteratorState.ts';
import {
  scheduleTimeSlots,
  type TimeSlotCycleResult,
} from './TimeSlotService.ts';

export const ChannelTimeSlotScheduleRequest = z.object({
  type: z.literal('channel'),
  channelId: z.number().or(z.string()),
  schedule: TimeSlotScheduleSchema,
  seed: z.number().array().optional(),
  discardCount: z.number().optional(),
  startTime: z.number().optional(),
  // Set on save and preview. Rejects slots that reference missing content or
  // cannot play. Regeneration leaves it off so stored schedules keep playing.
  strictValidation: z.boolean().optional(),
  // Set when building one cycle of a rebuilding channel. See SlotCycleOptions.
  iteratorState: SlotIteratorStateSchema.optional(),
  // Epoch milliseconds.
  endTime: z.number().int().optional(),
  // Return restart points inside the build. See SlotCycleOptions.
  checkpoints: z.boolean().optional(),
  // Shuffle slots keep their own seed. See SlotCycleOptions.
  stableShuffle: z.boolean().optional(),
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
  startTime: z.number().optional(),
  // Set on save and preview. Rejects slots that reference missing content or
  // cannot play. Regeneration leaves it off so stored schedules keep playing.
  strictValidation: z.boolean().optional(),
  // Set when building one cycle of a rebuilding channel. See SlotCycleOptions.
  iteratorState: SlotIteratorStateSchema.optional(),
  // Epoch milliseconds.
  endTime: z.number().int().optional(),
  // Return restart points inside the build. See SlotCycleOptions.
  checkpoints: z.boolean().optional(),
  // Shuffle slots keep their own seed. See SlotCycleOptions.
  stableShuffle: z.boolean().optional(),
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
  ): Promise<TimeSlotCycleResult> {
    const slotPrograms =
      await this.slotSchedulerHelper.collectSlotProgramming(request);

    // Strict saves reject a redirect to a missing channel. Lenient
    // regeneration plays flex in its place.
    let missingRedirectChannelIds: Set<string> | undefined;
    if (request.strictValidation) {
      await this.slotSchedulerHelper.assertSlotReferences(
        request.schedule.slots,
        slotPrograms,
      );
    } else {
      missingRedirectChannelIds =
        await this.slotSchedulerHelper.findMissingRedirectChannelIds(
          request.schedule.slots,
        );
    }

    return scheduleTimeSlots(
      request.schedule,
      slotPrograms,
      request.seed,
      request.discardCount ?? 0,
      request.startTime ? dayjs(request.startTime) : undefined,
      {
        iteratorState: request.iteratorState,
        endTime:
          request.endTime !== undefined ? dayjs(request.endTime) : undefined,
        checkpoints: request.checkpoints,
        stableShuffle: request.stableShuffle,
        missingRedirectChannelIds,
      },
    );
  }
}
