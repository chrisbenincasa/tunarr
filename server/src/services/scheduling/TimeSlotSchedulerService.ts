import { seq } from '@tunarr/shared/util';
import { ChannelProgram, CustomProgram, FillerProgram } from '@tunarr/types';
import {
  TimeSlot,
  TimeSlotScheduleResult,
  TimeSlotScheduleSchema,
} from '@tunarr/types/api';
import { ChannelProgramSchema } from '@tunarr/types/schemas';
import { inject, injectable, LazyServiceIdentifier } from 'inversify';
import { difference, flatten, isNumber, reduce, reject } from 'lodash-es';
import { z } from 'zod/v4';
import { CustomShowDB } from '../../db/CustomShowDB.ts';
import { FillerDB } from '../../db/FillerListDB.ts';
import { IChannelDB } from '../../db/interfaces/IChannelDB.ts';
import { KEYS } from '../../types/inject.ts';
import { uniqProperties } from '../../util/seq.ts';
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
});

export type ChannelTimeSlotScheduleRequest = z.infer<
  typeof ChannelTimeSlotScheduleRequest
>;

export const ProgramsTimeSlotScheduleRequest = z.object({
  type: z.literal('programs'),
  programs: z.array(ChannelProgramSchema),
  schedule: TimeSlotScheduleSchema,
  materializeResult: z.boolean(),
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
    @inject(CustomShowDB) private customShowDB: CustomShowDB,
    @inject(FillerDB) private fillerDB: FillerDB,
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

    const [missingCustomShowPrograms, missingFillerPrograms] =
      await Promise.all([
        this.getMissingCustomShowPrograms(programs, request.schedule.slots),
        this.getMissingFillerListPrograms(programs, request.schedule.slots),
      ]);

    programs = reject(programs, (p) => p.type === 'flex')
      .concat(missingCustomShowPrograms)
      .concat(missingFillerPrograms);

    return scheduleTimeSlots(request.schedule, programs);
  }

  private async getMissingCustomShowPrograms(
    programs: ChannelProgram[],
    slots: TimeSlot[],
  ) {
    const customShowIds = uniqProperties(
      programs.filter((program) => program.type === 'custom'),
      (p) => p.customShowId,
    );

    // Here's the big one - find shows that are included in the schedule but
    // not currently saved to the channel.
    const slottedCustomShows = reduce(
      slots,
      (acc, curr) => {
        if (curr.type === 'custom-show') {
          acc.add(curr.customShowId);
        }
        return acc;
      },
      new Set<string>(),
    );

    const missingShows = difference([...slottedCustomShows], customShowIds);

    // Query
    return flatten(
      await Promise.all(
        missingShows.map((show) => this.customShowDB.getShowPrograms(show)),
      ),
    );
  }

  private async getMissingFillerListPrograms(
    programs: ChannelProgram[],
    slots: TimeSlot[],
  ) {
    const fillerListIds = uniqProperties(
      programs.filter((program) => program.type === 'filler'),
      (p) => p.fillerListId,
    );

    // Here's the big one - find shows that are included in the schedule but
    // not currently saved to the channel.
    const slotFiller = slots.flatMap((slot) => {
      switch (slot.type) {
        case 'filler':
        case 'flex':
        case 'redirect':
          return [];
        case 'movie':
        case 'show':
        case 'custom-show':
          return slot.filler?.map(({ fillerListId }) => fillerListId) ?? [];
      }
    });

    const slottedFillerLists = reduce(
      slots,
      (acc, curr) => {
        if (curr.type === 'filler') {
          acc.add(curr.fillerListId);
        }
        return acc;
      },
      new Set<string>(),
    );

    slotFiller.forEach((id) => slottedFillerLists.add(id));

    const missing = difference([...slottedFillerLists], fillerListIds);

    // Query
    return flatten(
      await Promise.all(
        missing.map((list) =>
          this.fillerDB.getFillerPrograms(list).then((programs) => {
            // Actually make these filler programs -- this is a hack
            return programs.map(
              (program) =>
                ({
                  type: 'filler',
                  duration: program.duration,
                  fillerListId: list,
                  id: program.id,
                  persisted: true,
                  program,
                }) satisfies FillerProgram,
            );
          }),
        ),
      ),
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
