import { MediaSourceType } from '@/db/schema/MediaSource.js';
import { enumKeys } from '@/util/enumUtil.js';
import type { ExternalIdType } from '@tunarr/types/schemas';
import { ProgramSourceType } from './ProgramSourceType.ts';

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

export function programExternalIdTypeFromSourceType(
  src: ProgramSourceType,
): ProgramExternalIdType {
  switch (src) {
    case ProgramSourceType.PLEX:
      return ProgramExternalIdType.PLEX;
    case ProgramSourceType.JELLYFIN:
      return ProgramExternalIdType.JELLYFIN;
  }
}

export function programExternalIdTypeToMediaSourceType(
  src: ProgramExternalIdType,
) {
  switch (src) {
    case ProgramExternalIdType.PLEX:
      return MediaSourceType.Plex;
    case ProgramExternalIdType.JELLYFIN:
      return MediaSourceType.Jellyfin;
    default:
      return;
  }
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
