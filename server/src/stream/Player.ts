import { FfmpegSettings, Watermark } from '@tunarr/types';
import { Writable } from 'stream';
import { FfmpegEvents } from '../ffmpeg/ffmpeg.js';
import { TypedEventEmitter } from '../types/eventEmitter.js';
import { Maybe } from '../types/util.js';
import { EntityManager } from '../dao/dataSource.js';
import { StreamLineupItem } from '../dao/derived_types/StreamLineup.js';
import { SettingsDB } from '../dao/settings.js';
import { StreamContextChannel } from './types.js';

export abstract class Player {
  cleanUp(): void {}

  abstract play(
    outStream: Writable,
  ): Promise<Maybe<TypedEventEmitter<FfmpegEvents>>>;
}

export type PlayerContext = {
  lineupItem: StreamLineupItem;
  ffmpegSettings: FfmpegSettings;
  channel: StreamContextChannel;
  m3u8: boolean;
  audioOnly: boolean;
  isLoading?: boolean;
  watermark?: Watermark;
  entityManager: EntityManager;
  settings: SettingsDB;
};
