import type { IProgramDB } from '@/db/interfaces/IProgramDB.js';
import { FileSystemService } from '@/services/FileSystemService.js';
import { KEYS } from '@/types/inject.js';
import { jsonSchema } from '@/types/schemas.js';
import { Nullable } from '@/types/util.js';
import { Timer } from '@/util/Timer.js';
import { asyncPool } from '@/util/asyncPool.js';
import dayjs from '@/util/dayjs.js';
import { fileExists } from '@/util/fsUtil.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { MutexMap } from '@/util/mutexMap.js';
import { seq } from '@tunarr/shared/util';
import {
  ChannelProgram,
  ChannelProgramming,
  CondensedChannelProgram,
  CondensedChannelProgramming,
  ContentProgram,
} from '@tunarr/types';
import { UpdateChannelProgrammingRequest } from '@tunarr/types/api';
import { inject, injectable, interfaces } from 'inversify';
import { Kysely } from 'kysely';
import {
  drop,
  entries,
  filter,
  forEach,
  groupBy,
  isEmpty,
  isNil,
  isString,
  isUndefined,
  map,
  mapValues,
  nth,
  omitBy,
  partition,
  omit,
  reject,
  sum,
  sumBy,
  take,
  uniq,
  uniqBy,
} from 'lodash-es';
import { Low } from 'lowdb';
import fs from 'node:fs/promises';
import { join } from 'node:path';
import { MarkRequired } from 'ts-essentials';
import { match } from 'ts-pattern';
import { MaterializeLineupCommand } from '../../commands/MaterializeLineupCommand.ts';
import { ProgramConverter } from '../converters/ProgramConverter.ts';
import {
  ContentItem,
  CurrentLineupSchemaVersion,
  isContentItem,
  isOfflineItem,
  isRedirectItem,
  Lineup,
  LineupItem,
  LineupSchema,
  PendingProgram,
} from '../derived_types/Lineup.ts';
import { IWorkerPool } from '../../interfaces/IWorkerPool.ts';
import {
  ChannelAndLineup,
  ChannelAndRawLineup,
  UpdateChannelLineupRequest,
} from '../interfaces/IChannelDB.ts';
import { SchemaBackedDbAdapter } from '../json/SchemaBackedJsonDBAdapter.ts';
import { calculateStartTimeOffsets } from '../lineupUtil.ts';
import {
  AllProgramGroupingFields,
  withPrograms,
  withTrackAlbum,
  withTrackArtist,
  withTvSeason,
  withTvShow,
} from '../programQueryHelpers.ts';
import {
  Channel,
  ChannelOrm,
} from '../schema/Channel.ts';
import { NewChannelProgram } from '../schema/ChannelPrograms.ts';
import { DB } from '../schema/db.ts';
import { DrizzleDBAccess } from '../schema/index.ts';
import {
  ChannelOrmWithPrograms,
  ChannelWithPrograms,
} from '../schema/derivedTypes.ts';
import {
  asyncMapToRecord,
  groupByFunc,
  groupByUniqProp,
  isDefined,
  isNonEmptyString,
  mapReduceAsyncSeq,
  programExternalIdString,
  run,
} from '../../util/index.ts';
import { typedProperty } from '@/types/path.js';
import { globalOptions } from '@/globals.js';
import { eq } from 'drizzle-orm';
import { chunk } from 'lodash-es';

// Module-level cache shared within this module
const fileDbCache: Record<string | number, Low<Lineup>> = {};
const fileDbLocks = new MutexMap();

const SqliteMaxDepthLimit = 1000;

type ProgramRelationOperation = { operation: 'add' | 'remove'; id: string };

function channelProgramToLineupItemFunc(
  dbIdByUniqueId: Record<string, string>,
): (p: ChannelProgram) => LineupItem {
  return (p) =>
    match(p)
      .returnType<LineupItem>()
      .with({ type: 'content' }, (program) => ({
        type: 'content',
        id: program.persisted ? program.id! : dbIdByUniqueId[program.uniqueId]!,
        durationMs: program.duration,
      }))
      .with({ type: 'custom' }, (program) => ({
        type: 'content',
        durationMs: program.duration,
        id: program.id,
        customShowId: program.customShowId,
      }))
      .with({ type: 'filler' }, (program) => ({
        type: 'content',
        durationMs: program.duration,
        id: program.id,
        fillerListId: program.fillerListId,
        fillerType: program.fillerType,
      }))
      .with({ type: 'redirect' }, (program) => ({
        type: 'redirect',
        channel: program.channel,
        durationMs: program.duration,
      }))
      .with({ type: 'flex' }, (program) => ({
        type: 'offline',
        durationMs: program.duration,
      }))
      .exhaustive();
}

