import { ChannelQueryBuilder } from '@/db/ChannelQueryBuilder.js';
import { CacheImageService } from '@/services/cacheImageService.js';
import { ChannelNotFoundError } from '@/types/errors.js';
import { KEYS } from '@/types/inject.js';
import { Result } from '@/types/result.js';
import { Maybe } from '@/types/util.js';
import dayjs from '@/util/dayjs.js';
import { booleanToNumber } from '@/util/sqliteUtil.js';
import type { SaveableChannel, Watermark } from '@tunarr/types';
import { eq } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import { Kysely } from 'kysely';
import { jsonArrayFrom } from 'kysely/helpers/sqlite';
import {
  isEmpty,
  isNil,
  isNumber,
  isString,
  isUndefined,
  map,
  sum,
} from 'lodash-es';
import { MarkRequired } from 'ts-essentials';
import { v4 } from 'uuid';
import { isDefined, isNonEmptyString } from '../../util/index.ts';
import { ChannelAndLineup } from '../interfaces/IChannelDB.ts';
import {
  Channel,
  ChannelOrm,
  ChannelUpdate,
  NewChannel,
} from '../schema/Channel.ts';
import { NewChannelFillerShow } from '../schema/ChannelFillerShow.ts';
import {
  ChannelWithRelations,
  ChannelOrmWithTranscodeConfig,
} from '../schema/derivedTypes.ts';
import {
  NewChannelSubtitlePreference,
} from '../schema/SubtitlePreferences.ts';
import type { DB } from '../schema/db.ts';
import type { DrizzleDBAccess } from '../schema/index.ts';
import { LineupRepository } from './LineupRepository.ts';

function sanitizeChannelWatermark(
  watermark: Maybe<Watermark>,
): Maybe<Watermark> {
  if (isUndefined(watermark)) {
    return;
  }

  const validFadePoints = (watermark.fadeConfig ?? []).filter(
    (conf) => conf.periodMins > 0,
  );

  return {
    ...watermark,
    fadeConfig: isEmpty(validFadePoints) ? undefined : validFadePoints,
  };
}

function updateRequestToChannel(updateReq: SaveableChannel): ChannelUpdate {
  const sanitizedWatermark = sanitizeChannelWatermark(updateReq.watermark);

  return {
    number: updateReq.number,
    watermark: sanitizedWatermark
      ? JSON.stringify(sanitizedWatermark)
      : undefined,
    icon: JSON.stringify(updateReq.icon),
    guideMinimumDuration: updateReq.guideMinimumDuration,
    groupTitle: updateReq.groupTitle,
    disableFillerOverlay: booleanToNumber(updateReq.disableFillerOverlay),
    startTime: +dayjs(updateReq.startTime).second(0).millisecond(0),
    offline: JSON.stringify(updateReq.offline),
    name: updateReq.name,
    duration: updateReq.duration,
    stealth: booleanToNumber(updateReq.stealth),
    fillerRepeatCooldown: updateReq.fillerRepeatCooldown,
    guideFlexTitle: updateReq.guideFlexTitle,
    transcodeConfigId: updateReq.transcodeConfigId,
    streamMode: updateReq.streamMode,
    subtitlesEnabled: booleanToNumber(updateReq.subtitlesEnabled),
  } satisfies ChannelUpdate;
}

function createRequestToChannel(saveReq: SaveableChannel): NewChannel {
  const now = +dayjs();

  return {
    uuid: v4(),
    createdAt: now,
    updatedAt: now,
    number: saveReq.number,
    watermark: saveReq.watermark ? JSON.stringify(saveReq.watermark) : null,
    icon: JSON.stringify(saveReq.icon),
    guideMinimumDuration: saveReq.guideMinimumDuration,
    groupTitle: saveReq.groupTitle,
    disableFillerOverlay: saveReq.disableFillerOverlay ? 1 : 0,
    startTime: saveReq.startTime,
    offline: JSON.stringify(saveReq.offline),
    name: saveReq.name,
    duration: saveReq.duration,
    stealth: saveReq.stealth ? 1 : 0,
    fillerRepeatCooldown: saveReq.fillerRepeatCooldown,
    guideFlexTitle: saveReq.guideFlexTitle,
    streamMode: saveReq.streamMode,
    transcodeConfigId: saveReq.transcodeConfigId,
    subtitlesEnabled: booleanToNumber(saveReq.subtitlesEnabled),
  } satisfies NewChannel;
}

