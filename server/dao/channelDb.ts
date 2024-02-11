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
  isNil,
  isNull,
  map,
  nth,
  omitBy,
  sumBy,
} from 'lodash-es';
import { Low } from 'lowdb';
import { DataFile } from 'lowdb/node';
import { join } from 'path';
import { globalOptions } from '../globals.js';
import { Nullable } from '../types.js';
import { groupByFunc, groupByUniqAndMap } from '../util.js';
import { dbProgramToContentProgram } from './converters/programConverters.js';
import { getEm } from './dataSource.js';
import {
  Lineup,
  LineupItem,
  OfflineItem,
  isContentItem,
  isOfflineItem,
  isRedirectItem,
} from './derived_types/Lineup.js';
import { Channel } from './entities/Channel.js';
import { Program } from './entities/Program.js';
import { upsertContentPrograms } from './programHelpers.js';

dayjs.extend(duration);

function updateRequestToChannel(
  updateReq: SaveChannelRequest,
): Partial<Channel> {
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
      transcoding: updateReq.transcoding,
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
    transcoding: saveReq.transcoding,
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

  async deleteChannel(channelNumber: number) {
    const em = getEm();
    await em.repo(Channel).nativeDelete({ number: channelNumber });
    await em.flush();
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

    return {
      icon: channel.icon,
      name: channel.name,
      number: channel.number,
      totalPrograms: len,
      programs: buildApiLineup(
        channel,
        chain(lineup.items).drop(cleanOffset).take(cleanLimit).value(),
      ),
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
    return {
      icon: channel.icon,
      name: channel.name,
      number: channel.number,
      totalPrograms: len,
      programs: omitBy(materializedPrograms, isNil),
      lineup: buildCondensedLineup(channel, pagedLineup),
    };
  }

  async saveLineup(channelId: string, lineup: Lineup) {
    const db = await this.getFileDb(channelId);
    db.data = lineup;
    return await db.write();
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
        { items: [] },
      );
      await this.fileDbCache[channelId].read();
    }

    return this.fileDbCache[channelId];
  }
}

export function buildApiLineup(
  channel: Loaded<Channel, 'programs'>,
  lineup: LineupItem[],
) {
  return chain(lineup)
    .map((item) => toApiLineupItem(channel, item))
    .compact()
    .value();
}

export function buildCondensedLineup(
  channel: Loaded<Channel, 'programs'>,
  lineup: LineupItem[],
): CondensedChannelProgram[] {
  return chain(lineup)
    .map((item) => {
      let p: CondensedChannelProgram | null = null;
      if (isOfflineItem(item)) {
        p = offlineLineupItemToProgram(channel, item);
      } else if (isRedirectItem(item)) {
        // TODO: Materialize the redirected program???
        p = {
          persisted: true,
          type: 'redirect',
          channel: item.channel,
          duration: item.durationMs,
        };
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

      return p;
    })
    .compact()
    .value();
}

export function toApiLineupItem(
  channel: Loaded<Channel, 'programs'>,
  item: LineupItem,
) {
  if (isOfflineItem(item)) {
    return offlineLineupItemToProgram(channel, item);
  } else if (isRedirectItem(item)) {
    // TODO: Materialize the redirected program???
    return {
      persisted: true,
      type: 'redirect',
      channel: item.channel,
    } as RedirectProgram;
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
