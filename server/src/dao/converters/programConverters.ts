import { Loaded } from '@mikro-orm/core';
import {
  ChannelProgram,
  ContentProgram,
  FlexProgram,
  RedirectProgram,
} from '@tunarr/types';
import { find, isNil, merge } from 'lodash-es';
import { MarkRequired } from 'ts-essentials';
import { isPromise } from 'util/types';
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
import { logger } from '../legacyDbMigration.js';

type ContentProgramConversionOptions = {
  skipPopulate: boolean;
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
        logger.warn(
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
        opts?.contentProgramConversionOptions,
      );
    }
  }

  /**
   * Given a Program entity, convert to a ContentProgram for use in Lineup APIs
   * Takes care of loading missing relations
   */
  async entityToContentProgram(
    program: Loaded<Program>,
    opts: Partial<ContentProgramConversionOptions> = defaultContentProgramConversionOptions,
  ) {
    return this.partialEntityToContentProgram(program, opts);
  }

  /**
   * Convert a Program entity to a ContentProgram, disregarding which fields
   * were loaded on the Program. Prefer {@link entityToContentProgram} for more
   * strict checks.
   */
  async partialEntityToContentProgram(
    program: MarkRequired<
      Partial<Program>,
      'uuid' | 'title' | 'duration' | 'type'
    >,
    opts: Partial<ContentProgramConversionOptions> = defaultContentProgramConversionOptions,
  ): Promise<ContentProgram> {
    const mergedOpts = merge({}, defaultContentProgramConversionOptions, opts);
    let extraFields: Partial<ContentProgram> = {};
    // This will ensure extra fields are populated for join types
    // It won't reissue queries if the loaded program already has these popualted
    if (program.type === ProgramType.Episode) {
      const shouldFetch =
        mergedOpts.forcePopulate ||
        ((isNil(program.tvShow) || isNil(program.season)) &&
          !mergedOpts.skipPopulate);
      const populatedProgram = shouldFetch
        ? await getEm().populate(program, ['tvShow', 'season'])
        : program;
      extraFields = {
        seasonNumber: populatedProgram.season?.index,
        episodeNumber: populatedProgram.episode,
        episodeTitle: populatedProgram.title,
        icon: populatedProgram.episodeIcon ?? populatedProgram.showIcon,
        showId: populatedProgram.tvShow?.uuid,
        seasonId: populatedProgram.season?.uuid,
      };
    } else if (program.type === ProgramType.Track) {
      const shouldFetch =
        mergedOpts.forcePopulate ||
        ((isNil(program.album) || isNil(program.artist)) &&
          !mergedOpts.skipPopulate);
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

    return {
      persisted: true, // Explicit since we're dealing with db loaded entities
      uniqueId: program.uuid,
      summary: program.summary,
      date: program.originalAirDate,
      rating: program.rating,
      icon: program.icon,
      title:
        program.type === ProgramType.Episode
          ? program.showTitle ?? program.title
          : program.title,
      duration: program.duration,
      type: 'content',
      id: program.uuid,
      subtype: program.type,
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
}
