import {
  Loaded,
  OrderDefinition,
  QueryOrder,
  RequiredEntityData,
  wrap,
} from '@mikro-orm/core';
import { scheduleRandomSlots, scheduleTimeSlots } from '@tunarr/shared';
import { forProgramType, seq } from '@tunarr/shared/util';
import {
  ChannelProgram,
  ChannelProgramming,
  CondensedChannelProgram,
  CondensedChannelProgramming,
  ContentProgram,
  SaveChannelRequest,
  Watermark,
  tag,
} from '@tunarr/types';
import { UpdateChannelProgrammingRequest } from '@tunarr/types/api';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration.js';
import ld, {
  chunk,
  compact,
  entries,
  filter,
  forEach,
  groupBy,
  isEmpty,
  isNil,
  isNull,
  isNumber,
  isString,
  isUndefined,
  map,
  mapValues,
  nth,
  omitBy,
  partition,
  reduce,
  reject,
  sumBy,
  take,
  uniqBy,
} from 'lodash-es';
import { Low } from 'lowdb';
import fs from 'node:fs/promises';
import { join } from 'path';
import { MarkOptional, MarkRequired } from 'ts-essentials';
import { match } from 'ts-pattern';
import { ChannelWithPrograms as RawChannelWithPrograms } from '../dao/direct/derivedTypes.js';
import { globalOptions } from '../globals.js';
import { serverContext } from '../serverContext.js';
import { typedProperty } from '../types/path.js';
import { Result } from '../types/result.js';
import { Maybe } from '../types/util.js';
import { asyncPool } from '../util/asyncPool.js';
import { fileExists } from '../util/fsUtil.js';
import {
  groupByFunc,
  groupByUniqProp,
  isDefined,
  isNonEmptyString,
  mapAsyncSeq,
  mapReduceAsyncSeq,
  run,
} from '../util/index.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';
import { MutexMap } from '../util/mutexMap.js';
import { Timer } from '../util/perf.js';
import { SchemaBackedDbAdapter } from './SchemaBackedDbAdapter.js';
import { ProgramConverter } from './converters/programConverters.js';
import { getEm } from './dataSource.js';
import {
  ContentItem,
  CurrentLineupSchemaVersion,
  Lineup,
  LineupItem,
  LineupSchema,
  PendingProgram,
  isContentItem,
  isOfflineItem,
  isRedirectItem,
} from './derived_types/Lineup.js';
import { directDbAccess } from './direct/directDbAccess.js';
import {
  MinimalProgramGroupingFields,
  withFallbackPrograms,
  withPrograms,
  withTrackAlbum,
  withTrackArtist,
  withTvSeason,
  withTvShow,
} from './direct/programQueryHelpers.js';
import { programExternalIdString } from './direct/schema/Program.js';
import { Channel, ChannelTranscodingSettings } from './entities/Channel.js';
import { ChannelFillerShow } from './entities/ChannelFillerShow.js';
import { FillerShow, FillerShowId } from './entities/FillerShow.js';
import { Program } from './entities/Program.js';
import { ProgramDB } from './programDB.js';

dayjs.extend(duration);

// We use this to chunk super huge channel / program relation updates because
// of the way that mikro-orm generates these (e.g. "delete from XYZ where () or () ...").
// When updating a _huge_ channel, we hit internal sqlite limits, so we must chunk these
// operations ourselves.
const SqliteMaxDepthLimit = 1000;

type ProgramRelationOperation = { operation: 'add' | 'remove'; id: Program };

function sanitizeChannelWatermark(
  watermark: Maybe<Watermark>,
): Maybe<Watermark> {
  if (isUndefined(watermark)) {
    return;
  }

  const validFadePoints = filter(
    watermark.fadeConfig,
    (conf) => conf.periodMins > 0,
  );

  return {
    ...watermark,
    fadeConfig: isEmpty(validFadePoints) ? undefined : validFadePoints,
  };
}

