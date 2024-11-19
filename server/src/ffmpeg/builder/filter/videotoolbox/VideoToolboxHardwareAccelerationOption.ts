import { GlobalOption } from '@/ffmpeg/builder/options/GlobalOption.ts';

export class VideoToolboxHardwareAccelerationOption extends GlobalOption {
  options(): string[] {
    return ['-hwaccel', 'videotoolbox'];
  }
}
