import { ChannelQueryBuilder } from '@/db/ChannelQueryBuilder.js';
import { CacheImageService } from '@/services/cacheImageService.js';
import { ChannelNotFoundError } from '@/types/errors.js';
import { KEYS } from '@/types/inject.js';
import { Result } from '@/types/result.js';
import { Maybe } from '@/types/util.js';
import dayjs from '@/util/dayjs.js';
import type { SaveableChannel, Watermark } from '@tunarr/types';
import { desc, eq, sql } from 'drizzle-orm';
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
  NewChannelOrm,
} from '../schema/Channel.ts';
import { ChannelFillerShow } from '../schema/ChannelFillerShow.ts';
import { ChannelPrograms } from '../schema/ChannelPrograms.ts';
import {
  ChannelWithRelations,
  ChannelOrmWithTranscodeConfig,
} from '../schema/derivedTypes.ts';
import {
  ChannelSubtitlePreferences,
  NewChannelSubtitlePreferenceOrm,
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

function updateRequestToChannel(
  updateReq: SaveableChannel,
): Partial<NewChannelOrm> {
  const sanitizedWatermark = sanitizeChannelWatermark(updateReq.watermark);

  return {
    number: updateReq.number,
    watermark: sanitizedWatermark ?? undefined,
    icon: updateReq.icon,
    guideMinimumDuration: updateReq.guideMinimumDuration,
    groupTitle: updateReq.groupTitle,
    disableFillerOverlay: updateReq.disableFillerOverlay,
    startTime: +dayjs(updateReq.startTime).second(0).millisecond(0),
    offline: updateReq.offline,
    name: updateReq.name,
    duration: updateReq.duration,
    stealth: updateReq.stealth,
    fillerRepeatCooldown: updateReq.fillerRepeatCooldown,
    guideFlexTitle: updateReq.guideFlexTitle,
    transcodeConfigId: updateReq.transcodeConfigId,
    streamMode: updateReq.streamMode,
    subtitlesEnabled: updateReq.subtitlesEnabled,
  } satisfies Partial<NewChannelOrm>;
}

function createRequestToChannel(saveReq: SaveableChannel): NewChannelOrm {
  const now = +dayjs();

  return {
    uuid: v4(),
    createdAt: now,
    updatedAt: now,
    number: saveReq.number,
    watermark: saveReq.watermark ?? null,
    icon: saveReq.icon,
    guideMinimumDuration: saveReq.guideMinimumDuration,
    groupTitle: saveReq.groupTitle,
    disableFillerOverlay: saveReq.disableFillerOverlay,
    startTime: saveReq.startTime,
    offline: saveReq.offline,
    name: saveReq.name,
    duration: saveReq.duration,
    stealth: saveReq.stealth,
    fillerRepeatCooldown: saveReq.fillerRepeatCooldown,
    guideFlexTitle: saveReq.guideFlexTitle,
    streamMode: saveReq.streamMode,
    transcodeConfigId: saveReq.transcodeConfigId,
    subtitlesEnabled: saveReq.subtitlesEnabled,
  } satisfies NewChannelOrm;
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
  ): Promise<ChannelAndLineup<ChannelOrm>> {
    const existing = await this.getChannel(createReq.number);
    if (!isNil(existing)) {
      throw new Error(
        `Channel with number ${createReq.number} already exists: ${existing.name}`,
      );
    }

    const channel = this.drizzleDB.transaction((tx) => {
      const channel = tx
        .insert(Channel)
        .values(createRequestToChannel(createReq))
        .returning()
        .get();

      if (!channel) {
        throw new Error('Error while saving new channel.');
      }

      if (!isEmpty(createReq.fillerCollections)) {
        tx.insert(ChannelFillerShow)
          .values(
            map(createReq.fillerCollections, (fc) => ({
              channelUuid: channel.uuid,
              cooldown: fc.cooldownSeconds,
              fillerShowUuid: fc.id,
              weight: fc.weight,
            })),
          )
          .run();
      }

      const subtitlePreferences = createReq.subtitlePreferences?.map(
        (pref) =>
          ({
            channelId: channel.uuid,
            uuid: v4(),
            languageCode: pref.langugeCode,
            allowExternal: pref.allowExternal,
            allowImageBased: pref.allowImageBased,
            filterType: pref.filter,
            priority: pref.priority,
          }) satisfies NewChannelSubtitlePreferenceOrm,
      );
      if (subtitlePreferences) {
        tx.insert(ChannelSubtitlePreferences)
          .values(subtitlePreferences)
          .run();
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
  ): Promise<ChannelAndLineup> {
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

    this.drizzleDB.transaction((tx) => {
      tx.update(Channel).set(update).where(eq(Channel.uuid, id)).run();

      if (!isEmpty(updateReq.fillerCollections)) {
        const channelFillerShows = map(
          updateReq.fillerCollections,
          (filler) => ({
            cooldown: filler.cooldownSeconds,
            channelUuid: channel.uuid,
            fillerShowUuid: filler.id,
            weight: filler.weight,
          }),
        );

        tx.delete(ChannelFillerShow)
          .where(eq(ChannelFillerShow.channelUuid, channel.uuid))
          .run();
        tx.insert(ChannelFillerShow).values(channelFillerShows).run();
      }
      const subtitlePreferences = updateReq.subtitlePreferences?.map(
        (pref) =>
          ({
            channelId: channel.uuid,
            uuid: v4(),
            languageCode: pref.langugeCode,
            allowExternal: pref.allowExternal,
            allowImageBased: pref.allowImageBased,
            filterType: pref.filter,
            priority: pref.priority,
          }) satisfies NewChannelSubtitlePreferenceOrm,
      );
      tx.delete(ChannelSubtitlePreferences)
        .where(eq(ChannelSubtitlePreferences.channelId, channel.uuid))
        .run();
      if (subtitlePreferences) {
        tx.insert(ChannelSubtitlePreferences)
          .values(subtitlePreferences)
          .run();
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
      channel: (await this.getChannelOrm(id))!,
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
    const channelAndLineup =
      await this.lineupRepository.loadChannelAndLineup(id);
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

  async copyChannel(id: string): Promise<ChannelAndLineup<ChannelOrm>> {
    const channel = await this.getChannelOrm(id);
    if (!channel) {
      throw new Error(`Cannot copy channel: channel ID: ${id} not found`);
    }

    const lineup = await this.lineupRepository.loadLineup(id);

    const newChannelId = v4();
    const now = +dayjs();
    const newChannel = this.drizzleDB.transaction((tx) => {
      const maxRow = tx
        .select({ number: Channel.number })
        .from(Channel)
        .orderBy(desc(Channel.number))
        .limit(1)
        .get();

      const maxNumber = maxRow?.number ?? 0;

      const { transcodeConfig: _, ...channelFields } = channel;
      const newChannel = tx
        .insert(Channel)
        .values({
          ...channelFields,
          uuid: newChannelId,
          name: `${channel.name} - Copy`,
          number: maxNumber + 1,
          icon: channel.icon,
          offline: channel.offline,
          watermark: channel.watermark,
          createdAt: now,
          updatedAt: now,
          transcoding: null,
          transcodeConfigId: channel.transcodeConfigId,
        })
        .returning()
        .get();

      tx.insert(ChannelFillerShow)
        .select(
          tx
            .select({
              channelUuid: sql<string>`${newChannelId}`.as('channelUuid'),
              fillerShowUuid: ChannelFillerShow.fillerShowUuid,
              cooldown: ChannelFillerShow.cooldown,
              weight: ChannelFillerShow.weight,
            })
            .from(ChannelFillerShow)
            .where(eq(ChannelFillerShow.channelUuid, channel.uuid)),
        )
        .run();

      tx.insert(ChannelPrograms)
        .select(
          tx
            .select({
              channelUuid: sql<string>`${newChannelId}`.as('channelUuid'),
              programUuid: ChannelPrograms.programUuid,
            })
            .from(ChannelPrograms)
            .where(eq(ChannelPrograms.channelUuid, channel.uuid)),
        )
        .run();

      return newChannel;
    });

    const newLineup = await this.lineupRepository.saveLineup(
      newChannel.uuid,
      lineup,
    );

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

      this.drizzleDB.transaction((tx) => {
        tx.delete(ChannelSubtitlePreferences)
          .where(eq(ChannelSubtitlePreferences.channelId, channelId))
          .run();
        tx.delete(Channel).where(eq(Channel.uuid, channelId)).run();
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
