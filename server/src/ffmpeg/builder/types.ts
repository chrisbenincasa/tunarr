import type { ExcludeByValueType, TupleToUnion } from '@/types/util.js';
import type { Resolution } from '@tunarr/types';
import type { AnyFunction } from 'ts-essentials';

export type DataProps<T> = ExcludeByValueType<T, AnyFunction>;

export const StreamKinds = [
  'audio',
  'video',
  'all',
  'stillimage',
  'subtitle',
] as const;

export type StreamKind = TupleToUnion<typeof StreamKinds>;

export const FrameDataLocations = ['unknown', 'hardware', 'software'] as const;

export const FrameDataLocation: Record<
  Capitalize<FrameDataLocation>,
  FrameDataLocation
> = {
  Hardware: 'hardware',
  Software: 'software',
  Unknown: 'unknown',
} as const;

export type FrameDataLocation = TupleToUnion<typeof FrameDataLocations>;

type FrameSizeFields = DataProps<FrameSize>;

export class FrameSize {
  width: number;
  height: number;

  private constructor(fields: FrameSizeFields) {
    this.width = fields.width;
    this.height = fields.height;
  }

  static create(fields: FrameSizeFields) {
    return new FrameSize(fields);
  }

  static fromResolution(resolution: Resolution) {
    return this.create({
      width: resolution.widthPx,
      height: resolution.heightPx,
    });
  }

  // Prefer create above
  static withDimensions(width: number, height: number) {
    return this.create({ width, height });
  }

  equals({ width: otherWidth, height: otherHeight }: FrameSize) {
    return this.width === otherWidth && this.height === otherHeight;
  }

  ensureEven(): this {
    this.width = this.width + (this.width % 2);
    this.height = this.height + (this.height % 2);
    return this;
  }

  toString(): string {
    return `FrameSize (width = ${this.width}, height = ${this.height})`;
  }

  public static SevenTwenty = FrameSize.withDimensions(1280, 720);
  public static FHD = FrameSize.withDimensions(1920, 1080);
  public static FourK = FrameSize.withDimensions(3840, 2160);
  public static SVGA43 = FrameSize.withDimensions(800, 600);
}

export enum RateControlMode {
  CBR,
  CQP,
  VBR,
}
