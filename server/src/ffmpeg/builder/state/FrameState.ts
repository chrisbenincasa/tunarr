import { MarkOptional } from 'ts-essentials';
import { Nullable } from '../../../types/util';
import { FrameDataLocation, FrameSize } from '../types';

export type FrameState = {
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
};

// Some fields are always required...
export const DefaultFrameState: Omit<
  FrameState,
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
};

export function FrameState(
  frameState: MarkOptional<FrameState, keyof typeof DefaultFrameState>,
): FrameState {
  return {
    ...DefaultFrameState,
    ...frameState,
  };
}
