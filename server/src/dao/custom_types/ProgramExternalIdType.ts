import { ExternalIdType } from '@tunarr/types/schemas';
import { enumKeys } from '../../util/enumUtil.js';

export enum ProgramExternalIdType {
  PLEX = 'plex',
  PLEX_GUID = 'plex-guid',
  TMDB = 'tmdb',
  IMDB = 'imdb',
  TVDB = 'tvdb',
  JELLYFIN = 'jellyfin',
}

export function programExternalIdTypeFromExternalIdType(
  str: ExternalIdType,
): ProgramExternalIdType {
  return programExternalIdTypeFromString(str)!;
}

export function programExternalIdTypeFromString(
  str: string,
): ProgramExternalIdType | undefined {
  for (const key of enumKeys(ProgramExternalIdType)) {
    const value = ProgramExternalIdType[key];
    if (value.toString().toLowerCase() === str) {
      return value;
    }
  }
  return;
}

export function programExternalIdTypeFromJellyfinProvider(provider: string) {
  switch (provider.toLowerCase()) {
    case 'tmdb':
      return ProgramExternalIdType.TMDB;
    case 'imdb':
      return ProgramExternalIdType.IMDB;
    case 'tvdb':
      return ProgramExternalIdType.TVDB;
    default:
      return null;
  }
}
