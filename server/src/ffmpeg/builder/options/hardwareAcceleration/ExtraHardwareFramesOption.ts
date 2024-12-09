import { GlobalOption } from '@/ffmpeg/builder/options/GlobalOption.ts';

export class ExtraHardwareFramesOption extends GlobalOption {
  constructor(private numFrames: number = 64) {
    super();
  }

  options(): string[] {
    return ['-extra_hw_frames', `${this.numFrames}`];
  }
}
