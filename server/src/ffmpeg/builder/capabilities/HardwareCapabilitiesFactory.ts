import type { ReadableFfmpegSettings } from '@/db/interfaces/ISettingsDB.js';
import type { TranscodeConfig } from '@/db/schema/TranscodeConfig.js';
import { HardwareAccelerationMode } from '@/db/schema/TranscodeConfig.js';
import type {
  BaseFfmpegHardwareCapabilities,
  FfmpegHardwareCapabilitiesFactory,
} from '@/ffmpeg/builder/capabilities/BaseFfmpegHardwareCapabilities.js';
import { DefaultHardwareCapabilities } from '@/ffmpeg/builder/capabilities/DefaultHardwareCapabilities.js';
import { NoHardwareCapabilities } from '@/ffmpeg/builder/capabilities/NoHardwareCapabilities.js';
import { NvidiaHardwareCapabilitiesFactory } from '@/ffmpeg/builder/capabilities/NvidiaHardwareCapabilitiesFactory.js';
import { VaapiHardwareCapabilitiesFactory } from '@/ffmpeg/builder/capabilities/VaapiHardwareCapabilitiesFactory.js';
import { QsvHardwareCapabilitiesFactory } from './QsvHardwareCapabilitiesFactory.ts';

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
      case HardwareAccelerationMode.Vaapi:
        return new VaapiHardwareCapabilitiesFactory(
          this.transcodeConfig,
        ).getCapabilities();
      case HardwareAccelerationMode.Qsv:
        return new QsvHardwareCapabilitiesFactory(
          this.transcodeConfig,
          this.ffmpegSettings,
        ).getCapabilities();
      case HardwareAccelerationMode.Videotoolbox:
        return new DefaultHardwareCapabilities();
      default:
        return new NoHardwareCapabilities();
    }
  }
}
