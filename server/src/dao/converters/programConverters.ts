import { Loaded } from '@mikro-orm/core';
import {
  ChannelProgram,
  ContentProgram,
  ExternalId,
  FlexProgram,
  RedirectProgram,
  externalIdEquals,
} from '@tunarr/types';
import {
  compact,
  find,
  isNil,
  isObject,
  map,
  merge,
  uniqWith,
} from 'lodash-es';
import { isPromise } from 'util/types';
import {
  isDefined,
  isNonEmptyString,
  nullToUndefined,
} from '../../util/index.js';
import { LoggerFactory } from '../../util/logging/LoggerFactory.js';
import { getEm } from '../dataSource.js';
import {
  LineupItem,
  OfflineItem,
  RedirectItem,
  isOfflineItem,
  isRedirectItem,
} from '../derived_types/Lineup.js';
import { Channel } from '../entities/Channel.js';
import { Program, ProgramType } from '../entities/Program.js';
import {
  Program as RawProgram,
  Channel as RawChannel,
} from '../direct/derivedTypes.js';
import { ProgramExternalId as RawProgramExternalId } from '../direct/types.gen.js';
import { ProgramExternalId } from '../entities/ProgramExternalId.js';
import {
  isValidMultiExternalIdType,
  isValidSingleExternalIdType,
} from '@tunarr/types/schemas';
import { seq } from '@tunarr/shared/util';
import { DeepPartial, MarkRequired } from 'ts-essentials';

type ContentProgramConversionOptions = {
  skipPopulate: boolean | Partial<Record<'externalIds' | 'grouping', boolean>>;
  forcePopulate: boolean;
};

const defaultContentProgramConversionOptions: ContentProgramConversionOptions =
  {
    skipPopulate: false,
    forcePopulate: false,
  };

type LineupItemConversionOptions = {
  contentProgramConversionOptions?: Partial<ContentProgramConversionOptions>;
};

/**
 * Converts DB types to API types
 */
export class ProgramConverter {
  private logger = LoggerFactory.child({
    caller: import.meta,
    className: ProgramConverter.name,
  });

