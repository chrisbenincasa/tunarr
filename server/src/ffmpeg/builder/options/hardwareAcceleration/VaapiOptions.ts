import { FrameState } from '../../state/FrameState.ts';
import { GlobalOption } from '../GlobalOption.ts';

export class VaapiHardwareAccelerationOption extends GlobalOption {
  constructor(
    private vaapiDevice: string,
    private canHardwardDecode: boolean,
  ) {
    super();
  }

  options(): string[] {
    return this.canHardwardDecode
      ? ['-hwaccel', 'vaapi', '-vaapi_device', this.vaapiDevice]
      : ['-vaapi_device', this.vaapiDevice];
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.updateFrameLocation('hardware');
  }
}
