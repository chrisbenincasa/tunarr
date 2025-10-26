import { OutputOption } from '../OutputOption.ts';

export class FrameRateOutputOption extends OutputOption {
  constructor(private frameRate: number) {
    super();
  }

  options(): string[] {
    return ['-r', this.frameRate.toString(10), '-fps_mode', 'cfr'];
  }
}
