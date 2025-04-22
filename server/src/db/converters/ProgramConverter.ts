import { ProgramType } from '@/db/schema/Program.js';
import { MinimalProgramExternalId } from '@/db/schema/ProgramExternalId.js';
import { ProgramGroupingExternalId } from '@/db/schema/ProgramGroupingExternalId.js';
import { KEYS } from '@/types/inject.js';
import { isNonEmptyString, nullToUndefined } from '@/util/index.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import { seq } from '@tunarr/shared/util';
import {
  ChannelProgram,
  ContentProgram,
  FlexProgram,
  RedirectProgram,
} from '@tunarr/types';
import {
  isValidMultiExternalIdType,
  isValidSingleExternalIdType,
} from '@tunarr/types/schemas';
import { inject, injectable } from 'inversify';
import { Kysely } from 'kysely';
import { find, isNil, omitBy } from 'lodash-es';
import { isPromise } from 'node:util/types';
import { DeepNullable, DeepPartial, MarkRequired } from 'ts-essentials';
import {
  LineupItem,
  OfflineItem,
  RedirectItem,
  isOfflineItem,
  isRedirectItem,
} from '../derived_types/Lineup.js';
import { Channel } from '../schema/Channel.ts';
import { DB } from '../schema/db.ts';
import type {
  ChannelWithPrograms,
  ChannelWithRelations,
  ProgramWithRelations,
} from '../schema/derivedTypes.ts';

/**
 * Converts DB types to API types
 */
