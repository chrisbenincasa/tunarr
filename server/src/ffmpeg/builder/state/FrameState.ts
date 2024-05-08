import { MarkOptional } from 'ts-essentials';
import { Nullable } from '../../../types/util';
import { DataProps, FrameDataLocation, FrameSize } from '../types';
import { merge } from 'lodash-es';
import { PixelFormat } from '../format/PixelFormat';

type FrameStateFields = DataProps<FrameState>;

// Some fields are always required...
export const DefaultFrameState: Omit<
  FrameStateFields,
  'scaledSize' | 'paddedSize' | 'isAnamorphic'
> = {
  realtime: false,
  videoFormat: 'mpeg2video',
  frameRate: null,
  videoTrackTimescale: null,
  videoBitrate: null,
  videoBufferSize: null,
  frameDataLocation: 'unknown',
  interlaced: false,
  pixelFormat: null,
  bitDepth: 8,
};

export class FrameState {
  scaledSize: FrameSize;
  paddedSize: FrameSize;
  isAnamorphic: boolean;
  realtime: boolean;
  videoFormat: string;
  frameRate: Nullable<number>;
  videoTrackTimescale: Nullable<number>;
  videoBitrate: Nullable<number>;
  videoBufferSize: Nullable<number>;
  frameDataLocation: FrameDataLocation;
  interlaced: boolean;
  pixelFormat: Nullable<PixelFormat>;

  constructor(
    fields: MarkOptional<FrameStateFields, keyof typeof DefaultFrameState>,
  ) {
    merge(this, fields);
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