  /**
   * Converts a LineupItem to a ChannelProgram
   *
   * @param channel
   * @param item
   * @param channelReferences
   * @returns
   */
  async lineupItemToChannelProgram(
    channel: Loaded<Channel, 'programs'>,
    item: LineupItem,
    channelReferences: Loaded<Channel, never, 'name' | 'number'>[],
    opts?: LineupItemConversionOptions,
  ): Promise<ChannelProgram | null> {
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
      const program = channel.programs.find((p) => p.uuid === item.id);
      if (isNil(program)) {
        return null;
      }

      return this.entityToContentProgram(
        program,
        undefined,
        opts?.contentProgramConversionOptions,
      );
    }
  }

  directLineupItemToChannelProgram(
    channel: MarkRequired<RawChannel, 'programs'>,
    item: LineupItem,
    channelReferences: MarkRequired<
      DeepPartial<RawChannel>,
      'uuid' | 'number' | 'name'
    >[], // TODO fix this up...
  ) {
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
      const program = channel.programs.find((p) => p.uuid === item.id);
      if (isNil(program)) {
        return null;
      }

      return this.directEntityToContentProgramSync(
        program,
        program.externalIds ?? [], // TODO fill in external IDs here
      );
    }
  }

  /**
   * Given a Program entity, convert to a ContentProgram for use in Lineup APIs
   * Takes care of loading missing relations
   */
  async entityToContentProgram(
    program: Loaded<Program>,
    externalIds: Loaded<ProgramExternalId>[] | undefined = undefined,
    opts: Partial<ContentProgramConversionOptions> = defaultContentProgramConversionOptions,
  ): Promise<ContentProgram> {
    return this.partialEntityToContentProgram(program, externalIds, opts);
  }

  /**
   * Convert a Program entity to a ContentProgram, disregarding which fields
   * were loaded on the Program. Prefer {@link entityToContentProgram} for more
   * strict checks.
   *
   * NOTE: This method is not really suitable for converting large amounts of items,
   * even if we disable all fetching/population, simply because it will create a promise.
   * TODO: Put type guards on the loaded program so we can force callers to pre-populate
   * the necessary fields.
   */
  async partialEntityToContentProgram(
    program: Loaded<Program>,
    externalIds: Loaded<ProgramExternalId>[] | undefined = undefined,
    opts: Partial<ContentProgramConversionOptions> = defaultContentProgramConversionOptions,
  ): Promise<ContentProgram> {
    const mergedOpts = merge({}, defaultContentProgramConversionOptions, opts);
    let extraFields: Partial<ContentProgram> = {};

    // This will ensure extra fields are populated for join types
    // It won't reissue queries if the loaded program already has these popualted
    const skipGroupings = isObject(mergedOpts.skipPopulate)
      ? mergedOpts.skipPopulate.grouping
      : !!mergedOpts.skipPopulate;
    const skipExternalIds = isObject(mergedOpts.skipPopulate)
      ? mergedOpts.skipPopulate.externalIds
      : !!mergedOpts.skipPopulate;

    if (program.type === ProgramType.Episode) {
      extraFields = {
        ...extraFields,
        icon: program.episodeIcon ?? program.showIcon,
        showId: program.tvShow?.uuid,
        seasonId: program.season?.uuid,
        seasonNumber: program.season?.isInitialized()
          ? program.season.unwrap().index
          : undefined,
        episodeNumber: program.episode,
        episodeTitle: program.title,
        title: program.showTitle ?? program.title,
      };

      if (
        mergedOpts.forcePopulate ||
        (!program.season?.isInitialized() && !skipGroupings)
      ) {
        const season = await program.season?.load();
        extraFields = {
          ...extraFields,
          seasonNumber: season?.index,
        };
      } else if (program.season?.isInitialized()) {
        extraFields = {
          ...extraFields,
          seasonNumber: program.season?.getEntity().index,
        };
      }
    } else if (program.type === ProgramType.Track) {
      const shouldFetch =
        mergedOpts.forcePopulate ||
        ((isNil(program.album) || isNil(program.artist)) && !skipGroupings);
      const populatedProgram = shouldFetch
        ? await getEm().populate(program, ['artist', 'album'])
        : program;
      extraFields = {
        // TODO: Use the join fields
        albumName: populatedProgram.albumName,
        artistName: populatedProgram.artistName,
        albumId: populatedProgram.album?.uuid,
        artistId: populatedProgram.artist?.uuid,
      };
    }

    const eids: ExternalId[] = [];
    if (isDefined(externalIds)) {
      eids.push(...compact(map(externalIds, (eid) => eid.toExternalId())));
    }

    if (!program.externalIds.isInitialized() && !skipExternalIds) {
      await program.externalIds.init();
    }

    eids.push(
      ...compact(map(program.externalIds, (eid) => eid.toExternalId())),
    );

    return {
      persisted: true, // Explicit since we're dealing with db loaded entities
      uniqueId: program.uuid,
      summary: program.summary,
      date: program.originalAirDate,
      rating: program.rating,
      icon: program.icon,
      title: program.title,
      // program.type === ProgramType.Episode
      // ? program.showTitle ?? program.title
      // : program.title,
      duration: program.duration,
      type: 'content',
      id: program.uuid,
      subtype: program.type,
      externalIds: uniqWith(eids, externalIdEquals),
      ...extraFields,
    };
  }

  preloadedEntityToContentProgramSync(
    program: Loaded<Program, 'season' | 'album' | 'artist' | 'tvShow'>,
  ): ContentProgram {
    return this.partialEntityToContentProgramSync(program);
  }

  partialEntityToContentProgramSync(
    program: Loaded<Program, 'season' | 'album' | 'artist'>,
  ): ContentProgram {
    let extraFields: Partial<ContentProgram> = {};
    if (program.type === ProgramType.Episode) {
      extraFields = {
        ...extraFields,
        icon: program.episodeIcon ?? program.showIcon,
        showId: program.tvShow?.uuid,
        seasonId: program.season?.uuid,
        seasonNumber: program.season?.$.index,
        episodeNumber: program.episode,
        episodeTitle: program.title,
        title:
          (program.tvShow?.isInitialized()
            ? program.tvShow?.unwrap().title
            : program.showTitle) ?? program.title,
      };
    } else if (program.type === ProgramType.Track) {
      extraFields = {
        albumName: program.album?.$.title,
        artistName: program.artist?.$.title,
        albumId: program.album?.uuid,
        artistId: program.artist?.uuid,
      };
    }

    return {
      persisted: true, // Explicit since we're dealing with db loaded entities
      uniqueId: program.uuid,
      summary: program.summary,
      date: program.originalAirDate,
      rating: program.rating,
      icon: program.icon,
      title: program.title,
      duration: program.duration,
      type: 'content',
      id: program.uuid,
      subtype: program.type,
      externalIds: compact(
        map(program.externalIds, (eid) => eid.toExternalId()),
      ),
      ...extraFields,
    };
  }

  directEntityToContentProgramSync(
    program: RawProgram,
    externalIds: RawProgramExternalId[],
  ): ContentProgram {
    let extraFields: Partial<ContentProgram> = {};
    if (program.type === ProgramType.Episode.toString()) {
      extraFields = {
        ...extraFields,
        icon: nullToUndefined(program.episodeIcon ?? program.showIcon),
        showId: nullToUndefined(program.tvShow?.uuid ?? program.tvShowUuid),
        seasonId: nullToUndefined(program.tvSeason?.uuid ?? program.seasonUuid),
        seasonNumber: nullToUndefined(program.tvSeason?.index),
        episodeNumber: nullToUndefined(program.episode),
        episodeTitle: program.title,
        title: nullToUndefined(program.tvShow?.title ?? program.showTitle),
      };
    } else if (program.type === ProgramType.Track.toString()) {
      extraFields = {
        albumName: nullToUndefined(program.trackAlbum?.title),
        artistName: nullToUndefined(program.trackArtist?.title),
        albumId: nullToUndefined(program.trackAlbum?.uuid ?? program.albumUuid),
        artistId: nullToUndefined(
          program.trackArtist?.uuid ?? program.artistUuid,
        ),
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
      // TODO: Fix this type!!!
      subtype: program.type as 'movie' | 'episode' | 'track',
      externalIds: seq.collect(externalIds, (eid) => this.toExternalId(eid)),
      ...extraFields,
    };
  }

  offlineLineupItemToProgram(
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
    channel: Loaded<Channel, never, 'name' | 'number'>,
  ): RedirectProgram;
  redirectLineupItemToProgram(
    item: RedirectItem,
    channel?: Loaded<Channel, never, 'name' | 'number'>,
  ): Promise<RedirectProgram> | RedirectProgram {
    const loadedChannel = isNil(channel)
      ? getEm().findOneOrFail(Channel, { uuid: item.channel })
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
    channel: Loaded<Channel, never, 'name' | 'number'>,
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

  private toExternalId(rawExternalId: RawProgramExternalId) {
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
