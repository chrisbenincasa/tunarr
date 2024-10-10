import { Maybe } from '../../../types/util';
import { FFMPEGInfo } from '../../ffmpegInfo';
import { PixelFormat } from '../format/PixelFormat';
import { NvidiaHardwareCapabilities } from './NvidiaHardwareCapabilities';

export abstract class BaseFfmpegHardwareCapabilities {
  readonly type: string;
  constructor(protected ffmpegInfo: FFMPEGInfo) {}

  abstract canDecode(
    videoFormat: string,
    videoProfile: Maybe<string>,
    pixelFormat: Maybe<PixelFormat>,
  ): Promise<boolean>;

  abstract canEncode(
    videoFormat: string,
    videoProfile: Maybe<string>,
    pixelFormat: Maybe<PixelFormat>,
  ): Promise<boolean>;
}

export type FfmpegHardwareCapabilities = NvidiaHardwareCapabilities;
