import { ProgramType } from '@/db/schema/Program.ts';
import { MinimalProgramExternalId } from '@/db/schema/ProgramExternalId.ts';
import { DB } from '@/db/schema/db.ts';
import { isNonEmptyString, nullToUndefined } from '@/util/index.ts';
import { LoggerFactory } from '@/util/logging/LoggerFactory.ts';
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
import { Kysely } from 'kysely';
import { find, isNil, omitBy } from 'lodash-es';
import { DeepPartial, MarkRequired } from 'ts-essentials';
import { isPromise } from 'util/types';
import {
  LineupItem,
  OfflineItem,
  RedirectItem,
  isOfflineItem,
  isRedirectItem,
} from '../derived_types/Lineup.ts';
import {
  ChannelWithPrograms,
  ChannelWithRelations,
  ProgramDaoWithRelations,
} from '../schema/derivedTypes.js';

/**
 * Converts DB types to API types
 */
export class ProgramConverter {
  private logger = LoggerFactory.child({
    caller: import.meta,
    className: ProgramConverter.name,
  });

  constructor(private db: Kysely<DB>) {}

  lineupItemToChannelProgram(
    channel: ChannelWithRelations,
    item: LineupItem,
    channelReferences: MarkRequired<
      DeepPartial<ChannelWithRelations>,
      'uuid' | 'number' | 'name'
    >[], // TODO fix this up...
    preMaterializedProgram?: ProgramDaoWithRelations,
  ): ChannelProgram | null;
  lineupItemToChannelProgram(
    channel: ChannelWithPrograms,
    item: LineupItem,
    channelReferences: MarkRequired<
      DeepPartial<ChannelWithRelations>,
      'uuid' | 'number' | 'name'
    >[], // TODO fix this up...
    preMaterializedProgram?: ProgramDaoWithRelations,
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
    } else {
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
  }

  programDaoToContentProgram(
    program: ProgramDaoWithRelations,
    externalIds: MinimalProgramExternalId[],
  ): ContentProgram {
    let extraFields: Partial<ContentProgram> = {};
    if (program.type === ProgramType.Episode) {
      extraFields = {
        ...extraFields,
        icon: nullToUndefined(program.episodeIcon ?? program.showIcon),
        showId: nullToUndefined(program.tvShow?.uuid ?? program.tvShowUuid),
        seasonId: nullToUndefined(program.tvSeason?.uuid ?? program.seasonUuid),
        // Fallback to the denormalized field, for now
        seasonNumber: nullToUndefined(
          program.tvSeason?.index, // ?? program.seasonNumber,
        ),
        episodeNumber: nullToUndefined(program.episode),
        episodeTitle: program.title,
        title: nullToUndefined(program.tvShow?.title ?? program.showTitle),
        index: nullToUndefined(program.episode),
        parentIndex: nullToUndefined(program.tvSeason?.index),
        grandparentIndex: nullToUndefined(program.tvShow?.index),
      };
      // if (isEmpty(extraFields.showId)) {
      //   this.logger.warn(
      //     'Empty show UUID when converting program ID = %s. This may lead to broken frontend features. Please file a bug!',
      //     program.uuid,
      //   );
      // }
    } else if (program.type === ProgramType.Track.toString()) {
      extraFields = {
        albumName: nullToUndefined(program.trackAlbum?.title),
        artistName: nullToUndefined(program.trackArtist?.title),
        albumId: nullToUndefined(program.trackAlbum?.uuid ?? program.albumUuid),
        artistId: nullToUndefined(
          program.trackArtist?.uuid ?? program.artistUuid,
        ),
        // HACK: Tracks save their index under the episode field
        index: nullToUndefined(program.episode),
        parentIndex: nullToUndefined(program.trackAlbum?.index),
        grandparentIndex: nullToUndefined(program.trackArtist?.index),
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
    channel: MarkRequired<DeepPartial<ChannelWithRelations>, 'name' | 'number'>,
  ): RedirectProgram;
  redirectLineupItemToProgram(
    item: RedirectItem,
    channel?: MarkRequired<
      DeepPartial<ChannelWithRelations>,
      'name' | 'number'
    >,
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
    channel: MarkRequired<DeepPartial<ChannelWithRelations>, 'name' | 'number'>,
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
}
