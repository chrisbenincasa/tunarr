import { FrameDataLocation } from '../types.ts';
import { BaseDecoder } from './BaseDecoder.ts';

export class VulkanDecoder extends BaseDecoder {
  readonly name = 'implicit_vulkan';
  protected _outputFrameDataLocation = FrameDataLocation.Hardware;

  options(): string[] {
    return ['-hwaccel_output_format', 'vulkan'];
  }
}
