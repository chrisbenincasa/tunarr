import { GlobalOption } from '@/ffmpeg/builder/options/GlobalOption.js';

export class ExtraHardwareFramesOption extends GlobalOption {
  constructor(private numFrames: number = 64) {
    super();
  }

  options(): string[] {
    return ['-extra_hw_frames', `${this.numFrames}`];
  }
}
