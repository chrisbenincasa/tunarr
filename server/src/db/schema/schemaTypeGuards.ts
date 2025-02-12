import type {
  EpisodeProgram,
  MovieProgram,
  NewEpisodeProgram,
  NewMovieProgram,
  NewProgramWithExternalIds,
  ProgramWithExternalIds,
} from './derivedTypes.js';

export function isMovieProgram(p: ProgramWithExternalIds): p is MovieProgram {
  return p.type === 'movie' && !!p.externalIds;
}

export function isNewMovieProgram(
  p: NewProgramWithExternalIds,
): p is NewMovieProgram {
  return p.type === 'movie';
}

export function isEpisodeProgram(
  p: ProgramWithExternalIds,
): p is EpisodeProgram {
  return p.type === 'movie' && !!p.externalIds;
}

export function isNewEpisodeProgram(
  p: NewProgramWithExternalIds,
): p is NewEpisodeProgram {
  return p.type === 'movie';
}