@injectable()
export class LineupRepository {
  private logger = LoggerFactory.child({
    caller: import.meta,
    className: this.constructor.name,
  });

  private timer = new Timer(this.logger, 'trace');

  constructor(
    @inject(KEYS.Database) private db: Kysely<DB>,
    @inject(KEYS.DrizzleDB) private drizzleDB: DrizzleDBAccess,
    @inject(FileSystemService) private fileSystemService: FileSystemService,
    @inject(KEYS.WorkerPoolFactory)
    private workerPoolProvider: interfaces.AutoFactory<IWorkerPool>,
    @inject(MaterializeLineupCommand)
    private materializeLineupCommand: MaterializeLineupCommand,
    @inject(KEYS.ProgramDB) private programDB: IProgramDB,
    @inject(ProgramConverter) private programConverter: ProgramConverter,
  ) {}

  async createLineup(channelId: string): Promise<void> {
    const db = await this.getFileDb(channelId);
    await db.write();
  }

  async getFileDb(channelId: string, forceRead: boolean = false): Promise<Low<Lineup>> {
    return await fileDbLocks.getOrCreateLock(channelId).then((lock) =>
      lock.runExclusive(async () => {
        const existing = fileDbCache[channelId];
        if (isDefined(existing)) {
          if (forceRead) {
            await existing.read();
          }
          return existing;
        }

        const defaultValue = {
          items: [],
          startTimeOffsets: [],
          lastUpdated: dayjs().valueOf(),
          version: CurrentLineupSchemaVersion,
        };
        const db = new Low<Lineup>(
          new SchemaBackedDbAdapter(
            LineupSchema,
            this.fileSystemService.getChannelLineupPath(channelId),
            defaultValue,
          ),
          defaultValue,
        );
        await db.read();
        fileDbCache[channelId] = db;
        return db;
      }),
    );
  }

  async markLineupFileForDeletion(
    channelId: string,
    isDelete: boolean = true,
  ): Promise<void> {
    const path = join(
      globalOptions().databaseDirectory,
      `channel-lineups/${channelId}.json${isDelete ? '' : '.bak'}`,
    );
    try {
      if (await fileExists(path)) {
        const newPath = isDelete ? `${path}.bak` : path.replace('.bak', '');
        await fs.rename(path, newPath);
      }
      if (isDelete) {
        delete fileDbCache[channelId];
      } else {
        await this.getFileDb(channelId);
      }
    } catch (e) {
      this.logger.error(
        e,
        `Error while trying to ${
          isDelete ? 'mark' : 'unmark'
        } Channel %s lineup json for deletion`,
        channelId,
      );
    }
  }

  async restoreLineupFile(channelId: string): Promise<void> {
    return this.markLineupFileForDeletion(channelId, false);
  }

  async removeRedirectReferences(toChannel: string): Promise<void> {
    const allChannels = await this.drizzleDB.query.channels
      .findMany({
        orderBy: (fields, { asc }) => asc(fields.number),
      })
      .execute();

    const ops = asyncPool(
      reject(allChannels, { uuid: toChannel }),
      async (channel) => {
        const lineup = await this.loadLineup(channel.uuid);
        let changed = false;
        const newLineup: LineupItem[] = map(lineup.items, (item) => {
          if (item.type === 'redirect' && item.channel === toChannel) {
            changed = true;
            return {
              type: 'offline' as const,
              durationMs: item.durationMs,
            };
          } else {
            return item;
          }
        });
        if (changed) {
          return this.saveLineup(channel.uuid, { ...lineup, items: newLineup });
        }
        return;
      },
      { concurrency: 2 },
    );

    for await (const updateResult of ops) {
      if (updateResult.isFailure()) {
        this.logger.error(
          'Error removing redirect references for channel %s from channel %s',
          toChannel,
          updateResult.error.input.uuid,
        );
      }
    }
  }

