import type { InputSource } from '../../input/InputSource.ts';
import { InputOption } from './InputOption.ts';

export class RealtimeBufferSizeInputOption extends InputOption {
  constructor(private size: string) {
    super();
  }

  appliesToInput(input: InputSource): boolean {
    return input.type === 'video' || input.type === 'audio';
  }

  options(): string[] {
    return ['-rtbufsize', this.size];
  }
}
