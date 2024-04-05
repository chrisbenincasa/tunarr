import { Loaded } from '@mikro-orm/core';
import { ContentProgram } from '@tunarr/types';
import { getEm } from '../dataSource.js';
import { Program, ProgramType } from '../entities/Program.js';

export class ProgramConverter {
  async entityToContentProgram(
    program: Loaded<Program, never, '*'>,
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
}

export function dbProgramToContentProgram(
  program: Loaded<Program, 'artist'>,
  persisted: boolean = true,
): ContentProgram {
  return {
    persisted,
    uniqueId: program.uuid,
    summary: program.summary,
    date: program.originalAirDate,
    rating: program.rating,
    icon: program.showIcon ?? program.episodeIcon ?? program.icon,
    title:
      program.type === ProgramType.Episode
        ? program.showTitle ?? program.title
        : program.title,
    duration: program.duration,
    type: 'content',
    id: program.uuid,
    subtype: program.type,
    seasonNumber:
      program.type === ProgramType.Episode ? program.seasonNumber : undefined,
    episodeNumber:
      program.type === ProgramType.Episode ? program.episode : undefined,
    episodeTitle:
      program.type === ProgramType.Episode ? program.title : undefined,
    albumName: program.albumName,
    artistName: program.artistName,
  };
}