  async saveLineup(
    channelId: string,
    newLineup: UpdateChannelLineupRequest,
  ): Promise<Lineup> {
    const db = await this.getFileDb(channelId);
    await db.update((data) => {
      if (isDefined(newLineup.items)) {
        data.items = newLineup.items;
        data.startTimeOffsets =
          newLineup.startTimeOffsets ??
          calculateStartTimeOffsets(newLineup.items);
      }

      if (isDefined(newLineup.schedule)) {
        if (newLineup.schedule === null) {
          data.schedule = undefined;
        } else {
          data.schedule = newLineup.schedule;
        }
      }

      if (isDefined(newLineup.pendingPrograms)) {
        data.pendingPrograms =
          newLineup.pendingPrograms === null
            ? undefined
            : newLineup.pendingPrograms;
      }

      if (isDefined(newLineup.onDemandConfig)) {
        data.onDemandConfig =
          newLineup.onDemandConfig === null
            ? undefined
            : newLineup.onDemandConfig;
      }

      data.version = newLineup?.version ?? data.version;

      data.lastUpdated = dayjs().valueOf();
    });

    if (isDefined(newLineup.items)) {
      const newDur = sum(newLineup.items.map((item) => item.durationMs));
      await this.updateChannelDuration(channelId, newDur);
    }
    return db.data;
  }

  private updateChannelDuration(id: string, newDur: number): Promise<number> {
    return this.drizzleDB
      .update(Channel)
      .set({ duration: newDur })
      .where(eq(Channel.uuid, id))
      .limit(1)
      .execute()
      .then((_) => _.changes);
  }

  async updateLineupConfig<
    Key extends keyof Omit<
      Lineup,
      'items' | 'startTimeOffsets' | 'pendingPrograms'
    >,
  >(id: string, key: Key, conf: Lineup[Key]): Promise<void> {
    const lineupDb = await this.getFileDb(id);
    return await lineupDb.update((existing) => {
      existing[key] = conf;
    });
  }

  async setChannelPrograms(
    channel: Channel,
    lineup: readonly LineupItem[],
  ): Promise<Channel | null>;
  async setChannelPrograms(
    channel: string | Channel,
    lineup: readonly LineupItem[],
    startTime?: number,
  ): Promise<Channel | null>;
  async setChannelPrograms(
    channel: string | Channel,
    lineup: readonly LineupItem[],
    startTime?: number,
  ): Promise<Channel | null> {
    const loadedChannel = await run(async () => {
      if (isString(channel)) {
        return this.db
          .selectFrom('channel')
          .where('channel.uuid', '=', channel)
          .selectAll()
          .executeTakeFirst();
      } else {
        return channel;
      }
    });

    if (isNil(loadedChannel)) {
      return null;
    }

    const allIds = uniq(map(filter(lineup, isContentItem), 'id'));

    return await this.db.transaction().execute(async (tx) => {
      if (!isUndefined(startTime)) {
        loadedChannel.startTime = startTime;
      }
      loadedChannel.duration = sumBy(lineup, typedProperty('durationMs'));
      const updatedChannel = await tx
        .updateTable('channel')
        .where('channel.uuid', '=', loadedChannel.uuid)
        .set('duration', sumBy(lineup, typedProperty('durationMs')))
        .$if(isDefined(startTime), (_) => _.set('startTime', startTime!))
        .returningAll()
        .executeTakeFirst();

      for (const idChunk of chunk(allIds, 500)) {
        await tx
          .deleteFrom('channelPrograms')
          .where('channelUuid', '=', loadedChannel.uuid)
          .where('programUuid', 'not in', idChunk)
          .execute();
      }

      for (const idChunk of chunk(allIds, 500)) {
        await tx
          .insertInto('channelPrograms')
          .values(
            map(idChunk, (id) => ({
              programUuid: id,
              channelUuid: loadedChannel.uuid,
            })),
          )
          .onConflict((oc) => oc.doNothing())
          .executeTakeFirst();
      }

      return updatedChannel ?? null;
    });
  }

