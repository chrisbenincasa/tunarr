import { ConstantGlobalOption } from '../GlobalOption';

export class CudaHardwareAccelerationOption extends ConstantGlobalOption {
  constructor() {
    super(['-hwaccel', 'cuda']);
  }
}
