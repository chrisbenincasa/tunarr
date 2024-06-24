import { SchedulingOperation } from '@tunarr/types/api';
import { compact, isNull, isUndefined, map, reject, sortBy } from 'lodash-es';
import { ChannelAndLineup, ChannelDB } from '../../dao/channelDb.js';
import { Lineup } from '../../dao/derived_types/Lineup.js';
import { asyncPool } from '../../util/asyncPool.js';
import { asyncFlow, intersperse, isDefined } from '../../util/index.js';
import { CollapseOfflineTimeOperator } from './CollapseOfflineTimeOperator.js';
import { IntermediateOperator } from './IntermediateOperator.js';
import { SchedulingOperatorFactory } from './SchedulingOperatorFactory.js';
import { LoggerFactory } from '../../util/logging/LoggerFactory.js';
import { Func } from '../../types/func.js';

const OperatorToWeight: Record<SchedulingOperation['type'], number> = {
  ordering: 0,
  modifier: 10,
} as const;

export class LineupCreator {
  #logger = LoggerFactory.child({ className: LineupCreator.name });
  private channelDB = new ChannelDB();

  // Right now this is very basic -- we just set the pending items
  // to be he lineup items. Eventually, this will apply lineup
  // scheduling rules.
  async resolveLineup(channelId: string) {
    const lineup = await this.channelDB.loadLineup(channelId);
    return await this.resolveLineupInternal(channelId, lineup);
  }

  async promoteLineup(channelId: string) {
    const lineup = await this.channelDB.loadLineup(channelId);
    const maybeUpdatedLineup = await this.resolveLineupInternal(
      channelId,
      lineup,
    );
    if (isDefined(maybeUpdatedLineup)) {
      const { channel: updatedChannel, lineup: updatedLineup } =
        maybeUpdatedLineup;
      // We're only going to allow operations to alter the channel start
      // time for now...

      await this.channelDB.setChannelPrograms(
        updatedChannel,
        updatedLineup.items,
      );

      await this.channelDB.updateChannelStartTime(
        channelId,
        updatedChannel.startTime,
      );

      await this.channelDB.saveLineup(channelId, {
        ...lineup,
        items: updatedLineup.items,
        startTimeOffsets: updatedLineup.startTimeOffsets,
        pendingPrograms: [],
      });
    }
  }

  // Moves all pending lineups across all channels, applies scheduling rules,
  // and generates a new lineup
  async promoteAllPendingLineups() {
    const pool = asyncPool(
      map(await this.channelDB.getAllChannels(), 'uuid'),
      (channel) => this.promoteLineup(channel),
      { concurrency: 2 },
    );

    for await (const result of pool) {
      if (result.type === 'error') {
        this.#logger.error(
          result.error,
          'Error while promoting lineup for channel: %s',
          result.input,
        );
      }
    }
  }

  private async resolveLineupInternal(channelId: string, lineup: Lineup) {
    if (
      !isUndefined(lineup.pendingPrograms) &&
      lineup.pendingPrograms.length > 0
    ) {
      const channelAndLineup =
        await this.channelDB.loadChannelAndLineup(channelId);
      if (isNull(channelAndLineup)) {
        this.#logger.warn(
          'Could not load channel and lineup ID = %s',
          channelId,
        );
        return;
      }

      return await this.applySchedulingOperations(channelAndLineup);
    }

    return;
  }

  private async applySchedulingOperations(channelAndLineup: ChannelAndLineup) {
    return await this.createScheduleOperationPipeline(
      channelAndLineup.lineup.schedulingOperations ?? [],
    )(channelAndLineup);
  }

  // This doesn't really do much yet, but eventually it'll
  // properly, 'topologically' sort operations and return a
  // function
  private createScheduleOperationPipeline(
    ops: SchedulingOperation[],
  ): (channelAndLineup: ChannelAndLineup) => Promise<ChannelAndLineup> {
    const seenIds = new Set<string>();
    const dedupedOps = reject(ops, (op) => {
      if (op.allowMultiple) {
        return false;
      }

      if (seenIds.has(op.id)) {
        return true;
      }

      seenIds.add(op.id);
      return false;
    });

    const operations = compact(
      map(
        sortBy(dedupedOps, (op) => OperatorToWeight[op.type]),
        (op) => SchedulingOperatorFactory.create(op),
      ),
    );

    const pipeline = intersperse<
      Func<ChannelAndLineup, Promise<ChannelAndLineup>>
    >(
      operations,
      // TODO: We may only need to collapse offline time once right before the
      // the last intermediate operator
      [CollapseOfflineTimeOperator, IntermediateOperator],
      true,
    );

    console.log(pipeline);

    return ({ channel, lineup }) =>
      asyncFlow(pipeline, {
        channel,
        lineup: { ...lineup, items: lineup.pendingPrograms ?? [] },
      });
  }
}
