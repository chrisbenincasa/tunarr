import { compact, isNull, isUndefined, map, reject, values } from 'lodash-es';
import { ChannelAndLineup, ChannelDB } from '../../dao/channelDb.js';
import { asyncPool } from '../../util/asyncPool.js';
import { Lineup } from '../../dao/derived_types/Lineup.js';
import { SchedulingOperation } from '@tunarr/types/api';
import { asyncFlow, intersperse } from '../../util/index.js';
import { SchedulingOperatorFactory } from './SchedulingOperatorFactory.js';
import { IntermediateOperator } from './IntermediateOperator.js';

export class LineupCreator {
  private channelDB = new ChannelDB();

  // Right now this is very basic -- we just set the pending items
  // to be he lineup items. Eventually, this will apply lineup
  // scheduling rules.
  async resolveLineup(channelId: string) {
    const lineup = await this.channelDB.loadLineup(channelId);
    return await this.resolveLineupInternal(channelId, lineup);
  }

  // Moves all pending lineups across all channels, applies scheduling rules,
  // and generates a new lineup
  async promoteAllPendingLineups() {
    const pool = asyncPool(
      values(await this.channelDB.loadAllLineups()),
      async ({ channel, lineup }) => {
        console.log('here ya bithc');
        return await this.resolveLineupInternal(channel.uuid, lineup);
      },
      2,
    );

    for await (const result of pool) {
      if (result.type === 'error') {
        console.error(
          'Error while promoting lineup for channel: ' +
            result.input.channel.uuid,
          result.error,
        );
      }
    }
  }

  private async resolveLineupInternal(channelId: string, lineup: Lineup) {
    console.log(
      'Channel ID ' + channelId + ' lineup items ',
      lineup.items.length,
      lineup.pendingPrograms?.length,
    );
    if (
      !isUndefined(lineup.pendingPrograms) &&
      lineup.pendingPrograms.length > 0
    ) {
      console.log('Resolving lineup for channel ' + channelId);
      const channelAndLineup =
        await this.channelDB.loadChannelAndLineup(channelId);
      if (isNull(channelAndLineup)) {
        console.warn('Could not load channel and lineup ID = ' + channelId);
        return;
      }

      const { channel: updatedChannel, lineup: updatedLineup } =
        await this.applySchedulingOperations(channelAndLineup);

      // We're only going to allow operations to alter the channel start
      // time for now...
      await this.channelDB.setChannelPrograms(
        updatedChannel,
        updatedLineup.items,
      );
      await this.channelDB.saveLineup(channelId, {
        ...lineup,
        items: updatedLineup.items,
        pendingPrograms: [],
      });
    }
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

    const operators = intersperse(
      compact(map(dedupedOps, (op) => SchedulingOperatorFactory.create(op))),
      IntermediateOperator,
    );

    return (channelAndLineup) => asyncFlow(operators, channelAndLineup);
  }
}
