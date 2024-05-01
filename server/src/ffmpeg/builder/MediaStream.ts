import { isNull } from 'lodash-es';
import { Nullable } from '../../types/util';
import { FrameSize, PixelFormat, StreamKind } from './types';
import { AnyFunction } from 'ts-essentials';
import { ExcludeByValueType } from '../../types/util';

export type MediaStream = {
  index: number;
  codec: string;
  kind: StreamKind;
};

type MediaStreamFields<T extends MediaStream> = Omit<
  ExcludeByValueType<T, AnyFunction>,
  'kind'
>;

// Object types that are used to construct the classes
// They derive their values from the class fields themselves,
// taking care to remove any functions or unwanted parameters.
// We use a separate fields object to get "named argument"
// semantics with class construction, but still enabling us
// to have hierarchies, methods, etc.
type AudioStreamFields = MediaStreamFields<AudioStream>;
type VideoStreamFields = MediaStreamFields<VideoStream>;

export class AudioStream implements MediaStream {
  readonly kind: StreamKind = 'audio';
  index: number;
  codec: string;
  channels: number;

  private constructor(fields: AudioStreamFields) {
    this.index = fields.index;
    this.codec = fields.codec;
    this.channels = fields.channels;
  }

  static create(fields: AudioStreamFields) {
    return new AudioStream(fields);
  }
}

export class VideoStream implements MediaStream {
  readonly kind: StreamKind = 'video';
  index: number;
  codec: string;
  pixelFormat: Nullable<PixelFormat>;
  frameSize: FrameSize;
  isAnamorphic: boolean;
  pixelAspectRatio: Nullable<`${number}:${number}`>;

  private constructor(fields: VideoStreamFields) {
    // Unfortunately TS is not 'smart' enough to let us
    // dynamically apply these fields
    this.index = fields.index;
    this.codec = fields.codec;
    this.pixelFormat = fields.pixelFormat;
    this.frameSize = fields.frameSize;
    this.isAnamorphic = fields.isAnamorphic;
    this.pixelAspectRatio = fields.pixelAspectRatio;
  }

  static create(fields: VideoStreamFields) {
    return new VideoStream(fields);
  }

  squarePixelFrameSize(resolution: FrameSize): FrameSize {
    let width = this.frameSize.width;
    let height = this.frameSize.height;

    if (this.isAnamorphic && !isNull(this.pixelAspectRatio)) {
      const [numStr, denStr] = this.pixelAspectRatio.split(':');
      const num = Number.parseFloat(numStr);
      const den = Number.parseFloat(denStr);

      width = Math.floor((this.frameSize.width * num) / den);
      height = Math.floor((this.frameSize.height * num) / den);
    }

    const widthPercent = resolution.width / width;
    const heightPercent = resolution.height / height;
    const minPercent = Math.min(widthPercent, heightPercent);

    return FrameSize.create({
      width: Math.floor(width * minPercent),
      height: Math.floor(height * minPercent),
    });
  }
}