  async addPendingPrograms(
    channelId: string,
    pendingPrograms: PendingProgram[],
  ): Promise<void> {
    if (pendingPrograms.length === 0) {
      return;
    }

    const db = await this.getFileDb(channelId);
    return await db.update((data) => {
      if (isUndefined(data.pendingPrograms)) {
        data.pendingPrograms = [...pendingPrograms];
      } else {
        data.pendingPrograms.push(...pendingPrograms);
      }
    });
  }

  async removeProgramsFromLineup(
    channelId: string,
    programIds: string[],
  ): Promise<void> {
    if (programIds.length === 0) {
      return;
    }

    const idSet = new Set(programIds);
    const lineup = await this.loadLineup(channelId);
    lineup.items = map(lineup.items, (item) => {
      if (isContentItem(item) && idSet.has(item.id)) {
        return {
          type: 'offline',
          durationMs: item.durationMs,
        };
      } else {
        return item;
      }
    });
    await this.saveLineup(channelId, lineup);
  }

  async removeProgramsFromAllLineups(programIds: string[]): Promise<void> {
    if (isEmpty(programIds)) {
      return;
    }

    const lineups = await this.loadAllLineups();

    const programsToRemove = new Set(programIds);
    for (const [channelId, { lineup }] of Object.entries(lineups)) {
      const newLineupItems: LineupItem[] = lineup.items.map((item) => {
        switch (item.type) {
          case 'content': {
            if (programsToRemove.has(item.id)) {
              return {
                type: 'offline',
                durationMs: item.durationMs,
              };
            }
            return item;
          }
          case 'offline':
          case 'redirect':
            return item;
        }
      });

      await this.saveLineup(channelId, {
        ...lineup,
        items: newLineupItems,
      });

      const duration = sum(newLineupItems.map((item) => item.durationMs));

      await this.db
        .updateTable('channel')
        .set({ duration })
        .where('uuid', '=', channelId)
        .limit(1)
        .executeTakeFirst();
    }
  }

  async loadAllLineups(): Promise<Record<string, { channel: ChannelOrm; lineup: Lineup }>> {
    const allChannels = await this.drizzleDB.query.channels
      .findMany({ orderBy: (fields, { asc }) => asc(fields.number) })
      .execute();
    return mapReduceAsyncSeq(
      allChannels,
      async (channel) => ({
        channel,
        lineup: await this.loadLineup(channel.uuid),
      }),
      (prev, { channel, lineup }) => {
        prev[channel.uuid] = { channel, lineup };
        return prev;
      },
      {} as Record<string, { channel: ChannelOrm; lineup: Lineup }>,
    );
  }

  async loadAllLineupConfigs(
    forceRead: boolean = false,
  ): Promise<Record<string, ChannelAndLineup>> {
    const allChannels = await this.drizzleDB.query.channels
      .findMany({ orderBy: (fields, { asc }) => asc(fields.number) })
      .execute();
    return asyncMapToRecord(
      allChannels,
      async (channel) => ({
        channel,
        lineup: await this.loadLineup(channel.uuid, forceRead),
      }),
      ({ channel }) => channel.uuid,
    );
  }

  async loadAllRawLineups(): Promise<Record<string, ChannelAndRawLineup>> {
    const allChannels = await this.drizzleDB.query.channels
      .findMany({ orderBy: (fields, { asc }) => asc(fields.number) })
      .execute();
    return asyncMapToRecord(
      allChannels,
      async (channel) => {
        if (
          !(await fileExists(
            this.fileSystemService.getChannelLineupPath(channel.uuid),
          ))
        ) {
          await this.createLineup(channel.uuid);
        }

        return {
          channel,
          lineup: jsonSchema.parse(
            JSON.parse(
              (
                await fs.readFile(
                  this.fileSystemService.getChannelLineupPath(channel.uuid),
                )
              ).toString('utf-8'),
            ),
          ),
        };
      },
      ({ channel }) => channel.uuid,
    );
  }

  async loadLineup(channelId: string, forceRead: boolean = false): Promise<Lineup> {
    const db = await this.getFileDb(channelId, forceRead);
    return db.data;
  }

  async loadChannelAndLineup(
    channelId: string,
  ): Promise<ChannelAndLineup<Channel> | null> {
    const channel = await this.db
      .selectFrom('channel')
      .where('channel.uuid', '=', channelId)
      .selectAll()
      .executeTakeFirst();
    if (isNil(channel)) {
      return null;
    }

    return {
      channel,
      lineup: await this.loadLineup(channelId),
    };
  }

