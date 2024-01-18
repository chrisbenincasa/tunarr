import { ContentProgram } from 'dizquetv-types';
import { Program, ProgramType } from '../entities/Program.js';

export function dbProgramToContentProgram(
  program: Program,
  persisted: boolean = true,
): ContentProgram {
  return {
    persisted,
    summary: program.summary,
    date: program.originalAirDate,
    rating: program.rating,
    icon: program.showIcon ?? program.episodeIcon ?? program.icon,
    title: program.showTitle ?? program.title,
    duration: program?.duration,
    type: 'content',
    id: program.uuid,
    subtype: program.type,
    seasonNumber:
      program.type === ProgramType.Episode ? program.season : undefined,
    episodeNumber:
      program.type === ProgramType.Episode ? program.episode : undefined,
    episodeTitle:
      program.type === ProgramType.Episode ? program.title : undefined,
  };
}
