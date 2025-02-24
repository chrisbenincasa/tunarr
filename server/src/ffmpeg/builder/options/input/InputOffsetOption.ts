import { InputOption } from './InputOption.ts';

export class InputOffsetOption extends InputOption {
  constructor(private durationSeconds: number) {
    super();
  }

  options(): string[] {
    return ['-itsoffset', `${this.durationSeconds}s`];
  }

  appliesToInput(): boolean {
    return true;
  }
}