function updateRequestToChannel(
  updateReq: SaveChannelRequest,
): Partial<Channel> {
  const transcoding: ChannelTranscodingSettings = omitBy(
    updateReq.transcoding,
    (val) => val === 'global' || isNil(val),
  );

  return omitBy<Partial<Channel>>(
    {
      number: updateReq.number,
      watermark: sanitizeChannelWatermark(updateReq.watermark),
      icon: updateReq.icon,
      guideMinimumDuration: updateReq.guideMinimumDuration,
      groupTitle: updateReq.groupTitle,
      disableFillerOverlay: updateReq.disableFillerOverlay,
      startTime: updateReq.startTime,
      offline: updateReq.offline,
      name: updateReq.name,
      transcoding: isEmpty(transcoding)
        ? undefined
        : {
            targetResolution: transcoding?.targetResolution,
            videoBitrate: transcoding?.videoBitrate,
            videoBufferSize: transcoding?.videoBufferSize,
          },
      duration: updateReq.duration,
      stealth: updateReq.stealth,
      fillerRepeatCooldown: updateReq.fillerRepeatCooldown,
      guideFlexTitle: updateReq.guideFlexTitle,
    },
    isNil,
  );
}

function createRequestToChannel(
  saveReq: SaveChannelRequest,
): RequiredEntityData<Channel> {
  const transcoding: ChannelTranscodingSettings = omitBy(
    saveReq.transcoding,
    (val) => val === 'global' || isNil(val),
  );

  return {
    number: saveReq.number,
    watermark: saveReq.watermark,
    icon: saveReq.icon,
    guideMinimumDuration: saveReq.guideMinimumDuration,
    groupTitle: saveReq.groupTitle,
    disableFillerOverlay: saveReq.disableFillerOverlay,
    startTime: saveReq.startTime,
    offline: saveReq.offline,
    name: saveReq.name,
    transcoding: isEmpty(transcoding)
      ? undefined
      : {
          targetResolution: transcoding?.targetResolution,
          videoBitrate: transcoding?.videoBitrate,
          videoBufferSize: transcoding?.videoBufferSize,
        },
    duration: saveReq.duration,
    stealth: saveReq.stealth,
    fillerRepeatCooldown: saveReq.fillerRepeatCooldown,
    guideFlexTitle: saveReq.guideFlexTitle,
    streamMode: 'hls', // TODO: Let users choose
  } satisfies RequiredEntityData<Channel>;
}

export type LoadedChannelWithGroupRefs = Loaded<
  Channel,
  | 'programs'
  | 'programs.artist'
  | 'programs.album'
  | 'programs.tvShow'
  | 'programs.season'
>;

// Let's see if this works... in so we can have many ChannelDb objects flying around.
const fileDbCache: Record<string | number, Low<Lineup>> = {};
const fileDbLocks = new MutexMap();

export class ChannelDB {
  private logger = LoggerFactory.child({
    caller: import.meta,
    className: this.constructor.name,
  });
  private timer = new Timer(this.logger, 'trace');
  #programConverter = new ProgramConverter();

  constructor(private programDB: ProgramDB = new ProgramDB()) {}

  async channelExists(channelId: string) {
    const channel = await directDbAccess()
      .selectFrom('channel')
      .where('channel.uuid', '=', channelId)
      .select('uuid')
      .executeTakeFirst();
    return !isNil(channel);
  }

  getChannelByNumber(channelNumber: number) {
    return getEm().repo(Channel).findOne({ number: channelNumber });
  }

  async channelIdForNumber(channelNumber: number) {
    const result = await directDbAccess()
      .selectFrom('channel')
      .where('number', '=', channelNumber)
      .select('uuid')
      .executeTakeFirst();
    return result?.uuid;
  }

  getChannelById(id: string) {
    return getEm().repo(Channel).findOne({ uuid: id });
  }

  getChannelDirect(id: string | number) {
    return directDbAccess()
      .selectFrom('channel')
      .$if(isString(id), (eb) => eb.where('channel.uuid', '=', id as string))
      .$if(isNumber(id), (eb) => eb.where('channel.number', '=', id as number))
      .selectAll()
      .executeTakeFirst();
  }

