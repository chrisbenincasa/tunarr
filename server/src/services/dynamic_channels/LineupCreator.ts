import { isUndefined } from 'lodash-es';
import { ChannelDB } from '../../dao/channelDb.js';

export class LineupCreator {
  private channelDB = new ChannelDB();

  // Right now this is very basic -- we just set the pending items
  // to be he lineup items. Eventually, this will apply lineup
  // scheduling rules.
  async resolveLineup(channelId: string) {
    const lineup = await this.channelDB.loadLineup(channelId);
    console.log(lineup.items.length, lineup.pendingPrograms?.length);
    if (
      !isUndefined(lineup.pendingPrograms) &&
      lineup.pendingPrograms.length > 0
    ) {
      await this.channelDB.setChannelPrograms(
        channelId,
        lineup.pendingPrograms,
      );
      await this.channelDB.saveLineup(channelId, {
        ...lineup,
        items: lineup.pendingPrograms,
        pendingPrograms: [],
      });
    }
  }
}
