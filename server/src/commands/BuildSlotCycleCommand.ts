import { isNonEmptyString, seq } from '@tunarr/shared/util';
import type { CondensedChannelProgram } from '@tunarr/types';
import { inject, injectable } from 'inversify';
import { sumBy, uniq } from 'lodash-es';
import type { MarkRequired } from 'ts-essentials';
import { condensedProgramToLineupItem } from '../db/channel/lineupItemConversion.ts';
import type {
  Lineup,
  LineupConfig,
  LineupItem,
} from '../db/derived_types/Lineup.ts';
import type { IWorkerPool } from '../interfaces/IWorkerPool.ts';
import type {
  BuiltCycle,
  CycleSnapshot,
} from '../services/scheduling/slotCycles.ts';
import type { SlotCheckpoint } from '../services/scheduling/slotCheckpoints.ts';
import type {
  ChannelTimeSlotScheduleRequest,
  ProgramsTimeSlotScheduleRequest,
} from '../services/scheduling/TimeSlotSchedulerService.ts';
import { KEYS } from '../types/inject.ts';
import type { Nullable } from '../types/util.ts';

type Request = {
  channelId: string;
  lineup: LineupConfig;
  startTime: number;
  snapshot: CycleSnapshot | undefined;
  chunkMs: number;
};

type ClassicReplayRequest = {
  lineup: MarkRequired<
    Pick<Lineup, 'items' | 'schedule' | 'scheduleSeed'>,
    'schedule' | 'scheduleSeed'
  >;
  startTime: number;
};

type LineupSchedule = NonNullable<Lineup['schedule']>;

// Time and random slot requests share every field except the schedule.
type ScheduleRequest =
  | Omit<ChannelTimeSlotScheduleRequest, 'schedule'>
  | Omit<ProgramsTimeSlotScheduleRequest, 'schedule'>;

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
    chunkMs,
  }: Request): Promise<BuiltCycle> {
    const { schedule, scheduleSeed } = lineup;
    if (!schedule) {
      throw new Error(
        `Channel ${channelId} has no slot schedule to build a cycle from`,
      );
    }

    // Every cycle replays the same seeded RNG from its stored discard count.
    // Without a seed the scheduler mints fresh entropy per cycle, which makes
    // the count meaningless and a cascade unable to reproduce what aired.
    if (!scheduleSeed) {
      throw new Error(
        `Channel ${channelId} rebuilds each cycle but has no schedule seed`,
      );
    }

    return this.build(schedule, {
      type: 'channel',
      channelId,
      startTime,
      seed: scheduleSeed,
      discardCount: snapshot?.discardCount ?? 0,
      iteratorState: snapshot?.iteratorState,
      endTime: startTime + chunkMs,
      checkpoints: true,
      stableShuffle: true,
    });
  }

  /**
   * Replays the pass a classic slot channel loops, with checkpoints.
   *
   * It uses the classic build's seed and options, so it reproduces the stored
   * lineup when the library hasn't changed since. The programs come from the
   * stored lineup, because a save may already have replaced the channel's
   * program list.
   */
  async replayClassic({
    lineup,
    startTime,
  }: ClassicReplayRequest): Promise<BuiltCycle> {
    const programIds = uniq(
      seq.collect(lineup.items, (item) =>
        item.type === 'content' ? item.id : null,
      ),
    );

    return this.build(lineup.schedule, {
      type: 'programs',
      programIds,
      startTime,
      seed: lineup.scheduleSeed,
      checkpoints: true,
    });
  }

  private async build(
    schedule: LineupSchedule,
    request: ScheduleRequest,
  ): Promise<BuiltCycle> {
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
      checkpoints: shiftForDroppedItems(
        result.lineup,
        result.checkpoints ?? [],
      ),
    };
  }
}

// Checkpoint offsets count the scheduler's own output. Dropping an item
// shortens the lineup, so every checkpoint after it moves earlier by that
// item's duration.
function shiftForDroppedItems(
  lineup: readonly CondensedChannelProgram[],
  checkpoints: readonly SlotCheckpoint[],
): SlotCheckpoint[] {
  const drops: { startMs: number; durationMs: number }[] = [];
  let cursorMs = 0;
  for (const program of lineup) {
    if (channelProgramToLineupItem(program) === null) {
      drops.push({ startMs: cursorMs, durationMs: program.duration });
    }
    cursorMs += program.duration;
  }

  if (drops.length === 0) {
    return [...checkpoints];
  }

  return checkpoints.map((checkpoint) => ({
    ...checkpoint,
    offsetMs:
      checkpoint.offsetMs -
      sumBy(
        drops.filter((drop) => drop.startMs < checkpoint.offsetMs),
        (drop) => drop.durationMs,
      ),
  }));
}

function channelProgramToLineupItem(
  p: CondensedChannelProgram,
): Nullable<LineupItem> {
  if (p.type === 'content' && !isNonEmptyString(p.id)) {
    return null;
  }
  return condensedProgramToLineupItem(p);
}
