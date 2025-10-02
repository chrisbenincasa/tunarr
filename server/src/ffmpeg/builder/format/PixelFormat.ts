import type { Maybe } from '@/types/util.js';

export interface Equatable<T> {
  equals(other: T): boolean;
}

export const PixelFormats = {
  ARGB: 'argb',
  RGBA: 'rgba',
  YUV420P: 'yuv420p',
  YUVA420P: 'yuva420p',
  YUV420P10LE: 'yuv420p10le',
  YUV444P: 'yuv444p',
  YUV444P10LE: 'yuv444p10le',
  YUV444P16LE: 'yuv444p16le',
  Unknown: 'unknown',
  // Hardware types
  NV12: 'nv12',
  VAAPI: 'vaapi',
  P010: 'p010le',
  CUDA: 'cuda',
} as const;

export const ValidHardwarePixelFormats = {
  // TODO: Should we support others?
  NV12: 'nv12',
  P010LE: 'p010le',
  P016LE: 'p016',
} as const;

export type ValidPixelFormatName =
  (typeof PixelFormats)[keyof typeof PixelFormats];

export interface PixelFormat extends Equatable<PixelFormat> {
  // Name used in the generated ffmpeg command
  name: ValidPixelFormatName;
  bitDepth: number;
  // Some formats have corresponding representations that are
  // used on hardware. For instance, yuv420p === nv12
  // In some scenarios, we need to use the "hardware" version
  // of a format, like when downloading frames from hardware.
  toHardwareFormat(): Maybe<PixelFormat>;
  toSoftwareFormat(): Maybe<PixelFormat>;
  // If the pixel format is "wrapping" another (i.e. nv12 used in the context
  // of another format) then this method will return the underlying format
  // Otherwise, it should return "this"
  unwrap(): PixelFormat;

  prettyPrint(): string;
}

export abstract class BasePixelFormat implements PixelFormat {
  name: ValidPixelFormatName;
  bitDepth: number;

  abstract toHardwareFormat(): Maybe<PixelFormat>;
  abstract toSoftwareFormat(): Maybe<PixelFormat>;

  equals(other: PixelFormat): boolean {
    return this.name === other.name && this.bitDepth === other.bitDepth;
  }

  unwrap(): PixelFormat {
    return this;
  }

  prettyPrint() {
    return `${this.constructor.name}(name=${this.name}, bitDepth=${this.bitDepth})`;
  }
}

export abstract class HardwarePixelFormat extends BasePixelFormat {
  constructor(protected readonly underlying: PixelFormat) {
    super();
  }

  toHardwareFormat(): Maybe<PixelFormat> {
    return this;
  }

  toSoftwareFormat(): Maybe<PixelFormat> {
    return this.underlying;
  }

  unwrap(): PixelFormat {
    return this.underlying;
  }

  equals(other: PixelFormat): boolean {
    return super.equals(other) && this.unwrap().equals(other.unwrap());
  }
}

abstract class SoftwarePixelFormat extends BasePixelFormat {
  toSoftwareFormat(): Maybe<PixelFormat> {
    return this;
  }

  toHardwareFormat(): Maybe<PixelFormat> {
    return;
  }
}

export function PixelFormatUnknown(bitDepth: number = 8): BasePixelFormat {
  return new (class extends SoftwarePixelFormat {
    name = 'unknown' as const;
    bitDepth: number = bitDepth;
    toHardwareFormat(): Maybe<PixelFormat> {
      return;
    }
  })();
}

export class PixelFormatRgba extends SoftwarePixelFormat {
  readonly name = PixelFormats.RGBA;
  readonly bitDepth: number = 8; // Shrug
}

export class PixelFormatYuv420P extends SoftwarePixelFormat {
  readonly name = PixelFormats.YUV420P;
  readonly bitDepth: number = 8;

  toHardwareFormat(): Maybe<PixelFormat> {
    return new PixelFormatNv12(this);
  }
}

export class PixelFormatYuv444P extends SoftwarePixelFormat {
  readonly name = PixelFormats.YUV444P;
  readonly bitDepth: number = 8;
}

export class PixelFormatYuva420P extends SoftwarePixelFormat {
  readonly name = PixelFormats.YUVA420P;
  readonly bitDepth: number = 8;
}

export class PixelFormatYuv420P10Le extends SoftwarePixelFormat {
  readonly name = PixelFormats.YUV420P10LE;
  readonly bitDepth: number = 10;

  toHardwareFormat(): Maybe<PixelFormat> {
    return new PixelFormatP010();
  }
}

export class PixelFormatYuv444P16Le extends SoftwarePixelFormat {
  readonly name = PixelFormats.YUV444P16LE;
  readonly bitDepth: number = 10;
}

// Semi-planar YUV 4:2:0
// HW decoders output this (in general) when decoding 8-bit inputs
export class PixelFormatNv12 extends HardwarePixelFormat {
  readonly name = PixelFormats.NV12;

  readonly bitDepth: number = 8;
}

// Special-case frames for VA-API
export class PixelFormatVaapi extends HardwarePixelFormat {
  constructor(readonly underlying: PixelFormat) {
    super(underlying);
    this.name = this.underlying.name;
    this.bitDepth = this.underlying.bitDepth;
  }
}

// Special-case format for CUDA. Represnts "some" form of
// pixel format that is optimized for GPU transcoding (e.g. nv12 or p010)
export class PixelFormatCuda extends HardwarePixelFormat {
  constructor(readonly underlying: PixelFormat) {
    super(underlying);
    this.name = this.underlying.name;
    this.bitDepth = this.underlying.bitDepth;
  }
}

// HW decoders output this (in general) when decoding 10-bit inputs
export class PixelFormatP010 extends HardwarePixelFormat {
  readonly name = PixelFormats.P010;
  readonly bitDepth: number = 10;

  constructor() {
    super(new PixelFormatYuv420P10Le());
  }
}

export class KnownPixelFormats {
  static forPixelFormat(name: KnownPixelFormats) {
    switch (name) {
      case PixelFormats.YUV420P:
        return new PixelFormatYuv420P();
      case PixelFormats.YUV420P10LE:
        return new PixelFormatYuv420P10Le();
      case PixelFormats.YUVA420P:
        return new PixelFormatYuva420P();
      case PixelFormats.YUV444P:
        return new PixelFormatYuv444P();
      case PixelFormats.YUV444P16LE:
        return new PixelFormatYuv444P16Le();
      default:
        return;
    }
  }
}
