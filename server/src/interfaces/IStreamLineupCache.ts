import type { StreamLineupItem } from '../db/derived_types/StreamLineup.ts';

export interface IStreamLineupCache {
  getProgramLastPlayTime(channelId: string, programId: string): number;

  getFillerLastPlayTime(channelId: string, fillerId: string): number;

  recordPlayback(
    channelId: string,
    t0: number,
    lineupItem: StreamLineupItem,
  ): Promise<void>;

  clear(): void;
}
