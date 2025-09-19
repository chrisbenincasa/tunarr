import type { MovieProgram, ProgramWithExternalIds } from './derivedTypes.js';

export function isMovieProgram(p: ProgramWithExternalIds): p is MovieProgram {
  return p.type === 'movie' && !!p.externalIds;
}
