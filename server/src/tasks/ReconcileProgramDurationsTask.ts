import type { Lineup, LineupItem } from '@/db/derived_types/Lineup.js';
import { isContentItem } from '@/db/derived_types/Lineup.js';
import { type IChannelDB } from '@/db/interfaces/IChannelDB.js';
import {
  rebaseChannelStartTime,
  reconcileLineupDurations,
  remapLineupPosition,
} from '@/db/lineupDurationReconciler.js';
import { calculateStartTimeOffsets } from '@/db/lineupUtil.js';
import { GlobalScheduler } from '@/services/Scheduler.js';
import { OnDemandChannelService } from '@/services/OnDemandChannelService.js';
import { KEYS } from '@/types/inject.js';
import { isNonEmptyString } from '@/util/index.js';
import { InjectLogger } from '@/util/inject.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import { flushEventLoop } from '@tunarr/shared/util';
import type { Tag } from '@tunarr/types';
import { Mutex } from 'async-mutex';
import dayjs from 'dayjs';
import { inject, injectable } from 'inversify';
import type { Kysely } from 'kysely';
import { chunk, sumBy, uniq } from 'lodash-es';
import z from 'zod';
import type { ChannelOrm } from '../db/schema/Channel.ts';
import type { DB } from '../db/schema/db.ts';
import type { TaskMetadata } from './Task.ts';
import { Task2 } from './Task.ts';
import { taskDef } from './TaskRegistry.ts';

export type ReconcileProgramDurationsTaskRequest = z.infer<
  typeof ReconcileProgramDurationsTaskRequest
>;

export const ReconcileProgramDurationsTaskRequest = z
  .discriminatedUnion('type', [
    z.object({
      type: z.literal('channel'),
      channelId: z.string().optional(),
    }),
    z.object({
      type: z.literal('program'),
      programId: z.string().optional(),
    }),
  ])
  .optional();

type ChannelTiming = {
  startTime: number;
  duration: number;
};

// Copies program durations from the program table into channel lineups.
// Durations change when a media server's file changes, for example when a
// movie is replaced with an extended edition. Streaming schedules from the
// lineup copy, so a stale copy leaves dead air or cuts programs short.
//
// Runs after every library scan. It keeps each channel on the same program
// and position while the durations change.
@injectable()
@taskDef({
  schema: ReconcileProgramDurationsTaskRequest,
  hidden: true,
})
export class ReconcileProgramDurationsTask extends Task2<
  typeof ReconcileProgramDurationsTaskRequest