@injectable()
export class BasicChannelRepository {
  constructor(
    @inject(KEYS.Database) private db: Kysely<DB>,
    @inject(KEYS.DrizzleDB) private drizzleDB: DrizzleDBAccess,
    @inject(CacheImageService) private cacheImageService: CacheImageService,
    @inject(KEYS.LineupRepository) private lineupRepository: LineupRepository,
  ) {}

  async channelExists(channelId: string): Promise<boolean> {
    const channel = await this.db
      .selectFrom('channel')
      .where('channel.uuid', '=', channelId)
      .select('uuid')
      .executeTakeFirst();
    return !isNil(channel);
  }

  getChannelOrm(
    id: string | number,
  ): Promise<Maybe<ChannelOrmWithTranscodeConfig>> {
    return this.drizzleDB.query.channels.findFirst({
      where: (channel, { eq }) => {
        return isString(id) ? eq(channel.uuid, id) : eq(channel.number, id);
      },
      with: {
        transcodeConfig: true,
      },
    });
  }

  getChannel(id: string | number): Promise<Maybe<ChannelWithRelations>>;
  getChannel(
    id: string | number,
    includeFiller: true,
  ): Promise<Maybe<MarkRequired<ChannelWithRelations, 'fillerShows'>>>;
  async getChannel(
    id: string | number,
    includeFiller: boolean = false,
  ): Promise<Maybe<ChannelWithRelations>> {
    return this.db
      .selectFrom('channel')
      .$if(isString(id), (eb) => eb.where('channel.uuid', '=', id as string))
      .$if(isNumber(id), (eb) => eb.where('channel.number', '=', id as number))
      .$if(includeFiller, (eb) =>
        eb.select((qb) =>
          jsonArrayFrom(
            qb
              .selectFrom('channelFillerShow')
              .whereRef('channel.uuid', '=', 'channelFillerShow.channelUuid')
              .select([
                'channelFillerShow.channelUuid',
                'channelFillerShow.fillerShowUuid',
                'channelFillerShow.cooldown',
                'channelFillerShow.weight',
              ]),
          ).as('fillerShows'),
        ),
      )
      .selectAll()
      .executeTakeFirst();
  }

  getChannelBuilder(id: string | number) {
    return ChannelQueryBuilder.createForIdOrNumber(this.db, id);
  }

  getAllChannels(): Promise<ChannelOrm[]> {
    return this.drizzleDB.query.channels
      .findMany({
        orderBy: (fields, { asc }) => asc(fields.number),
      })
      .execute();
  }

  async saveChannel(
    createReq: SaveableChannel,
  ): Promise<ChannelAndLineup<Channel>> {
    const existing = await this.getChannel(createReq.number);
    if (!isNil(existing)) {
      throw new Error(
        `Channel with number ${createReq.number} already exists: ${existing.name}`,
      );
    }

    const channel = await this.db.transaction().execute(async (tx) => {
      const channel = await tx
        .insertInto('channel')
        .values(createRequestToChannel(createReq))
        .returningAll()
        .executeTakeFirst();

      if (!channel) {
        throw new Error('Error while saving new channel.');
      }

      if (!isEmpty(createReq.fillerCollections)) {
        await tx
          .insertInto('channelFillerShow')
          .values(
            map(
              createReq.fillerCollections,
              (fc) =>
                ({
                  channelUuid: channel.uuid,
                  cooldown: fc.cooldownSeconds,
                  fillerShowUuid: fc.id,
                  weight: fc.weight,
                }) satisfies NewChannelFillerShow,
            ),
          )
          .execute();
      }

      const subtitlePreferences = createReq.subtitlePreferences?.map(
        (pref) =>
          ({
            channelId: channel.uuid,
            uuid: v4(),
            languageCode: pref.langugeCode,
            allowExternal: booleanToNumber(pref.allowExternal),
            allowImageBased: booleanToNumber(pref.allowImageBased),
            filterType: pref.filter,
            priority: pref.priority,
          }) satisfies NewChannelSubtitlePreference,
      );
      if (subtitlePreferences) {
        await tx
          .insertInto('channelSubtitlePreferences')
          .values(subtitlePreferences)
          .executeTakeFirstOrThrow();
      }

      return channel;
    });

    await this.lineupRepository.createLineup(channel.uuid);

    if (isDefined(createReq.onDemand) && createReq.onDemand.enabled) {
      const db = await this.lineupRepository.getFileDb(channel.uuid);
      await db.update((lineup) => {
        lineup.onDemandConfig = {
          state: 'paused',
          cursor: 0,
        };
      });
    }

    return {
      channel,
      lineup: (await this.lineupRepository.getFileDb(channel.uuid)).data,
    };
  }