  async loadChannelAndLineupOrm(
    channelId: string,
  ): Promise<ChannelAndLineup<ChannelOrm> | null> {
    const channel = await this.drizzleDB.query.channels.findFirst({
      where: (ch, { eq }) => eq(ch.uuid, channelId),
      with: { transcodeConfig: true },
    });
    if (isNil(channel)) {
      return null;
    }

    return {
      channel,
      lineup: await this.loadLineup(channelId),
    };
  }

  async loadChannelWithProgamsAndLineup(
    channelId: string,
  ): Promise<{ channel: ChannelOrmWithPrograms; lineup: Lineup } | null> {
    const channelsAndPrograms = await this.drizzleDB.query.channels.findFirst({
      where: (fields, { eq }) => eq(fields.uuid, channelId),
      with: {
        channelPrograms: {
          with: {
            program: {
              with: {
                show: true,
                season: true,
                artist: true,
                album: true,
                externalIds: true,
              },
            },
          },
        },
      },
    });

    if (isNil(channelsAndPrograms)) {
      return null;
    }

    const withoutJoinTable = omit(channelsAndPrograms, 'channelPrograms');
    const channel: ChannelOrmWithPrograms = {
      ...withoutJoinTable,
      programs: channelsAndPrograms.channelPrograms.map((cp) => cp.program),
    };

    return {
      channel,
      lineup: await this.loadLineup(channelId),
    };
  }

  async loadAndMaterializeLineup(
    channelId: string,
    offset: number = 0,
    limit: number = -1,
  ): Promise<ChannelProgramming | null> {
    const channel = await this.db
      .selectFrom('channel')
      .selectAll(['channel'])
      .where('channel.uuid', '=', channelId)
      .leftJoin(
        'channelPrograms',
        'channel.uuid',
        'channelPrograms.channelUuid',
      )
      .select((eb) =>
        withPrograms(eb, {
          joins: {
            customShows: true,
            tvShow: [
              'programGrouping.uuid',
              'programGrouping.title',
              'programGrouping.summary',
              'programGrouping.type',
            ],
            tvSeason: [
              'programGrouping.uuid',
              'programGrouping.title',
              'programGrouping.summary',
              'programGrouping.type',
            ],
            trackArtist: [
              'programGrouping.uuid',
              'programGrouping.title',
              'programGrouping.summary',
              'programGrouping.type',
            ],
            trackAlbum: [
              'programGrouping.uuid',
              'programGrouping.title',
              'programGrouping.summary',
              'programGrouping.type',
            ],
          },
        }),
      )
      .groupBy('channel.uuid')
      .orderBy('channel.number asc')
      .executeTakeFirst();

    if (isNil(channel)) {
      return null;
    }

    const lineup = await this.loadLineup(channelId);
    const len = lineup.items.length;
    const cleanOffset = offset < 0 ? 0 : offset;
    const cleanLimit = limit < 0 ? len : limit;

    const { lineup: apiLineup, offsets } = await this.buildApiLineup(
      channel,
      take(drop(lineup.items, cleanOffset), cleanLimit),
    );

    return {
      icon: channel.icon,
      name: channel.name,
      number: channel.number,
      totalPrograms: len,
      programs: apiLineup,
      startTimeOffsets: offsets,
    };
  }

