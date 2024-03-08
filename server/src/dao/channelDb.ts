import { Loaded, QueryOrder, RequiredEntityData, wrap } from '@mikro-orm/core';
import { scheduleTimeSlots } from '@tunarr/shared';
import {
  ChannelProgram,
  ChannelProgramming,
  CondensedChannelProgram,
  CondensedChannelProgramming,
  ContentProgram,
  FlexProgram,
  RedirectProgram,
  SaveChannelRequest,
} from '@tunarr/types';
import { UpdateChannelProgrammingRequest } from '@tunarr/types/api';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration.js';
import {
  chain,
  compact,
  filter,
  isEmpty,
  isNil,
  isNull,
  map,
  nth,
  omitBy,
  reduce,
  sumBy,
  take,
} from 'lodash-es';
import { Low } from 'lowdb';
import { DataFile } from 'lowdb/node';
import fs from 'node:fs/promises';
import { join } from 'path';
import { globalOptions } from '../globals.js';
import createLogger from '../logger.js';
import { Nullable } from '../types.js';
import { groupByFunc, groupByUniqAndMap } from '../util.js';
import { fileExists } from '../util/fsUtil.js';
import { dbProgramToContentProgram } from './converters/programConverters.js';
import { getEm } from './dataSource.js';
import {
  Lineup,
  LineupItem,
  OfflineItem,
  RedirectItem,
  isContentItem,
  isOfflineItem,
  isRedirectItem,
} from './derived_types/Lineup.js';
import { Channel, ChannelTranscodingSettings } from './entities/Channel.js';
import { Program } from './entities/Program.js';
import { upsertContentPrograms } from './programHelpers.js';

dayjs.extend(duration);

const logger = createLogger(import.meta);

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
      watermark: updateReq.watermark,
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
      fillerRepeatCooldown: updateReq.fillerRepeatCooldown
        ? dayjs.duration({ seconds: updateReq.fillerRepeatCooldown })
        : undefined,
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

  const c: RequiredEntityData<Channel> = {
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
    fillerRepeatCooldown: saveReq.fillerRepeatCooldown
      ? dayjs.duration({ seconds: saveReq.fillerRepeatCooldown })
      : undefined,
  };
  return c;
}

export class ChannelDB {
  private fileDbCache: Record<string | number, Low<Lineup>> = {};

  getChannelByNumber(channelNumber: number): Promise<Nullable<Channel>> {
    return getEm().repo(Channel).findOne({ number: channelNumber });
  }

  getChannelById(id: string) {
    return getEm().repo(Channel).findOne({ uuid: id });
  }

  getChannelAndPrograms(uuid: string) {
    return getEm()
      .repo(Channel)
      .findOne({ uuid }, { populate: ['programs'] });
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

    const channel = new Channel();
    wrap(channel).assign(createRequestToChannel(createReq), { em });
    em.persist(channel);
    await this.createLineup(channel.uuid);
    await em.flush();
    return channel.uuid;
  }

  async updateChannel(id: string, updateReq: SaveChannelRequest) {
    const em = getEm();
    const channel = em.getReference(Channel, id);
    const update = updateRequestToChannel(updateReq);
    wrap(channel).assign(update, {
      merge: true,
      convertCustomTypes: true,
      onlyProperties: true,
    });
    console.log(channel);
    await em.flush();
    return channel;
  }

  async deleteChannel(channelId: string) {
    const em = getEm();
    let marked = false;
    try {
      await this.markFileDbForDeletion(channelId);
      marked = true;
      const ref = em.getReference(Channel, channelId);
      await em.remove(ref).flush();
    } catch (e) {
      // If we failed at the DB level for some reason,
      // try to restore the lineup file.
      if (marked) {
        await this.markFileDbForDeletion(channelId, false);
      }

      logger.error(
        'Error while attempting to delete channel %s: %O',
        channelId,
        e,
      );
    }
  }

  async getAllChannelNumbers() {
    const channels = await getEm().findAll(Channel, {
      fields: ['number'],
      orderBy: { number: QueryOrder.DESC },
    });
    return channels.map((channel) => channel.number);
  }

  async getAllChannels() {
    // TODO return all programs
    return getEm().repo(Channel).findAll();
  }

