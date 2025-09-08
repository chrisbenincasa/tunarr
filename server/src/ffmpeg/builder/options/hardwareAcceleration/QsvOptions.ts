import { GlobalOption } from '@/ffmpeg/builder/options/GlobalOption.js';
import type { Nullable } from '@/types/util.js';
import { isNonEmptyString } from '@/util/index.js';
import os from 'node:os';
import { HardwareAccelerationMode } from '../../../../db/schema/TranscodeConfig.ts';

export class QsvHardwareAccelerationOption extends GlobalOption {
  constructor(
    private qsvDevice: Nullable<string>,
    private decodeMode: HardwareAccelerationMode,
  ) {
    super();
  }

  options(): string[] {
    const initDevice =
      os.type().toLowerCase() === 'windows_nt'
        ? 'qsv=hw'
        : 'qsv=hw:hw,child_device_type=vaapi';
    const initDeviceOpts = [
      '-init_hw_device',
      initDevice,
      '-filter_hw_device',
      'hw',
    ];

    const result = ['-hwaccel', 'qsv', '-hwaccel_output_format', 'qsv'];

    if (this.decodeMode !== HardwareAccelerationMode.Qsv) {
      result.length = 0;
    }

    if (os.type().toLowerCase() == 'linux') {
      if (isNonEmptyString(this.qsvDevice)) {
        result.push('-qsv_device', this.qsvDevice);
      }
    }

    return [...result, ...initDeviceOpts];
  }
}
