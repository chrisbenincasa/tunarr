import {
  chunk,
  differenceWith,
  filter,
  forEach,
  isUndefined,
  keys,
  map,
  once,
  uniqBy,
} from 'lodash-es';
import { ChannelDB } from '../dao/channelDb';
import { getEm } from '../dao/dataSource';
import { isContentItem } from '../dao/derived_types/Lineup';
import { Program } from '../dao/entities/Program';
import { flatMapAsyncSeq, isNonEmptyString } from '../util';
import { Task } from './Task';
import createLogger from '../logger';

// This task is fired off whenever programs are updated. It goes through
// all channel lineups that contain the program and ensure that their
// lineup JSON files have the correct durations for the program.
// Program durations can change when the underlying file in a media server has
// changed, ex. replacing a movie with an extended edition (or sometimes a)
// different versions varies in length by a few seconds).
export class ReconcileProgramDurationsTask extends Task {
  static ID = ReconcileProgramDurationsTask.name;
  ID = ReconcileProgramDurationsTask.ID;
  taskName = ReconcileProgramDurationsTask.name;

  // Optionally provide the channel ID that was updated on the triggering
  // operation, since theoretically we don't have to check it.
  constructor(private channelId?: string) {
    super();
  }

  private get logger() {
    return this.makeLogger();
  }

  private makeLogger = once(() => createLogger(import.meta));

  protected async runInternal(): Promise<unknown> {
    const em = getEm();
    // TODO put this in the constructor
    const channelDB = new ChannelDB();

    // Programs previously loaded from the DB, keyed by ID, value
    // is the source-of-truth duration.
    const cachedPrograms: Record<string, number> = {};

    for (const channel of await channelDB.getAllChannels()) {
      if (isNonEmptyString(this.channelId) && channel.uuid === this.channelId) {
        continue;
      }

      const lineup = await channelDB.loadLineup(channel.uuid);
      const uniqueProgramIds = uniqBy(
        filter(lineup.items, isContentItem),
        (item) => item.id,
      );
      const missingKeys = differenceWith(
        uniqueProgramIds,
        keys(cachedPrograms),
        (item, id) => item.id === id,
      );

      const missingPrograms = await flatMapAsyncSeq(
        chunk(missingKeys, 25),
        async (items) => {
          return await em.repo(Program).find({
            uuid: {
              $in: map(items, 'id'),
            },
          });
        },
      );

      forEach(missingPrograms, (program) => {
        cachedPrograms[program.uuid] = program.duration;
      });

      let changed = false;
      const newLineupItems = map(lineup.items, (item) => {
        if (isContentItem(item)) {
          const dbItemDuration = cachedPrograms[item.id];
          if (
            !isUndefined(dbItemDuration) &&
            dbItemDuration !== item.durationMs
          ) {
            console.debug('Found duration mismatch: %s', item.id);
            changed = true;
            return {
              ...item,
              durationMs: dbItemDuration,
            };
          }

          return item;
        } else {
          return item;
        }
      });

      if (changed) {
        this.logger.debug(
          'Channel %s had a program duration discrepancy, updating lineup!',
          channel.uuid,
        );
        await channelDB.saveLineup(channel.uuid, {
          ...lineup,
          items: newLineupItems,
        });
      }
    }

    return;
  }
}
