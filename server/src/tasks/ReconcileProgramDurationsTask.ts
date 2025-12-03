import { isContentItem } from '@/db/derived_types/Lineup.js';
import { type IChannelDB } from '@/db/interfaces/IChannelDB.js';
import { KEYS } from '@/types/inject.js';
import { isNonEmptyString } from '@/util/index.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import { flushEventLoop } from '@tunarr/shared/util';
import { Tag } from '@tunarr/types';
import { inject, injectable } from 'inversify';
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
import { ChannelOrm } from '../db/schema/Channel.ts';
import { DB } from '../db/schema/db.ts';
import { Task, TaskMetadata } from './Task.ts';

export type ReconcileProgramDurationsTaskRequest =
  | {
      type: 'channel';
      channelId?: string;
    }
  | {
      type: 'program';
      programId?: string;
    };

// This task is fired off whenever programs are updated. It goes through
// all channel lineups that contain the program and ensure that their
// lineup JSON files have the correct durations for the program.
// Program durations can change when the underlying file in a media server has
// changed, ex. replacing a movie with an extended edition (or sometimes a)
// different versions varies in length by a few seconds).
@injectable()
export class ReconcileProgramDurationsTask extends Task {
  static KEY = Symbol.for(ReconcileProgramDurationsTask.name);
  static ID = ReconcileProgramDurationsTask.name;

  public ID = ReconcileProgramDurationsTask.ID as Tag<
    typeof ReconcileProgramDurationsTask.name,
    TaskMetadata
  >;

  // Optionally provide the channel ID that was updated on the triggering
  // operation, since theoretically we don't have to check it.
  constructor(
    @inject(KEYS.ChannelDB) private channelDB: IChannelDB,
    @inject(KEYS.Logger) logger: Logger,
    @inject(KEYS.Database) private db: Kysely<DB>,
    private request?: ReconcileProgramDurationsTaskRequest,
  ) {
    super(logger);
    this.logger.setBindings({ task: this.ID });
  }

  protected async runInternal(): Promise<unknown> {
    // Programs previously loaded from the DB, keyed by ID, value
    // is the source-of-truth duration.
    const cachedPrograms: Record<string, number> = {};

    let channels: ChannelOrm[];
    if (this.programId) {
      channels = await this.channelDB.findChannelsForProgramId(this.programId);
    } else {
      channels = await this.channelDB.getAllChannels();
    }

    for (const channel of channels) {
      if (this.channelId && channel.uuid !== this.channelId) {
        continue;
      }

      await flushEventLoop();

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

      const missingPrograms: { uuid: string; duration: number }[] = [];
      for (const keyChunk of chunk(missingKeys, 200)) {
        await flushEventLoop();
        const result = await this.db
          .selectFrom('program')
          .select(['uuid', 'duration'])
          .where('uuid', 'in', map(keyChunk, 'id'))
          .execute();
        missingPrograms.push(...result);
        forEach(result, (program) => {
          cachedPrograms[program.uuid] = program.duration;
        });
      }

      let changed = false;
      const newLineupItems = map(lineup.items, (item) => {
        if (isContentItem(item) && item.fillerType !== 'fallback') {
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

  private get channelId() {
    if (
      this.request?.type === 'channel' &&
      isNonEmptyString(this.request.channelId)
    ) {
      return this.request.channelId;
    }
    return null;
  }

  private get programId() {
    if (
      this.request?.type === 'program' &&
      isNonEmptyString(this.request.programId)
    ) {
      return this.request.programId;
    }
    return null;
  }
}
