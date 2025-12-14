import type { ExcludeByValueType, Nullable } from '@/types/util.js';
import { isNonEmptyString } from '@tunarr/shared/util';
import { isEmpty, isNull, merge, nth } from 'lodash-es';
import type { AnyFunction, MarkOptional, StrictOmit } from 'ts-essentials';
import { VideoFormats } from './constants.ts';
import { PixelFormatUnknown, type PixelFormat } from './format/PixelFormat.ts';
import type { DataProps, StreamKind } from './types.ts';
import { FrameSize } from './types.ts';

export type MediaStream = {
  index: number;
  codec: string;
  readonly kind: StreamKind;
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
type VideoStreamFields = StrictOmit<
  MediaStreamFields<VideoStream>,
  'isAnamorphic' | 'sampleAspectRatio'
>;

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
  providedSampleAspectRatio: Nullable<string>;
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

  get sampleAspectRatio(): string {
    const inputSar = this.providedSampleAspectRatio;
    if (isNull(inputSar) || isEmpty(inputSar) || inputSar === '0:0') {
      let dar = parseFloat(this.displayAspectRatio);
      if (isNaN(dar)) {
        const [num, den] = this.displayAspectRatio.split(':');
        dar = parseFloat(num!) / parseFloat(den!);
      }

      const res = this.frameSize.width / this.frameSize.height;
      const formattedDar = Number.isInteger(dar)
        ? dar.toString()
        : dar.toFixed(12);
      const formattedRes = Number.isInteger(res)
        ? res.toString()
        : res.toFixed(12);
      return `${formattedDar}:${formattedRes}`;
    }

    const [num, den] = inputSar.split(':').map((s) => parseFloat(s));
    const formattedNum = Number.isInteger(num)
      ? num!.toString()
      : num!.toFixed(12);
    const formattedDen = Number.isInteger(den)
      ? den!.toString()
      : den!.toFixed(12);
    return `${formattedNum}:${formattedDen}`;
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
        dar = parseFloat(num!) / parseFloat(den!);
      }

      const res = this.frameSize.width / this.frameSize.height;
      return dar / res;
    }

    const [num, den] = this.sampleAspectRatio.split(':');
    return parseFloat(num!) / parseFloat(den!);
  }

  getNumericFrameRateOrDefault(defaultRate: number = 24) {
    let frameRate = defaultRate;
    if (isNonEmptyString(this.frameRate)) {
      const intParsed = parseInt(this.frameRate);
      if (isNaN(intParsed)) {
        const parts = this.frameRate.split('/');
        const numerator = nth(parts, 0);
        const denominator = nth(parts, 1);
        let rate = 24;
        if (isNonEmptyString(numerator) && isNonEmptyString(denominator)) {
          const numeratorInt = parseInt(numerator);
          const denominatorInt = parseInt(denominator);
          if (!isNaN(numeratorInt) && !isNaN(denominatorInt)) {
            rate = Math.round(numeratorInt / denominatorInt);
          }
        }
        frameRate = rate;
      }
    }

    return frameRate;
  }
}

type StillImageStreamFields = MarkOptional<
  StrictOmit<
    DataProps<StillImageStream>,
    | 'codec'
    | 'kind'
    | 'isAnamorphic'
    | 'providedSampleAspectRatio'
    | 'sampleAspectRatio'
    | 'displayAspectRatio'
    | 'inputKind'
  >,
  'pixelFormat'
>;

export class StillImageStream extends VideoStream {
  readonly inputKind: VideoInputKind = 'stillimage' as const;

  private constructor(fields: StillImageStreamFields) {
    super({
      codec: VideoFormats.Undetermined,
      providedSampleAspectRatio: '1:1',
      displayAspectRatio: '1:1',
      ...fields,
      pixelFormat: fields.pixelFormat ?? PixelFormatUnknown(),
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

export type SubtitleInputKind = 'embedded' | 'external';

const ImageBasedSubtitles = [
  'hdmv_pgs_subtitle',
  'dvd_subtitle',
  'dvdsub',
  'vobsub',
  'pgssub',
  'pgs',
];

export const SubtitleMethods = {
  None: 'none',
  Burn: 'burn',
  Convert: 'convert',
  Copy: 'copy',
} as const;

export type SubtitleMethod =
  (typeof SubtitleMethods)[keyof typeof SubtitleMethods];

export abstract class SubtitleStream implements MediaStream {
  readonly kind: 'subtitle';
  readonly inputKind: SubtitleInputKind;

  constructor(
    public readonly codec: string,
    public readonly index: number,
    public readonly method: SubtitleMethod,
  ) {}

  get isImageBased() {
    return ImageBasedSubtitles.includes(this.codec);
  }
}

export class EmbeddedSubtitleStream extends SubtitleStream {
  readonly kind = 'subtitle' as const;
  readonly inputKind: SubtitleInputKind = 'embedded';
}

export class ExternalSubtitleStream extends SubtitleStream {
  readonly kind = 'subtitle' as const;
  readonly inputKind: SubtitleInputKind = 'external';

  constructor(codec: string, method: SubtitleMethod) {
    super(codec, 0, method);
  }
}
