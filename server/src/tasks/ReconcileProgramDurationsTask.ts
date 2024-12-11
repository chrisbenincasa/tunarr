import { ChannelDB } from '@/db/ChannelDB.ts';
import { isContentItem } from '@/db/derived_types/Lineup.ts';
import { DB } from '@/db/schema/db.ts';
import { Nullable } from '@/types/util.ts';
import { flatMapAsyncSeq, isNonEmptyString } from '@/util/index.ts';
import { Kysely } from 'kysely';
import {
  chunk,
  differenceWith,
  filter,
  forEach,
  isUndefined,
  keys,
  map,
  uniqBy,
} from 'lodash-es';
import { Task } from './Task.ts';

// This task is fired off whenever programs are updated. It goes through
// all channel lineups that contain the program and ensure that their
// lineup JSON files have the correct durations for the program.
// Program durations can change when the underlying file in a media server has
// changed, ex. replacing a movie with an extended edition (or sometimes a)
// different versions varies in length by a few seconds).
export class ReconcileProgramDurationsTask extends Task {
  static ID = ReconcileProgramDurationsTask.name;

  ID = ReconcileProgramDurationsTask.ID;

  // Optionally provide the channel ID that was updated on the triggering
  // operation, since theoretically we don't have to check it.
  constructor(
    private db: Kysely<DB>,
    private channelId: Nullable<string>,
    private channelDB: ChannelDB,
  ) {
    super();
    this.logger.setBindings({ task: this.ID });
  }

  protected async runInternal(): Promise<unknown> {
    // Programs previously loaded from the DB, keyed by ID, value
    // is the source-of-truth duration.
    const cachedPrograms: Record<string, number> = {};

    for (const channel of await this.channelDB.getAllChannels()) {
      if (isNonEmptyString(this.channelId) && channel.uuid === this.channelId) {
        continue;
      }

      const lineup = await this.channelDB.loadLineup(channel.uuid);
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
        chunk(missingKeys, 200),
        (items) =>
          this.db
            .selectFrom('program')
            .select(['uuid', 'duration'])
            .where('uuid', 'in', map(items, 'id'))
            .execute(),
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
            this.logger.debug('Found duration mismatch: %s', item.id);
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
        await this.channelDB.saveLineup(channel.uuid, {
          ...lineup,
          items: newLineupItems,
        });
      }
    }

    return;
  }
}