  async loadCondensedLineup(
    channelId: string,
    offset: number = 0,
    limit: number = -1,
  ): Promise<CondensedChannelProgramming | null> {
    const lineup = await this.timer.timeAsync('loadLineup', () =>
      this.loadLineup(channelId),
    );

    const len = lineup.items.length;
    const cleanOffset = offset < 0 ? 0 : offset;
    const cleanLimit = limit < 0 ? len : limit;
    const pagedLineup = take(drop(lineup.items, cleanOffset), cleanLimit);

    const channel = await this.timer.timeAsync('select channel', () =>
      this.db
        .selectFrom('channel')
        .where('channel.uuid', '=', channelId)
        .selectAll()
        .executeTakeFirst(),
    );

    if (isNil(channel)) {
      return null;
    }

    const contentItems = filter(pagedLineup, isContentItem);

    const directPrograms = await this.timer.timeAsync('direct', () =>
      this.db
        .selectFrom('channelPrograms')
        .where('channelUuid', '=', channelId)
        .innerJoin('program', 'channelPrograms.programUuid', 'program.uuid')
        .selectAll('program')
        .select((eb) => [
          withTvShow(eb, AllProgramGroupingFields, true),
          withTvSeason(eb, AllProgramGroupingFields, true),
          withTrackAlbum(eb, AllProgramGroupingFields, true),
          withTrackArtist(eb, AllProgramGroupingFields, true),
        ])
        .execute(),
    );

    const externalIds = await this.timer.timeAsync('eids', () =>
      this.db
        .selectFrom('channelPrograms')
        .where('channelUuid', '=', channelId)
        .innerJoin(
          'programExternalId',
          'channelPrograms.programUuid',
          'programExternalId.programUuid',
        )
        .selectAll('programExternalId')
        .execute(),
    );

    const externalIdsByProgramId = groupBy(
      externalIds,
      (eid) => eid.programUuid,
    );

    const programsById = groupByUniqProp(directPrograms, 'uuid');

    const materializedPrograms = this.timer.timeSync('program convert', () => {
      const ret: Record<string, ContentProgram> = {};
      forEach(uniqBy(contentItems, 'id'), (item) => {
        const program = programsById[item.id];
        if (!program) {
          return;
        }

        const converted = this.programConverter.programDaoToContentProgram(
          program,
          externalIdsByProgramId[program.uuid] ?? [],
        );

        if (converted) {
          ret[converted.id] = converted;
        }
      });

      return ret;
    });

    const { lineup: condensedLineup, offsets } = await this.timer.timeAsync(
      'build condensed lineup',
      () =>
        this.buildCondensedLineup(
          channel,
          new Set([...seq.collect(directPrograms, (p) => p.uuid)]),
          pagedLineup,
        ),
    );

    let apiOffsets: number[];
    if (lineup.startTimeOffsets) {
      apiOffsets = take(drop(lineup.startTimeOffsets, cleanOffset), cleanLimit);
    } else {
      const scale = sumBy(
        take(lineup.items, cleanOffset - 1),
        (i) => i.durationMs,
      );
      apiOffsets = map(offsets, (o) => o + scale);
    }

    return {
      icon: channel.icon,
      name: channel.name,
      number: channel.number,
      totalPrograms: len,
      programs: omitBy(materializedPrograms, isNil),
      lineup: condensedLineup,
      startTimeOffsets: apiOffsets,
      schedule: lineup.schedule,
    };
  }

