import {
  PixelFormatUnknown,
  type PixelFormat,
} from '@/ffmpeg/builder/format/PixelFormat.js';
import type { DataProps, FrameSize } from '@/ffmpeg/builder/types.js';
import { FrameDataLocation } from '@/ffmpeg/builder/types.js';
import type { Nullable } from '@/types/util.js';
import { isEqual, merge } from 'lodash-es';
import type { MarkOptional } from 'ts-essentials';
import type { VideoFormat } from '../constants.ts';

type FrameStateFields = DataProps<FrameState>;

// Some fields are always required...
export const DefaultFrameState: Omit<
  FrameStateFields,
  'scaledSize' | 'paddedSize' | 'isAnamorphic'
> = {
  realtime: false,
  videoFormat: 'h264',
  videoPreset: null,
  videoProfile: null,
  frameRate: null,
  videoTrackTimescale: null,
  videoBitrate: null,
  videoBufferSize: null,
  frameDataLocation: FrameDataLocation.Unknown,
  deinterlace: false,
  pixelFormat: null,
  bitDepth: 8,
  forceSoftwareOverlay: false,
  infiniteLoop: false,
};

export class FrameState {
  scaledSize: FrameSize;
  paddedSize: FrameSize;
  croppedSize?: FrameSize;
  isAnamorphic: boolean;
  realtime: boolean;
  videoFormat: VideoFormat;
  videoPreset: Nullable<string>;
  videoProfile: Nullable<string>;
  frameRate: Nullable<number>;
  videoTrackTimescale: Nullable<number>;
  videoBitrate: Nullable<number>;
  videoBufferSize: Nullable<number>;
  frameDataLocation: FrameDataLocation;
  deinterlace: boolean;
  pixelFormat: Nullable<PixelFormat>;
  infiniteLoop: boolean = false;

  forceSoftwareOverlay = false;

  constructor(
    fields: MarkOptional<FrameStateFields, keyof typeof DefaultFrameState>,
  ) {
    merge(this, DefaultFrameState, fields);
  }

  get bitDepth() {
    return this.pixelFormat?.bitDepth ?? 8;
  }

  update(fields: Partial<FrameStateFields>) {
    return new FrameState({ ...this, ...fields });
  }

  updateFrameLocation(location: FrameDataLocation) {
    if (this.frameDataLocation !== location) {
      return this.update({ frameDataLocation: location });
    }

    return this;
  }

  pixelFormatOrUnknown() {
    return this.pixelFormat ?? PixelFormatUnknown(this.bitDepth);
  }

  equals(other: FrameState): boolean {
    return this === other || isEqual(this, other);
  }
}
