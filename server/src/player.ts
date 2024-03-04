import { Writable } from 'stream';
import { Maybe } from './types.js';
import { TypedEventEmitter } from './types/eventEmitter.js';
import { FfmpegEvents } from './ffmpeg.js';

export abstract class Player {
  cleanUp(): void {}

  abstract play(
    outStream: Writable,
  ): Promise<Maybe<TypedEventEmitter<FfmpegEvents>>>;
}
