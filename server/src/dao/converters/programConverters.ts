import { Loaded } from '@mikro-orm/core';
import { ContentProgram, FlexProgram, RedirectProgram } from '@tunarr/types';
import { getEm } from '../dataSource.js';
import { OfflineItem, RedirectItem } from '../derived_types/Lineup.js';
import { Channel } from '../entities/Channel.js';
import { Program, ProgramType } from '../entities/Program.js';

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
  ): Promise<ContentProgram> {
    const em = getEm();
    let extraFields: Partial<ContentProgram> = {};
    // This will ensure extra fields are populated for join types
    // It won't reissue queries if the loaded program already has these popualted
    if (program.type === ProgramType.Episode) {
      const populatedProgram = await em.populate(program, ['tvShow', 'season']);
      extraFields = {
        seasonNumber: populatedProgram.season?.index,
        episodeNumber: populatedProgram.episode,
        episodeTitle: populatedProgram.title,
        icon: populatedProgram.episodeIcon ?? populatedProgram.showIcon,
        showId: populatedProgram.tvShow?.uuid,
        seasonId: populatedProgram.season?.uuid,
      };
    } else if (program.type === ProgramType.Track) {
      const populatedProgram = await em.populate(program, ['artist', 'album']);
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

  redirectLineupItemToProgram(item: RedirectItem): RedirectProgram {
    // TODO: Materialize the redirected program???
    return {
      persisted: true,
      type: 'redirect',
      channel: item.channel,
      duration: item.durationMs,
    };
  }
}
