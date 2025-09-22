import type { StreamLineupItem } from '@/db/derived_types/StreamLineup.js';
import type { Channel } from '@/db/schema/Channel.js';
import type { TranscodeConfig } from '@/db/schema/TranscodeConfig.js';
import type { ChannelStreamMode } from '@tunarr/types';
import dayjs from 'dayjs';
import type { GetCurrentLineupItemRequest } from './StreamProgramCalculator.ts';

export class PlayerContext {
  /**
   *
   * @param lineupItem  What is being played
   * @param targetChannel The channel whose schedule is being played
   * @param sourceChannel The channel that is currently tuned. This is only different than target in the case of a redirect
   * @param audioOnly
   * @param isLoading
   * @param realtime Whether to output at realtime
   * @param useNewPipeline The transcode config to use for the player session
   * @param transcodeConfig  The transcode config to use for the player session
   * @param streamMode The stream mode to use for the player session
   */
  constructor(
    public lineupItem: StreamLineupItem,
    public targetChannel: Channel,
    public sourceChannel: Channel,
    public audioOnly: boolean,
    public realtime: boolean,
    public transcodeConfig: TranscodeConfig,
    public streamMode: ChannelStreamMode,
  ) {}

  static error(
    duration: number,
    error: string | boolean | Error,
    targetChannel: Channel,
    sourceChannel: Channel,
    realtime: boolean,
    transcodeConfig: TranscodeConfig,
    streamMode: ChannelStreamMode,
  ): PlayerContext {
    return new PlayerContext(
      {
        type: 'error',
        duration,
        streamDuration: duration,
        error,
        programBeginMs: +dayjs(),
      },
      targetChannel,
      sourceChannel,
      false,
      realtime,
      transcodeConfig,
      streamMode,
    );
  }
}

export type GetPlayerContextRequest = GetCurrentLineupItemRequest & {
  audioOnly: boolean;
};
