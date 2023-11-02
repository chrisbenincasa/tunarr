import { Writable } from 'stream';
import { Maybe, TypedEventEmitter } from './types.js';
import { FfmpegEvents } from './ffmpeg.js';

export abstract class Player {
  cleanUp(): void {}

  abstract play(
    outStream: Writable,
  ): Promise<Maybe<TypedEventEmitter<FfmpegEvents>>>;
}
