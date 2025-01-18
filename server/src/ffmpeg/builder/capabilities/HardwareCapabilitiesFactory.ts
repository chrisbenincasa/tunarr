import { ReadableFfmpegSettings } from '@/db/SettingsDB.ts';
import {
  HardwareAccelerationMode,
  TranscodeConfig,
} from '@/db/schema/TranscodeConfig.ts';
import {
  BaseFfmpegHardwareCapabilities,
  FfmpegHardwareCapabilitiesFactory,
} from '@/ffmpeg/builder/capabilities/BaseFfmpegHardwareCapabilities.ts';
import { DefaultHardwareCapabilities } from '@/ffmpeg/builder/capabilities/DefaultHardwareCapabilities.ts';
import { NoHardwareCapabilities } from '@/ffmpeg/builder/capabilities/NoHardwareCapabilities.ts';
import { NvidiaHardwareCapabilitiesFactory } from '@/ffmpeg/builder/capabilities/NvidiaHardwareCapabilitiesFactory.ts';
import { VaapiHardwareCapabilitiesFactory } from '@/ffmpeg/builder/capabilities/VaapiHardwareCapabilitiesFactory.ts';

export class HardwareCapabilitiesFactory
  implements FfmpegHardwareCapabilitiesFactory
{
  constructor(
    private ffmpegSettings: ReadableFfmpegSettings,
    private transcodeConfig: TranscodeConfig,
  ) {}

  async getCapabilities(): Promise<BaseFfmpegHardwareCapabilities> {
    switch (this.transcodeConfig.hardwareAccelerationMode) {
      case HardwareAccelerationMode.None:
        return new NoHardwareCapabilities();
      case HardwareAccelerationMode.Cuda:
        return new NvidiaHardwareCapabilitiesFactory(
          this.ffmpegSettings,
        ).getCapabilities();
      case HardwareAccelerationMode.Qsv:
      case HardwareAccelerationMode.Vaapi:
        return new VaapiHardwareCapabilitiesFactory(
          this.transcodeConfig,
        ).getCapabilities();
      case HardwareAccelerationMode.Videotoolbox:
        return new DefaultHardwareCapabilities();
      default:
        return new NoHardwareCapabilities();
    }
  }
}