  async getAllChannelsAndPrograms() {
    return getEm()
      .repo(Channel)
      .findAll({ populate: ['programs'] });
  }

  async updateLineup(id: string, req: UpdateChannelProgrammingRequest) {
    const channel = await this.getChannelAndPrograms(id);

    if (isNil(channel)) {
      return null;
    }

    const em = getEm();

    const updateChannel = async (
      lineup: readonly LineupItem[],
      startTime: number,
    ) => {
      return await em.transactional(async (em) => {
        channel.startTime = startTime;
        channel.duration = sumBy(lineup, (p) => p.durationMs);
        const allIds = chain(lineup)
          .filter(isContentItem)
          .map((p) => p.id)
          .uniq()
          .value();
        channel.programs.removeAll();
        await em.persistAndFlush(channel);
        const refs = allIds.map((id) => em.getReference(Program, id));
        channel.programs.set(refs);
        await em.persistAndFlush(channel);
        return channel;
      });
    };

    const createNewLineup = async (
      programs: ChannelProgram[],
      lineup: ChannelProgram[] = programs,
    ) => {
      const upsertedPrograms = await upsertContentPrograms(programs);
      const dbIdByUniqueId = groupByFunc(
        upsertedPrograms,
        (p) => p.uniqueId(),
        (p) => p.uuid,
      );
      return map(lineup, (program) =>
        channelProgramToLineupItem(program, dbIdByUniqueId),
      );
    };

    if (req.type === 'manual') {
      const programs = req.programs;
      const lineup = compact(
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

      const newLineup = await createNewLineup(programs, lineup);
      const updatedChannel = await updateChannel(
        newLineup,
        dayjs().unix() * 1000,
      );
      await this.saveLineup(id, {
        items: newLineup,
      });

      return {
        channel: updatedChannel,
        newLineup,
      };
    } else if (req.type === 'time') {
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
      const { programs, startTime } = await scheduleTimeSlots(
        req.schedule,
        req.programs,
      );

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

  async loadLineup(channelId: string) {
    const db = await this.getFileDb(channelId);
    await db.read();
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

    const { lineup: apiLineup, offsets } = buildApiLineup(
      channel,
      chain(lineup.items).drop(cleanOffset).take(cleanLimit).value(),
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
    const channel = await this.getChannelAndPrograms(channelId);
    if (isNil(channel)) {
      return null;
    }

    const lineup = await this.loadLineup(channelId);
    const len = lineup.items.length;
    const cleanOffset = offset < 0 ? 0 : offset;
    const cleanLimit = limit < 0 ? len : limit;
    const pagedLineup = chain(lineup.items)
      .drop(cleanOffset)
      .take(cleanLimit)
      .value();

    const materializedPrograms = groupByUniqAndMap(
      filter(pagedLineup, isContentItem),
      'id',
      (item) => contentLineupItemToProgram(channel, item.id),
    );

    const { lineup: condensedLineup, offsets } = buildCondensedLineup(
      channel,
      pagedLineup,
    );

    let apiOffsets: number[];
    if (lineup.startTimeOffsets) {
      apiOffsets = chain(lineup.startTimeOffsets)
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

  async saveLineup(channelId: string, lineup: Lineup) {
    const db = await this.getFileDb(channelId);
    if (lineup.items.length === 0) {
      lineup.items.push({
        type: 'offline',
        durationMs: Number.MAX_SAFE_INTEGER,
      });
    }
    lineup.startTimeOffsets = reduce(
      lineup.items,
      (acc, item, index) => [...acc, acc[index] + item.durationMs],
      [0],
    );
    db.data = lineup;
    return await db.write();
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

  private async getFileDb(channelId: string) {
    if (!this.fileDbCache[channelId]) {
      this.fileDbCache[channelId] = new Low<Lineup>(
        new DataFile(
          join(globalOptions().database, `channel-lineups/${channelId}.json`),
          {
            parse: JSON.parse,
            stringify(data) {
              return JSON.stringify(data);
            },
          },
        ),
        { items: [], startTimeOffsets: [] },
      );
      await this.fileDbCache[channelId].read();
    }

    return this.fileDbCache[channelId];
  }

  private async markFileDbForDeletion(
    channelId: string,
    isDelete: boolean = true,
  ) {
    const path = join(
      globalOptions().database,
      `channel-lineups/${channelId}.json${isDelete ? '' : '.bak'}`,
    );
    try {
      if (await fileExists(path)) {
        const newPath = isDelete ? `${path}.bak` : path.replace('.bak', '');
        await fs.rename(path, newPath);
      }
      if (isDelete) {
        delete this.fileDbCache[channelId];
      } else {
        // Reload the file into the DB cache
        await this.getFileDb(channelId);
      }
    } catch (e) {
      logger.error(
        `Error while trying to ${
          isDelete ? 'mark' : 'unmark'
        } Channel %s lineup json for deletion: %O`,
        channelId,
        e,
      );
    }
  }
}

export function buildApiLineup(
  channel: Loaded<Channel, 'programs'>,
  lineup: LineupItem[],
): { lineup: ChannelProgram[]; offsets: number[] } {
  let lastOffset = 0;
  const offsets: number[] = [];
  const programs = chain(lineup)
    .map((item) => {
      const apiItem = toApiLineupItem(channel, item);
      if (apiItem) {
        offsets.push(lastOffset);
        lastOffset += item.durationMs;
      }
      return apiItem;
    })
    .compact()
    .value();

  return { lineup: programs, offsets };
}

export function buildCondensedLineup(
  channel: Loaded<Channel, 'programs'>,
  lineup: LineupItem[],
): { lineup: CondensedChannelProgram[]; offsets: number[] } {
  let lastOffset = 0;
  const offsets: number[] = [];
  const programs = chain(lineup)
    .map((item) => {
      let p: CondensedChannelProgram | null = null;
      if (isOfflineItem(item)) {
        p = offlineLineupItemToProgram(channel, item);
      } else if (isRedirectItem(item)) {
        p = redirectLineupItemToProgram(item);
      } else {
        const program = contentLineupItemToProgram(channel, item.id);
        if (!isNil(program)) {
          p = {
            persisted: true,
            type: 'content',
            id: item.id,
            // subtype: program.subtype,
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

export function toApiLineupItem(
  channel: Loaded<Channel, 'programs'>,
  item: LineupItem,
) {
  if (isOfflineItem(item)) {
    return offlineLineupItemToProgram(channel, item);
  } else if (isRedirectItem(item)) {
    return redirectLineupItemToProgram(item);
  } else {
    return contentLineupItemToProgram(channel, item.id);
  }
}

function offlineLineupItemToProgram(
  channel: Loaded<Channel>,
  p: OfflineItem,
  persisted: boolean = true,
): FlexProgram {
  return {
    persisted,
    type: 'flex',
    icon: channel.icon?.path,
    duration: p.durationMs,
  };
}

function redirectLineupItemToProgram(item: RedirectItem): RedirectProgram {
  // TODO: Materialize the redirected program???
  return {
    persisted: true,
    type: 'redirect',
    channel: item.channel,
    duration: item.durationMs,
  };
}

export function contentLineupItemToProgram(
  channel: Loaded<Channel, 'programs'>,
  programId: string,
  persisted: boolean = true,
): ContentProgram | null {
  const program = channel.programs.find((x) => x.uuid === programId);
  if (isNil(program)) {
    return null;
  }

  return dbProgramToContentProgram(program, persisted);
}

function channelProgramToLineupItem(
  program: ChannelProgram,
  dbIdByUniqueId: Record<string, string>,
): LineupItem {
  let item: LineupItem;
  switch (program.type) {
    case 'custom':
      item = {
        type: 'content', // Custom program
        durationMs: program.duration,
        id: program.id,
      };
      break;
    case 'content':
      item = {
        type: 'content',
        id: program.persisted ? program.id! : dbIdByUniqueId[program.uniqueId],
        durationMs: program.duration,
      };
      break;
    case 'redirect':
      item = {
        type: 'redirect',
        channel: '', // TODO fix this....!
        durationMs: program.duration,
      };
      break;
    case 'flex':
      item = {
        type: 'offline',
        durationMs: program.duration,
      };
      break;
  }

  return item;
}
