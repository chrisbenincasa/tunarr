import { MediaSourceType } from '@/db/schema/MediaSource.ts';
import { enumKeys } from '@/util/enumUtil.ts';

export enum ProgramSourceType {
  PLEX = 'plex',
  JELLYFIN = 'jellyfin',
}

export function programSourceTypeFromString(
  str: string,
): ProgramSourceType | undefined {
  for (const key of enumKeys(ProgramSourceType)) {
    const value = ProgramSourceType[key];
    if (key.toLowerCase() === str) {
      return value;
    }
  }
  return;
}

export function programSourceTypeToMediaSource(src: ProgramSourceType) {
  switch (src) {
    case ProgramSourceType.PLEX:
      return MediaSourceType.Plex;
    case ProgramSourceType.JELLYFIN:
      return MediaSourceType.Jellyfin;
  }
}

export function programSourceTypeFromMediaSource(src: MediaSourceType) {
  switch (src) {
    case MediaSourceType.Plex:
      return ProgramSourceType.PLEX;
    case MediaSourceType.Jellyfin:
      return ProgramSourceType.JELLYFIN;
  }
}
