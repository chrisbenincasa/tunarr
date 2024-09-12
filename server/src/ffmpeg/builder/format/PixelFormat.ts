export interface Equatable<T> {
  equals(other: T): boolean;
}

interface PixelFormatEquals extends Equatable<PixelFormat> {}

export interface PixelFormat extends PixelFormatEquals {
  name: string;
  // Name used in the generated ffmpeg command
  ffmpegName: string;
  bitDepth: number;
}

export abstract class BasePixelFormat implements PixelFormat {
  name: string;
  ffmpegName: string;
  bitDepth: number;

  equals(other: PixelFormat): boolean {
    return (
      this.name === other.name &&
      this.ffmpegName === other.ffmpegName &&
      this.bitDepth === other.bitDepth
    );
  }
}

export const PixelFormats = {
  ARGB: 'argb',
  YUV420P: 'yuv420p',
  YUV420PLe: 'yuv240ple',
  NV12: 'nv12',
} as const;

export const FfmpegPixelFormats = {
  ARGB: 'argb',
  YUV420P: 'yuv420p',
  YUV420PLe: 'yuv240ple',
  NV12: 'nv12',
} as const;

export function PixelFormatUnknown(bitDepth: number = 8): BasePixelFormat {
  return new (class extends BasePixelFormat {
    name: string = 'unknown';
    ffmpegName: string = 'unknown';
    bitDepth: number = bitDepth;
  })();
}

export class PixelFormatYuv420P extends BasePixelFormat {
  readonly name: string = PixelFormats.YUV420P;
  readonly ffmpegName: string = FfmpegPixelFormats.YUV420P;
  readonly bitDepth: number = 8;
}

export class PixelFormatYuv420P10Le extends BasePixelFormat {
  readonly name: string = PixelFormats.YUV420PLe;
  readonly ffmpegName: string = FfmpegPixelFormats.YUV420PLe;
  readonly bitDepth: number = 8;
}

export class PixelFormatNv12 extends BasePixelFormat {
  readonly name: string = PixelFormats.NV12;
  readonly ffmpegName: string = 'nv12';
  readonly bitDepth: number = 8;
}
