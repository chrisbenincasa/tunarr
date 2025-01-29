import type { StreamLineupItem } from '@/db/derived_types/StreamLineup.js';
import type { Channel } from '@/db/schema/Channel.js';
import type { TranscodeConfig } from '@/db/schema/TranscodeConfig.js';
import type { ChannelStreamMode } from '@tunarr/types';
import dayjs from 'dayjs';
import type { GetCurrentLineupItemRequest } from './StreamProgramCalculator.ts';

export class PlayerContext {
  constructor(
    public lineupItem: StreamLineupItem,
    public targetChannel: Channel,
    public sourceChannel: Channel,
    public audioOnly: boolean,
    public isLoading: boolean,
    public realtime: boolean,
    public useNewPipeline: boolean,
    public transcodeConfig: TranscodeConfig,
    public streamMode: ChannelStreamMode,
  ) {}

  static error(
    duration: number,
    error: string | boolean | Error,
    targetChannel: Channel,
    sourceChannel: Channel,
    realtime: boolean,
    useNewPipeline: boolean,
    transcodeConfig: TranscodeConfig,
    streamMode: ChannelStreamMode,
  ): PlayerContext {
    return new PlayerContext(
      {
        type: 'error',
        duration,
        streamDuration: duration,
        title: 'Error',
        error,
        programBeginMs: +dayjs(),
      },
      targetChannel,
      sourceChannel,
      false,
      false,
      realtime,
      useNewPipeline,
      transcodeConfig,
      streamMode,
    );
  }
}

export type GetPlayerContextRequest = GetCurrentLineupItemRequest & {
  audioOnly: boolean;
};
