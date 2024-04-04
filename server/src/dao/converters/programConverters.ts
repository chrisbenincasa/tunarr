import { ContentProgram } from '@tunarr/types';
import { Program, ProgramType } from '../entities/Program.js';

export function dbProgramToContentProgram(
  program: Program,
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
