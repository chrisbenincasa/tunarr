import { ConstantGlobalOption } from '@/ffmpeg/builder/options/GlobalOption.js';

export class CudaHardwareAccelerationOption extends ConstantGlobalOption {
  constructor(initVulkanDevice: boolean) {
    if (initVulkanDevice) {
      super([
        '-init_hw_device',
        'cuda=nv',
        '-init_hw_device',
        'vulkan=vk@nv',
        '-hwaccel',
        'vulkan',
      ]);
    } else {
      super(['-init_hw_device', 'cuda', '-hwaccel', 'cuda']);
    }
  }
}
