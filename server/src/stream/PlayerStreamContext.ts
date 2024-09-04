import { StreamLineupItem } from '../dao/derived_types/StreamLineup';
import { Channel } from '../dao/direct/derivedTypes.js';
import { GetCurrentLineupItemRequest } from './StreamProgramCalculator';

export class PlayerContext {
  constructor(
    public lineupItem: StreamLineupItem,
    public channel: Channel,
    public audioOnly: boolean,
    public isLoading: boolean,
    public realtime: boolean,
  ) {}
}

export type GetPlayerContextRequest = GetCurrentLineupItemRequest & {
  audioOnly: boolean;
};
