import { BaseFfmpegHardwareCapabilities } from './BaseFfmpegHardwareCapabilities';

export class NoHardwareCapabilities extends BaseFfmpegHardwareCapabilities {
  readonly type = 'none' as const;
  constructor() {
    super();
  }

  canDecode(): Promise<boolean> {
    return Promise.resolve(false);
  }

  canEncode(): Promise<boolean> {
    return Promise.resolve(false);
  }
}
