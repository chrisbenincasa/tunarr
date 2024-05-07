import { isNull, merge } from 'lodash-es';
import { Nullable } from '../../types/util';
import { DataProps, FrameSize, PixelFormat, StreamKind } from './types';
import { AnyFunction, MarkOptional } from 'ts-essentials';
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

export type VideoInputKind = 'video' | 'stillimage' | 'filter';

export class VideoStream implements MediaStream {
  readonly kind: StreamKind = 'video';
  index: number;
  codec: string;
  pixelFormat: Nullable<PixelFormat>;
  frameSize: FrameSize;
  isAnamorphic: boolean;
  pixelAspectRatio: Nullable<`${number}:${number}`>;
  inputKind: VideoInputKind = 'video';

  protected constructor(fields: MarkOptional<VideoStreamFields, 'inputKind'>) {
    // Unfortunately TS is not 'smart' enough to let us
    // dynamically apply these fields. This works... mainly
    // because we derive the fields for the input type right
    // from the class itself.
    merge(this, fields);
  }

  static create(fields: MarkOptional<VideoStreamFields, 'inputKind'>) {
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

type StillImageStreamFields = Omit<
  DataProps<StillImageStream>,
  | 'codec'
  | 'kind'
  | 'pixelFormat'
  | 'isAnamorphic'
  | 'pixelAspectRatio'
  | 'inputKind'
>;

export class StillImageStream extends VideoStream {
  // readonly kind: StreamKind = 'stillimage';
  readonly inputKind: VideoInputKind = 'stillimage';

  private constructor(fields: StillImageStreamFields) {
    super({
      ...fields,
      codec: '',
      isAnamorphic: false,
      pixelAspectRatio: null,
      pixelFormat: null,
    });
    // merge(this, fields);
  }

  static create(fields: StillImageStreamFields) {
    return new StillImageStream(fields);
  }
}

type SyntheticVideoStreamFields = Omit<
  DataProps<SyntheticVideoStream>,
  'inputKind'
>;
export class SyntheticVideoStream extends VideoStream {
  filterDefinition: string;
  readonly inputKind: VideoInputKind = 'filter';

  private constructor(fields: SyntheticVideoStreamFields) {
    super(fields);
    this.filterDefinition = fields.filterDefinition;
  }

  static create(fields: SyntheticVideoStreamFields) {
    return new SyntheticVideoStream(fields);
  }

  static testSrc(
    fields: Omit<SyntheticVideoStreamFields, 'filterDefinition'>,
    size: FrameSize,
    extraParams: string = '',
  ) {
    return this.create({
      ...fields,
      filterDefinition: `testsrc=size=${size.width}x${size.height}${extraParams}`,
    });
  }
}