  async updateLineup(
    id: string,
    req: UpdateChannelProgrammingRequest,
  ): Promise<Nullable<{ channel: ChannelOrm; newLineup: LineupItem[] }>> {
    const channel = await this.drizzleDB.query.channels.findFirst({
      where: (fields, { eq }) => eq(fields.uuid, id),
      with: {
        channelPrograms: {
          columns: {
            programUuid: true,
          },
        },
      },
    });

    const lineup = await this.loadLineup(id);

    if (isNil(channel)) {
      return null;
    }

    const updateChannel = async (lineup: readonly LineupItem[]) => {
      return await this.db.transaction().execute(async (tx) => {
        await tx
          .updateTable('channel')
          .where('channel.uuid', '=', id)
          .set({
            duration: sumBy(lineup, typedProperty('durationMs')),
          })
          .limit(1)
          .executeTakeFirstOrThrow();

        const allNewIds = new Set([
          ...uniq(map(filter(lineup, isContentItem), (p) => p.id)),
        ]);

        const existingIds = new Set([
          ...channel.channelPrograms.map((cp) => cp.programUuid),
        ]);

        const removeOperations: ProgramRelationOperation[] = map(
          reject([...existingIds], (existingId) => allNewIds.has(existingId)),
          (removalId) => ({
            operation: 'remove' as const,
            id: removalId,
          }),
        );

        const addOperations: ProgramRelationOperation[] = map(
          reject([...allNewIds], (newId) => existingIds.has(newId)),
          (addId) => ({
            operation: 'add' as const,
            id: addId,
          }),
        );

        for (const ops of chunk(
          [...addOperations, ...removeOperations],
          SqliteMaxDepthLimit / 2,
        )) {
          const [adds, removes] = partition(
            ops,
            ({ operation }) => operation === 'add',
          );

          if (!isEmpty(removes)) {
            await tx
              .deleteFrom('channelPrograms')
              .where('channelPrograms.programUuid', 'in', map(removes, 'id'))
              .where('channelPrograms.channelUuid', '=', id)
              .execute();
          }

          if (!isEmpty(adds)) {
            await tx
              .insertInto('channelPrograms')
              .values(
                map(
                  adds,
                  ({ id }) =>
                    ({
                      channelUuid: channel.uuid,
                      programUuid: id,
                    }) satisfies NewChannelProgram,
                ),
              )
              .execute();
          }
        }
        return channel;
      });
    };

    const createNewLineup = async (
      programs: ChannelProgram[],
      lineupPrograms: ChannelProgram[] = programs,
    ) => {
      const upsertedPrograms =
        await this.programDB.upsertContentPrograms(programs);
      const dbIdByUniqueId = groupByFunc(
        upsertedPrograms,
        programExternalIdString,
        (p) => p.uuid,
      );
      return map(lineupPrograms, channelProgramToLineupItemFunc(dbIdByUniqueId));
    };

    const upsertPrograms = async (programs: ChannelProgram[]) => {
      const upsertedPrograms =
        await this.programDB.upsertContentPrograms(programs);
      return groupByFunc(
        upsertedPrograms,
        programExternalIdString,
        (p) => p.uuid,
      );
    };

    if (req.type === 'manual') {
      const newLineupItems = await run(async () => {
        const newItems = await this.timer.timeAsync(
          'createNewLineup',
          async () => {
            const programs = req.programs;
            const dbIdByUniqueId = await upsertPrograms(programs);
            const convertFunc = channelProgramToLineupItemFunc(dbIdByUniqueId);
            return seq.collect(req.lineup, (lineupItem) => {
              switch (lineupItem.type) {
                case 'index': {
                  const program = nth(programs, lineupItem.index);
                  if (program) {
                    return convertFunc({
                      ...program,
                      duration: lineupItem.duration ?? program.duration,
                    });
                  }
                  return null;
                }
                case 'persisted': {
                  return {
                    type: 'content',
                    id: lineupItem.programId,
                    customShowId: lineupItem.customShowId,
                    durationMs: lineupItem.duration,
                  } satisfies ContentItem;
                }
              }
            });
          },
        );
        if (req.append) {
          const existingLineup = await this.loadLineup(channel.uuid);
          return [...existingLineup.items, ...newItems];
        } else {
          return newItems;
        }
      });

      const updatedChannel = await this.timer.timeAsync('updateChannel', () =>
        updateChannel(newLineupItems),
      );

      await this.timer.timeAsync('saveLineup', () =>
        this.saveLineup(id, {
          items: newLineupItems,
          onDemandConfig: isDefined(lineup.onDemandConfig)
            ? {
                ...lineup.onDemandConfig,
                cursor: 0,
              }
            : undefined,
        }),
      );

      return {
        channel: updatedChannel,
        newLineup: newLineupItems,
      };
    } else if (req.type === 'time' || req.type === 'random') {
      let programs: ChannelProgram[];
      if (req.type === 'time') {
        const { result } = await this.workerPoolProvider().queueTask({
          type: 'time-slots',
          request: {
            type: 'programs',
            programIds: req.programs,
            schedule: req.schedule,
            seed: req.seed,
            startTime: channel.startTime,
          },
        });

        programs = MaterializeLineupCommand.expandLineup(
          result.lineup,
          await this.materializeLineupCommand.execute({
            lineup: result.lineup,
          }),
        );
      } else {
        const { result } = await this.workerPoolProvider().queueTask({
          type: 'schedule-slots',
          request: {
            type: 'programs',
            programIds: req.programs,
            startTime: channel.startTime,
            schedule: req.schedule,
            seed: req.seed,
          },
        });
        programs = MaterializeLineupCommand.expandLineup(
          result.lineup,
          await this.materializeLineupCommand.execute({
            lineup: result.lineup,
          }),
        );
      }

      const newLineup = await createNewLineup(programs);

      const updatedChannel = await updateChannel(newLineup);
      await this.saveLineup(id, {
        items: newLineup,
        schedule: req.schedule,
      });

      return {
        channel: updatedChannel,
        newLineup,
      };
    }

    return null;
  }

