import { Nullable } from '../../../../types/util';
import { isNonEmptyString } from '../../../../util';
import { GlobalOption } from '../GlobalOption';
import os from 'node:os';

export class QsvHardwareAccelerationOption extends GlobalOption {
  constructor(private qsvDevice: Nullable<string>) {
    super();
  }

  options(): string[] {
    const initDevice =
      os.type().toLowerCase() === 'windows_nt'
        ? 'd3d11va=hw:,vendor=0x8086'
        : 'qsv=hw:hw,child_device_type=vaapi';
    const initDeviceOpts = [
      '-init_hw_device',
      initDevice,
      '-filter_hw_device',
      'hw',
    ];

    const result = ['-hwaccel', 'qsv', '-hwaccel_output_format', 'qsv'];

    if (os.type().toLowerCase() == 'linux') {
      if (isNonEmptyString(this.qsvDevice)) {
        result.push('-qsv_device', this.qsvDevice);
      }
    }

    return [...result, ...initDeviceOpts];
  }
}
