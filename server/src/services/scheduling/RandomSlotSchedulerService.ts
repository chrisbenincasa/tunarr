import { seq } from '@tunarr/shared/util';
import { ChannelProgram, CustomProgram, FillerProgram } from '@tunarr/types';
import {
  RandomSlotScheduleSchema,
  SlotScheduleResult,
  TimeSlotScheduleResult,
} from '@tunarr/types/api';
import { ChannelProgramSchema } from '@tunarr/types/schemas';
import { inject, injectable, LazyServiceIdentifier } from 'inversify';
import { isNumber, reject } from 'lodash-es';
import { z } from 'zod/v4';
import { IChannelDB } from '../../db/interfaces/IChannelDB.ts';
import { KEYS } from '../../types/inject.ts';
import { RandomSlotScheduler } from './RandomSlotsService.ts';
import { SlotSchedulerHelper } from './SlotSchedulerHelper.ts';

type MaterializedSlotScheduleResult = {
  programs: ChannelProgram[];
  startTime: number;
};

export const ChannelSlotScheduleRequest = z.object({
  type: z.literal('channel'),
  channelId: z.number().or(z.string()),
  schedule: RandomSlotScheduleSchema,
  materializeResult: z.boolean(),
  seed: z.number().array().optional(),
  discardCount: z.number().optional(),
});

export type ChannelSlotScheduleRequest = z.infer<
  typeof ChannelSlotScheduleRequest
>;

export const ProgramsSlotScheduleRequest = z.object({
  type: z.literal('programs'),
  programs: z.array(ChannelProgramSchema),
  schedule: RandomSlotScheduleSchema,
  materializeResult: z.boolean(),
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
    @inject(new LazyServiceIdentifier(() => KEYS.ChannelDB))
    private channelDB: IChannelDB,
    @inject(SlotSchedulerHelper)
    private slotSchedulerHelper: SlotSchedulerHelper,
  ) {}

  async schedule<
    Req extends SlotScheduleServiceRequest,
    Out = Req extends { materializeResult: true }
      ? MaterializedSlotScheduleResult
      : SlotScheduleResult,
  >(request: Req): Promise<Out>;
  async schedule(
    request: SlotScheduleServiceRequest,
  ): Promise<MaterializedSlotScheduleResult | TimeSlotScheduleResult> {
    let programs: ChannelProgram[];
    if (request.type === 'channel') {
      programs = await this.getPrograms(request.channelId);
    } else {
      programs = request.programs;
    }

    const [customShowPrograms, fillerPrograms] = await Promise.all([
      this.slotSchedulerHelper.materializeCustomShowPrograms(
        request.schedule.slots,
      ),
      this.slotSchedulerHelper.materializeFillerLists(request.schedule.slots),
    ]);

    programs = reject(programs, (p) => p.type === 'flex')
      .concat(customShowPrograms)
      .concat(fillerPrograms);

    return new RandomSlotScheduler(request.schedule).generateSchedule(
      programs,
      request.seed,
      request.discardCount,
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
    result: SlotScheduleResult,
  ): MaterializedSlotScheduleResult {
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