  private async buildApiLineup(
    channel: ChannelWithPrograms,
    lineup: LineupItem[],
  ): Promise<{ lineup: ChannelProgram[]; offsets: number[] }> {
    const allChannels = await this.db
      .selectFrom('channel')
      .select(['channel.uuid', 'channel.number', 'channel.name'])
      .execute();
    let lastOffset = 0;
    const offsets: number[] = [];

    const programsById = groupByUniqProp(channel.programs, 'uuid');

    const programs: ChannelProgram[] = [];

    for (const item of lineup) {
      const apiItem = match(item)
        .with({ type: 'content' }, (contentItem) => {
          const fullProgram = programsById[contentItem.id];
          if (!fullProgram) {
            return null;
          }
          return this.programConverter.programDaoToContentProgram(
            fullProgram,
            fullProgram.externalIds ?? [],
          );
        })
        .otherwise((item) =>
          this.programConverter.lineupItemToChannelProgram(
            channel,
            item,
            allChannels,
          ),
        );

      if (apiItem) {
        offsets.push(lastOffset);
        lastOffset += item.durationMs;
        programs.push(apiItem);
      }
    }

    return { lineup: programs, offsets };
  }

  private async buildCondensedLineup(
    channel: Channel,
    dbProgramIds: Set<string>,
    lineup: LineupItem[],
  ): Promise<{ lineup: CondensedChannelProgram[]; offsets: number[] }> {
    let lastOffset = 0;
    const offsets: number[] = [];

    const customShowLineupItemsByShowId = mapValues(
      groupBy(
        filter(
          lineup,
          (l): l is MarkRequired<ContentItem, 'customShowId'> =>
            l.type === 'content' && isNonEmptyString(l.customShowId),
        ),
        (i) => i.customShowId,
      ),
      (items) => uniqBy(items, 'id'),
    );

    const customShowIndexes: Record<string, Record<string, number>> = {};
    for (const [customShowId, items] of entries(
      customShowLineupItemsByShowId,
    )) {
      customShowIndexes[customShowId] = {};

      const results = await this.db
        .selectFrom('customShowContent')
        .select(['customShowContent.contentUuid', 'customShowContent.index'])
        .where('customShowContent.contentUuid', 'in', map(items, 'id'))
        .where('customShowContent.customShowUuid', '=', customShowId)
        .groupBy('customShowContent.contentUuid')
        .execute();

      const byItemId: Record<string, number> = {};
      for (const { contentUuid, index } of results) {
        byItemId[contentUuid] = index;
      }

      customShowIndexes[customShowId] = byItemId;
    }

    const allChannels = await this.db
      .selectFrom('channel')
      .select(['uuid', 'name', 'number'])
      .execute();

    const channelsById = groupByUniqProp(allChannels, 'uuid');

    const programs = seq.collect(lineup, (item) => {
      let p: CondensedChannelProgram | null = null;
      if (isOfflineItem(item)) {
        p = this.programConverter.offlineLineupItemToProgram(channel, item);
      } else if (isRedirectItem(item)) {
        if (channelsById[item.channel]) {
          p = this.programConverter.redirectLineupItemToProgram(
            item,
            channelsById[item.channel]!,
          );
        } else {
          this.logger.warn(
            'Found dangling redirect program. Bad ID = %s',
            item.channel,
          );
          p = {
            persisted: true,
            type: 'flex',
            duration: item.durationMs,
          };
        }
      } else if (item.customShowId) {
        p = {
          persisted: true,
          type: 'custom',
          customShowId: item.customShowId,
          duration: item.durationMs,
          index: customShowIndexes[item.customShowId]![item.id] ?? -1,
          id: item.id,
        };
      } else if (item.fillerListId) {
        p = {
          persisted: true,
          type: 'filler',
          fillerListId: item.fillerListId,
          fillerType: item.fillerType,
          id: item.id,
          duration: item.durationMs,
        };
      } else {
        if (dbProgramIds.has(item.id)) {
          p = {
            persisted: true,
            type: 'content',
            id: item.id,
            duration: item.durationMs,
          };
        }
      }

      if (p) {
        offsets.push(lastOffset);
        lastOffset += item.durationMs;
      }

      return p;
    });
    return { lineup: programs, offsets };
  }
}
