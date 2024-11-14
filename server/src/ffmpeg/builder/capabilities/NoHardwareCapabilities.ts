import { BaseFfmpegHardwareCapabilities } from './BaseFfmpegHardwareCapabilities.ts';

export class NoHardwareCapabilities extends BaseFfmpegHardwareCapabilities {
  readonly type = 'none' as const;
  constructor() {
    super();
  }

  canDecode(): boolean {
    return false;
  }

  canEncode(): boolean {
    return false;
  }
}
