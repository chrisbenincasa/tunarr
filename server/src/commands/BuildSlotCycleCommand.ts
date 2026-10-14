import { isNonEmptyString, seq } from '@tunarr/shared/util';
import type { CondensedChannelProgram } from '@tunarr/types';
import { inject, injectable } from 'inversify';
import { sumBy } from 'lodash-es';
import { condensedProgramToLineupItem } from '../db/channel/lineupItemConversion.ts';
import type { LineupConfig, LineupItem } from '../db/derived_types/Lineup.ts';
import type { IWorkerPool } from '../interfaces/IWorkerPool.ts';
import type {
  BuiltCycle,
  CycleSnapshot,
} from '../services/scheduling/slotCycles.ts';
import { cycleEndTime } from '../services/scheduling/slotCycles.ts';
import { KEYS } from '../types/inject.ts';
import type { Nullable } from '../types/util.ts';

type Request = {
  channelId: string;
  lineup: LineupConfig;
  startTime: number;
  snapshot: CycleSnapshot | undefined;
};

/**
 * Builds one cycle of a slot schedule and hands back its items and end state.
 *
 * It writes nothing. SlotCycleBoundaryService decides what to keep and
 * persists it in one go, under the channel's lineup lock.
 */
@injectable()
export class BuildSlotCycleCommand {
  constructor(
    @inject(KEYS.WorkerPoolFactory)
    private workerPoolProvider: () => IWorkerPool,
  ) {}

  async execute({
    channelId,
    lineup,
    startTime,
    snapshot,
  }: Request): Promise<BuiltCycle> {
    const { schedule, scheduleSeed } = lineup;
    if (!schedule) {
      throw new Error(
        `Channel ${channelId} has no slot schedule to build a cycle from`,
      );
    }

    const request = {
      type: 'channel' as const,
      channelId,
      startTime,
      seed: scheduleSeed,
      discardCount: snapshot?.discardCount ?? 0,
      iteratorState: snapshot?.iteratorState,
      endTime: cycleEndTime(schedule, startTime),
    };

    const { result } =
      schedule.type === 'time'
        ? await this.workerPoolProvider().queueTask({
            type: 'time-slots',
            request: { ...request, schedule },
          })
        : await this.workerPoolProvider().queueTask({
            type: 'schedule-slots',
            request: { ...request, schedule },
          });

    const items = seq.collect(result.lineup, channelProgramToLineupItem);

    return {
      items,
      durationMs: sumBy(items, (item) => item.durationMs),
      endSnapshot: {
        discardCount: result.discardCount,
        iteratorState: result.iteratorState,
      },
    };
  }
}

function channelProgramToLineupItem(
  p: CondensedChannelProgram,
): Nullable<LineupItem> {
  if (p.type === 'content' && !isNonEmptyString(p.id)) {
    return null;
  }
  return condensedProgramToLineupItem(p);
}
