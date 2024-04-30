import { GlobalOption } from '../../options/GlobalOption.ts';

export class VideoToolboxHardwareAccelerationOption extends GlobalOption {
  options(): string[] {
    return ['-hwaccel', 'videotoolbox'];
  }
}
