import type { InputSource } from '../../input/InputSource.ts';
import { InputOption } from './InputOption.ts';

export class CopyTimestampInputOption extends InputOption {
  appliesToInput(input: InputSource): boolean {
    return input.type === 'video';
  }

  options(_inputSource: InputSource): string[] {
    return ['-copyts'];
  }
}
