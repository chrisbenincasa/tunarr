import { GlobalOption } from '@/ffmpeg/builder/options/GlobalOption.js';
import type { FrameState } from '@/ffmpeg/builder/state/FrameState.js';
import { FrameDataLocation } from '@/ffmpeg/builder/types.js';

export class VaapiHardwareAccelerationOption extends GlobalOption {
  constructor(
    private vaapiDevice: string,
    private canHardwardDecode: boolean,
    private withOpenclDerivation: boolean = false,
  ) {
    super();
  }

  options(): string[] {
    if (this.withOpenclDerivation) {
      // Use named device init so that OpenCL can be derived from the VAAPI
      // device, which is required for hwmap=derive_device=opencl to work.
      const initDevices = [
        '-init_hw_device',
        `vaapi=va:${this.vaapiDevice}`,
        '-init_hw_device',
        'opencl=ocl@va',
      ];
      return this.canHardwardDecode
        ? [...initDevices, '-hwaccel', 'vaapi', '-hwaccel_device', 'va']
        : initDevices;
    }
    return this.canHardwardDecode
      ? ['-hwaccel', 'vaapi', '-vaapi_device', this.vaapiDevice]
      : ['-vaapi_device', this.vaapiDevice];
  }

  nextState(currentState: FrameState): FrameState {
    return currentState.updateFrameLocation(FrameDataLocation.Hardware);
  }
}
