import { isUndefined, map, values } from 'lodash-es';
import { ChannelDB } from '../../dao/channelDb.js';
import { asyncPool } from '../../util/asyncPool.js';
import { Lineup, LineupItem } from '../../dao/derived_types/Lineup.js';
import { SchedulingOperation } from '@tunarr/types/api';
import { PadProgramsSchedulingOperator } from './SchedulingOperator.js';
import { asyncFlow } from '../../util/index.js';

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
      const newItems = await this.applySchedulingOperations(lineup);

      await this.channelDB.setChannelPrograms(channelId, newItems);
      await this.channelDB.saveLineup(channelId, {
        ...lineup,
        items: newItems,
        pendingPrograms: [],
      });
    }
  }

  private async applySchedulingOperations(lineup: Lineup) {
    return await this.createScheduleOperationPipeline(
      lineup.schedulingOperations ?? [],
    )([...lineup.items]);
  }

  // This doesn't really do much yet, but eventually it'll
  // properly, 'topologically' sort operations and return a
  // function
  private createScheduleOperationPipeline(
    ops: SchedulingOperation[],
  ): (lineup: readonly LineupItem[]) => Promise<LineupItem[]> {
    const operators = map(ops, (op) => {
      switch (op.id) {
        case 'add_padding':
          return new PadProgramsSchedulingOperator(op);
      }
    });

    return (lineup) => asyncFlow(operators, lineup);
  }
}
