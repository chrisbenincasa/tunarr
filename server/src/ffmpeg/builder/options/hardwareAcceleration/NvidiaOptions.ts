import { ConstantGlobalOption } from '../GlobalOption.ts';

export class CudaHardwareAccelerationOption extends ConstantGlobalOption {
  constructor() {
    super(['-hwaccel', 'cuda']);
  }
}
