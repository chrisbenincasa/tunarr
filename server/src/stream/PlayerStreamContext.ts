import { StreamLineupItem } from '../dao/derived_types/StreamLineup';
import { Channel } from '../dao/direct/schema/Channel';
import { GetCurrentLineupItemRequest } from './StreamProgramCalculator';

export class PlayerContext {
  constructor(
    public lineupItem: StreamLineupItem,
    public channel: Channel,
    public audioOnly: boolean,
    public isLoading: boolean,
    public realtime: boolean,
  ) {}

  static error(
    duration: number,
    error: string | boolean | Error,
    channel: Channel,
    realtime: boolean = true,
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
    );
  }
}

export type GetPlayerContextRequest = GetCurrentLineupItemRequest & {
  audioOnly: boolean;
};
