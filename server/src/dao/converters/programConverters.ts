import { Loaded } from '@mikro-orm/core';
import { ContentProgram, FlexProgram, RedirectProgram } from '@tunarr/types';
import { MarkRequired } from 'ts-essentials';
import { getEm } from '../dataSource.js';
import { OfflineItem, RedirectItem } from '../derived_types/Lineup.js';
import { Channel } from '../entities/Channel.js';
import { Program, ProgramType } from '../entities/Program.js';
import { isNil } from 'lodash-es';
import { isPromise } from 'util/types';

/**
 * Converts DB types to API types
 */
export class ProgramConverter {
  /**
   * Given a Program entity, convert to a ContentProgram for use in Lineup APIs
   * Takes care of loading missing relations
   */
  async entityToContentProgram(
    program: Loaded<Program>,
    opts: { skipPopulate?: boolean } = { skipPopulate: false },
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
    opts: { skipPopulate?: boolean } = { skipPopulate: false },
  ): Promise<ContentProgram> {
    const em = getEm();
    let extraFields: Partial<ContentProgram> = {};
    // This will ensure extra fields are populated for join types
    // It won't reissue queries if the loaded program already has these popualted
    if (program.type === ProgramType.Episode) {
      const populatedProgram = !opts.skipPopulate
        ? await em.populate(program, ['tvShow', 'season'])
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
      const populatedProgram = !opts.skipPopulate
        ? await em.populate(program, ['artist', 'album'])
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
