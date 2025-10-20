import { seq } from '@tunarr/shared/util';
import { ChannelProgram, CustomProgram, FillerProgram } from '@tunarr/types';
import {
  TimeSlotScheduleResult,
  TimeSlotScheduleSchema,
} from '@tunarr/types/api';
import { ChannelProgramSchema } from '@tunarr/types/schemas';
import { inject, injectable, LazyServiceIdentifier } from 'inversify';
import { isNumber, reject } from 'lodash-es';
import { z } from 'zod/v4';
import { IChannelDB } from '../../db/interfaces/IChannelDB.ts';
import { KEYS } from '../../types/inject.ts';
import { SlotSchedulerHelper } from './SlotSchedulerHelper.ts';
import { scheduleTimeSlots } from './TimeSlotService.ts';

type MaterializedTimeSlotScheduleResult = {
  programs: ChannelProgram[];
  startTime: number;
};

export const ChannelTimeSlotScheduleRequest = z.object({
  type: z.literal('channel'),
  channelId: z.number().or(z.string()),
  schedule: TimeSlotScheduleSchema,
  materializeResult: z.boolean(),
  seed: z.number().array().optional(),
  discardCount: z.number().optional(),
});

export type ChannelTimeSlotScheduleRequest = z.infer<
  typeof ChannelTimeSlotScheduleRequest
>;

export const ProgramsTimeSlotScheduleRequest = z.object({
  type: z.literal('programs'),
  programs: z.array(ChannelProgramSchema),
  schedule: TimeSlotScheduleSchema,
  materializeResult: z.boolean(),
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
    @inject(new LazyServiceIdentifier(() => KEYS.ChannelDB))
    private channelDB: IChannelDB,
    @inject(SlotSchedulerHelper)
    private slotSchedulerHelper: SlotSchedulerHelper,
  ) {}

  async schedule<
    Req extends TimeSlotScheduleServiceRequest,
    Out = Req extends { materializeResult: true }
      ? MaterializedTimeSlotScheduleResult
      : TimeSlotScheduleResult,
  >(request: Req): Promise<Out>;
  async schedule(
    request: TimeSlotScheduleServiceRequest,
  ): Promise<MaterializedTimeSlotScheduleResult | TimeSlotScheduleResult> {
    let programs: ChannelProgram[];
    if (request.type === 'channel') {
      programs = await this.getPrograms(request.channelId);
    } else {
      programs = request.programs;
    }

    const [customShowPrograms, fillerPrograms, showPrograms] =
      await Promise.all([
        this.slotSchedulerHelper.materializeCustomShowPrograms(
          request.schedule.slots,
        ),
        this.slotSchedulerHelper.materializeFillerLists(request.schedule.slots),
        this.slotSchedulerHelper.materializeShows(request.schedule.slots),
      ]);

    programs = reject(programs, (p) => p.type === 'flex')
      .concat(customShowPrograms)
      .concat(fillerPrograms)
      .concat(showPrograms);

    return scheduleTimeSlots(
      request.schedule,
      programs,
      request.seed,
      request.discardCount ?? 0,
    );
  }

  private async getPrograms(channelId: string | number) {
    if (isNumber(channelId)) {
      channelId = (await this.channelDB.getChannel(channelId, false))!.uuid;
    }
    const channelAndLineup =
      await this.channelDB.loadAndMaterializeLineup(channelId);
    if (!channelAndLineup) {
      throw new Error(`Channel ID = ${channelId} not found!`);
    }

    return channelAndLineup.programs;
  }

  static materializeProgramsFromResult(
    result: TimeSlotScheduleResult,
  ): MaterializedTimeSlotScheduleResult {
    const materializedPrograms: ChannelProgram[] = seq.collect(
      result.lineup,
      (program) => {
        switch (program.type) {
          case 'redirect':
          case 'flex':
            return program;
          case 'content':
            return program.id ? result.programs[program.id] : null;
          case 'custom':
            program.program = result.programs[program.id];
            return program as CustomProgram;
          case 'filler':
            program.program = result.programs[program.id];
            return program as FillerProgram;
        }
      },
    );

    return {
      startTime: result.startTime,
      programs: materializedPrograms,
    };
  }
}
