import { ExcludeByValueType, TupleToUnion } from '@/types/util.ts';
import { Resolution } from '@tunarr/types';
import { AnyFunction } from 'ts-essentials';

export type DataProps<T> = ExcludeByValueType<T, AnyFunction>;

export const HardwareAccelerationModes = [
  'none',
  'qsv',
  'cuda',
  'vaapi',
  'videotoolbox',
  // 'amf',
] as const;

export const HardwareAccelerationMode: Record<
  Capitalize<HardwareAccelerationMode>,
  HardwareAccelerationMode
> = {
  Cuda: 'cuda' as const,
  None: 'none' as const,
  Qsv: 'qsv' as const,
  Videotoolbox: 'videotoolbox' as const,
  Vaapi: 'vaapi' as const,
} as const;

export type HardwareAccelerationMode = TupleToUnion<
  typeof HardwareAccelerationModes
>;

export const StreamKinds = ['audio', 'video', 'all', 'stillimage'] as const;

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

  public static FHD = FrameSize.withDimensions(1920, 1080);
  public static FourK = FrameSize.withDimensions(3840, 2160);
}

export enum RateControlMode {
  CBR,
  CQP,
  VBR,
}
