import { StreamLineupItem } from '@/db/derived_types/StreamLineup.ts';
import { Channel } from '@/db/schema/Channel.ts';
import { TranscodeConfig } from '@/db/schema/TranscodeConfig.ts';
import { GetCurrentLineupItemRequest } from './StreamProgramCalculator.ts';

export class PlayerContext {
  constructor(
    public lineupItem: StreamLineupItem,
    public channel: Channel,
    public audioOnly: boolean,
    public isLoading: boolean,
    public realtime: boolean,
    public useNewPipeline: boolean,
    public transcodeConfig: TranscodeConfig,
  ) {}

  static error(
    duration: number,
    error: string | boolean | Error,
    channel: Channel,
    realtime: boolean,
    useNewPipeline: boolean,
    transcodeConfig: TranscodeConfig,
  ): PlayerContext {
    return new PlayerContext(
      {
        type: 'error',
        duration,
        streamDuration: duration,
        title: 'Error',
        error,
      },
      channel,
      false,
      false,
      realtime,
      useNewPipeline,
      transcodeConfig,
    );
  }
}

export type GetPlayerContextRequest = GetCurrentLineupItemRequest & {
  audioOnly: boolean;
};