> {
  static KEY = Symbol.for(ReconcileProgramDurationsTask.name);
  static ID = ReconcileProgramDurationsTask.name;

  // Scans can finish back to back. Runs are serialized so two of them never
  // rebase the same channel from the same stale start time.
  private static runLock = new Mutex();

  schema = ReconcileProgramDurationsTaskRequest;

  public ID = ReconcileProgramDurationsTask.ID as Tag<
    typeof ReconcileProgramDurationsTask.name,
    TaskMetadata
  >;

  @InjectLogger() declare protected readonly logger: Logger;

  constructor(
    @inject(KEYS.ChannelDB) private channelDB: IChannelDB,
    @inject(KEYS.Database) private db: Kysely<DB>,
    @inject(OnDemandChannelService)
    private onDemandService: OnDemandChannelService,
  ) {
    super();
    this.logger.setBindings({ task: this.ID });
  }

  protected async runInternal(
    request?: ReconcileProgramDurationsTaskRequest,
  ): Promise<void> {
    await ReconcileProgramDurationsTask.runLock.runExclusive(() =>
      this.reconcileChannels(request),
    );
  }

  private async reconcileChannels(
    request?: ReconcileProgramDurationsTaskRequest,
  ) {
    const programId = this.programId(request);
    const channelId = this.channelId(request);

    let channels: ChannelOrm[];
    if (programId) {
      channels = await this.channelDB.findChannelsForProgramId(programId);
    } else {
      channels = await this.channelDB.getAllChannels();
    }

    // Program durations shared across channels, keyed by program ID.
    const programDurations = new Map<string, number>();

    for (const channel of channels) {
      if (channelId && channel.uuid !== channelId) {
        continue;
      }

      await flushEventLoop();

      try {
        await this.reconcileChannel(channel.uuid, programDurations);
      } catch (e) {
        this.logger.error(
          e,
          'Failed to reconcile program durations for channel %s',
          channel.uuid,
        );
      }
    }
  }

  private async reconcileChannel(
    channelId: string,
    programDurations: Map<string, number>,
  ) {
    const lineup = await this.channelDB.loadLineup(channelId);
    await this.loadProgramDurations(lineup.items, programDurations);

    // Re-read under the on-demand lock so a pause or resume can't interleave
    // with the position rebase below.
    await this.onDemandService.runWithChannelLock(channelId, async () => {
      const channelAndLineup =
        await this.channelDB.loadChannelAndLineup(channelId);
      if (!channelAndLineup) {
        return;
      }

      const { channel, lineup } = channelAndLineup;
      const reconciliation = reconcileLineupDurations(
        lineup.items,
        programDurations,
      );
      if (reconciliation.changedItemCount === 0) {
        return;
      }

      const now = dayjs().valueOf();
      const oldPosition = currentPosition(channel, lineup, now);
      const newCycle = sumBy(reconciliation.items, (item) => item.durationMs);

      await this.channelDB.saveLineup(channelId, {
        ...lineup,
        items: reconciliation.items,
        startTimeOffsets: calculateStartTimeOffsets(reconciliation.items),
      });

      if (oldPosition !== undefined && newCycle > 0) {
        const newPosition = remapLineupPosition(
          lineup.items,
          reconciliation,
          oldPosition,
        );

        if (lineup.onDemandConfig) {
          // A resume time older than the lineup's lastUpdated makes the next
          // pause restart the channel, so it is stamped after the save.
          await this.channelDB.updateLineupConfig(channelId, 'onDemandConfig', {
            ...lineup.onDemandConfig,
            cursor: newPosition,
            lastResumed:
              lineup.onDemandConfig.state === 'playing'
                ? dayjs().valueOf()
                : lineup.onDemandConfig.lastResumed,
          });
        } else {
          await this.channelDB.updateChannelStartTime(
            channelId,
            rebaseChannelStartTime(
              channel.startTime,
              newCycle,
              now,
              newPosition,
            ),
          );
        }
      }

      this.logger.info(
        'Corrected %d stale program durations in channel %s (cycle %d ms -> %d ms)',
        reconciliation.changedItemCount,
        channelId,
        channel.duration,
        newCycle,
      );

      GlobalScheduler.scheduleOneOffTask(
        KEYS.UpdateXmlTvTaskFactory,
        dayjs().add(1, 'second'),
        { channelId },
      );
    });
  }

  private async loadProgramDurations(
    items: ReadonlyArray<LineupItem>,
    programDurations: Map<string, number>,
  ) {
    const missingIds = uniq(
      items
        .filter(isContentItem)
        .map((item) => item.id)
        .filter((id) => !programDurations.has(id)),
    );

    for (const idChunk of chunk(missingIds, 200)) {
      await flushEventLoop();
      const programs = await this.db
        .selectFrom('program')
        .select(['uuid', 'duration'])
        .where('uuid', 'in', idChunk)
        .execute();
      for (const program of programs) {
        programDurations.set(program.uuid, program.duration);
      }
    }
  }

  private channelId(request?: ReconcileProgramDurationsTaskRequest) {
    if (request?.type === 'channel' && isNonEmptyString(request.channelId)) {
      return request.channelId;
    }
    return null;
  }

  private programId(request?: ReconcileProgramDurationsTaskRequest) {
    if (request?.type === 'program' && isNonEmptyString(request.programId)) {
      return request.programId;
    }
    return null;
  }
}

// Position within the lineup cycle at `now`, computed the same way streaming
// computes it. Undefined when the channel has no position yet.
function currentPosition(
  channel: ChannelTiming,
  lineup: Lineup,
  now: number,
): number | undefined {
  if (channel.duration <= 0) {
    return;
  }

  const onDemand = lineup.onDemandConfig;
  if (onDemand) {
    const sinceResume =
      onDemand.state === 'playing' && onDemand.lastResumed !== undefined
        ? Math.max(0, now - onDemand.lastResumed)
        : 0;
    return (onDemand.cursor + sinceResume) % channel.duration;
  }

  if (now < channel.startTime) {
    return;
  }
  return (now - channel.startTime) % channel.duration;
}
