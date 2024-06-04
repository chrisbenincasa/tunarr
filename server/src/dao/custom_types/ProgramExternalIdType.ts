import { enumKeys } from '../../util/enumUtil.js';

export enum ProgramExternalIdType {
  PLEX = 'plex',
  PLEX_GUID = 'plex-guid',
  TMDB = 'tmdb',
  IMDB = 'imdb',
  TVDB = 'tvdb',
}

export function programExternalIdTypeFromString(
  str: string,
): ProgramExternalIdType | undefined {
  for (const key of enumKeys(ProgramExternalIdType)) {
    const value = ProgramExternalIdType[key];
    if (key.toLowerCase() === str) {
      return value;
    }
  }
  return;
}
