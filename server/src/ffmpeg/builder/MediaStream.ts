import type { DataProps, ExcludeByValueType, Nullable } from '@/types/util.js';
import { isNonEmptyString } from '@tunarr/shared/util';
import { merge, nth } from 'lodash-es';
import type { AnyFunction, MarkOptional, StrictOmit } from 'ts-essentials';
import { VideoFormats } from './constants.ts';
import { ColorFormat } from './format/ColorFormat.js';
import { PixelFormatUnknown, type PixelFormat } from './format/PixelFormat.ts';
import type { StreamKind } from './types.ts';
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
export type VideoStreamFields = StrictOmit<
  MediaStreamFields<VideoStream>,
  'isAnamorphic' | 'sampleAspectRatio'
>;

// Real anamorphic SARs (8:9, 10:11, 32:27, 4:3) sit well outside this band.
// Rounded DARs such as "1.78" on 1920x1080 sit inside it.
const SquarePixelTolerance = 0.01;

// Parses "N:M" or a decimal string. Returns undefined unless the ratio is a
// positive finite number, so ffprobe's "0:0" and "0:1" read as unknown.
function parseRatio(value: Nullable<string> | undefined): number | undefined {
  if (!isNonEmptyString(value)) {
    return;
  }

  const [num, den] = value.split(':');
  const ratio =
    den === undefined
      ? parseFloat(value)
      : parseFloat(num ?? '') / parseFloat(den);
  return Number.isFinite(ratio) && ratio > 0 ? ratio : undefined;
}

function formatRatioPart(n: number) {
  return Number.isInteger(n) ? n.toString() : n.toFixed(12);
}

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
  index!: number;
  codec!: string;
  profile?: string;
  pixelFormat!: Nullable<PixelFormat>;
  frameSize!: FrameSize;
  frameRate?: string;
  inputKind: VideoInputKind = 'video' as const;
  colorFormat!: Nullable<ColorFormat>;
  providedSampleAspectRatio!: Nullable<string>;
  displayAspectRatio!: string;

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

  isHdr() {
    return this.colorFormat?.isHdr ?? false;
  }

  isDolbyVision(): boolean {
    return (
      this.codec === VideoFormats.Dvhe ||
      this.codec === VideoFormats.Dvh1 ||
      (this.profile?.toLowerCase().includes('dolby vision') ?? false)
    );
  }

  get sampleAspectRatio(): string {
    const inputSar = this.providedSampleAspectRatio;
    if (isNonEmptyString(inputSar) && parseRatio(inputSar) !== undefined) {
      const [num, den] = inputSar.split(':');
      const formattedDen =
        den === undefined ? '1' : formatRatioPart(parseFloat(den));
      return `${formatRatioPart(parseFloat(num ?? ''))}:${formattedDen}`;
    }

    const dar = parseRatio(this.displayAspectRatio);
    if (dar === undefined) {
      return '1:1';
    }

    const res = this.frameSize.width / this.frameSize.height;
    return `${formatRatioPart(dar)}:${formatRatioPart(res)}`;
  }

  get isAnamorphic() {
    return Math.abs(this.getSampleAspectRatio() - 1) > SquarePixelTolerance;
  }

  squarePixelFrameSize(resolution: FrameSize): FrameSize {
    // SAR stretches the stored width to its display width. Height is unchanged.
    const width = this.isAnamorphic
      ? this.frameSize.width * this.getSampleAspectRatio()
      : this.frameSize.width;
    const height = this.frameSize.height;

    const widthPercent = resolution.width / width;
    const heightPercent = resolution.height / height;
    const minPercent = Math.min(widthPercent, heightPercent);

    return FrameSize.create({
      width: Math.round(width * minPercent),
      height: Math.round(height * minPercent),
    });
  }

  // A missing, zero, or unparseable SAR is derived from the DAR. Without a
  // usable DAR either, pixels are assumed square.
  private getSampleAspectRatio(): number {
    const providedSar = parseRatio(this.providedSampleAspectRatio);
    if (providedSar !== undefined) {
      return providedSar;
    }

    const dar = parseRatio(this.displayAspectRatio);
    if (dar === undefined) {
      return 1;
    }

    return dar / (this.frameSize.width / this.frameSize.height);
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
    | 'colorFormat'
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
      colorFormat: ColorFormat.unknown, // TODO: Is this necessary
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
class SyntheticVideoStream extends VideoStream {
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
  readonly kind: 'subtitle' = 'subtitle' as const;
  abstract readonly inputKind: SubtitleInputKind;

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
  readonly inputKind: SubtitleInputKind = 'embedded';
}

export class ExternalSubtitleStream extends SubtitleStream {
  readonly inputKind: SubtitleInputKind = 'external';

  constructor(codec: string, method: SubtitleMethod) {
    super(codec, 0, method);
  }
}