  getChannel(id: string | number) {
    return isNumber(id) ? this.getChannelByNumber(id) : this.getChannelById(id);
  }

  getChannelAndPrograms(
    uuid: string,
  ): Promise<RawChannelWithPrograms | undefined> {
    return directDbAccess()
      .selectFrom('channel')
      .selectAll(['channel'])
      .where('channel.uuid', '=', uuid)
      .innerJoin(
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
  }

  getChannelProgramExternalIds(uuid: string) {
    return directDbAccess()
      .selectFrom('channelPrograms')
      .where('channelUuid', '=', uuid)
      .innerJoin(
        'programExternalId',
        'channelPrograms.programUuid',
        'programExternalId.programUuid',
      )
      .selectAll('programExternalId')
      .execute();
  }

  async getChannelFallbackPrograms(uuid: string) {
    const result = await directDbAccess()
      .selectFrom('channelFallback')
      .where('channelFallback.channelUuid', '=', uuid)
      .select(withFallbackPrograms)
      .groupBy('channelFallback.channelUuid')
      .executeTakeFirst();
    return result?.programs ?? [];
  }

  /**
   * The old implementation using the ORM, which is super slow for
   * huge channels. This WILL be removed, but we're keeping it around
   * so that we can ship the perf improvements now without changing the
   * whole world.
   * @deprecated
   */
  getChannelAndProgramsSLOW(uuid: string) {
    return getEm()
      .repo(Channel)
      .findOne(
        { uuid },
        { populate: ['programs', 'programs.customShows.uuid'] },
      );
  }

  getChannelAndProgramsByNumber(number: number) {
    return getEm()
      .repo(Channel)
      .findOne({ number }, { populate: ['programs'] });
  }

  async saveChannel(createReq: SaveChannelRequest) {
    const em = getEm();
    const existing = await em.findOne(Channel, { number: createReq.number });
    if (!isNull(existing)) {
      throw new Error(
        `Channel with number ${createReq.number} already exists: ${existing.name}`,
      );
    }

    const channel = em.create(Channel, createRequestToChannel(createReq));
    em.persist(channel);

    await this.createLineup(channel.uuid);
    if (isDefined(createReq.onDemand) && createReq.onDemand.enabled) {
      const db = await this.getFileDb(channel.uuid);
      await db.update((lineup) => {
        lineup.onDemandConfig = {
          state: 'paused',
          cursor: 0,
        };
      });
    }

    await em.flush();
    return { channel, lineup: (await this.getFileDb(channel.uuid)).data };
  }

  async updateChannel(id: string, updateReq: SaveChannelRequest) {
    const em = getEm();
    const channel = em.getReference(Channel, id);
    const update = updateRequestToChannel(updateReq);
    const loadedChannel = wrap(channel).assign(update, {
      merge: true,
      onlyProperties: true,
    });

    if (
      isNonEmptyString(updateReq.watermark?.url) &&
      URL.canParse(updateReq.watermark.url)
    ) {
      const url = updateReq.watermark?.url;
      const parsed = new URL(url);
      if (!parsed.hostname.includes('localhost')) {
        // Attempt to download the watermark and cache it.
        const cacheWatermarkResult = await Result.attemptAsync(() =>
          serverContext().cacheImageService.getOrDownloadImageUrl(url),
        );
        if (cacheWatermarkResult.isFailure()) {
          this.logger.warn(
            cacheWatermarkResult.error,
            'Was unable to cache watermark URL at %s',
            url,
          );
        }
      }
    }

    if (isDefined(updateReq.fillerCollections))
      [
        await em.transactional(async (em) => {
          await em.repo(ChannelFillerShow).nativeDelete({
            channel: { uuid: id },
          });

          const channelFillerShows = map(
            updateReq.fillerCollections,
            (filler) => {
              return em.create(ChannelFillerShow, {
                cooldown: filler.cooldownSeconds,
                channel: em.getReference(Channel, id),
                fillerShow: em.getReference(
                  FillerShow,
                  tag<FillerShowId>(filler.id),
                ),
                weight: filler.weight,
              });
            },
          );

          await em.insertMany(ChannelFillerShow, channelFillerShows);
        }),
      ];

    if (isDefined(updateReq.onDemand)) {
      const db = await this.getFileDb(id);
      await db.update((lineup) => {
        if (updateReq.onDemand?.enabled ?? false) {
          lineup.onDemandConfig = {
            state: 'paused',
            cursor: 0,
          };
        } else {
          delete lineup['onDemandConfig'];
        }
      });
    }

    await em.flush();

    return {
      channel: await loadedChannel.populate(['fillers', 'channelFillers']),
      lineup: await this.loadLineup(id),
    };
  }

  async updateChannelStartTime(id: string, newTime: number) {
    const ts = dayjs(newTime);
    return getEm().nativeUpdate(
      Channel,
      {
        uuid: id,
      },
      {
        startTime: ts.unix() * 1000,
      },
    );
  }

  async deleteChannel(
    channelId: string,
    blockOnLineupUpdates: boolean = false,
  ) {
    const em = getEm();
    let marked = false;
    try {
      await this.markLineupFileForDeletion(channelId);
      marked = true;

      const ref = em.getReference(Channel, channelId);
      await em.remove(ref).flush();
      // Best effort remove references to this channel
      const removeRefs = () =>
        this.removeRedirectReferences(channelId).catch((e) => {
          this.logger.error('Error while removing redirect references: %O', e);
        });

      if (blockOnLineupUpdates) {
        await removeRefs();
      } else {
        process.nextTick(() => {
          removeRefs().catch(() => {});
        });
      }
    } catch (e) {
      // If we failed at the DB level for some reason,
      // try to restore the lineup file.
      if (marked) {
        await this.restoreLineupFile(channelId);
      }

      this.logger.error(
        'Error while attempting to delete channel %s: %O',
        channelId,
        e,
      );

      throw e;
    }
  }

  async getAllChannelNumbers() {
    const channels = await getEm().findAll(Channel, {
      fields: ['number'],
      orderBy: { number: QueryOrder.DESC },
    });
    return channels.map((channel) => channel.number);
  }

  async getAllChannels(orderBy?: OrderDefinition<Channel>) {
    // TODO return all programs
    return getEm().repo(Channel).findAll({ orderBy });
  }

  async getAllChannelsAndPrograms(): Promise<RawChannelWithPrograms[]> {
    return await directDbAccess()
      .selectFrom('channel')
      .selectAll(['channel'])
      .leftJoin(
        'channelPrograms',
        'channelPrograms.channelUuid',
        'channel.uuid',
      )
      .select((eb) => [
        withPrograms(eb, {
          joins: {
            trackAlbum: MinimalProgramGroupingFields,
            trackArtist: MinimalProgramGroupingFields,
            tvShow: MinimalProgramGroupingFields,
            tvSeason: MinimalProgramGroupingFields,
          },
        }),
      ])
      .groupBy('channel.uuid')
      .orderBy('channel.number asc')
      .execute();
  }

  async updateLineup(id: string, req: UpdateChannelProgrammingRequest) {
    const em = getEm();
    const channel = await em.findOne(Channel, id, {
      populate: ['programs:ref'],
    });
    const lineup = await this.loadLineup(id);

    if (isNil(channel)) {
      return null;
    }

    const updateChannel = async (
      lineup: readonly LineupItem[],
      startTime: number,
    ) => {
      return await em.transactional(async (em) => {
        channel.startTime = startTime;
        channel.duration = sumBy(lineup, typedProperty('durationMs'));

        const allNewIds = new Set([
          ...ld
            .chain(lineup)
            .filter(isContentItem)
            .map((p) => p.id)
            .uniq()
            .value(),
        ]);

        const existingIds = new Set([
          ...channel.programs.map((program) => program.uuid),
        ]);

        // Create our remove operations
        const removeOperations: ProgramRelationOperation[] = ld
          .chain([...existingIds])
          .reject((existingId) => allNewIds.has(existingId))
          .map((removalId) => ({
            operation: 'remove' as const,
            id: em.getReference(Program, removalId),
          }))
          .value();

        // Create addition operations
        const addOperations: ProgramRelationOperation[] = ld
          .chain([...allNewIds])
          .reject((newId) => existingIds.has(newId))
          .map((addId) => ({
            operation: 'add' as const,
            id: em.getReference(Program, addId),
          }))
          .value();

        await mapAsyncSeq(
          chunk(
            [...addOperations, ...removeOperations],
            SqliteMaxDepthLimit / 2,
          ),
          async (ops) => {
            const [adds, removes] = partition(
              ops,
              ({ operation }) => operation === 'add',
            );
            channel.programs.remove(map(removes, ({ id }) => id));
            channel.programs.add(map(adds, ({ id }) => id));
            await em.persistAndFlush(channel);
          },
        );

        return channel;
      });
    };

    const createNewLineup = async (
      programs: ChannelProgram[],
      lineup: ChannelProgram[] = programs,
    ) => {
      const upsertedPrograms =
        await this.programDB.upsertContentPrograms(programs);
      const dbIdByUniqueId = groupByFunc(
        upsertedPrograms,
        programExternalIdString,
        (p) => p.uuid,
      );
      return map(lineup, channelProgramToLineupItemFunc(dbIdByUniqueId));
    };

    if (req.type === 'manual') {
      const programs = req.programs;
      const lineupItems = compact(
        map(req.lineup, ({ index, duration }) => {
          const program = nth(programs, index);
          if (program) {
            return {
              ...program,
              duration: duration ?? program.duration,
            };
          }
          return;
        }),
      );

      const newLineupItems = await this.timer.timeAsync('createNewLineup', () =>
        createNewLineup(programs, lineupItems),
      );
      const updatedChannel = await this.timer.timeAsync('updateChannel', () =>
        updateChannel(newLineupItems, dayjs().unix() * 1000),
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
      // const programs = req.body.programs;
      // const persistedPrograms = filter(programs, isContentProgram)
      // const upsertedPrograms = await upsertContentPrograms(programs);
      // TODO: What would it be like to run the scheduler in a separate worker thread??
      // await runWorker<number>(
      //   new URL('../../util/scheduleTimeSlotsWorker', import.meta.url),
      //   {
      //     schedule: req.body.schedule,
      //     programs: req.body.programs,
      //   },
      // ),
      const { programs, startTime } =
        req.type === 'time'
          ? await scheduleTimeSlots(req.schedule, req.programs)
          : await scheduleRandomSlots(req.schedule, req.programs);

      const newLineup = await createNewLineup(programs);

      const updatedChannel = await updateChannel(newLineup, startTime);
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

  /**
   * Like {@link ChannelDB#saveLineup} but only allows updating config-based information in the lineup
   */
  async updateLineupConfig<
    Key extends keyof Omit<
      Lineup,
      'items' | 'startTimeOffsets' | 'pendingPrograms'
    >,
  >(id: string, key: Key, conf: Lineup[Key]) {
    const lineupDb = await this.getFileDb(id);
    return await lineupDb.update((existing) => {
      existing[key] = conf;
    });
  }

  async setChannelPrograms(
    channel: Loaded<Channel>,
    lineup: readonly LineupItem[],
  ): Promise<Loaded<Channel> | null>;
  async setChannelPrograms(
    channel: string | Loaded<Channel>,
    lineup: readonly LineupItem[],
    startTime?: number,
  ): Promise<Loaded<Channel> | null> {
    const loadedChannel = await run(async () => {
      if (isString(channel)) {
        return await this.getChannelById(channel);
      } else {
        return channel;
      }
    });

    if (isNull(loadedChannel)) {
      return null;
    }

    return await getEm().transactional(async (em) => {
      if (!isUndefined(startTime)) {
        loadedChannel.startTime = startTime;
      }
      loadedChannel.duration = sumBy(lineup, typedProperty('durationMs'));

      const allIds = ld
        .chain(lineup)
        .filter(isContentItem)
        .map((p) => p.id)
        .uniq()
        .value();
      loadedChannel.programs.removeAll();
      await em.persistAndFlush(loadedChannel);
      const refs = allIds.map((id) => em.getReference(Program, id));
      loadedChannel.programs.set(refs);
      await em.persistAndFlush(loadedChannel);
      return loadedChannel;
    });
  }

  async addPendingPrograms(
    channelId: string,
    pendingPrograms: PendingProgram[],
  ) {
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

  async loadAllLineups() {
    return mapReduceAsyncSeq(
      await this.getAllChannelsAndPrograms(),
      async (channel) => {
        return {
          channel,
          lineup: await this.loadLineup(channel.uuid),
        };
      },
      (prev, { channel, lineup }) => ({
        ...prev,
        [channel.uuid]: { channel, lineup },
      }),
      {} as Record<string, { channel: RawChannelWithPrograms; lineup: Lineup }>,
    );
  }

  async loadAllLineupConfigs(forceRead: boolean = false) {
    return mapReduceAsyncSeq(
      await this.getAllChannels(),
      async (channel) => {
        return {
          channel,
          lineup: await this.loadLineup(channel.uuid, forceRead),
        };
      },
      (prev, { channel, lineup }) => ({
        ...prev,
        [channel.uuid]: { channel, lineup },
      }),
      {} as Record<string, { channel: Loaded<Channel>; lineup: Lineup }>,
    );
  }

  async loadChannelAndLineup(channelId: string) {
    const channel = await this.getChannelById(channelId);
    if (isNull(channel)) {
      return null;
    }

    return {
      channel,
      lineup: await this.loadLineup(channelId),
    };
  }

  async loadDirectChannelAndLineup(channelId: string) {
    const channel = await this.getChannelDirect(channelId);
    if (isNil(channel)) {
      return null;
    }

    return {
      channel,
      lineup: await this.loadLineup(channelId),
    };
  }

  async loadLineup(channelId: string, forceRead: boolean = false) {
    const db = await this.getFileDb(channelId, forceRead);
    return db.data;
  }

  async loadAndMaterializeLineup(
    channelId: string,
    offset: number = 0,
    limit: number = 100,
  ): Promise<ChannelProgramming | null> {
    const channel = await this.getChannelAndPrograms(channelId);
    if (isNil(channel)) {
      return null;
    }

    const lineup = await this.loadLineup(channelId);
    const len = lineup.items.length;
    const cleanOffset = offset < 0 ? 0 : offset;
    const cleanLimit = limit < 0 ? len : limit;

    const { lineup: apiLineup, offsets } = await this.buildApiLineup(
      channel,
      ld.chain(lineup.items).drop(cleanOffset).take(cleanLimit).value(),
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
    const pagedLineup = ld
      .chain(lineup.items)
      .drop(cleanOffset)
      .take(cleanLimit)
      .value();

    const channel = await this.timer.timeAsync('select channel', () =>
      getEm().repo(Channel).findOne({ uuid: channelId }),
    );

    if (isNil(channel)) {
      return null;
    }

    const contentItems = filter(pagedLineup, isContentItem);

    const directPrograms = await this.timer.timeAsync('direct', () =>
      directDbAccess()
        .selectFrom('channelPrograms')
        .where('channelUuid', '=', channelId)
        .innerJoin('program', 'channelPrograms.programUuid', 'program.uuid')
        .selectAll('program')
        .select((eb) => [
          withTvShow(eb),
          withTvSeason(eb),
          withTrackAlbum(eb),
          withTrackArtist(eb),
        ])
        .execute(),
    );

    const externalIds = await this.timer.timeAsync('eids', () =>
      this.getChannelProgramExternalIds(channelId),
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

        const converted =
          this.#programConverter.directEntityToContentProgramSync(
            program,
            externalIdsByProgramId[program.uuid] ?? [],
          );

        ret[converted.id!] = converted;
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
      apiOffsets = ld
        .chain(lineup.startTimeOffsets)
        .drop(cleanOffset)
        .take(cleanLimit)
        .value();
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

  async saveLineup(
    channelId: string,
    newLineup: MarkOptional<Omit<Lineup, 'lastUpdated'>, 'version'>,
  ) {
    const db = await this.getFileDb(channelId);
    newLineup.startTimeOffsets = reduce(
      newLineup.items,
      (acc, item, index) => [...acc, acc[index] + item.durationMs],
      [0],
    );
    db.data = {
      ...db.data,
      version: newLineup?.version ?? db.data.version,
      items: newLineup.items,
      startTimeOffsets: newLineup.startTimeOffsets,
      schedule: newLineup.schedule,
      pendingPrograms: newLineup.pendingPrograms,
      onDemandConfig: newLineup.onDemandConfig,
      lastUpdated: dayjs().valueOf(),
    };
    await db.write();
    return db.data;
  }

  async removeProgramsFromLineup(channelId: string, programIds: string[]) {
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

  private async createLineup(channelId: string) {
    const db = await this.getFileDb(channelId);
    await db.write();
  }

  private async getFileDb(channelId: string, forceRead: boolean = false) {
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
            join(
              globalOptions().databaseDirectory,
              `channel-lineups/${channelId}.json`,
            ),
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

  private async restoreLineupFile(channelId: string) {
    return this.markLineupFileForDeletion(channelId, false);
  }

  private async markLineupFileForDeletion(
    channelId: string,
    isDelete: boolean = true,
  ) {
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
        // Reload the file into the DB cache
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

  private async buildApiLineup(
    channel: RawChannelWithPrograms,
    lineup: LineupItem[],
  ): Promise<{ lineup: ChannelProgram[]; offsets: number[] }> {
    const allChannels = await directDbAccess()
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
          return this.#programConverter.directEntityToContentProgramSync(
            fullProgram,
            fullProgram.externalIds ?? [],
          );
        })
        .otherwise((item) =>
          this.#programConverter.directLineupItemToChannelProgram(
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
    channel: Loaded<Channel>,
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

      const results = await directDbAccess()
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

    const allChannels = await getEm()
      .repo(Channel)
      .findAll({
        fields: ['name', 'number'],
      });

    const channelsById = groupByUniqProp(allChannels, 'uuid');

    const programs = ld
      .chain(lineup)
      .map((item) => {
        let p: CondensedChannelProgram | null = null;
        if (isOfflineItem(item)) {
          p = this.#programConverter.offlineLineupItemToProgram(channel, item);
        } else if (isRedirectItem(item)) {
          if (channelsById[item.channel]) {
            p = this.#programConverter.redirectLineupItemToProgram(
              item,
              channelsById[item.channel],
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
            index: customShowIndexes[item.customShowId][item.id] ?? -1,
            id: item.id,
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
      })
      .compact()
      .value();
    return { lineup: programs, offsets };
  }

  private async removeRedirectReferences(toChannel: string) {
    const allChannels = await this.getAllChannels();

    const ops = asyncPool(
      reject(allChannels, { uuid: toChannel }),
      async (channel) => {
        const lineup = await this.loadLineup(channel.uuid);
        let changed = false;
        const newLineup: LineupItem[] = map(lineup.items, (item) => {
          if (item.type === 'redirect' && item.channel === toChannel) {
            changed = true;
            return {
              type: 'offline',
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
      if (updateResult.type === 'error') {
        this.logger.error(
          'Error removing redirect references for channel %s from channel %s',
          toChannel,
          updateResult.input.uuid,
        );
      }
    }
  }
}

function channelProgramToLineupItemFunc(
  dbIdByUniqueId: Record<string, string>,
): (p: ChannelProgram) => LineupItem {
  return forProgramType<LineupItem>({
    custom: (program) => ({
      type: 'content', // Custom program
      durationMs: program.duration,
      id: program.id,
      customShowId: program.customShowId,
    }),
    content: (program) => {
      return {
        type: 'content',
        id: program.persisted ? program.id! : dbIdByUniqueId[program.uniqueId],
        durationMs: program.duration,
      };
    },
    redirect: (program) => ({
      type: 'redirect',
      channel: program.channel,
      durationMs: program.duration,
    }),
    flex: (program) => ({
      type: 'offline',
      durationMs: program.duration,
    }),
  });
}
