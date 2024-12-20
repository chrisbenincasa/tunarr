import { TranscodeConfig } from '@/db/schema/TranscodeConfig.ts';
import {
  BaseFfmpegHardwareCapabilities,
  FfmpegHardwareCapabilitiesFactory,
} from '@/ffmpeg/builder/capabilities/BaseFfmpegHardwareCapabilities.ts';
import { DefaultHardwareCapabilities } from '@/ffmpeg/builder/capabilities/DefaultHardwareCapabilities.ts';
import { NoHardwareCapabilities } from '@/ffmpeg/builder/capabilities/NoHardwareCapabilities.ts';
import { NvidiaHardwareCapabilitiesFactory } from '@/ffmpeg/builder/capabilities/NvidiaHardwareCapabilitiesFactory.ts';
import { VaapiHardwareCapabilitiesFactory } from '@/ffmpeg/builder/capabilities/VaapiHardwareCapabilitiesFactory.ts';
import { FfmpegSettings } from '@tunarr/types';

export class HardwareCapabilitiesFactory
  implements FfmpegHardwareCapabilitiesFactory
{
  constructor(
    private ffmpegSettings: FfmpegSettings,
    private transcodeConfig: TranscodeConfig,
  ) {}

  async getCapabilities(): Promise<BaseFfmpegHardwareCapabilities> {
    switch (this.transcodeConfig.hardwareAccelerationMode) {
      case 'none':
        return new NoHardwareCapabilities();
      case 'cuda':
        return new NvidiaHardwareCapabilitiesFactory(
          this.ffmpegSettings,
        ).getCapabilities();
      case 'qsv':
      case 'vaapi':
        return new VaapiHardwareCapabilitiesFactory(
          this.transcodeConfig,
        ).getCapabilities();
      case 'videotoolbox':
        return new DefaultHardwareCapabilities();
    }
  }
}
