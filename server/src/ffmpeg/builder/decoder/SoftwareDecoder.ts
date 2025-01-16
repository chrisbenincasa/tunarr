import { FrameDataLocation } from '@/ffmpeg/builder/types.ts';
import { BaseDecoder } from './BaseDecoder.ts';

export abstract class SoftwareDecoder extends BaseDecoder {
  protected outputFrameDataLocation: FrameDataLocation =
    FrameDataLocation.Software;
}
