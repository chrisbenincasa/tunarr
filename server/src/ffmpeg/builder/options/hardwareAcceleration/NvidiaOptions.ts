import { ConstantGlobalOption } from '@/ffmpeg/builder/options/GlobalOption.js';

export class CudaHardwareAccelerationOption extends ConstantGlobalOption {
  constructor() {
    super(['-hwaccel', 'cuda']);
  }
}
