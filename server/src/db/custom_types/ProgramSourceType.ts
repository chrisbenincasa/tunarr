import { enumKeys } from '@/util/enumUtil.js';

export enum ProgramSourceType {
  PLEX = 'plex',
  JELLYFIN = 'jellyfin',
  EMBY = 'emby',
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
