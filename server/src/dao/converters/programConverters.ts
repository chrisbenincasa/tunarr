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
import { find, isNil, omitBy } from 'lodash-es';
import { DeepPartial, MarkRequired } from 'ts-essentials';
import { isPromise } from 'util/types';
import { isNonEmptyString, nullToUndefined } from '../../util/index.js';
import { LoggerFactory } from '../../util/logging/LoggerFactory.js';
import {
  LineupItem,
  OfflineItem,
  RedirectItem,
  isOfflineItem,
  isRedirectItem,
} from '../derived_types/Lineup.js';
import {
  ChannelWithRelations,
  ProgramWithRelations,
  ChannelWithRelations as RawChannel,
  ChannelWithPrograms as RawChannelWithPrograms,
  ProgramWithRelations as RawProgram,
} from '../direct/derivedTypes.js';
import { directDbAccess } from '../direct/directDbAccess.js';
import { MinimalProgramExternalId } from '../direct/schema/ProgramExternalId.js';
import { ProgramType } from '../entities/Program.js';

/**
 * Converts DB types to API types
 */
export class ProgramConverter {
  private logger = LoggerFactory.child({
    caller: import.meta,
    className: ProgramConverter.name,
  });

  directLineupItemToChannelProgram(
    channel: ChannelWithRelations,
    item: LineupItem,
    channelReferences: MarkRequired<
      DeepPartial<RawChannel>,
      'uuid' | 'number' | 'name'
    >[], // TODO fix this up...
    preMaterializedProgram?: ProgramWithRelations,
  ): ChannelProgram | null;
  directLineupItemToChannelProgram(
    channel: RawChannelWithPrograms,
    item: LineupItem,
    channelReferences: MarkRequired<
      DeepPartial<RawChannel>,
      'uuid' | 'number' | 'name'
    >[], // TODO fix this up...
    preMaterializedProgram?: ProgramWithRelations,
  ): ChannelProgram | null {
    if (isOfflineItem(item)) {
      return this.directOfflineLineupItemToProgram(channel, item);
    } else if (isRedirectItem(item)) {
      const redirectChannel = find(channelReferences, { uuid: item.channel });
      if (isNil(redirectChannel)) {
        this.logger.warn(
          'Dangling redirect channel reference. Source channel = %s, target channel = %s',
          channel.uuid,
          item.channel,
        );
        return this.directOfflineLineupItemToProgram(channel, {
          type: 'offline',
          durationMs: item.durationMs,
        });
      }
      return this.directRedirectLineupItemToProgram(item, redirectChannel);
    } else {
      const program =
        preMaterializedProgram && preMaterializedProgram.uuid === item.id
          ? preMaterializedProgram
          : channel.programs.find((p) => p.uuid === item.id);
      if (isNil(program)) {
        return null;
      }

      return this.directEntityToContentProgramSync(
        program,
        program.externalIds ?? [], // TODO fill in external IDs here
      );
    }
  }

  directEntityToContentProgramSync(
    program: RawProgram,
    externalIds: MinimalProgramExternalId[],
  ): ContentProgram {
    let extraFields: Partial<ContentProgram> = {};
    if (program.type === ProgramType.Episode.toString()) {
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

  directOfflineLineupItemToProgram(
    channel: RawChannel,
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
    channel: MarkRequired<DeepPartial<RawChannel>, 'name' | 'number'>,
  ): RedirectProgram;
  redirectLineupItemToProgram(
    item: RedirectItem,
    channel?: MarkRequired<DeepPartial<RawChannel>, 'name' | 'number'>,
  ): Promise<RedirectProgram> | RedirectProgram {
    const loadedChannel = isNil(channel)
      ? directDbAccess()
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

  directRedirectLineupItemToProgram(
    item: RedirectItem,
    channel: MarkRequired<DeepPartial<RawChannel>, 'uuid' | 'number' | 'name'>,
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

  private toRedirectChannelInternal(
    item: RedirectItem,
    channel: MarkRequired<DeepPartial<RawChannel>, 'name' | 'number'>,
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
