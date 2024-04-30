import { BaseDecoder } from '../BaseDecoder.ts';

export class VideoToolboxDecoder extends BaseDecoder {
  readonly name: string = 'implicit_videotoolbox';

  protected outputFrameDataLocation: 'unknown' | 'hardware' | 'software' =
    'software';
}
