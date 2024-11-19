import { PixelFormat } from '@/ffmpeg/builder/format/PixelFormat.ts';
import {
  DataProps,
  FrameDataLocation,
  FrameSize,
} from '@/ffmpeg/builder/types.ts';
import { Nullable } from '@/types/util.ts';
import { merge } from 'lodash-es';
import { MarkOptional } from 'ts-essentials';

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
  deinterlaced: true,
  pixelFormat: null,
  bitDepth: 8,
};

export class FrameState {
  scaledSize: FrameSize;
  paddedSize: FrameSize;
  croppedSize?: FrameSize;
  isAnamorphic: boolean;
  realtime: boolean;
  videoFormat: string;
  videoPreset: Nullable<string>;
  videoProfile: Nullable<string>;
  frameRate: Nullable<number>;
  videoTrackTimescale: Nullable<number>;
  videoBitrate: Nullable<number>;
  videoBufferSize: Nullable<number>;
  frameDataLocation: FrameDataLocation;
  deinterlaced: boolean;
  pixelFormat: Nullable<PixelFormat>;

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
}
