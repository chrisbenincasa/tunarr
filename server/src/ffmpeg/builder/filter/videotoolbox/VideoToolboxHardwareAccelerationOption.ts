import { GlobalOption } from '@/ffmpeg/builder/options/GlobalOption.js';

export class VideoToolboxHardwareAccelerationOption extends GlobalOption {
  options(): string[] {
    return ['-hwaccel', 'videotoolbox'];
  }
}
