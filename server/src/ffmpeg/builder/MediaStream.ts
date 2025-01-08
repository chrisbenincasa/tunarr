import { ExcludeByValueType, Nullable } from '@/types/util.ts';
import { isEmpty, isNull, merge } from 'lodash-es';
import { AnyFunction, MarkOptional } from 'ts-essentials';
import { PixelFormat } from './format/PixelFormat.ts';
import { DataProps, FrameSize, StreamKind } from './types.ts';

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
type VideoStreamFields = Omit<MediaStreamFields<VideoStream>, 'isAnamorphic'>;

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
  readonly kind: StreamKind = 'video' as const;
  index: number;
  codec: string;
  profile?: string;
  pixelFormat: Nullable<PixelFormat>;
  frameSize: FrameSize;
  frameRate?: string;
  inputKind: VideoInputKind = 'video' as const;
  sampleAspectRatio: Nullable<string>;
  displayAspectRatio: string;

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

  bitDepth() {
    return this.pixelFormat?.bitDepth ?? 8;
  }

  get isAnamorphic() {
    if (this.sampleAspectRatio === '1:1') {
      return false;
    } else if (this.sampleAspectRatio !== '0:1') {
      return true;
    } else if (this.displayAspectRatio === '0:1') {
      return false;
    }

    return (
      this.displayAspectRatio !==
      `${this.frameSize.width}:${this.frameSize.height}`
    );
  }

  squarePixelFrameSize(resolution: FrameSize): FrameSize {
    let width = this.frameSize.width;
    let height = this.frameSize.height;

    if (this.isAnamorphic) {
      const sar = this.getSampleAspectRatio();
      width = Math.floor(this.frameSize.width * sar);
      height = Math.floor(this.frameSize.height * sar);
    }

    const widthPercent = resolution.width / width;
    const heightPercent = resolution.height / height;
    const minPercent = Math.min(widthPercent, heightPercent);

    return FrameSize.create({
      width: Math.floor(width * minPercent),
      height: Math.floor(height * minPercent),
    });
  }

  private getSampleAspectRatio() {
    if (
      isNull(this.sampleAspectRatio) ||
      isEmpty(this.sampleAspectRatio) ||
      this.sampleAspectRatio === '0:0'
    ) {
      let dar = parseFloat(this.displayAspectRatio);
      if (isNaN(dar)) {
        const [num, den] = this.displayAspectRatio.split(':');
        dar = parseFloat(num) / parseFloat(den);
      }

      const res = this.frameSize.width / this.frameSize.height;
      return dar / res;
    }

    const [num, den] = this.sampleAspectRatio.split(':');
    return parseFloat(num) / parseFloat(den);
  }
}

type StillImageStreamFields = Omit<
  DataProps<StillImageStream>,
  | 'codec'
  | 'kind'
  | 'pixelFormat'
  | 'isAnamorphic'
  | 'sampleAspectRatio'
  | 'displayAspectRatio'
  | 'inputKind'
>;

export class StillImageStream extends VideoStream {
  readonly inputKind: VideoInputKind = 'stillimage' as const;

  private constructor(fields: StillImageStreamFields) {
    super({
      ...fields,
      codec: '',
      sampleAspectRatio: '1:1',
      displayAspectRatio: '1:1',
      pixelFormat: null,
    });
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
  readonly inputKind: VideoInputKind = 'filter' as const;

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
