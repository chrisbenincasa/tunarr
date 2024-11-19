import { ConstantGlobalOption } from '@/ffmpeg/builder/options/GlobalOption.ts';

export class CudaHardwareAccelerationOption extends ConstantGlobalOption {
  constructor() {
    super(['-hwaccel', 'cuda']);
  }
}
