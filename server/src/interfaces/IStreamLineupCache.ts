import type { StreamLineupItem } from '../db/derived_types/StreamLineup.ts';

export interface IStreamLineupCache {
  getCurrentLineupItem(
    channelId: string,
    timeNow: number,
  ): StreamLineupItem | undefined;

  getProgramLastPlayTime(channelId: string, programId: string): number;

  getFillerLastPlayTime(channelId: string, fillerId: string): number;

  recordPlayback(
    channelId: string,
    t0: number,
    lineupItem: StreamLineupItem,
  ): Promise<void>;

  clear(): void;

  clearPlayback(channelId: string): Promise<void>;
}