@injectable()
export class ProgramConverter {
  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(KEYS.Database) private db: Kysely<DB>,
  ) {}

  lineupItemToChannelProgram(
    channel: ChannelWithRelations,
    item: LineupItem,
    channelReferences: MarkRequired<
      DeepPartial<Channel>,
      'uuid' | 'number' | 'name'
    >[], // TODO fix this up...
    preMaterializedProgram?: ProgramWithRelations,
  ): ChannelProgram | null;
  lineupItemToChannelProgram(
    channel: ChannelWithPrograms,
    item: LineupItem,
    channelReferences: MarkRequired<
      DeepPartial<Channel>,
      'uuid' | 'number' | 'name'
    >[], // TODO fix this up...
    preMaterializedProgram?: ProgramWithRelations,
  ): ChannelProgram | null {
    if (isOfflineItem(item)) {
      return this.offlineLineupItemToProgram(channel, item);
    } else if (isRedirectItem(item)) {
      const redirectChannel = find(channelReferences, { uuid: item.channel });
      if (isNil(redirectChannel)) {
        this.logger.warn(
          'Dangling redirect channel reference. Source channel = %s, target channel = %s',
          channel.uuid,
          item.channel,
        );
        return this.offlineLineupItemToProgram(channel, {
          type: 'offline',
          durationMs: item.durationMs,
        });
      }
      return this.redirectLineupItemToProgram(item, redirectChannel);
    } else if (item.type === 'content') {
      const program =
        preMaterializedProgram && preMaterializedProgram.uuid === item.id
          ? preMaterializedProgram
          : channel.programs.find((p) => p.uuid === item.id);
      if (isNil(program)) {
        return null;
      }

      return this.programDaoToContentProgram(
        program,
        program.externalIds ?? [], // TODO fill in external IDs here
      );
    }

    return null;
  }

  programDaoToContentProgram(
    program: ProgramWithRelations,
    externalIds: MinimalProgramExternalId[],
  ): MarkRequired<ContentProgram, 'id'> {
    let extraFields: Partial<ContentProgram> = {};
    if (program.type === ProgramType.Episode) {
      extraFields = {
        ...extraFields,
        icon: nullToUndefined(program.episodeIcon ?? program.showIcon),
        showId: nullToUndefined(program.tvShow?.uuid ?? program.tvShowUuid),
        seasonId: nullToUndefined(program.tvSeason?.uuid ?? program.seasonUuid),
        // Fallback to the denormalized field, for now
        seasonNumber: nullToUndefined(
          program.tvSeason?.index ?? program.seasonNumber,
        ),
        episodeNumber: nullToUndefined(program.episode),
        title: program.title,
        parent: {
          id: nullToUndefined(program.tvSeason?.uuid ?? program.seasonUuid),
          index: nullToUndefined(program.tvSeason?.index),
          title: nullToUndefined(program.tvSeason?.title ?? program.showTitle),
          year: nullToUndefined(program.tvSeason?.year),
          externalKey: nullToUndefined(
            find(
              program.tvSeason?.externalIds ?? [],
              (eid) => eid.externalSourceId === program.externalSourceId,
            )?.externalKey,
          ),
          externalIds: seq.collect(program.tvSeason?.externalIds, (eid) =>
            this.toGroupingExternalId(eid),
          ),
        },
        grandparent: {
          id: nullToUndefined(program.tvShow?.uuid ?? program.tvShowUuid),
          index: nullToUndefined(program.tvShow?.index),
          title: nullToUndefined(program.tvShow?.title),
          externalKey: nullToUndefined(
            find(
              program.tvShow?.externalIds ?? [],
              (eid) => eid.externalSourceId === program.externalSourceId,
            )?.externalKey,
          ),
          year: nullToUndefined(program.tvShow?.year),
          externalIds: seq.collect(program.tvShow?.externalIds, (eid) =>
            this.toGroupingExternalId(eid),
          ),
        },
        index: nullToUndefined(program.episode),
      };
    } else if (program.type === ProgramType.Track.toString()) {
      extraFields = {
        parent: {
          id: nullToUndefined(program.trackAlbum?.uuid ?? program.albumUuid),
          index: nullToUndefined(program.trackAlbum?.index),
          title: nullToUndefined(
            program.albumName ?? program.trackAlbum?.title,
          ),
          externalKey: nullToUndefined(
            find(
              program.trackAlbum?.externalIds ?? [],
              (eid) => eid.externalSourceId === program.externalSourceId,
            )?.externalKey,
          ),
          year: nullToUndefined(program.trackAlbum?.year),
          externalIds: seq.collect(program.trackAlbum?.externalIds, (eid) =>
            this.toGroupingExternalId(eid),
          ),
        },
        grandparent: {
          id: nullToUndefined(program.trackArtist?.uuid ?? program.artistUuid),
          index: nullToUndefined(program.trackArtist?.index),
          title: nullToUndefined(program.trackArtist?.title),
          externalKey: nullToUndefined(
            find(
              program.trackArtist?.externalIds ?? [],
              (eid) => eid.externalSourceId === program.externalSourceId,
            )?.externalKey,
          ),
          year: nullToUndefined(program.trackArtist?.year),
          externalIds: seq.collect(program.trackArtist?.externalIds, (eid) =>
            this.toGroupingExternalId(eid),
          ),
        },
        albumId: nullToUndefined(program.trackAlbum?.uuid ?? program.albumUuid),
        artistId: nullToUndefined(
          program.trackArtist?.uuid ?? program.artistUuid,
        ),
        // HACK: Tracks save their index under the episode field
        index: nullToUndefined(program.episode),
      };
    }

    return {
      persisted: true, // Explicit since we're dealing with db loaded entities
      uniqueId: program.uuid,
      summary: nullToUndefined(program.summary),
      date: nullToUndefined(program.originalAirDate),
      rating: nullToUndefined(program.rating),
      icon: nullToUndefined(program.icon),
      title: program.title,
      duration: program.duration,
      type: 'content',
      id: program.uuid,
      subtype: program.type,
      externalIds: seq.collect(externalIds, (eid) => this.toExternalId(eid)),
      externalKey: program.externalKey,
      externalSourceId: program.externalSourceId,
      externalSourceName: program.externalSourceId,
      externalSourceType: program.sourceType,
      ...omitBy(extraFields, isNil),
    };
  }

  offlineLineupItemToProgram(
    channel: ChannelWithRelations,
    program: OfflineItem,
    persisted: boolean = true,
  ): FlexProgram {
    return {
      persisted,
      type: 'flex',
      icon: channel.icon?.path,
      duration: program.durationMs,
    };
  }

  redirectLineupItemToProgram(
    item: RedirectItem,
    channel: MarkRequired<DeepPartial<Channel>, 'name' | 'number'>,
  ): RedirectProgram;
  redirectLineupItemToProgram(
    item: RedirectItem,
    channel?: MarkRequired<DeepPartial<Channel>, 'name' | 'number'>,
  ): Promise<RedirectProgram> | RedirectProgram {
    const loadedChannel = isNil(channel)
      ? this.db
          .selectFrom('channel')
          .select(['uuid', 'number', 'name'])
          .where('uuid', '=', item.channel)
          .executeTakeFirstOrThrow()
      : channel;
    if (isPromise(loadedChannel)) {
      return loadedChannel.then((c) => this.toRedirectChannelInternal(item, c));
    } else {
      return this.toRedirectChannelInternal(item, loadedChannel);
    }
  }

  private toRedirectChannelInternal(
    item: RedirectItem,
    channel: MarkRequired<DeepPartial<Channel>, 'name' | 'number'>,
  ): RedirectProgram {
    return {
      persisted: true,
      type: 'redirect',
      channel: item.channel,
      channelName: channel.name,
      channelNumber: channel.number,
      duration: item.durationMs,
    };
  }

  private toExternalId(rawExternalId: MinimalProgramExternalId) {
    if (
      isNonEmptyString(rawExternalId.externalSourceId) &&
      isValidMultiExternalIdType(rawExternalId.sourceType)
    ) {
      return {
        type: 'multi' as const,
        source: rawExternalId.sourceType,
        sourceId: rawExternalId.externalSourceId,
        id: rawExternalId.externalKey,
      };
    } else if (
      isValidSingleExternalIdType(rawExternalId.sourceType) &&
      !isNonEmptyString(rawExternalId.externalSourceId)
    ) {
      return {
        type: 'single' as const,
        source: rawExternalId.sourceType,
        id: rawExternalId.externalKey,
      };
    }

    return;
  }

  private toGroupingExternalId(
    rawExternalId: DeepNullable<ProgramGroupingExternalId>,
  ) {
    if (!rawExternalId.externalKey) {
      return;
    }

    if (
      rawExternalId.sourceType &&
      isNonEmptyString(rawExternalId.externalSourceId) &&
      isValidMultiExternalIdType(rawExternalId.sourceType)
    ) {
      return {
        type: 'multi' as const,
        source: rawExternalId.sourceType,
        sourceId: rawExternalId.externalSourceId,
        id: rawExternalId.externalKey,
      };
    } else if (
      rawExternalId.sourceType &&
      isValidSingleExternalIdType(rawExternalId.sourceType) &&
      !isNonEmptyString(rawExternalId.externalSourceId)
    ) {
      return {
        type: 'single' as const,
        source: rawExternalId.sourceType,
        id: rawExternalId.externalKey,
      };
    }

    return;
  }
}
