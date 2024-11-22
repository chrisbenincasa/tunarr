import { Maybe } from '@/types/util.ts';

export interface Equatable<T> {
  equals(other: T): boolean;
}

export const PixelFormats = {
  ARGB: 'argb',
  YUV420P: 'yuv420p',
  YUVA420P: 'yuva420p',
  YUV420P10LE: 'yuv420p10le',
  YUV444P: 'yuv444p',
  YUV444P10LE: 'yuv444p10le',
  Unknown: 'unknown',
} as const;

export const FfmpegPixelFormats = {
  ...PixelFormats,
  // Hardware types
  NV12: 'nv12',
  VAAPI: 'vaapi',
  P010LE: 'p010le',
} as const;

export const ValidWrapperPixelFormats = {
  // TODO: Should we support others?
  NV12: 'nv12',
} as const;

type ValidPixelFormatName = (typeof PixelFormats)[keyof typeof PixelFormats];
type ValidFfmpegPixelFormat =
  (typeof FfmpegPixelFormats)[keyof typeof FfmpegPixelFormats];
type ValidWrapperPixelFormat =
  (typeof ValidWrapperPixelFormats)[keyof typeof ValidWrapperPixelFormats];

interface PixelFormatEquals extends Equatable<PixelFormat> {}

export interface PixelFormat extends PixelFormatEquals {
  name: ValidPixelFormatName;
  // Name used in the generated ffmpeg command
  ffmpegName: ValidFfmpegPixelFormat;
  bitDepth: number;
  unwrap(): Maybe<PixelFormat>;
  wrap(wrapperFmt: ValidWrapperPixelFormat): HardwarePixelFormat;
}

export abstract class BasePixelFormat implements PixelFormat {
  name: ValidPixelFormatName;
  ffmpegName: ValidFfmpegPixelFormat;
  bitDepth: number;

  // If a hardware format, returns the underlying pixel format, if
  // available
  unwrap(): Maybe<PixelFormat> {
    return this;
  }

  wrap(wrapperFmt: ValidWrapperPixelFormat): HardwarePixelFormat {
    if (this instanceof HardwarePixelFormat) {
      return this;
    }
    switch (wrapperFmt) {
      case ValidWrapperPixelFormats.NV12:
        return new PixelFormatNv12(this.name);
    }
  }

  equals(other: PixelFormat): boolean {
    return (
      this.name === other.name &&
      this.ffmpegName === other.ffmpegName &&
      this.bitDepth === other.bitDepth
    );
  }
}

export function PixelFormatUnknown(bitDepth: number = 8): BasePixelFormat {
  return new (class extends BasePixelFormat {
    name = 'unknown' as const;
    ffmpegName = 'unknown' as const;
    bitDepth: number = bitDepth;
  })();
}

export class PixelFormatYuv420P extends BasePixelFormat {
  readonly name = PixelFormats.YUV420P;
  readonly ffmpegName = FfmpegPixelFormats.YUV420P;
  readonly bitDepth: number = 8;
}

export class PixelFormatYuv444P extends BasePixelFormat {
  readonly name = PixelFormats.YUV444P;
  readonly ffmpegName = FfmpegPixelFormats.YUV444P;
  readonly bitDepth: number = 8;
}

export class PixelFormatYuva420P extends BasePixelFormat {
  readonly name = PixelFormats.YUVA420P;
  readonly ffmpegName = FfmpegPixelFormats.YUVA420P;
  readonly bitDepth: number = 8;
}

export class PixelFormatYuv420P10Le extends BasePixelFormat {
  readonly name = PixelFormats.YUV420P10LE;
  readonly ffmpegName = FfmpegPixelFormats.YUV420P10LE;
  readonly bitDepth: number = 8;
}

abstract class HardwarePixelFormat extends BasePixelFormat {
  unwrap(): Maybe<PixelFormat> {
    return KnownPixelFormats.forPixelFormat(this.name);
  }
}

// HW decoders output this (in general) when decoding 8-bit inputs
export class PixelFormatNv12 extends HardwarePixelFormat {
  constructor(public readonly name: ValidPixelFormatName) {
    super();
  }

  readonly ffmpegName = FfmpegPixelFormats.NV12;
  readonly bitDepth: number = 8;
}

// Special-case frames for VA-API
export class PixelFormatVaapi extends HardwarePixelFormat {
  readonly ffmpegName = FfmpegPixelFormats.VAAPI;

  constructor(
    public readonly name: ValidPixelFormatName,
    public readonly bitDepth: number,
  ) {
    super();
  }
}

// HW decoders output this (in general) when decoding 10-bit inputs
export class PixelFormatP010Le extends HardwarePixelFormat {
  constructor(public readonly name: ValidPixelFormatName) {
    super();
  }

  readonly ffmpegName = FfmpegPixelFormats.P010LE;
  readonly bitDepth: number = 10;
}

export class KnownPixelFormats {
  static forPixelFormat(name: string) {
    switch (name) {
      case PixelFormats.YUV420P:
        return new PixelFormatYuv420P();
      case PixelFormats.YUV420P10LE:
        return new PixelFormatYuv420P10Le();
      case PixelFormats.YUVA420P:
        return new PixelFormatYuva420P();
      default:
        return;
    }
  }
}