  async updateChannel(
    id: string,
    updateReq: SaveableChannel,
  ): Promise<ChannelAndLineup<Channel>> {
    const channel = await this.getChannel(id);

    if (isNil(channel)) {
      throw new ChannelNotFoundError(id);
    }

    const update = updateRequestToChannel(updateReq);

    if (
      isNonEmptyString(updateReq.watermark?.url) &&
      URL.canParse(updateReq.watermark.url)
    ) {
      const url = updateReq.watermark?.url;
      const parsed = new URL(url);
      if (!parsed.hostname.includes('localhost')) {
        await Result.attemptAsync(() =>
          this.cacheImageService.getOrDownloadImageUrl(url),
        );
      }
    }

    await this.db.transaction().execute(async (tx) => {
      await tx
        .updateTable('channel')
        .where('channel.uuid', '=', id)
        .set(update)
        .executeTakeFirstOrThrow();

      if (!isEmpty(updateReq.fillerCollections)) {
        const channelFillerShows = map(
          updateReq.fillerCollections,
          (filler) =>
            ({
              cooldown: filler.cooldownSeconds,
              channelUuid: channel.uuid,
              fillerShowUuid: filler.id,
              weight: filler.weight,
            }) satisfies NewChannelFillerShow,
        );

        await tx
          .deleteFrom('channelFillerShow')
          .where('channelFillerShow.channelUuid', '=', channel.uuid)
          .executeTakeFirstOrThrow();
        await tx
          .insertInto('channelFillerShow')
          .values(channelFillerShows)
          .executeTakeFirstOrThrow();
      }
      const subtitlePreferences = updateReq.subtitlePreferences?.map(
        (pref) =>
          ({
            channelId: channel.uuid,
            uuid: v4(),
            languageCode: pref.langugeCode,
            allowExternal: booleanToNumber(pref.allowExternal),
            allowImageBased: booleanToNumber(pref.allowImageBased),
            filterType: pref.filter,
            priority: pref.priority,
          }) satisfies NewChannelSubtitlePreference,
      );
      await tx
        .deleteFrom('channelSubtitlePreferences')
        .where('channelSubtitlePreferences.channelId', '=', channel.uuid)
        .executeTakeFirstOrThrow();
      if (subtitlePreferences) {
        await tx
          .insertInto('channelSubtitlePreferences')
          .values(subtitlePreferences)
          .executeTakeFirstOrThrow();
      }
    });

    if (isDefined(updateReq.onDemand)) {
      const db = await this.lineupRepository.getFileDb(id);
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

    return {
      channel: (await this.getChannel(id, true))!,
      lineup: await this.lineupRepository.loadLineup(id),
    };
  }

  updateChannelDuration(id: string, newDur: number): Promise<number> {
    return this.drizzleDB
      .update(Channel)
      .set({
        duration: newDur,
      })
      .where(eq(Channel.uuid, id))
      .limit(1)
      .execute()
      .then((_) => _.changes);
  }

  async updateChannelStartTime(id: string, newTime: number): Promise<void> {
    return this.db
      .updateTable('channel')
      .where('channel.uuid', '=', id)
      .set('startTime', newTime)
      .executeTakeFirst()
      .then(() => {});
  }

  async syncChannelDuration(id: string): Promise<boolean> {
    const channelAndLineup = await this.lineupRepository.loadChannelAndLineup(id);
    if (!channelAndLineup) {
      return false;
    }
    const { channel, lineup } = channelAndLineup;
    const lineupDuration = sum(map(lineup.items, (item) => item.durationMs));
    if (lineupDuration !== channel.duration) {
      await this.db
        .updateTable('channel')
        .where('channel.uuid', '=', id)
        .set('duration', lineupDuration)
        .executeTakeFirst();
      return true;
    }
    return false;
  }

  async copyChannel(id: string): Promise<ChannelAndLineup<Channel>> {
    const channel = await this.getChannel(id);
    if (!channel) {
      throw new Error(`Cannot copy channel: channel ID: ${id} not found`);
    }

    const lineup = await this.lineupRepository.loadLineup(id);

    const newChannelId = v4();
    const now = +dayjs();
    const newChannel = await this.db.transaction().execute(async (tx) => {
      const { number: maxId } = await tx
        .selectFrom('channel')
        .select('number')
        .orderBy('number desc')
        .limit(1)
        .executeTakeFirstOrThrow();
      const newChannel = await tx
        .insertInto('channel')
        .values({
          ...channel,
          uuid: newChannelId,
          name: `${channel.name} - Copy`,
          number: maxId + 1,
          icon: JSON.stringify(channel.icon),
          offline: JSON.stringify(channel.offline),
          watermark: JSON.stringify(channel.watermark),
          createdAt: now,
          updatedAt: now,
          transcoding: null,
        })
        .returningAll()
        .executeTakeFirstOrThrow();

      await tx
        .insertInto('channelFillerShow')
        .columns(['channelUuid', 'cooldown', 'fillerShowUuid', 'weight'])
        .expression((eb) =>
          eb
            .selectFrom('channelFillerShow')
            .select([
              eb.val(newChannelId).as('channelUuid'),
              'channelFillerShow.cooldown',
              'channelFillerShow.fillerShowUuid',
              'channelFillerShow.weight',
            ])
            .where('channelFillerShow.channelUuid', '=', channel.uuid),
        )
        .executeTakeFirstOrThrow();

      await tx
        .insertInto('channelPrograms')
        .columns(['channelUuid', 'programUuid'])
        .expression((eb) =>
          eb
            .selectFrom('channelPrograms')
            .select([
              eb.val(newChannelId).as('channelUuid'),
              'channelPrograms.programUuid',
            ])
            .where('channelPrograms.channelUuid', '=', channel.uuid),
        )
        .executeTakeFirstOrThrow();

      await tx
        .insertInto('channelCustomShows')
        .columns(['channelUuid', 'customShowUuid'])
        .expression((eb) =>
          eb
            .selectFrom('channelCustomShows')
            .select([
              eb.val(newChannelId).as('channelUuid'),
              'channelCustomShows.customShowUuid',
            ])
            .where('channelCustomShows.channelUuid', '=', channel.uuid),
        )
        .executeTakeFirstOrThrow();

      return newChannel;
    });

    const newLineup = await this.lineupRepository.saveLineup(newChannel.uuid, lineup);

    return {
      channel: newChannel,
      lineup: newLineup,
    };
  }

  async deleteChannel(
    channelId: string,
    blockOnLineupUpdates: boolean = false,
  ): Promise<void> {
    let marked = false;
    try {
      await this.lineupRepository.markLineupFileForDeletion(channelId);
      marked = true;

      await this.db.transaction().execute(async (tx) => {
        await tx
          .deleteFrom('channelSubtitlePreferences')
          .where('channelId', '=', channelId)
          .executeTakeFirstOrThrow();
        await tx
          .deleteFrom('channel')
          .where('uuid', '=', channelId)
          .limit(1)
          .executeTakeFirstOrThrow();
      });

      const removeRefs = () =>
        this.lineupRepository.removeRedirectReferences(channelId).catch(() => {
          // Errors are logged inside removeRedirectReferences
        });

      if (blockOnLineupUpdates) {
        await removeRefs();
      } else {
        setTimeout(() => {
          removeRefs().catch(() => {});
        });
      }
    } catch (e) {
      if (marked) {
        await this.lineupRepository.restoreLineupFile(channelId);
      }
      throw e;
    }
  }
}
