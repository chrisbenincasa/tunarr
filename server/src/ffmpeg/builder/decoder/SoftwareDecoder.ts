import { FrameDataLocation } from '@/ffmpeg/builder/types.js';
import { BaseDecoder } from './BaseDecoder.ts';

export abstract class SoftwareDecoder extends BaseDecoder {
  protected _outputFrameDataLocation: FrameDataLocation =
    FrameDataLocation.Software;
}
