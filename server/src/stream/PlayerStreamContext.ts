import type { StreamLineupItem } from '@/db/derived_types/StreamLineup.js';
import type { ChannelOrm } from '@/db/schema/Channel.js';
import type { TranscodeConfigOrm } from '@/db/schema/TranscodeConfig.js';
import type { ChannelStreamMode } from '@tunarr/types';
import dayjs from 'dayjs';
import type { StreamEncoding } from '../ffmpeg/ffmpegBase.ts';
import type { GetCurrentLineupItemRequest } from './StreamProgramCalculator.ts';

export class PlayerContext {
  /**
   *
   * @param lineupItem  What is being played
   * @param targetChannel The channel whose schedule is being played
   * @param sourceChannel The channel that is currently tuned. This is only different than target in the case of a redirect
   * @param transcodeConfig  The transcode config to use for the player session
   * @param streamSettings
   */
  constructor(
    public lineupItem: StreamLineupItem,
    public targetChannel: ChannelOrm,
    public sourceChannel: ChannelOrm,
    public transcodeConfig: TranscodeConfigOrm,
    private streamSettings: PlayerContextStreamSettings,
  ) {}

  get audioOnly() {
    return this.streamSettings.audioOnly;
  }

  get realtime() {
    return this.streamSettings.realtime;
  }

  get streamMode() {
    return this.streamSettings.streamMode;
  }

  get encoding() {
    return this.streamSettings.encodingMode ?? { mode: 'transcode' };
  }

  static error(
    duration: number,
    error: string | boolean | Error,
    targetChannel: ChannelOrm,
    sourceChannel: ChannelOrm,
    realtime: boolean,
    transcodeConfig: TranscodeConfigOrm,
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
      transcodeConfig,
      {
        audioOnly: false,
        realtime,
        streamMode,
      },
    );
  }
}

export type PlayerContextStreamSettings = {
  audioOnly: boolean;
  realtime: boolean;
  streamMode: ChannelStreamMode;
  encodingMode?: StreamEncoding;
};

export type GetPlayerContextRequest = GetCurrentLineupItemRequest & {
  audioOnly: boolean;
};
